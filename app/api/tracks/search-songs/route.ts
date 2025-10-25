import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query) {
    return NextResponse.json({ error: "Query parameter required" }, { status: 400 })
  }

  try {
    const cookieStore = await cookies()
    let accessToken = cookieStore.get("spotify_access_token")?.value
    const refreshToken = cookieStore.get("spotify_refresh_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "10",
    })

    const callSpotify = async (token: string) => {
      return fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    }

    // First attempt
    let response = await callSpotify(accessToken)

    // If token expired (401) and we have a refresh token, try to refresh and retry once
    if (response.status === 401 && refreshToken) {
      try {
        const tokenData = await spotifyApi.refreshAccessToken(refreshToken)

        if (tokenData && tokenData.access_token) {
          accessToken = tokenData.access_token

          // Update cookies with the refreshed access token
          cookieStore.set("spotify_access_token", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: tokenData.expires_in ?? 3600,
          })

          if (tokenData.refresh_token) {
            cookieStore.set("spotify_refresh_token", tokenData.refresh_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 60 * 60 * 24 * 30,
            })
          }

          // Retry the Spotify call with new token
          response = await callSpotify(accessToken)
        } else {
          console.error("[v0] refreshAccessToken did not return access_token", tokenData)
        }
      } catch (err) {
        console.error("[v0] Token refresh failed:", err)
      }
    }

    const data = await response.json()

    if (!response.ok) {
      console.error("[v0] Spotify API error:", response.status, data)
      // Bubble up spotify's error message/status to the client for easier debugging
      return NextResponse.json({ error: data }, { status: response.status })
    }

    const tracks = (data.tracks?.items || []).map((track: any) => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0]?.name || "Unknown Artist",
      albumArt: track.album.images[0]?.url || "",
      duration: Math.floor(track.duration_ms / 1000),
      previewUrl: track.preview_url || "",
      uri: track.uri,
    }))

    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("[v0] /api/tracks/search-songs failed:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
