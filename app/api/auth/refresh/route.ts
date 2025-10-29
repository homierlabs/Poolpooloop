// FILE: app/api/auth/refresh/route.ts
// PURPOSE: API endpoint to refresh expired Spotify access tokens
// USAGE: Called automatically by other API routes when token expires

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get("spotify_refresh_token")?.value

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 })
    }

    console.log("[v0] Refreshing access token")
    const tokenData = await spotifyApi.refreshAccessToken(refreshToken)

    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: "Failed to refresh token" }, { status: 401 })
    }

    // Update cookies with new tokens
    cookieStore.set("spotify_access_token", tokenData.access_token, {
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
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    console.log("[v0] Token refreshed successfully")
    return NextResponse.json({ 
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in 
    })
  } catch (error: any) {
    console.error("[v0] Token refresh failed:", error)
    return NextResponse.json(
      { error: "Token refresh failed", details: String(error) },
      { status: 500 }
    )
  }
}
