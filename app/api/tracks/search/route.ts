import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"
import type { Track } from "@/lib/types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const accessToken = cookieStore.get("spotify_access_token")?.value

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchData = await spotifyApi.searchTrack(accessToken, query)

    if (!searchData.tracks?.items || searchData.tracks.items.length === 0) {
      return NextResponse.json({ track: null })
    }

    const track = searchData.tracks.items[0]
    const featuresData = await spotifyApi.getTrackFeatures(accessToken, [track.id])
    const features = featuresData.audio_features[0] || {}

    const trackData: Track = {
      id: track.id,
      name: track.name,
      artist: track.artists.map((a: any) => a.name).join(", "),
      album: track.album.name,
      albumArt: track.album.images[0]?.url || "/placeholder.svg?height=300&width=300",
      duration: Math.floor(track.duration_ms / 1000),
      previewUrl: track.preview_url || "",
      uri: track.uri,
      popularity: track.popularity,
      energy: features.energy || 0,
      danceability: features.danceability || 0,
      valence: features.valence || 0,
      year: track.album.release_date?.split("-")[0] || "",
    }

    return NextResponse.json({ track: trackData })
  } catch (error) {
    console.error("[v0] Failed to search track:", error)
    return NextResponse.json({ error: "Failed to search track" }, { status: 500 })
  }
}
