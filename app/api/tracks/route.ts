// FILE: app/api/tracks/route.ts
// PURPOSE: Get user's top tracks from Spotify with audio features
// USAGE: Called on initial load to populate track library

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"
import type { Track } from "@/lib/types"

async function getAccessToken() {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value

  if (!accessToken && !refreshToken) {
    throw new Error("Not authenticated")
  }

  // Refresh token if access token is missing
  if (!accessToken && refreshToken) {
    const tokenData = await spotifyApi.refreshAccessToken(refreshToken)
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
  }

  return accessToken!
}

export async function GET() {
  try {
    const accessToken = await getAccessToken()

    const topTracksData = await spotifyApi.getUserTopTracks(accessToken, 50)

    if (!topTracksData?.items || topTracksData.items.length === 0) {
      console.log("[v0] No top tracks found, returning empty array")
      return NextResponse.json({ tracks: [] })
    }

    // Fetch audio features for all tracks
    const trackIds = topTracksData.items.map((t: any) => t.id)
    const featuresData = await spotifyApi.getTrackFeatures(accessToken, trackIds)

    const tracks: Track[] = topTracksData.items.map((track: any, index: number) => {
      const features = featuresData?.audio_features?.[index] || {}
      return {
        id: track.id,
        name: track.name,
        artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
        album: track.album?.name || "Unknown Album",
        albumArt: track.album?.images?.[0]?.url || "/placeholder.svg?height=300&width=300",
        duration: Math.floor((track.duration_ms || 180000) / 1000), // Fallback to 3 minutes
        previewUrl: track.preview_url || null,
        uri: track.uri,
        popularity: track.popularity || 0,
        energy: features.energy || 0.5,
        danceability: features.danceability || 0.5,
        valence: features.valence || 0.5,
        year: track.album?.release_date ? track.album.release_date.split("-")[0] : "",
      }
    })

    console.log("[v0] Returning", tracks.length, "tracks from /api/tracks")
    return NextResponse.json({ tracks })
  } catch (error: any) {
    console.error("[v0] Failed to fetch tracks:", error)
    
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Failed to fetch tracks", details: String(error) },
      { status: 500 }
    )
  }
}
