import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("spotify_access_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { deviceId, trackUri } = await request.json()

    if (!deviceId || !trackUri) {
      return NextResponse.json({ error: "Missing deviceId or trackUri" }, { status: 400 })
    }

    await spotifyApi.startPlayback(accessToken, deviceId, trackUri)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Playback start error:", error)
    return NextResponse.json({ error: "Failed to start playback" }, { status: 500 })
  }
}
