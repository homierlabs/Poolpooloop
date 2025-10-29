// FILE: lib/spotify.ts
// PURPOSE: Spotify Web API wrapper with token management and error handling
// USAGE: Import spotifyApi from this file in API routes

import './env' // Validate environment variables on import

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI!

// Universal, UTF-8 safe base64 encoder for Node, Edge, browser, etc.
function encodeClientCredentials(clientId: string, clientSecret: string) {
  const str = `${clientId}:${clientSecret}`
  // Node.js
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return Buffer.from(str, "utf-8").toString("base64")
  }
  // Browser/Edge: utf-8 safe
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(str)))
  }
  if (typeof globalThis !== "undefined" && typeof (globalThis as any).btoa === "function") {
    return (globalThis as any).btoa(unescape(encodeURIComponent(str)))
  }
  throw new Error("No base64 encoder available")
}

async function postToken(body: URLSearchParams) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${encodeClientCredentials(CLIENT_ID, CLIENT_SECRET)}`,
    },
    body,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const err = new Error("Spotify token endpoint returned an error")
    ;(err as any).status = response.status
    ;(err as any).body = data
    throw err
  }
  return data
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (error) {
      if (i === maxRetries) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  throw new Error('Max retries reached')
}

export const spotifyApi = {
  getAuthUrl: () => {
    const scopes = [
      "user-read-private",
      "user-read-email",
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-currently-playing",
      "playlist-read-private",
      "playlist-read-collaborative",
      "user-top-read",
      "streaming",
      "user-read-playback-position",
    ]
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: scopes.join(" "),
      show_dialog: "false",
    })
    return `https://accounts.spotify.com/authorize?${params.toString()}`
  },

  getAccessToken: async (code: string) => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    })
    return postToken(body)
  },

  refreshAccessToken: async (refreshToken: string) => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
    return postToken(body)
  },

  getUserProfile: async (accessToken: string) => {
    const response = await fetchWithRetry("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.status}`)
    }
    return response.json()
  },

  getTrackFeatures: async (accessToken: string, trackIds: string[]) => {
    if (trackIds.length === 0) return { audio_features: [] }
    const response = await fetchWithRetry(
      `https://api.spotify.com/v1/audio-features?ids=${trackIds.join(",")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!response.ok) {
      console.error("Failed to get track features:", response.status)
      return { audio_features: [] }
    }
    return response.json()
  },

  getUserTopTracks: async (accessToken: string, limit = 50) => {
    const response = await fetchWithRetry(
      `https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=medium_term`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!response.ok) {
      throw new Error(`Failed to get top tracks: ${response.status}`)
    }
    return response.json()
  },

  searchTrack: async (accessToken: string, query: string) => {
    const params = new URLSearchParams({ q: query, type: "track", limit: "10" })
    const response = await fetchWithRetry(
      `https://api.spotify.com/v1/search?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }
    return response.json()
  },

  getRecommendationsBySeed: async (
    accessToken: string,
    seedTrackId: string,
    targetFeatures: {
      energy?: number
      danceability?: number
      valence?: number
      tempo?: number
    }
  ) => {
    const params = new URLSearchParams({
      seed_tracks: seedTrackId,
      limit: "20",
    })
    if (targetFeatures.energy !== undefined) {
      params.append("target_energy", targetFeatures.energy.toString())
    }
    if (targetFeatures.danceability !== undefined) {
      params.append("target_danceability", targetFeatures.danceability.toString())
    }
    if (targetFeatures.valence !== undefined) {
      params.append("target_valence", targetFeatures.valence.toString())
    }
    if (targetFeatures.tempo !== undefined) {
      params.append("target_tempo", targetFeatures.tempo.toString())
    }
    const response = await fetchWithRetry(
      `https://api.spotify.com/v1/recommendations?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!response.ok) {
      console.error("Failed to get recommendations:", response.status)
      return { tracks: [] }
    }
    return response.json()
  },

  getSingleTrackFeatures: async (accessToken: string, trackId: string) => {
    const response = await fetchWithRetry(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!response.ok) {
      console.error("Failed to get single track features:", response.status)
      return null
    }
    return response.json()
  },

  getTrackById: async (accessToken: string, trackId: string) => {
    const response = await fetchWithRetry(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!response.ok) {
      throw new Error(`Failed to get track: ${response.status}`)
    }
    return response.json()
  },

  startPlayback: async (accessToken: string, deviceId: string, trackUri: string) => {
    const response = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [trackUri] }),
      }
    )
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error("Playback start failed:", error)
      const err = new Error("Failed to start playback")
      ;(err as any).body = error
      ;(err as any).status = response.status
      throw err
    }
    return response
  },

  getPlaybackState: async (accessToken: string) => {
    const response = await fetchWithRetry("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (response.status === 204) {
      return null
    }
    if (!response.ok) {
      throw new Error(`Failed to get playback state: ${response.status}`)
    }
    return response.json()
  },
}
