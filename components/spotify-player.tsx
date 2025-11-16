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
  
  const initRef = useRef(false)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const playbackStartTimeRef = useRef<number>(0)

  const startProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    playbackStartTimeRef.current = Date.now()
    onProgress(0)
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - playbackStartTimeRef.current) / 1000)
      onProgress(elapsed)
      
      // Check if track has ended
      const trackDuration = track.duration || 180
      if (elapsed >= trackDuration) {
        clearInterval(progressIntervalRef.current!)
        progressIntervalRef.current = null
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
    if (initRef.current) return
    initRef.current = true

    let spotifyPlayer: Spotify.Player | null = null
    let accessToken = ""

    const initialize = async () => {
      try {
        setIsLoading(true)
        setError("")
        
        // Step 1: Get access token
        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json()

        if (!sessionData.authenticated || !sessionData.accessToken) {
          setError("Not authenticated")
          setIsLoading(false)
          return
        }

        accessToken = sessionData.accessToken

        // Step 2: Wait for Spotify SDK
        if (!window.Spotify) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("SDK timeout")), 10000)
            
            window.onSpotifyWebPlaybackSDKReady = () => {
              clearTimeout(timeout)
              resolve()
            }
            
            // Also poll in case callback already fired
            const poll = setInterval(() => {
              if (window.Spotify) {
                clearTimeout(timeout)
                clearInterval(poll)
                resolve()
              }
            }, 100)
          })
        }

        // Step 3: Create player
        spotifyPlayer = new window.Spotify.Player({
          name: "DJ Interface Web Player",
          getOAuthToken: (cb) => cb(accessToken),
          volume: volume / 100,
        })

        // Step 4: Setup error listeners
        spotifyPlayer.addListener("initialization_error", ({ message }) => {
          setError(`Init error: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("authentication_error", ({ message }) => {
          setError(`Auth error: ${message}`)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("account_error", ({ message }) => {
          setError("Spotify Premium required")
          setIsPremium(false)
          setIsLoading(false)
        })

        spotifyPlayer.addListener("playback_error", ({ message }) => {
          setError(`Playback error: ${message}`)
        })

        // Step 5: Handle player ready
        spotifyPlayer.addListener("ready", async ({ device_id }) => {
          setDeviceId(device_id)
          setPlayer(spotifyPlayer)
          setError("")
          
          try {
            // Transfer playback to this device
            await fetch("https://api.spotify.com/v1/me/player", {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                device_ids: [device_id],
                play: false,
              }),
            })

            // Wait for transfer to complete
            await new Promise(res => setTimeout(res, 800))

            // Start playback
            const playRes = await fetch(
              `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  uris: [track.uri],
                }),
              }
            )

            if (playRes.ok || playRes.status === 204) {
              // Wait a moment for playback to actually start
              await new Promise(res => setTimeout(res, 500))
              
              startProgressTracking()
              setIsPlaying(true)
              setIsLoading(false)
            } else {
              setError(`Play failed: ${playRes.status}`)
              setIsLoading(false)
            }
          } catch (err) {
            setError(`Playback setup failed: ${String(err)}`)
            setIsLoading(false)
          }
        })

        spotifyPlayer.addListener("player_state_changed", (state) => {
          if (!state) return
          
          const nowPlaying = !state.paused
          setIsPlaying(nowPlaying)
          
          if (nowPlaying && !progressIntervalRef.current) {
            // Resume from current position
            const currentSec = Math.floor(state.position / 1000)
            playbackStartTimeRef.current = Date.now() - (currentSec * 1000)
            startProgressTracking()
          } else if (!nowPlaying && progressIntervalRef.current) {
            stopProgressTracking()
          }
        })

        // Step 6: Connect player
        const connected = await spotifyPlayer.connect()
        
        if (!connected) {
          setError("Failed to connect")
          setIsLoading(false)
        }

      } catch (err) {
        setError(`Init failed: ${String(err)}`)
        setIsLoading(false)
      }
    }

    initialize()

    return () => {
      stopProgressTracking()
      if (spotifyPlayer) {
        spotifyPlayer.disconnect()
      }
    }
  }, [track.uri])

  const togglePlayPause = async () => {
    if (!player) return
    await player.togglePlay()
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
