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
  const [userHasInteracted, setUserHasInteracted] = useState(false)
  const [readyToPlay, setReadyToPlay] = useState(false)
  const lastProgressRef = useRef<number>(0)
  const watchdogInterval = useRef<NodeJS.Timeout | null>(null)
  const hasStartedPlayback = useRef(false)

  useEffect(() => {
    let spotifyPlayer: Spotify.Player | null = null

    const initializePlayer = async () => {
      try {
        console.log("[v0] ====== PLAYER INITIALIZATION START ======")
        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json()

        if (!sessionData.authenticated || !sessionData.accessToken) {
          setError("Not authenticated")
          setIsLoading(false)
          return
        }

        const token = sessionData.accessToken
        console.log("[v0] Token obtained, length:", token.length)

        // Wait for SDK with longer timeout
        console.log("[v0] Waiting for Spotify SDK...")
        let sdkReadyAttempts = 0
        while (!window.Spotify && sdkReadyAttempts < 40) {
          await new Promise(resolve => setTimeout(resolve, 500))
          sdkReadyAttempts++
        }

        if (!window.Spotify) {
          console.error("[v0] SDK FAILED TO LOAD after 20 seconds")
          setError("Spotify SDK failed to load")
          setIsLoading(false)
          return
        }

        console.log("[v0] ✅ SDK loaded successfully")

        spotifyPlayer = new window.Spotify.Player({
          name: "DJ Interface Web Player",
          getOAuthToken: (cb) => {
            console.log("[v0] Providing token to SDK")
            cb(token)
          },
          volume: volume / 100,
        })

        spotifyPlayer.addListener("initialization_error", ({ message }) => {
          console.error("[v0] ❌ INITIALIZATION ERROR:", message)
          setError(`Init error: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("authentication_error", ({ message }) => {
          console.error("[v0] ❌ AUTH ERROR:", message)
          setError(`Auth error: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("account_error", ({ message }) => {
          console.error("[v0] ❌ ACCOUNT ERROR:", message)
          setError("Spotify Premium required")
          setIsPremium(false)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("playback_error", ({ message }) => {
          console.error("[v0] ❌ PLAYBACK ERROR:", message)
        })

        spotifyPlayer.addListener("ready", ({ device_id }) => {
          console.log("[v0] ✅✅✅ PLAYER READY - Device ID:", device_id)
          setDeviceId(device_id)
          setError("")
          setIsLoading(false)
          setReadyToPlay(true)
        })

        spotifyPlayer.addListener("not_ready", ({ device_id }) => {
          console.log("[v0] ⚠️ Device NOT READY:", device_id)
        })

        spotifyPlayer.addListener("player_state_changed", (state) => {
          if (!state) {
            console.log("[v0] State=null")
            return
          }

          const pos = Math.floor(state.position / 1000)
          const dur = Math.floor(state.duration / 1000)
          const paused = state.paused
          
          console.log(`[v0] STATE: ${paused ? 'PAUSED' : 'PLAYING'} | ${pos}s / ${dur}s`)

          setIsPlaying(!paused)
          
          if (pos !== lastProgressRef.current) {
            lastProgressRef.current = pos
            onProgress(pos)
          }

          // Detect track end
          if (state.position === 0 && paused && lastProgressRef.current > 5) {
            console.log("[v0] 🎵 TRACK ENDED")
            hasStartedPlayback.current = false
            onTrackEnd()
          }
        })

        console.log("[v0] Connecting player...")
        const connected = await spotifyPlayer.connect()
        
        if (!connected) {
          console.error("[v0] ❌ CONNECTION FAILED")
          setError("Failed to connect player")
          setIsLoading(false)
          return
        }

        console.log("[v0] ✅ PLAYER CONNECTED")
        setPlayer(spotifyPlayer)

      } catch (err) {
        console.error("[v0] ❌ FATAL INIT ERROR:", err)
        setError(`Init failed: ${String(err)}`)
        setIsLoading(false)
      }
    }

    initializePlayer()

    return () => {
      console.log("[v0] Cleanup...")
      if (watchdogInterval.current) clearInterval(watchdogInterval.current)
      if (player) {
        player.disconnect()
      }
    }
  }, [volume, onProgress, onTrackEnd])

  useEffect(() => {
    if (!deviceId || !track.uri || !player || !userHasInteracted) return
    if (hasStartedPlayback.current) return

    const startPlayback = async () => {
      try {
        console.log("[v0] ====== PLAYBACK START ======")
        console.log("[v0] Track:", track.name)
        console.log("[v0] URI:", track.uri)
        console.log("[v0] Device:", deviceId)
        
        setError("")
        hasStartedPlayback.current = true

        // Transfer device
        console.log("[v0] Transferring to device...")
        const token = (await fetch("/api/auth/session").then(r => r.json())).accessToken
        
        await fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            device_ids: [deviceId],
            play: false,
          }),
        })

        await new Promise(resolve => setTimeout(resolve, 1000))

        // Start playback
        console.log("[v0] Starting track...")
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
          console.error("[v0] ❌ Playback API FAILED:", data)
          setError(data.error || "Failed to start playback")
          return
        }

        console.log("[v0] ✅ Playback API SUCCESS")
        hasStartedPlayback.current = true
        
        // Start watchdog
        watchdogInterval.current = setInterval(async () => {
          const state = await player.getCurrentState()
          if (!state) return

          const pos = Math.floor(state.position / 1000)
          
          if (state.paused && pos < (track.duration || 180) - 5) {
            console.log(`[v0] 🚨 WATCHDOG RESUME at ${pos}s`)
            await player.resume()
          }

          if (pos !== lastProgressRef.current) {
            lastProgressRef.current = pos
            onProgress(pos)
          }
        }, 500)

      } catch (err) {
        console.error("[v0] ❌ PLAYBACK ERROR:", err)
        setError(`Playback failed: ${String(err)}`)
        hasStartedPlayback.current = false
      }
    }

    startPlayback()
  }, [deviceId, track.uri, track.name, track.duration, player, userHasInteracted, onProgress])

  const handleUserPlay = async () => {
    console.log("[v0] 🎯 USER CLICKED PLAY")
    setUserHasInteracted(true)
  }

  const togglePlayPause = async () => {
    if (!player) return

    try {
      const state = await player.getCurrentState()
      if (!state) return

      if (state.paused) {
        console.log("[v0] User RESUME")
        await player.resume()
      } else {
        console.log("[v0] User PAUSE")
        await player.pause()
      }
    } catch (error) {
      console.error("[v0] Toggle error:", error)
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
              Full song playback requires Spotify Premium.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (readyToPlay && !userHasInteracted) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Ready to Play</h2>
            <p className="text-muted-foreground">Click to start the music</p>
          </div>
          <Button 
            onClick={handleUserPlay} 
            size="lg" 
            className="h-24 w-24 rounded-full"
          >
            <Play className="w-12 h-12" />
          </Button>
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
