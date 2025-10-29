// FILE: app/api/tracks/similar/route.ts
// PURPOSE: Get similar tracks based on audio features (energy, danceability, etc.)
// USAGE: Called to generate voting candidates

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get("trackId")

  if (!trackId) {
    return NextResponse.json({ error: "Track ID required" }, { status: 400 })
  }

  try {
    const accessToken = await getAccessToken()

    // Get audio features for the current track
    const features = await spotifyApi.getSingleTrackFeatures(accessToken, trackId)

    if (!features) {
      console.warn("[v0] Could not get features for track, using defaults")
    }

    // Get recommendations based on audio features
    const recommendationsData = await spotifyApi.getRecommendationsBySeed(
      accessToken,
      trackId,
      {
        energy: features?.energy,
        danceability: features?.danceability,
        valence: features?.valence,
        tempo: features?.tempo,
      }
    )

    if (!recommendationsData || !recommendationsData.tracks || recommendationsData.tracks.length === 0) {
      console.log("[v0] No recommendations available, returning empty list")
      return NextResponse.json({ tracks: [] })
    }

    // Get audio features for all recommended tracks
    const trackIds = recommendationsData.tracks.map((t: any) => t.id)
    const featuresData = await spotifyApi.getTrackFeatures(accessToken, trackIds)

    const tracks: Track[] = recommendationsData.tracks.map((track: any, index: number) => {
      const trackFeatures = featuresData?.audio_features?.[index] || {}
      return {
        id: track.id,
        name: track.name || "Unknown Track",
        artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
        album: track.album?.name || "Unknown Album",
        albumArt: track.album?.images?.[0]?.url || "/placeholder.svg?height=300&width=300",
        duration: Math.floor((track.duration_ms || 180000) / 1000),
        previewUrl: track.preview_url || null,
        uri: track.uri,
        popularity: track.popularity || 0,
        energy: trackFeatures.energy || 0.5,
        danceability: trackFeatures.danceability || 0.5,
        valence: trackFeatures.valence || 0.5,
        year: track.album?.release_date ? track.album.release_date.split("-")[0] : "",
      }
    })

    console.log("[v0] Returning", tracks.length, "similar tracks for track", trackId)
    return NextResponse.json({ tracks })
  } catch (error: any) {
    console.error("[v0] Failed to fetch similar tracks:", error)
    
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Failed to fetch similar tracks", details: String(error) },
      { status: 500 }
    )
  }
}
