import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get("id")

  if (!trackId) {
    return NextResponse.json({ error: "Track ID required" }, { status: 400 })
  }

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("spotify_access_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: "Track not found" }, { status: response.status })
    }

    const track = {
      id: data.id,
      name: data.name,
      artist: data.artists[0]?.name || "Unknown Artist",
      albumArt: data.album.images[0]?.url || "",
      duration: Math.floor(data.duration_ms / 1000),
      previewUrl: data.preview_url || "",
    }

    return NextResponse.json({ track })
  } catch (error) {
    console.error("Failed to fetch track:", error)
    return NextResponse.json({ error: "Failed to fetch track" }, { status: 500 })
  }
}
