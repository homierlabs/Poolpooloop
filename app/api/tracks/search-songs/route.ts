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

    // Instrumentation: log presence of tokens and env markers (do NOT log secret values)
    console.log("[v0] /api/tracks/search-songs invoked, q=", query)
    console.log("[v0] spotify_access_token present:", !!accessToken)
    console.log("[v0] spotify_refresh_token present:", !!refreshToken)
    console.log("[v0] SPOTIFY_CLIENT_ID present:", !!process.env.SPOTIFY_CLIENT_ID)
    console.log("[v0] SPOTIFY_CLIENT_SECRET present:", !!process.env.SPOTIFY_CLIENT_SECRET)
    console.log("[v0] NEXT_PUBLIC_REDIRECT_URI:", !!process.env.NEXT_PUBLIC_REDIRECT_URI)

    if (!accessToken) {
      console.error("[v0] No access token cookie present - returning 401")
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
    let response: Response
    try {
      response = await callSpotify(accessToken)
    } catch (err) {
      console.error("[v0] Network/fetch error when calling Spotify search:", String(err))
      return NextResponse.json({ error: "Network error calling Spotify", details: String(err) }, { status: 502 })
    }

    // If 401 and we have a refresh token, attempt refresh and retry once
    if (response.status === 401 && refreshToken) {
      try {
        console.log("[v0] Access token expired (401). Attempting refresh with refresh token.")
        const tokenData = await spotifyApi.refreshAccessToken(refreshToken)
        console.log("[v0] refreshAccessToken returned:", tokenData && typeof tokenData === "object" ? Object.keys(tokenData) : String(tokenData))

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
            console.log("[v0] Persisted new refresh token from Spotify response")
          } else {
            console.log("[v0] No refresh token returned in refresh response")
          }

          // Retry once with new token
          try {
            response = await callSpotify(accessToken)
            console.log("[v0] Retried Spotify search after refresh, status:", response.status)
          } catch (err) {
            console.error("[v0] Network error on retrying Spotify search:", String(err))
            return NextResponse.json({ error: "Network error on retry calling Spotify", details: String(err) }, { status: 502 })
          }
        } else {
          console.error("[v0] refreshAccessToken did not return an access_token", tokenData)
          // Return informative 401 so we can see the failing payload in the client
          return NextResponse.json({ error: "Failed to refresh access token", details: tokenData }, { status: 401 })
        }
      } catch (err) {
        console.error("[v0] Token refresh attempt failed with exception:", String(err))
        return NextResponse.json({ error: "Token refresh failed", details: String(err) }, { status: 500 })
      }
    }

    let data: any
    try {
      data = await response.json()
    } catch (err) {
      console.error("[v0] Failed to JSON-parse Spotify response:", String(err))
      return NextResponse.json({ error: "Failed to parse Spotify response", details: String(err) }, { status: 502 })
    }

    if (!response.ok) {
      console.error("[v0] Spotify search returned error:", response.status, data)
      // Return Spotify's error payload so the client/network tab shows useful info
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

    console.log("[v0] Returning", tracks.length, "tracks for query:", query)
    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("[v0] /api/tracks/search-songs UNEXPECTED error:", error)
    return NextResponse.json({ error: "Search failed", details: String(error) }, { status: 500 })
  }
}
