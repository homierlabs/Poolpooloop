import { NextResponse } from "next/server"
import { spotifyApi } from "@/lib/spotify"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  console.log("[v0] Spotify callback received")

  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    console.error("[v0] Spotify authorization error:", error)
    return NextResponse.redirect(new URL(`/?error=spotify_${error}`, request.url))
  }

  if (!code) {
    console.error("[v0] No authorization code received")
    return NextResponse.redirect(new URL("/?error=no_code", request.url))
  }

  console.log("[v0] Exchanging code for access token")

  try {
    const tokenData = await spotifyApi.getAccessToken(code)

    if (tokenData.error) {
      console.error("[v0] Token exchange error:", tokenData.error, tokenData.error_description)
      return NextResponse.redirect(new URL(`/?error=token_${tokenData.error}`, request.url))
    }

    console.log("[v0] Access token received, setting cookies")

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
        maxAge: 60 * 60 * 24 * 30,
      })
    }

    console.log("[v0] Redirecting to /dj")
    return NextResponse.redirect(new URL("/dj", request.url))
  } catch (error) {
    console.error("[v0] Spotify callback failed:", error)
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url))
  }
}
