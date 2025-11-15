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
  
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const trackDurationRef = useRef<number>(0)
  const isTimerRunningRef = useRef(false)
  // </CHANGE>

  const startProgressTimer = (durationMs: number) => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
    }
    
    startTimeRef.current = Date.now()
    trackDurationRef.current = Math.floor(durationMs / 1000)
    isTimerRunningRef.current = true
    
    console.log(`[v0] ⏱️ Starting independent timer for ${trackDurationRef.current}s`)
    
    progressTimerRef.current = setInterval(() => {
      if (!isTimerRunningRef.current) return
      
      const elapsed = Date.now() - startTimeRef.current
      const currentSec = Math.floor(elapsed / 1000)
      
      onProgress(currentSec)
      
      // Check for track end
      if (currentSec >= trackDurationRef.current - 1) {
        console.log("[v0] 🎵 Track ended (timer)")
        stopProgressTimer()
        onTrackEnd()
      }
    }, 1000)
  }

  const stopProgressTimer = () => {
    isTimerRunningRef.current = false
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }
  // </CHANGE>

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
          console.log("🎧 Web Playback SDK device_id:", device_id)
          setDeviceId(device_id)
          setError("")
          setIsLoading(false)

          if (playbackStarted.current || !track.uri) return
          playbackStarted.current = true

          try {
            await new Promise((res) => setTimeout(res, 1200))

            const transfer = await fetch("https://api.spotify.com/v1/me/player", {
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

            console.log("Transfer status:", transfer.status)

            let deviceConfirmed = false
            for (let i = 0; i < 6; i++) {
              const devicesResp = await fetch("https://api.spotify.com/v1/me/player/devices", {
                headers: { Authorization: `Bearer ${token}` }
              })

              const devicesJson = await devicesResp.json()
              console.log(`[v0] Devices poll ${i + 1}:`, devicesJson)

              if (Array.isArray(devicesJson.devices)) {
                const found = devicesJson.devices.find((d: any) => d.id === device_id)
                if (found) {
                  console.log("[v0] ✅ Device confirmed active:", found)
                  deviceConfirmed = true
                  break
                }
              }

              await new Promise((res) => setTimeout(res, 400))
            }

            if (!deviceConfirmed) {
              console.warn("[v0] ⚠️ Device did NOT show up in devices list — playback may fail")
            }

            await new Promise((res) => setTimeout(res, 500))

            const play = await fetch(
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

            console.log("Play status:", play.status)

            if (play.ok || play.status === 204) {
              console.log("[v0] ✅✅✅ PLAYBACK STARTED SUCCESSFULLY")
              
              const durationMs = track.duration ? track.duration * 1000 : 180000
              startProgressTimer(durationMs)
              // </CHANGE>
            } else {
              console.error("[v0] ❌ Play failed with status:", play.status)
              setError(`Failed to start playback: ${play.status}`)
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
          setIsPlaying(!state.paused)
          console.log(`[v0] STATE: ${state.paused ? '⏸️ PAUSED' : '▶️ PLAYING'}`)
        })
        // </CHANGE>

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
      stopProgressTimer()
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
