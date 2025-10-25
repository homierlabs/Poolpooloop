const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/api/auth/callback"

function encodeClientCredentials(clientId: string, clientSecret: string) {
  const str = `${clientId}:${clientSecret}`
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return Buffer.from(str, "utf-8").toString("base64")
  }
  if (typeof btoa !== "undefined") {
    return btoa(str)
  }
  // Fallback for edge
  return (typeof globalThis !== "undefined" && (globalThis as any).btoa)
    ? (globalThis as any).btoa(str)
    : ""
}

export const spotifyApi = {
  getAuthUrl: () => {
    // ... unchanged ...
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

  // ...rest unchanged...
}
