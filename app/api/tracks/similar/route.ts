import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"
import type { Track } from "@/lib/types"

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("spotify_access_token")?.value

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get("trackId")

  if (!trackId) {
    return NextResponse.json({ error: "Track ID required" }, { status: 400 })
  }

  try {
    const features = await spotifyApi.getSingleTrackFeatures(accessToken, trackId)

    if (!features || features.error) {
      console.error("[v0] Failed to get track features:", features)
      return NextResponse.json({ error: "Failed to get track features" }, { status: 500 })
    }

    const recommendationsData = await spotifyApi.getRecommendationsBySeed(accessToken, trackId, {
      energy: features.energy,
      danceability: features.danceability,
      valence: features.valence,
      tempo: features.tempo,
    })

    if (!recommendationsData.tracks || recommendationsData.tracks.length === 0) {
      return NextResponse.json({ tracks: [] })
    }

    const trackIds = recommendationsData.tracks.map((track: any) => track.id)
    const featuresData = await spotifyApi.getTrackFeatures(accessToken, trackIds)

    const tracks: Track[] = recommendationsData.tracks.map((track: any, index: number) => {
      const trackFeatures = featuresData.audio_features[index] || {}

      return {
        id: track.id,
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(", "),
        album: track.album.name,
        albumArt: track.album.images[0]?.url || "/placeholder.svg?height=300&width=300",
        duration: Math.floor(track.duration_ms / 1000),
        previewUrl: track.preview_url,
        uri: track.uri,
        popularity: track.popularity,
        energy: trackFeatures.energy || 0,
        danceability: trackFeatures.danceability || 0,
        valence: trackFeatures.valence || 0,
      }
    })

    console.log("[v0] Found", tracks.length, "similar tracks for track", trackId)
    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("[v0] Failed to fetch similar tracks:", error)
    return NextResponse.json({ error: "Failed to fetch similar tracks" }, { status: 500 })
  }
}
