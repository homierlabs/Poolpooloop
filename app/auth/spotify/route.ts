import { NextResponse } from "next/server"
import { spotifyApi } from "@/lib/spotify"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/?error=spotify_${error}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url))
  }

  try {
    const tokenData = await spotifyApi.getAccessToken(code)

    if (tokenData.error) {
      return NextResponse.redirect(new URL(`/?error=token_${tokenData.error}`, request.url))
    }

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

    return NextResponse.redirect(new URL("/select-song", request.url))
  } catch (error) {
    console.error("Spotify callback failed:", error)
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url))
  }
}
