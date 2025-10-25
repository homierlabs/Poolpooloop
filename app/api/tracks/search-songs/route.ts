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

  // If we already have a valid access token, try using it first.
  // Only attempt refresh if Spotify returns a 401-like error or if we don't have an access token.
  const doSearch = async (token: string) => {
    const params = new URLSearchParams({ q: query, type: "track", limit: "10" })
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))
    return { response, data }
  }

  try {
    if (accessToken) {
      const { response, data } = await doSearch(accessToken)
      if (response.ok) {
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
      }

      // If unauthorized (401), we'll attempt refresh (below). Otherwise, return Spotify error.
      if (response.status !== 401) {
        return NextResponse.json({ error: data }, { status: response.status })
      }
    }

    // Need to refresh or we had no access token
    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token present. Please reconnect Spotify." }, { status: 401 })
    }

    // Attempt refresh
    try {
      const tokenData = await spotifyApi.refreshAccessToken(refreshToken)
      // spotifyApi.refreshAccessToken now throws on non-ok — catch above will handle it
      accessToken = tokenData.access_token
      // Persist refreshed tokens (if provided)
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
    } catch (refreshErr: any) {
      // refreshAccessToken throws an Error when Spotify returns non-ok
      console.error("[v0] refreshAccessToken failed:", refreshErr)
      const body = (refreshErr as any).body ?? { message: String(refreshErr) }
      const status = (refreshErr as any).status ?? 500
      return NextResponse.json({ error: "refreshAccessToken failed", details: body }, { status })
    }

    // Retry search with refreshed token
    const { response: r2, data: d2 } = await (async () => {
      const params = new URLSearchParams({ q: query, type: "track", limit: "10" })
      const resp = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const dt = await resp.json().catch(() => ({}))
      return { response: resp, data: dt }
    })()

    if (!r2.ok) {
      return NextResponse.json({ error: d2 }, { status: r2.status })
    }

    const tracks = (d2.tracks?.items || []).map((track: any) => ({
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
    console.error("[v0] Spotify search failed:", error)
    return NextResponse.json({ error: "Spotify search failed", details: String(error) }, { status: 500 })
  }
}
