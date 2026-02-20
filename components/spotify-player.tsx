"use client"

import { useEffect, useState, useRef } from "react"
import type { Track } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from "lucide-react"

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady: (() => void) | undefined
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  togglePlay: () => Promise<void>
  setVolume: (volume: number) => Promise<void>
  addListener: (event: string, callback: (data: any) => void) => void
}

interface SpotifyPlayerProps {
  track: Track
  nextTrack?: Track | null
  onProgress: (progress: number) => void
  onTrackEnd: () => void
}

export function SpotifyPlayer({ track, nextTrack, onProgress, onTrackEnd }: SpotifyPlayerProps) {
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null)
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
  const trackEndCalledRef = useRef<string>("")

  const startProgressTracking = (trackUri: string, durationSec: number) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    playbackStartTimeRef.current = Date.now()
    trackEndCalledRef.current = ""
    onProgress(0)

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - playbackStartTimeRef.current) / 1000)
      onProgress(elapsed)

      if (elapsed >= durationSec - 2 && trackEndCalledRef.current !== trackUri) {
        console.log("[v0] Track ending at", elapsed, "seconds")
        trackEndCalledRef.current = trackUri
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

  const playTrack = async (trackUri: string, durationSec: number) => {
    if (!deviceId || !accessTokenRef.current) {
      console.error("[v0] Cannot play track - no device or token")
      return
    }

    try {
      console.log("[v0] Playing track:", trackUri)
      setIsLoading(true)
      stopProgressTracking()

      const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessTokenRef.current}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: [trackUri],
        }),
      })

      if (playRes.ok || playRes.status === 204) {
        await new Promise((res) => setTimeout(res, 300))

        currentTrackUriRef.current = trackUri
        queuedNextTrackRef.current = ""

        startProgressTracking(trackUri, durationSec)
        setIsPlaying(true)
        setIsLoading(false)
        console.log("[v0] Track playing, duration:", durationSec, "seconds")
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
      console.log("[v0] Queuing next track:", trackUri)

      const queueRes = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessTokenRef.current}`,
        },
      })

      if (queueRes.ok || queueRes.status === 204) {
        queuedNextTrackRef.current = trackUri
        console.log("[v0] Queued successfully")
      }
    } catch (err) {
      console.error("[v0] Queue error:", err)
    }
  }

  useEffect(() => {
    if (nextTrack?.uri && deviceId && accessTokenRef.current) {
      queueNextTrack(nextTrack.uri)
    }
  }, [nextTrack?.uri, deviceId])

  useEffect(() => {
    if (initRef.current && deviceId && player && track.uri && track.uri !== currentTrackUriRef.current) {
      console.log("[v0] Track prop changed, playing new track:", track.name)
      const duration = track.duration || 180
      playTrack(track.uri, duration)
    }
  }, [track.uri, track.id, deviceId, player])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    let spotifyPlayer: SpotifyPlayer | null = null

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
          console.log("[v0] Player ready:", device_id)
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

            await new Promise((res) => setTimeout(res, 400))

            const duration = track.duration || 180
            await playTrack(track.uri, duration)
          } catch (err) {
            setError(`Setup failed: ${String(err)}`)
            setIsLoading(false)
          }
        })

        spotifyPlayer.addListener("player_state_changed", (state) => {
          if (!state) return
          setIsPlaying(!state.paused)
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
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-destructive/10 border border-destructive/30 rounded-2xl shadow-xl p-4 z-50 max-w-[320px] backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h4 className="font-semibold text-destructive mb-1">Premium Required</h4>
            <p className="text-sm text-muted-foreground">Spotify Premium is needed for playback.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-xl p-4 flex flex-col gap-3 z-50 min-w-[260px] md:min-w-[300px]">
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3 text-muted-foreground py-1">
          <div className="relative">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
          <span className="text-sm font-medium">Initializing player...</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button 
            onClick={togglePlayPause} 
            size="icon" 
            className="h-12 w-12 rounded-full shadow-md hover:shadow-lg transition-shadow"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </Button>

          <div className="flex items-center gap-2 flex-1 bg-secondary/50 rounded-full px-3 py-2">
            <Button onClick={toggleMute} size="icon" variant="ghost" className="h-7 w-7 rounded-full">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>

            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{isMuted ? 0 : volume}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
