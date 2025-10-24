"use client"

import { useEffect, useState, useRef } from "react"
import type { Track } from "@/lib/types"

interface SpotifyPlayerProps {
  track: Track
  onProgress: (progress: number) => void
  onTrackEnd: () => void
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: any
  }
}

export function SpotifyPlayer({ track, onProgress, onTrackEnd }: SpotifyPlayerProps) {
  const [player, setPlayer] = useState<any>(null)
  const [deviceId, setDeviceId] = useState<string>("")
  const [isReady, setIsReady] = useState(false)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://sdk.scdn.co/spotify-player.js"
    script.async = true
    document.body.appendChild(script)

    window.onSpotifyWebPlaybackSDKReady = () => {
      initializePlayer()
    }

    return () => {
      if (player) {
        player.disconnect()
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isReady && deviceId && track.id) {
      playTrack()
    }
  }, [track.id, isReady, deviceId])

  const initializePlayer = async () => {
    try {
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      if (!data.accessToken) {
        console.error("[v0] No access token available")
        return
      }

      const spotifyPlayer = new window.Spotify.Player({
        name: "DJ Voting Interface",
        getOAuthToken: (cb: (token: string) => void) => {
          cb(data.accessToken)
        },
        volume: 0.5,
      })

      spotifyPlayer.addListener("ready", ({ device_id }: { device_id: string }) => {
        console.log("[v0] Spotify Player ready with Device ID:", device_id)
        setDeviceId(device_id)
        setIsReady(true)
      })

      spotifyPlayer.addListener("not_ready", ({ device_id }: { device_id: string }) => {
        console.log("[v0] Device ID has gone offline:", device_id)
      })

      spotifyPlayer.addListener("player_state_changed", (state: any) => {
        if (!state) return

        console.log("[v0] Player state changed:", state)

        // Track progress
        if (progressInterval.current) {
          clearInterval(progressInterval.current)
        }

        progressInterval.current = setInterval(() => {
          spotifyPlayer.getCurrentState().then((currentState: any) => {
            if (currentState) {
              const progress = Math.floor(currentState.position / 1000)
              onProgress(progress)

              // Check if track ended
              if (currentState.paused && currentState.position === 0) {
                onTrackEnd()
              }
            }
          })
        }, 1000)
      })

      spotifyPlayer.addListener("initialization_error", ({ message }: { message: string }) => {
        console.error("[v0] Initialization error:", message)
      })

      spotifyPlayer.addListener("authentication_error", ({ message }: { message: string }) => {
        console.error("[v0] Authentication error:", message)
      })

      spotifyPlayer.addListener("account_error", ({ message }: { message: string }) => {
        console.error("[v0] Account error:", message)
      })

      spotifyPlayer.addListener("playback_error", ({ message }: { message: string }) => {
        console.error("[v0] Playback error:", message)
      })

      await spotifyPlayer.connect()
      setPlayer(spotifyPlayer)
    } catch (error) {
      console.error("[v0] Failed to initialize Spotify player:", error)
    }
  }

  const playTrack = async () => {
    try {
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      if (!data.accessToken || !deviceId) {
        console.error("[v0] Missing access token or device ID")
        return
      }

      const trackUri = `spotify:track:${track.id}`
      console.log("[v0] Starting playback for:", track.name, trackUri)

      await fetch("/api/playback/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, trackUri }),
      })
    } catch (error) {
      console.error("[v0] Failed to start playback:", error)
    }
  }

  return null // This component doesn't render anything visible
}
