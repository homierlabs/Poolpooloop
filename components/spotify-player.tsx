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
  const playerInitialized = useRef(false)
  const playbackStarted = useRef(false)
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const trackStartTimeRef = useRef<number>(0)
  const trackDurationRef = useRef<number>(0)

  const startProgressTracking = (durationMs: number) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
    
    trackStartTimeRef.current = Date.now()
    trackDurationRef.current = Math.floor(durationMs / 1000)
    
    console.log(`[v0] ⏱️ Starting progress tracking for ${trackDurationRef.current}s track`)
    
    onProgress(0)
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - trackStartTimeRef.current) / 1000)
      
      console.log(`[v0] 📍 Progress: ${elapsed}s / ${trackDurationRef.current}s`)
      onProgress(elapsed)
      
      if (elapsed >= trackDurationRef.current) {
        console.log("[v0] 🎵 Track ended")
        stopProgressTracking()
        onTrackEnd()
      }
    }, 1000)
  }

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  useEffect(() => {
    let spotifyPlayer: Spotify.Player | null = null

    const initializePlayer = async () => {
      if (playerInitialized.current) return
      playerInitialized.current = true

      try {
        console.log("[v0] ====== PLAYER INITIALIZATION START ======")
        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json()

        if (!sessionData.authenticated || !sessionData.accessToken) {
          console.log("[v0] ❌ Not authenticated")
          setError("Not authenticated. Please log in again.")
          setIsLoading(false)
          return
        }

        const token = sessionData.accessToken
        console.log("[v0] ✅ Token obtained successfully")

        console.log("[v0] Waiting for Spotify SDK to load...")
        
        if (!window.Spotify) {
          await new Promise<void>((resolve, reject) => {
            let resolved = false
            
            const pollInterval = setInterval(() => {
              if (window.Spotify && !resolved) {
                resolved = true
                clearInterval(pollInterval)
                console.log("[v0] ✅ SDK loaded via polling")
                resolve()
              }
            }, 100)
            
            window.onSpotifyWebPlaybackSDKReady = () => {
              if (!resolved) {
                resolved = true
                clearInterval(pollInterval)
                console.log("[v0] ✅ SDK loaded via callback")
                resolve()
              }
            }

            setTimeout(() => {
              if (!resolved) {
                resolved = true
                clearInterval(pollInterval)
                console.error("[v0] ❌ SDK failed to load within 15s")
                reject(new Error("SDK timeout"))
              }
            }, 15000)
          })
        } else {
          console.log("[v0] ✅ SDK already available")
        }

        if (!window.Spotify) {
          setError("Spotify SDK failed to load")
          setIsLoading(false)
          return
        }

        console.log("[v0] Creating Spotify Player instance...")
        spotifyPlayer = new window.Spotify.Player({
          name: "DJ Interface Web Player",
          getOAuthToken: (cb) => {
            console.log("[v0] SDK requesting OAuth token")
            cb(token)
          },
          volume: volume / 100,
        })

        console.log("[v0] ✅ Player instance created")

        spotifyPlayer.addListener("initialization_error", ({ message }) => {
          console.error("[v0] ❌ INITIALIZATION ERROR:", message)
          setError(`Initialization error: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("authentication_error", ({ message }) => {
          console.error("[v0] ❌ AUTHENTICATION ERROR:", message)
          setError(`Authentication error: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("account_error", ({ message }) => {
          console.error("[v0] ❌ ACCOUNT ERROR (Spotify Premium required):", message)
          setError("Spotify Premium required for full playback")
          setIsPremium(false)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("playback_error", ({ message }) => {
          console.error("[v0] ❌ PLAYBACK ERROR:", message)
          setError(`Playback error: ${message}`)
        })

        spotifyPlayer.addListener("ready", async ({ device_id }) => {
          console.log("🎧 Web Playback SDK ready, device_id:", device_id)
          setDeviceId(device_id)
          setError("")
          setIsLoading(false)

          if (playbackStarted.current || !track.uri) return
          playbackStarted.current = true

          try {
            await new Promise((res) => setTimeout(res, 500))

            await fetch("https://api.spotify.com/v1/me/player", {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                device_ids: [device_id],
                play: false,
              }),
            })

            await new Promise((res) => setTimeout(res, 500))

            const playResponse = await fetch(
              `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  uris: [track.uri],
                }),
              }
            )

            if (playResponse.ok || playResponse.status === 204) {
              console.log("[v0] ✅ PLAYBACK STARTED SUCCESSFULLY")
              
              const durationMs = track.duration ? track.duration * 1000 : 180000
              startProgressTracking(durationMs)
              
              setIsPlaying(true)
            } else {
              console.error("[v0] ❌ Play failed with status:", playResponse.status)
              setError(`Failed to start playback: ${playResponse.status}`)
            }
          } catch (err) {
            console.error("[v0] ❌ Playback sequence error:", err)
            setError(`Playback failed: ${String(err)}`)
          }
        })

        spotifyPlayer.addListener("not_ready", ({ device_id }) => {
          console.log("[v0] ⚠️ Device NOT READY:", device_id)
        })

        spotifyPlayer.addListener("player_state_changed", (state) => {
          if (!state) return
          
          const wasPlaying = isPlaying
          const nowPlaying = !state.paused
          
          setIsPlaying(nowPlaying)
          console.log(`[v0] STATE: ${nowPlaying ? '▶️ PLAYING' : '⏸️ PAUSED'}`)
          
          if (nowPlaying && !wasPlaying && progressIntervalRef.current === null) {
            const currentProgress = state.position / 1000
            trackStartTimeRef.current = Date.now() - (currentProgress * 1000)
            startProgressTracking(state.duration)
          } else if (!nowPlaying && progressIntervalRef.current) {
            stopProgressTracking()
          }
        })

        console.log("[v0] Connecting player to Spotify...")
        const connected = await spotifyPlayer.connect()
        
        if (!connected) {
          console.error("[v0] ❌ PLAYER CONNECTION FAILED")
          setError("Failed to connect to Spotify")
          setIsLoading(false)
          return
        }

        console.log("[v0] ✅ PLAYER CONNECTED SUCCESSFULLY")
        setPlayer(spotifyPlayer)

      } catch (err) {
        console.error("[v0] ❌ FATAL INITIALIZATION ERROR:", err)
        setError(`Initialization failed: ${String(err)}`)
        setIsLoading(false)
      }
    }

    initializePlayer()

    return () => {
      console.log("[v0] 🧹 Cleanup - disconnecting player")
      stopProgressTracking()
      if (player) {
        player.disconnect()
      }
    }
  }, [track.uri, volume, onProgress, onTrackEnd])

  const togglePlayPause = async () => {
    if (!player) return

    try {
      console.log("[v0] 🎵 Toggle play/pause")
      await player.togglePlay()
    } catch (error) {
      console.error("[v0] ❌ Toggle error:", error)
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
