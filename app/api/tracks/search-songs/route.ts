import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  if (!query) return NextResponse.json({ error: "Query parameter required" }, { status: 400 })

  const cookieStore = await cookies()
  let accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token present. Please reconnect Spotify." }, { status: 401 })
  }

  // Always refresh the access token before every search
  try {
    const tokenData = await spotifyApi.refreshAccessToken(refreshToken)
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: "Could not refresh access token", details: tokenData }, { status: 401 })
    }
    accessToken = tokenData.access_token

    // Persist refreshed token(s)
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
  } catch (err) {
    return NextResponse.json({ error: "refreshAccessToken failed", details: String(err) }, { status: 401 })
  }

  // Now always query Spotify with a fresh access token
  const params = new URLSearchParams({ q: query, type: "track", limit: "10" })
  try {
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status })
    }
    const tracks = (data.tracks?.items || []).map((track: any) => ({
      id: track.id,
      name: track.name,
      artist: (track.artists || []).map((a: any) => a.name).join(", ") || "Unknown Artist",
      albumArt: track.album?.images?.[0]?.url || "/placeholder.svg?height=300&width=300",
      duration: Math.floor(track.duration_ms / 1000),
      previewUrl: track.preview_url || "",
      uri: track.uri,
    }))
    return NextResponse.json({ tracks })
  } catch (error) {
    return NextResponse.json({ error: "Spotify search failed", details: String(error) }, { status: 500 })
  }
}
