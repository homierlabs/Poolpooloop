import { NextResponse } from "next/server"
import { spotifyApi } from "@/lib/spotify"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url))
  }

  try {
    const tokenData = await spotifyApi.getAccessToken(code)

    const cookieStore = await cookies()
    cookieStore.set("spotify_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_in,
    })

    if (tokenData.refresh_token) {
      cookieStore.set("spotify_refresh_token", tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return NextResponse.redirect(new URL("/dj", request.url))
  } catch (error) {
    console.error("[v0] Token exchange failed:", error)
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url))
  }
}
