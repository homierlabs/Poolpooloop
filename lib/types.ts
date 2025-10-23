export interface Track {
  id: string
  name: string
  artist: string
  album: string
  albumArt: string
  duration: number
  previewUrl?: string
  uri: string
  popularity: number
  energy: number
  danceability: number
  valence: number
}

export interface VoteData {
  trackId: string
  votes: number
}

export interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

export interface SpotifyUser {
  id: string
  display_name: string
  email: string
  images: Array<{ url: string }>
}
