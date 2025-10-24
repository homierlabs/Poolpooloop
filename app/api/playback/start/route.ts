import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("spotify_access_token")?.value

    if (!accessToken) {
      console.error("[v0] No access token in cookies")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { deviceId, trackUri } = await request.json()

    if (!deviceId || !trackUri) {
      console.error("[v0] Missing deviceId or trackUri")
      return NextResponse.json({ error: "Missing deviceId or trackUri" }, { status: 400 })
    }

    console.log("[v0] Starting playback - Device:", deviceId, "Track:", trackUri)

    await spotifyApi.startPlayback(accessToken, deviceId, trackUri)

    console.log("[v0] Playback started successfully")
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Playback start error:", error)
    return NextResponse.json(
      {
        error: "Failed to start playback",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
