import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    let accessToken = cookieStore.get("spotify_access_token")?.value
    const refreshToken = cookieStore.get("spotify_refresh_token")?.value

    if (!accessToken) {
      console.error("[v0] No access token present in cookies")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { deviceId, trackUri } = await request.json()

    if (!deviceId || !trackUri) {
      console.error("[v0] Missing deviceId or trackUri")
      return NextResponse.json({ error: "Missing deviceId or trackUri" }, { status: 400 })
    }

    console.log("[v0] Starting playback - Device:", deviceId, "Track:", trackUri)

    // Attempt to start playback; if 401, attempt refresh + retry
    const callStart = async (token: string) => {
      return spotifyApi.startPlayback(token, deviceId, trackUri)
    }

    try {
      let response = await callStart(accessToken).catch((err) => {
        console.error("[v0] startPlayback network error:", err)
        throw err
      })

      // spotifyApi.startPlayback throws on non-ok in helper; but in case it returns an error payload:
      // If underlying helper threw an error, we'll catch below.

      return NextResponse.json({ success: true })
    } catch (err: any) {
      // If the startPlayback helper threw, try refreshing if we have refresh token
      console.error("[v0] startPlayback failed, attempting refresh if possible:", String(err))

      if (!refreshToken) {
        return NextResponse.json({ error: "Failed to start playback", details: String(err) }, { status: 500 })
      }

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
          }

          // Retry playback
          await spotifyApi.startPlayback(accessToken, deviceId, trackUri)
          console.log("[v0] Playback started successfully after refresh")
          return NextResponse.json({ success: true })
        } else {
          console.error("[v0] refreshAccessToken did not return access_token", tokenData)
          return NextResponse.json({ error: "Failed to refresh access token", details: tokenData }, { status: 401 })
        }
      } catch (refreshErr) {
        console.error("[v0] Playback retry after refresh failed:", refreshErr)
        return NextResponse.json({ error: "Failed to start playback", details: String(refreshErr) }, { status: 500 })
      }
    }
  } catch (error: any) {
    console.error("[v0] Playback start error:", error)
    return NextResponse.json({ error: "Failed to start playback", details: String(error) }, { status: 500 })
  }
}
