import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value

  const env = {
    SPOTIFY_CLIENT_ID: !!process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: !!process.env.SPOTIFY_CLIENT_SECRET,
    NEXT_PUBLIC_REDIRECT_URI: !!process.env.NEXT_PUBLIC_REDIRECT_URI,
  }

  let refreshResult: any = undefined
  if (refreshToken) {
    try {
      const tokenData = await spotifyApi.refreshAccessToken(refreshToken)
      refreshResult = { success: true, tokenData }
    } catch (err: any) {
      refreshResult = { success: false, status: err?.status ?? null, body: err?.body ?? String(err) }
    }
  } else {
    refreshResult = { success: false, error: "No refresh token in cookies" }
  }

  return NextResponse.json({
    cookies: { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, accessTokenSnippet: accessToken ? accessToken.slice(0, 10) + "..." : null },
    env,
    refreshResult,
  })
}
