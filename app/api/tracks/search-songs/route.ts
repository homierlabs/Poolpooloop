// FILE: app/api/tracks/search-songs/route.ts
// PURPOSE: Search Spotify for tracks by query
// USAGE: Called from select-song page when user searches

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
  const query = searchParams.get("q")
  
  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: "Query parameter required" }, { status: 400 })
  }

  try {
    const accessToken = await getAccessToken()
    const searchData = await spotifyApi.searchTrack(accessToken, query)

    const tracks = (searchData.tracks?.items || []).map((track: any) => ({
      id: track.id,
      name: track.name || "Unknown Track",
      artist: (track.artists || []).map((a: any) => a.name).join(", ") || "Unknown Artist",
      albumArt: track.album?.images?.[0]?.url || "/placeholder.svg?height=300&width=300",
      duration: Math.floor((track.duration_ms || 180000) / 1000),
      previewUrl: track.preview_url || null,
      uri: track.uri,
      album: track.album?.name || "Unknown Album",
      year: track.album?.release_date ? track.album.release_date.split("-")[0] : "",
    }))

    return NextResponse.json({ tracks })
  } catch (error: any) {
    console.error("[v0] Spotify search failed:", error)
    
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Search failed", details: String(error) },
      { status: 500 }
    )
  }
}
