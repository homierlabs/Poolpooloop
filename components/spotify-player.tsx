"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import type { Track } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react'

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
  const [sdkReady, setSdkReady] = useState(false)
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const playbackCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const initAttempted = useRef(false)

  // Listen for SDK ready event
  useEffect(() => {
    const handleSDKReady = () => {
      console.log("[v0] Spotify SDK is ready")
      setSdkReady(true)
    }

    // Check if SDK is already loaded
    if (window.Spotify) {
      handleSDKReady()
    } else {
      window.addEventListener('spotify-sdk-ready', handleSDKReady)
    }

    return () => {
      window.removeEventListener('spotify-sdk-ready', handleSDKReady)
    }
  }, [])

  // Initialize player when SDK is ready
  const initializePlayer = useCallback(async () => {
    if (initAttempted.current || !sdkReady) return
    initAttempted.current = true

    try {
      console.log("[v0] Fetching access token...")
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      if (!data.accessToken) {
        setError("Not authenticated. Please log in again.")
        setIsLoading(false)
        return
      }

      console.log("[v0] Creating Spotify Player...")
      const spotifyPlayer = new window.Spotify.Player({
        name: "DJ Voting Interface",
        getOAuthToken: (cb: (token: string) => void) => {
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
        if (!state) return

        console.log("[v0] Player state changed - paused:", state.paused, "position:", state.position)
        setIsPlaying(!state.paused)
        
        if (!state.paused && state.position > 0) {
          setHasStartedPlaying(true)
        }

        if (progressInterval.current) {
          clearInterval(progressInterval.current)
          progressInterval.current = null
        }

        if (!state.paused) {
          progressInterval.current = setInterval(() => {
            spotifyPlayer.getCurrentState().then((currentState: any) => {
              if (currentState) {
                const progress = Math.floor(currentState.position / 1000)
                onProgress(progress)

                // Check if track ended
                if (currentState.paused && 
                    currentState.position === 0 && 
                    currentState.track_window.previous_tracks.length > 0) {
                  console.log("[v0] Track ended")
                  if (progressInterval.current) {
                    clearInterval(progressInterval.current)
                    progressInterval.current = null
                  }
                  onTrackEnd()
                }
              }
            })
          }, 1000)
        }
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
        setError("Spotify Premium required")
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
  }, [sdkReady, volume, onProgress, onTrackEnd])

  useEffect(() => {
    if (sdkReady && !initAttempted.current) {
      initializePlayer()
    }

    return () => {
      if (player) {
        console.log("[v0] Disconnecting player")
        player.disconnect()
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
      if (playbackCheckInterval.current) {
        clearInterval(playbackCheckInterval.current)
      }
    }
  }, [sdkReady, initializePlayer, player])

  useEffect(() => {
    if (!player || !isReady || !deviceId) return

    // Clear any existing check interval
    if (playbackCheckInterval.current) {
      clearInterval(playbackCheckInterval.current)
      playbackCheckInterval.current = null
    }

    // Start monitoring playback state every 2 seconds
    playbackCheckInterval.current = setInterval(async () => {
      try {
        const state = await player.getCurrentState()
        if (state) {
          const currentPosition = state.position
          console.log("[v0] Playback check - position:", currentPosition, "paused:", state.paused)
          
          // If track started but is now paused unexpectedly at beginning, resume it
          if (state.paused && currentPosition < 5000 && hasStartedPlaying) {
            console.log("[v0] Detected stuck playback, resuming...")
            await player.resume()
          }
        }
      } catch (error) {
        console.error("[v0] Error checking playback state:", error)
      }
    }, 2000)

    return () => {
      if (playbackCheckInterval.current) {
        clearInterval(playbackCheckInterval.current)
        playbackCheckInterval.current = null
      }
    }
  }, [player, isReady, deviceId, hasStartedPlaying])

  // Auto-play when track changes and player ready
  useEffect(() => {
    if (isReady && deviceId && track.id) {
      console.log("[v0] Ready to play track:", track.name, track.id)
      setHasStartedPlaying(false)
      playTrack()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, isReady, deviceId])

  const togglePlayPause = async () => {
    if (!player) return
    try {
      await player.togglePlay()
      console.log("[v0] Toggled playback")
    } catch (error) {
      console.error("[v0] Failed to toggle playback:", error)
      setError("Failed to toggle playback")
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

  const playTrack = async () => {
    try {
      setIsLoading(true)
      setHasStartedPlaying(false)
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      if (!data.accessToken || !deviceId) {
        setError("Cannot start playback - missing credentials")
        setIsLoading(false)
        return
      }

      const trackUri = track.uri || `spotify:track:${track.id}`
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
      
      setTimeout(async () => {
        try {
          const state = await player?.getCurrentState()
          if (state && state.paused) {
            console.log("[v0] Player paused after start, resuming...")
            await player.resume()
          }
        } catch (error) {
          console.error("[v0] Error checking initial playback state:", error)
        }
      }, 1500)
      
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
          <span className="text-sm">
            {!sdkReady ? "Loading Spotify SDK..." : "Initializing player..."}
          </span>
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
