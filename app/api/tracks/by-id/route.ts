// FILE: app/api/tracks/by-id/route.ts
// PURPOSE: Get a single track by ID from Spotify
// USAGE: Called when user selects a starting track

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"

async function getAccessToken() {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value

  if (!accessToken && !refreshToken) {
    throw new Error("Not authenticated")
  }

  if (!accessToken && refreshToken) {
    const tokenData = await spotifyApi.refreshAccessToken(refreshToken)
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
  }

  return accessToken!
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get("id")

  if (!trackId) {
    return NextResponse.json({ error: "Track ID required" }, { status: 400 })
  }

  try {
    const accessToken = await getAccessToken()
    const data = await spotifyApi.getTrackById(accessToken, trackId)

    const track = {
      id: data.id,
      name: data.name || "Unknown Track",
      artist: data.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
      album: data.album?.name || "Unknown Album",
      year: data.album?.release_date ? data.album.release_date.split("-")[0] : "",
      albumArt: data.album?.images?.[0]?.url || "/placeholder.svg?height=300&width=300",
      duration: Math.floor((data.duration_ms || 180000) / 1000),
      previewUrl: data.preview_url || null,
      uri: data.uri,
      popularity: data.popularity || 0,
      energy: 0.5, // Default values since we're not fetching features here
      danceability: 0.5,
      valence: 0.5,
    }

    return NextResponse.json({ track })
  } catch (error: any) {
    console.error("[v0] Failed to fetch track:", error)
    
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Failed to fetch track", details: String(error) },
      { status: 500 }
    )
  }
}
