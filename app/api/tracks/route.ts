import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"
import type { Track } from "@/lib/types"

export async function GET() {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value

  console.log("[v0] /api/tracks invoked. accessToken present:", !!accessToken, "refreshToken present:", !!refreshToken)

  if (!accessToken) {
    console.error("[v0] No access token cookie present")
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  async function callTopTracks(token: string) {
    return spotifyApi.getUserTopTracks(token, 50)
  }

  try {
    let topTracksData = await callTopTracks(accessToken)

    // If spotifyApi returned an object with error status and status code 401,
    // or if it threw due to network auth error, attempt to refresh and retry.
    // Some spotifyApi methods return JSON with error property instead of throwing.
    if ((topTracksData && (topTracksData as any).error && (topTracksData as any).error.status === 401) && refreshToken) {
      console.log("[v0] Top tracks call returned 401-like payload, attempting refresh")
      try {
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
            console.log("[v0] Persisted new refresh token")
          }
          topTracksData = await callTopTracks(accessToken)
        } else {
          console.error("[v0] refreshAccessToken did not return access_token:", tokenData)
          return NextResponse.json({ error: "Failed to refresh access token", details: tokenData }, { status: 401 })
        }
      } catch (err) {
        console.error("[v0] Token refresh failed:", String(err))
        return NextResponse.json({ error: "Token refresh failed", details: String(err) }, { status: 500 })
      }
    }

    // If spotifyApi returns an error object
    if (topTracksData && (topTracksData as any).error) {
      const errPayload = (topTracksData as any).error
      console.error("[v0] Spotify getUserTopTracks error:", errPayload)
      return NextResponse.json({ error: errPayload }, { status: errPayload.status || 500 })
    }

    if (!topTracksData?.items || topTracksData.items.length === 0) {
      console.log("[v0] No top tracks found, returning empty array")
      return NextResponse.json({ tracks: [] })
    }

    // Fetch features for all top tracks
    const trackIds = topTracksData.items.map((t: any) => t.id)
    const featuresData = await spotifyApi.getTrackFeatures(accessToken, trackIds).catch((err) => {
      console.error("[v0] getTrackFeatures failed:", err)
      return null
    })

    const tracks: Track[] = topTracksData.items.map((track: any, index: number) => {
      const features = featuresData?.audio_features?.[index] || {}
      return {
        id: track.id,
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(", "),
        album: track.album.name,
        albumArt: track.album.images?.[0]?.url || "/placeholder.svg?height=300&width=300",
        duration: Math.floor(track.duration_ms / 1000),
        previewUrl: track.preview_url,
        uri: track.uri,
        popularity: track.popularity,
        energy: features.energy || 0,
        danceability: features.danceability || 0,
        valence: features.valence || 0,
      }
    })

    console.log("[v0] Returning", tracks.length, "tracks from /api/tracks")
    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("[v0] Failed to fetch tracks:", error)
    return NextResponse.json({ error: "Failed to fetch tracks", details: String(error) }, { status: 500 })
  }
}
