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
  const lastProgressRef = useRef<number>(0)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const playerInitialized = useRef(false)

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
            
            // Method 1: Polling every 100ms
            const pollInterval = setInterval(() => {
              if (window.Spotify && !resolved) {
                resolved = true
                clearInterval(pollInterval)
                console.log("[v0] ✅ SDK loaded via polling")
                resolve()
              }
            }, 100)
            
            // Method 2: SDK ready callback
            window.onSpotifyWebPlaybackSDKReady = () => {
              if (!resolved) {
                resolved = true
                clearInterval(pollInterval)
                console.log("[v0] ✅ SDK loaded via callback")
                resolve()
              }
            }

            // Timeout after 15 seconds
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

        spotifyPlayer.addListener("ready", ({ device_id }) => {
          console.log("[v0] ✅✅✅ PLAYER READY EVENT - Device ID:", device_id)
          setDeviceId(device_id)
          setError("")
          setIsLoading(false)
        })

        spotifyPlayer.addListener("not_ready", ({ device_id }) => {
          console.log("[v0] ⚠️ Device NOT READY:", device_id)
        })

        spotifyPlayer.addListener("player_state_changed", (state) => {
          if (!state) {
            console.log("[v0] STATE: null (this is normal during initialization)")
            return
          }

          const pos = Math.floor(state.position / 1000)
          const dur = Math.floor(state.duration / 1000)
          const paused = state.paused
          
          console.log(`[v0] STATE: ${paused ? '⏸️ PAUSED' : '▶️ PLAYING'} | Position: ${pos}s / ${dur}s | Track: ${state.track_window.current_track.name}`)

          setIsPlaying(!paused)
          
          if (pos !== lastProgressRef.current) {
            lastProgressRef.current = pos
            onProgress(pos)
          }

          // Track ended detection
          if (state.position === 0 && paused && lastProgressRef.current > 5) {
            console.log("[v0] 🎵 TRACK ENDED - calling onTrackEnd")
            onTrackEnd()
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
      if (progressInterval.current) clearInterval(progressInterval.current)
      if (spotifyPlayer) {
        spotifyPlayer.disconnect()
      }
    }
  }, [volume, onProgress, onTrackEnd])

  useEffect(() => {
    if (!deviceId || !track.uri || !player) {
      console.log("[v0] ⏳ Waiting for playback prerequisites:", {
        deviceId: !!deviceId,
        trackUri: !!track.uri,
        player: !!player
      })
      return
    }

    const startPlayback = async () => {
      try {
        console.log("[v0] ====== STARTING PLAYBACK SEQUENCE ======")
        console.log("[v0] Track URI:", track.uri)
        console.log("[v0] Track Name:", track.name)
        console.log("[v0] Device ID:", deviceId)
        
        setError("")

        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json()
        const token = sessionData.accessToken

        console.log("[v0] 🔄 STEP 1: Transferring playback to web player device...")
        const transferResponse = await fetch(`https://api.spotify.com/v1/me/player`, {
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

        if (!transferResponse.ok && transferResponse.status !== 204) {
          console.warn("[v0] ⚠️ Device transfer returned status:", transferResponse.status)
          const errorText = await transferResponse.text()
          console.warn("[v0] Transfer response:", errorText)
        } else {
          console.log("[v0] ✅ Device transfer successful (status:", transferResponse.status, ")")
        }

        console.log("[v0] ⏳ STEP 2: Waiting 500ms for device activation...")
        await new Promise(resolve => setTimeout(resolve, 500))

        console.log("[v0] ▶️ STEP 3: Starting playback via Web API...")
        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            uris: [track.uri],
            position_ms: 0,
          }),
        })

        if (!playResponse.ok && playResponse.status !== 204) {
          const errorText = await playResponse.text()
          console.error("[v0] ❌ PLAYBACK START FAILED - Status:", playResponse.status)
          console.error("[v0] Error details:", errorText)
          setError(`Failed to start playback: ${playResponse.status}`)
          return
        }

        console.log("[v0] ✅✅✅ PLAYBACK STARTED SUCCESSFULLY")
        console.log("[v0] Full track should now be playing continuously")
        
        if (progressInterval.current) clearInterval(progressInterval.current)
        
        progressInterval.current = setInterval(async () => {
          if (!player) return
          
          const state = await player.getCurrentState()
          
          if (!state) {
            console.log("[v0] STATE POLL: null (initializing, this is OK)")
            return
          }

          const pos = Math.floor(state.position / 1000)
          
          if (pos !== lastProgressRef.current) {
            lastProgressRef.current = pos
            onProgress(pos)
          }
        }, 500)

        console.log("[v0] ✅ Progress polling started (500ms interval)")

      } catch (err) {
        console.error("[v0] ❌ PLAYBACK SEQUENCE ERROR:", err)
        setError(`Playback failed: ${String(err)}`)
      }
    }

    startPlayback()
  }, [deviceId, track.uri, track.name, player, onProgress, onTrackEnd])

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
