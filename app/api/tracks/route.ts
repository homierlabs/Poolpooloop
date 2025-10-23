import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"
import type { Track } from "@/lib/types"

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("spotify_access_token")?.value

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const topTracksData = await spotifyApi.getUserTopTracks(accessToken, 50)

    if (!topTracksData.items || topTracksData.items.length === 0) {
      return NextResponse.json({ tracks: [] })
    }

    const trackIds = topTracksData.items.map((track: any) => track.id)
    const featuresData = await spotifyApi.getTrackFeatures(accessToken, trackIds)

    const tracks: Track[] = topTracksData.items.map((track: any, index: number) => {
      const features = featuresData.audio_features[index] || {}

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
        energy: features.energy || 0,
        danceability: features.danceability || 0,
        valence: features.valence || 0,
      }
    })

    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("[v0] Failed to fetch tracks:", error)
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 })
  }
}
