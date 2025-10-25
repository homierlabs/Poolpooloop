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
      console.error("[v0] No access token cookie present")
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
    let response = await callSpotify(accessToken).catch((err) => {
      console.error("[v0] Network/fetch error when calling Spotify search:", err)
      throw err
    })

    // If 401 and we have a refresh token, attempt refresh and retry once
    if (response.status === 401 && refreshToken) {
      try {
        console.log("[v0] Access token expired, attempting refresh")
        const tokenData = await spotifyApi.refreshAccessToken(refreshToken)

        if (tokenData && tokenData.access_token) {
          accessToken = tokenData.access_token

          // Persist refreshed tokens back to cookies
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

          response = await callSpotify(accessToken)
        } else {
          console.error("[v0] refreshAccessToken returned unexpected payload:", tokenData)
        }
      } catch (err) {
        console.error("[v0] Token refresh attempt failed:", err)
        // Let the original response fall through (or return a specific error)
      }
    }

    const data = await response.json().catch((err) => {
      console.error("[v0] Failed to JSON-parse Spotify response:", err)
      throw err
    })

    if (!response.ok) {
      console.error("[v0] Spotify search returned error:", response.status, data)
      return NextResponse.json({ error: data }, { status: response.status })
    }

    const tracks = (data.tracks?.items || []).map((track: any) => ({
      id: track.id,
      name: track.name,
      artist: (track.artists || []).map((a: any) => a.name).join(", ") || "Unknown Artist",
      albumArt: track.album?.images?.[0]?.url || "/placeholder.svg?height=300&width=300",
      duration: Math.floor(track.duration_ms / 1000),
      previewUrl: track.preview_url || "",
      uri: track.uri,
    }))

    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("[v0] /api/tracks/search-songs failed:", error)
    // Return a safe error for the client to display
    return NextResponse.json({ error: "Search failed", details: String(error) }, { status: 500 })
  }
}
