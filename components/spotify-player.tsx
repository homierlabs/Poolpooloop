"use client"

import { useEffect, useState, useRef } from "react"
import type { Track } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from "lucide-react"

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
  const [error, setError] = useState<string>("")
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const sdkReadyHandlerRef = useRef<() => void | null>(null)

  useEffect(() => {
    // Handler that initialises the player when SDK is available
    const initializePlayer = async () => {
      try {
        console.log("[v0] Fetching access token...")
        const response = await fetch("/api/auth/session")
        const data = await response.json()

        if (!data.accessToken) {
          console.error("[v0] No access token available")
          setError("Not authenticated. Please log in again.")
          setIsLoading(false)
          return
        }

        if (!window.Spotify) {
          // SDK not present yet, bail out (the event listener below will re-run this)
          console.warn("[v0] Spotify SDK not yet available on window.Spotify")
          return
        }

        console.log("[v0] Creating Spotify Player...")
        const spotifyPlayer = new window.Spotify.Player({
          name: "DJ Voting Interface",
          getOAuthToken: (cb: (token: string) => void) => {
            console.log("[v0] Providing OAuth token to player")
            cb(data.accessToken)
          },
          volume: volume / 100,
        })

        spotifyPlayer.addListener("ready", ({ device_id }: { device_id: string }) => {
          console.log("[v0] ✅ Spotify Player ready with Device ID:", device_id)
          setDeviceId(device_id)
          setIsReady(true)
          setIsLoading(false)
          setError("")
        })

        spotifyPlayer.addListener("not_ready", ({ device_id }: { device_id: string }) => {
          console.log("[v0] ⚠️ Device ID has gone offline:", device_id)
          setError("Player went offline")
          setIsLoading(false)
        })

        spotifyPlayer.addListener("player_state_changed", (state: any) => {
          if (!state) {
            console.log("[v0] Player state is null")
            return
          }

          console.log("[v0] Player state changed - Playing:", !state.paused, "Position:", state.position)
          setIsPlaying(!state.paused)

          if (progressInterval.current) {
            clearInterval(progressInterval.current)
          }

          progressInterval.current = setInterval(() => {
            spotifyPlayer.getCurrentState().then((currentState: any) => {
              if (currentState) {
                const progress = Math.floor(currentState.position / 1000)
                onProgress(progress)

                if (
                  currentState.paused &&
                  currentState.position === 0 &&
                  currentState.track_window.previous_tracks.length > 0
                ) {
                  console.log("[v0] Track ended")
                  onTrackEnd()
                }
              }
            })
          }, 1000)
        })

        spotifyPlayer.addListener("initialization_error", ({ message }: { message: string }) => {
          console.error("[v0] ❌ Initialization error:", message)
          setError(`Initialization error: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("authentication_error", ({ message }: { message: string }) => {
          console.error("[v0] ❌ Authentication error:", message)
          setError(`Authentication error: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("account_error", ({ message }: { message: string }) => {
          console.error("[v0] ❌ Account error:", message)
          setError(`Account error: ${message}. You need Spotify Premium.`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("playback_error", ({ message }: { message: string }) => {
          console.error("[v0] ❌ Playback error:", message)
          setError(`Playback error: ${message}`)
        })

        console.log("[v0] Connecting player...")
        const connected = await spotifyPlayer.connect()

        if (connected) {
          console.log("[v0] ✅ Player connected successfully")
          setPlayer(spotifyPlayer)
        } else {
          console.error("[v0] ❌ Player failed to connect")
          setError("Failed to connect player")
          setIsLoading(false)
        }
      } catch (error) {
        console.error("[v0] ❌ Failed to initialize Spotify player:", error)
        setError("Failed to initialize player")
        setIsLoading(false)
      }
    }

    // If SDK already attached, initialize immediately
    if (window.Spotify) {
      initializePlayer()
    } else {
      // If SDK is not present yet: listen for our guaranteed event fired by the global callback
      const handler = () => {
        initializePlayer()
      }
      sdkReadyHandlerRef.current = handler
      window.addEventListener("spotify-sdk-ready", handler)
    }

    return () => {
      if (player) {
        console.log("[v0] Disconnecting player")
        player.disconnect()
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
      if (sdkReadyHandlerRef.current) {
        window.removeEventListener("spotify-sdk-ready", sdkReadyHandlerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // auto-play when track changes and player ready
    if (isReady && deviceId && track.id) {
      console.log("[v0] Ready to play track:", track.name, track.id)
      playTrack()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, isReady, deviceId])

  const togglePlayPause = async () => {
    if (!player) {
      console.error("[v0] No player available")
      return
    }

    try {
      console.log("[v0] Toggling playback")
      await player.togglePlay()
    } catch (error) {
      console.error("[v0] Failed to toggle playback:", error)
      setError("Failed to toggle playback")
    }
  }

  const handleVolumeChange = async (value: number[]) => {
    const newVolume = value[0]
    console.log("[v0] Setting volume to:", newVolume)
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
        console.log("[v0] Unmuting, setting volume to:", volume)
        await player.setVolume(volume / 100)
        setIsMuted(false)
      } else {
        console.log("[v0] Muting")
        await player.setVolume(0)
        setIsMuted(true)
      }
    } catch (error) {
      console.error("[v0] Failed to toggle mute:", error)
    }
  }

  const playTrack = async () => {
    try {
      setIsLoading(true)
      console.log("[v0] Fetching session for playback...")
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      if (!data.accessToken || !deviceId) {
        console.error("[v0] Missing access token or device ID")
        setError("Cannot start playback - missing credentials")
        setIsLoading(false)
        return
      }

      const trackUri = `spotify:track:${track.id}`
      console.log("[v0] 🎵 Starting playback for:", track.name, "URI:", trackUri, "Device:", deviceId)

      const playbackResponse = await fetch("/api/playback/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, trackUri }),
      })

      const playbackData = await playbackResponse.json()

      if (!playbackResponse.ok) {
        console.error("[v0] ❌ Playback start failed:", playbackData)
        setError(`Playback failed: ${playbackData.error}`)
        setIsLoading(false)
        return
      }

      console.log("[v0] ✅ Playback started successfully")
      setIsLoading(false)
      setError("")
    } catch (error) {
      console.error("[v0] ❌ Failed to start playback:", error)
      setError("Failed to start playback")
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 bg-card border border-border rounded-lg shadow-lg p-4 flex flex-col gap-3 z-50 min-w-[280px]">
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading player...</span>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Button onClick={togglePlayPause} size="icon" variant="default" className="h-10 w-10" disabled={!isReady}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>

          <div className="flex items-center gap-2 flex-1">
            <Button onClick={toggleMute} size="icon" variant="ghost" className="h-8 w-8" disabled={!isReady}>
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>

            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
              disabled={!isReady}
            />
            <span className="text-xs text-muted-foreground w-8 text-right">{isMuted ? 0 : volume}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
