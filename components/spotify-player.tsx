"use client"

import { useEffect, useState, useRef } from "react"
import type { Track } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react'

interface SpotifyPlayerProps {
  track: Track
  onProgress: (progress: number) => void
  onTrackEnd: () => void
}

export function SpotifyPlayer({ track, onProgress, onTrackEnd }: SpotifyPlayerProps) {
  const [player, setPlayer] = useState<Spotify.Player | null>(null)
  const [deviceId, setDeviceId] = useState<string>("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [volume, setVolume] = useState(50)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string>("")
  const [isPremium, setIsPremium] = useState(true)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const lastProgressRef = useRef<number>(0)
  const resumeAttemptsRef = useRef<number>(0)
  const watchdogInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let spotifyPlayer: Spotify.Player | null = null

    const initializePlayer = async () => {
      try {
        console.log("[v0] Fetching access token...")
        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json()

        if (!sessionData.authenticated || !sessionData.accessToken) {
          setError("Not authenticated. Please log in again.")
          setIsLoading(false)
          return
        }

        const token = sessionData.accessToken
        console.log("[v0] Access token obtained, length:", token.length)

        console.log("[v0] Waiting for Spotify SDK...")
        let sdkReadyAttempts = 0
        while (!window.Spotify && sdkReadyAttempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 500))
          sdkReadyAttempts++
        }

        if (!window.Spotify) {
          console.error("[v0] Spotify SDK failed to load after 15 seconds")
          setError("Spotify SDK failed to load. Please refresh the page.")
          setIsLoading(false)
          return
        }

        console.log("[v0] Spotify SDK loaded successfully")

        spotifyPlayer = new window.Spotify.Player({
          name: "DJ Interface Player",
          getOAuthToken: (cb) => {
            console.log("[v0] Providing OAuth token to player")
            cb(token)
          },
          volume: volume / 100,
        })

        spotifyPlayer.addListener("initialization_error", ({ message }) => {
          console.error("[v0] Initialization error:", message)
          setError(`Initialization failed: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("authentication_error", ({ message }) => {
          console.error("[v0] Authentication error:", message)
          setError(`Authentication failed: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("account_error", ({ message }) => {
          console.error("[v0] Account error:", message)
          setError("Spotify Premium required")
          setIsPremium(false)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("playback_error", ({ message }) => {
          console.error("[v0] Playback error:", message)
          setError(`Playback error: ${message}`)
        })

        spotifyPlayer.addListener("ready", ({ device_id }) => {
          console.log("[v0] ✅ Player READY - Device ID:", device_id)
          setDeviceId(device_id)
          setError("")
          setIsLoading(false)
        })

        spotifyPlayer.addListener("not_ready", ({ device_id }) => {
          console.log("[v0] ⚠️ Device offline:", device_id)
        })

        spotifyPlayer.addListener("player_state_changed", (state) => {
          if (!state) {
            console.log("[v0] Player state is null")
            return
          }

          const pos = Math.floor(state.position / 1000)
          const dur = Math.floor(state.duration / 1000)
          console.log("[v0] State change - Playing:", !state.paused, "Position:", pos + "s", "Duration:", dur + "s")

          setIsPlaying(!state.paused)
          
          const currentProgress = pos
          if (currentProgress !== lastProgressRef.current) {
            lastProgressRef.current = currentProgress
            onProgress(currentProgress)
          }

          // Track ended
          if (state.position === 0 && state.paused && lastProgressRef.current > 5) {
            console.log("[v0] 🎵 Track ended")
            onTrackEnd()
          }
        })

        console.log("[v0] Connecting player...")
        const connected = await spotifyPlayer.connect()
        
        if (!connected) {
          console.error("[v0] ❌ Failed to connect player")
          setError("Failed to connect player")
          setIsLoading(false)
          return
        }

        console.log("[v0] ✅ Player connected successfully")
        setPlayer(spotifyPlayer)

      } catch (err) {
        console.error("[v0] ❌ Player initialization error:", err)
        setError(`Failed to initialize: ${String(err)}`)
        setIsLoading(false)
      }
    }

    initializePlayer()

    return () => {
      console.log("[v0] Cleaning up player...")
      if (progressInterval.current) clearInterval(progressInterval.current)
      if (watchdogInterval.current) clearInterval(watchdogInterval.current)
      if (player) {
        player.disconnect()
      }
    }
  }, [volume, onProgress, onTrackEnd])

  useEffect(() => {
    if (!deviceId || !track.uri || !player) return

    const startPlayback = async () => {
      try {
        console.log("[v0] 🎵 Starting playback")
        console.log("[v0] Track:", track.name, "by", track.artist)
        console.log("[v0] URI:", track.uri)
        console.log("[v0] Device:", deviceId)
        
        setError("")
        resumeAttemptsRef.current = 0

        const response = await fetch("/api/playback/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            trackUri: track.uri,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          console.error("[v0] ❌ Playback API failed:", data)
          setError(data.error || "Failed to start playback")
          return
        }

        console.log("[v0] ✅ Playback API succeeded")
        
        const attemptResume = async (attemptNum: number, delay: number) => {
          await new Promise(resolve => setTimeout(resolve, delay))
          
          const state = await player.getCurrentState()
          console.log(`[v0] Resume attempt ${attemptNum}:`, state ? `paused=${state.paused}, position=${Math.floor(state.position/1000)}s` : "no state")
          
          if (state && state.paused) {
            console.log(`[v0] Resuming playback (attempt ${attemptNum})`)
            await player.resume()
          }
        }

        // Schedule multiple resume attempts
        attemptResume(1, 1000)
        attemptResume(2, 2000)
        attemptResume(3, 3000)

      } catch (err) {
        console.error("[v0] ❌ Playback start error:", err)
        setError(`Failed to start: ${String(err)}`)
      }
    }

    startPlayback()
  }, [deviceId, track.uri, track.name, track.artist, player])

  useEffect(() => {
    if (!player || !deviceId) return

    watchdogInterval.current = setInterval(async () => {
      try {
        const state = await player.getCurrentState()
        
        if (!state) {
          console.log("[v0] Watchdog: No state")
          return
        }

        const pos = Math.floor(state.position / 1000)
        
        // If paused and should be playing
        if (state.paused && resumeAttemptsRef.current < 10) {
          console.log(`[v0] 🔧 Watchdog forcing resume at ${pos}s (attempt ${resumeAttemptsRef.current + 1})`)
          await player.resume()
          resumeAttemptsRef.current++
        } else if (!state.paused) {
          // Reset counter when playing
          if (resumeAttemptsRef.current > 0) {
            console.log(`[v0] ✅ Playback recovered after ${resumeAttemptsRef.current} attempts`)
          }
          resumeAttemptsRef.current = 0
        }

        // Update progress
        if (pos !== lastProgressRef.current) {
          lastProgressRef.current = pos
          onProgress(pos)
        }

      } catch (err) {
        console.error("[v0] Watchdog error:", err)
      }
    }, 500)

    return () => {
      if (watchdogInterval.current) {
        clearInterval(watchdogInterval.current)
      }
    }
  }, [player, deviceId, onProgress])

  const togglePlayPause = async () => {
    if (!player) return

    try {
      const state = await player.getCurrentState()
      if (!state) {
        console.error("[v0] No state for toggle")
        return
      }

      if (state.paused) {
        console.log("[v0] User resuming")
        await player.resume()
        resumeAttemptsRef.current = 0
      } else {
        console.log("[v0] User pausing")
        await player.pause()
      }
    } catch (error) {
      console.error("[v0] Toggle failed:", error)
      setError("Playback control failed")
    }
  }

  const handleVolumeChange = async (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)

    if (player) {
      await player.setVolume(newVolume / 100)
      if (newVolume > 0) setIsMuted(false)
    }
  }

  const toggleMute = async () => {
    if (!player) return

    if (isMuted) {
      await player.setVolume(volume / 100)
      setIsMuted(false)
    } else {
      await player.setVolume(0)
      setIsMuted(true)
    }
  }

  if (!isPremium) {
    return (
      <div className="fixed bottom-6 right-6 bg-destructive/10 border border-destructive rounded-lg shadow-lg p-4 z-50 max-w-[320px]">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-destructive mb-1">Spotify Premium Required</h4>
            <p className="text-sm text-muted-foreground">
              Full song playback requires Spotify Premium. Upgrade your account to use this feature.
            </p>
          </div>
        </div>
      </div>
    )
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
          <span className="text-sm">Initializing player...</span>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Button onClick={togglePlayPause} size="icon" variant="default" className="h-10 w-10">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>

          <div className="flex items-center gap-2 flex-1">
            <Button onClick={toggleMute} size="icon" variant="ghost" className="h-8 w-8">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>

            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">{isMuted ? 0 : volume}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
