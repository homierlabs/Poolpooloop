const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/api/auth/callback"

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
    })
    return `https://accounts.spotify.com/authorize?${params.toString()}`
  },

  getAccessToken: async (code: string) => {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${encodeClientCredentials(CLIENT_ID, CLIENT_SECRET)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      console.error("[v0] Token request failed:", response.status, data)
    }
    return data
  },

  refreshAccessToken: async (refreshToken: string) => {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${encodeClientCredentials(CLIENT_ID, CLIENT_SECRET)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    })
    return response.json()
  },

  getUserProfile: async (accessToken: string) => {
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return response.json()
  },

  getRecommendations: async (accessToken: string, seedTracks: string[]) => {
    const params = new URLSearchParams({
      seed_tracks: seedTracks.slice(0, 5).join(","),
      limit: "20",
    })
    const response = await fetch(`https://api.spotify.com/v1/recommendations?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return response.json()
  },

  getTrackFeatures: async (accessToken: string, trackIds: string[]) => {
    const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds.join(",")}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return response.json()
  },

  getUserTopTracks: async (accessToken: string, limit = 50) => {
    const response = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=medium_term`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return response.json()
  },

  searchTrack: async (accessToken: string, query: string) => {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "1",
    })
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
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
    },
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
    const response = await fetch(`https://api.spotify.com/v1/recommendations?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return response.json()
  },

  getSingleTrackFeatures: async (accessToken: string, trackId: string) => {
    const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return response.json()
  },

  startPlayback: async (accessToken: string, deviceId: string, trackUri: string) => {
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [trackUri],
      }),
    })
    if (!response.ok) {
      const error = await response.json()
      console.error("[v0] Playback start failed:", error)
      throw new Error("Failed to start playback")
    }
    return response
  },

  getPlaybackState: async (accessToken: string) => {
    const response = await fetch("https://api.spotify.com/v1/me/player", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (response.status === 204) {
      return null
    }
    return response.json()
  },
}
