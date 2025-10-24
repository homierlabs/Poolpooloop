"use client"

import { useEffect, useState, useRef } from "react"
import type { Track } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react"

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
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [volume, setVolume] = useState(50)
  const [isMuted, setIsMuted] = useState(false)
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

  const togglePlayPause = async () => {
    if (!player) return

    try {
      await player.togglePlay()
    } catch (error) {
      console.error("[v0] Failed to toggle playback:", error)
    }
  }

  const handleVolumeChange = async (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)

    if (player) {
      try {
        await player.setVolume(newVolume / 100)
        if (newVolume > 0) setIsMuted(false)
      } catch (error) {
        console.error("[v0] Failed to set volume:", error)
      }
    }
  }

  const toggleMute = async () => {
    if (!player) return

    try {
      if (isMuted) {
        await player.setVolume(volume / 100)
        setIsMuted(false)
      } else {
        await player.setVolume(0)
        setIsMuted(true)
      }
    } catch (error) {
      console.error("[v0] Failed to toggle mute:", error)
    }
  }

  const initializePlayer = async () => {
    try {
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      if (!data.accessToken) {
        console.error("[v0] No access token available")
        setIsLoading(false)
        return
      }

      const spotifyPlayer = new window.Spotify.Player({
        name: "DJ Voting Interface",
        getOAuthToken: (cb: (token: string) => void) => {
          cb(data.accessToken)
        },
        volume: volume / 100,
      })

      spotifyPlayer.addListener("ready", ({ device_id }: { device_id: string }) => {
        console.log("[v0] Spotify Player ready with Device ID:", device_id)
        setDeviceId(device_id)
        setIsReady(true)
        setIsLoading(false)
      })

      spotifyPlayer.addListener("not_ready", ({ device_id }: { device_id: string }) => {
        console.log("[v0] Device ID has gone offline:", device_id)
        setIsLoading(false)
      })

      spotifyPlayer.addListener("player_state_changed", (state: any) => {
        if (!state) return

        console.log("[v0] Player state changed:", state)
        setIsPlaying(!state.paused)

        if (progressInterval.current) {
          clearInterval(progressInterval.current)
        }

        progressInterval.current = setInterval(() => {
          spotifyPlayer.getCurrentState().then((currentState: any) => {
            if (currentState) {
              const progress = Math.floor(currentState.position / 1000)
              onProgress(progress)

              if (currentState.paused && currentState.position === 0) {
                onTrackEnd()
              }
            }
          })
        }, 1000)
      })

      spotifyPlayer.addListener("initialization_error", ({ message }: { message: string }) => {
        console.error("[v0] Initialization error:", message)
        setIsLoading(false)
      })

      spotifyPlayer.addListener("authentication_error", ({ message }: { message: string }) => {
        console.error("[v0] Authentication error:", message)
        setIsLoading(false)
      })

      spotifyPlayer.addListener("account_error", ({ message }: { message: string }) => {
        console.error("[v0] Account error:", message)
        setIsLoading(false)
      })

      spotifyPlayer.addListener("playback_error", ({ message }: { message: string }) => {
        console.error("[v0] Playback error:", message)
        setIsLoading(false)
      })

      await spotifyPlayer.connect()
      setPlayer(spotifyPlayer)
    } catch (error) {
      console.error("[v0] Failed to initialize Spotify player:", error)
      setIsLoading(false)
    }
  }

  const playTrack = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      if (!data.accessToken || !deviceId) {
        console.error("[v0] Missing access token or device ID")
        setIsLoading(false)
        return
      }

      const trackUri = `spotify:track:${track.id}`
      console.log("[v0] Starting playback for:", track.name, trackUri)

      await fetch("/api/playback/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, trackUri }),
      })

      setIsLoading(false)
    } catch (error) {
      console.error("[v0] Failed to start playback:", error)
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 bg-card border border-border rounded-lg shadow-lg p-4 flex items-center gap-4 z-50">
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading player...</span>
        </div>
      ) : (
        <>
          <Button onClick={togglePlayPause} size="icon" variant="default" className="h-10 w-10" disabled={!isReady}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>

          <div className="flex items-center gap-2">
            <Button onClick={toggleMute} size="icon" variant="ghost" className="h-8 w-8" disabled={!isReady}>
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>

            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-24"
              disabled={!isReady}
            />
          </div>
        </>
      )}
    </div>
  )
}
