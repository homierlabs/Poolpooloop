import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { spotifyApi } from "@/lib/spotify"
import type { Track } from "@/lib/types"

export async function GET(request: Request) {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get("spotify_access_token")?.value
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value

  console.log("[v0] /api/tracks/similar invoked. accessToken present:", !!accessToken, "refreshToken present:", !!refreshToken)

  if (!accessToken) {
    console.error("[v0] No access token cookie present")
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get("trackId")

  if (!trackId) {
    console.error("[v0] No trackId provided")
    return NextResponse.json({ error: "Track ID required" }, { status: 400 })
  }

  async function callRecommendations(token: string, seedTrackId: string, features: any) {
    return spotifyApi.getRecommendationsBySeed(token, seedTrackId, {
      energy: features?.energy,
      danceability: features?.danceability,
      valence: features?.valence,
      tempo: features?.tempo,
    })
  }

  try {
    // Get single track features
    let features = await spotifyApi.getSingleTrackFeatures(accessToken, trackId).catch((err) => {
      console.error("[v0] getSingleTrackFeatures error:", err)
      return null
    })

    // If features has error that indicates 401, try refresh
    if ((features && (features as any).error && (features as any).error.status === 401) && refreshToken) {
      console.log("[v0] getSingleTrackFeatures returned 401-like payload, attempting refresh")
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
            console.log("[v0] Persisted new refresh token")
          }
          features = await spotifyApi.getSingleTrackFeatures(accessToken, trackId)
        } else {
          console.error("[v0] refreshAccessToken did not return access_token:", tokenData)
          return NextResponse.json({ error: "Failed to refresh access token", details: tokenData }, { status: 401 })
        }
      } catch (err) {
        console.error("[v0] Token refresh failed:", String(err))
        return NextResponse.json({ error: "Token refresh failed", details: String(err) }, { status: 500 })
      }
    }

    if (!features || (features as any).error) {
      console.error("[v0] Failed to get track features:", features)
      // fall back to returning empty list
      return NextResponse.json({ tracks: [] })
    }

    // Get recommendations
    let recommendationsData = await callRecommendations(accessToken, trackId, features).catch((err) => {
      console.error("[v0] getRecommendationsBySeed error:", err)
      return null
    })

    // If recommendations returned 401-like payload, attempt refresh-and-retry (again)
    if ((recommendationsData && (recommendationsData as any).error && (recommendationsData as any).error.status === 401) && refreshToken) {
      console.log("[v0] Recommendations call returned 401-like payload, attempting refresh")
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
            console.log("[v0] Persisted new refresh token")
          }
          recommendationsData = await callRecommendations(accessToken, trackId, features)
        } else {
          console.error("[v0] refreshAccessToken did not return access_token:", tokenData)
          return NextResponse.json({ error: "Failed to refresh access token", details: tokenData }, { status: 401 })
        }
      } catch (err) {
        console.error("[v0] Token refresh failed:", String(err))
        return NextResponse.json({ error: "Token refresh failed", details: String(err) }, { status: 500 })
      }
    }

    if (!recommendationsData || !recommendationsData.tracks) {
      console.log("[v0] Recommendations not available, returning empty list")
      return NextResponse.json({ tracks: [] })
    }

    const trackIds = recommendationsData.tracks.map((t: any) => t.id)
    const featuresData = await spotifyApi.getTrackFeatures(accessToken, trackIds).catch((err) => {
      console.error("[v0] getTrackFeatures error:", err)
      return null
    })

    const tracks: Track[] = recommendationsData.tracks.map((track: any, index: number) => {
      const trackFeatures = featuresData?.audio_features?.[index] || {}
      return {
        id: track.id,
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(", "),
        album: track.album.name,
        albumArt: track.album.images?.[0]?.url || "/placeholder.svg?height=300&width=300",
        duration: Math.floor(track.duration_ms / 1000),
        previewUrl: track.preview_url,
        uri: track.uri,
        popularity: track.popularity,
        energy: trackFeatures.energy || 0,
        danceability: trackFeatures.danceability || 0,
        valence: trackFeatures.valence || 0,
      }
    })

    console.log("[v0] Returning", tracks.length, "similar tracks for track", trackId)
    return NextResponse.json({ tracks })
  } catch (error) {
    console.error("[v0] Failed to fetch similar tracks:", error)
    return NextResponse.json({ error: "Failed to fetch similar tracks", details: String(error) }, { status: 500 })
  }
}
