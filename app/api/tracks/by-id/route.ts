import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get("id")

  if (!trackId) {
    return NextResponse.json({ error: "Track ID required" }, { status: 400 })
  }

  const cookieStore = await cookies()
  let accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value

  console.log("[v0] /api/tracks/by-id invoked for", trackId, "accessToken present:", !!accessToken)

  if (!accessToken) {
    console.error("[v0] No access token cookie present")
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const callSpotifyTrack = async (token: string) => {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response
  }

  try {
    let response = await callSpotifyTrack(accessToken).catch((err) => {
      console.error("[v0] Network error calling Spotify tracks API:", err)
      throw err
    })

    // If unauthorized, try refresh-and-retry
    if (response.status === 401 && refreshToken) {
      try {
        console.log("[v0] Track fetch returned 401, attempting refresh")
        // Refresh using server helper (you should have spotifyApi.refreshAccessToken)
        const { spotifyApi } = await import("@/lib/spotify")
        const tokenData = await spotifyApi.refreshAccessToken(refreshToken)
        if (tokenData && tokenData.access_token) {
          accessToken = tokenData.access_token
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
          response = await callSpotifyTrack(accessToken)
        } else {
          console.error("[v0] refreshAccessToken did not return access_token", tokenData)
          return NextResponse.json({ error: "Failed to refresh access token", details: tokenData }, { status: 401 })
        }
      } catch (err) {
        console.error("[v0] Token refresh failed:", String(err))
        return NextResponse.json({ error: "Token refresh failed", details: String(err) }, { status: 500 })
      }
    }

    const data = await response.json().catch((err) => {
      console.error("[v0] Failed to parse Spotify track response:", err)
      throw err
    })

    if (!response.ok) {
      console.error("[v0] Spotify track fetch returned error:", response.status, data)
      return NextResponse.json({ error: data }, { status: response.status })
    }

    const track = {
      id: data.id,
      name: data.name,
      artist: data.artists?.[0]?.name || "Unknown Artist",
      album: data.album?.name || "Unknown Album",
      year: data.album?.release_date ? new Date(data.album.release_date).getFullYear().toString() : "",
      albumArt: data.album?.images?.[0]?.url || "",
      duration: Math.floor(data.duration_ms / 1000),
      previewUrl: data.preview_url || "",
    }

    return NextResponse.json({ track })
  } catch (error) {
    console.error("[v0] Failed to fetch track:", error)
    return NextResponse.json({ error: "Failed to fetch track", details: String(error) }, { status: 500 })
  }
}
