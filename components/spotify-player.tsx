"use client"

import { useEffect, useState, useRef } from "react"
import type { Track } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react'

interface SpotifyPlayerProps {
  track: Track
  nextTrack?: Track | null
  onProgress: (progress: number) => void
  onTrackEnd: () => void
}

export function SpotifyPlayer({ track, nextTrack, onProgress, onTrackEnd }: SpotifyPlayerProps) {
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
  const accessTokenRef = useRef<string>("")
  const currentTrackUriRef = useRef<string>("")
  const queuedNextTrackRef = useRef<string>("")

  const startProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    playbackStartTimeRef.current = Date.now()
    onProgress(0)
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - playbackStartTimeRef.current) / 1000)
      onProgress(elapsed)
      
      const trackDuration = track.duration || 180
      if (elapsed >= trackDuration - 2) {
        console.log("[v0] Track ending at", elapsed, "seconds (duration:", trackDuration, "), calling onTrackEnd")
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }
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

  const playTrack = async (trackUri: string) => {
    if (!deviceId || !accessTokenRef.current) {
      console.error("[v0] Cannot play track - no device or token")
      return
    }

    try {
      console.log("[v0] Playing new track:", trackUri)
      setIsLoading(true)
      stopProgressTracking()
      
      const playRes = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessTokenRef.current}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: [trackUri],
          }),
        }
      )

      if (playRes.ok || playRes.status === 204) {
        await new Promise(res => setTimeout(res, 300))
        
        currentTrackUriRef.current = trackUri
        queuedNextTrackRef.current = ""
        
        startProgressTracking()
        setIsPlaying(true)
        setIsLoading(false)
        console.log("[v0] New track playing successfully")
      } else {
        setError(`Play failed: ${playRes.status}`)
        setIsLoading(false)
      }
    } catch (err) {
      setError(`Failed to play track: ${String(err)}`)
      setIsLoading(false)
    }
  }

  const queueNextTrack = async (trackUri: string) => {
    if (!deviceId || !accessTokenRef.current || queuedNextTrackRef.current === trackUri) {
      return
    }

    try {
      console.log("[v0] Queuing next track in Spotify:", trackUri)
      
      const queueRes = await fetch(
        `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessTokenRef.current}`,
          },
        }
      )

      if (queueRes.ok || queueRes.status === 204) {
        queuedNextTrackRef.current = trackUri
        console.log("[v0] Successfully queued next track in Spotify")
      } else {
        console.error("[v0] Failed to queue track:", queueRes.status)
      }
    } catch (err) {
      console.error("[v0] Queue API error:", err)
    }
  }

  useEffect(() => {
    if (nextTrack?.uri && deviceId && accessTokenRef.current) {
      console.log("[v0] Next track set, queuing in Spotify:", nextTrack.name)
      queueNextTrack(nextTrack.uri)
    }
  }, [nextTrack?.uri, deviceId])

  useEffect(() => {
    if (initRef.current && deviceId && player && track.uri && track.uri !== currentTrackUriRef.current) {
      console.log("[v0] Track changed from", currentTrackUriRef.current, "to", track.uri)
      console.log("[v0] Playing new track:", track.name)
      playTrack(track.uri)
    }
  }, [track.uri, deviceId, player])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    let spotifyPlayer: Spotify.Player | null = null

    const initialize = async () => {
      try {
        setIsLoading(true)
        setError("")
        
        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json()

        if (!sessionData.authenticated || !sessionData.accessToken) {
          setError("Not authenticated")
          setIsLoading(false)
          return
        }

        accessTokenRef.current = sessionData.accessToken

        if (!window.Spotify) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("SDK timeout")), 5000)
            
            window.onSpotifyWebPlaybackSDKReady = () => {
              clearTimeout(timeout)
              resolve()
            }
            
            const poll = setInterval(() => {
              if (window.Spotify) {
                clearTimeout(timeout)
                clearInterval(poll)
                resolve()
              }
            }, 50)
          })
        }

        spotifyPlayer = new window.Spotify.Player({
          name: "DJ Interface Web Player",
          getOAuthToken: (cb) => cb(accessTokenRef.current),
          volume: volume / 100,
        })

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

        spotifyPlayer.addListener("ready", async ({ device_id }) => {
          console.log("[v0] Player ready with device ID:", device_id)
          setDeviceId(device_id)
          setPlayer(spotifyPlayer)
          setError("")
          
          try {
            await fetch("https://api.spotify.com/v1/me/player", {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${accessTokenRef.current}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                device_ids: [device_id],
                play: false,
              }),
            })

            await new Promise(res => setTimeout(res, 400))

            await playTrack(track.uri)

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
            const currentSec = Math.floor(state.position / 1000)
            playbackStartTimeRef.current = Date.now() - (currentSec * 1000)
            startProgressTracking()
          } else if (!nowPlaying && progressIntervalRef.current) {
            stopProgressTracking()
          }
        })

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
      if (player) {
        player.disconnect()
      }
    }
  }, [])

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
