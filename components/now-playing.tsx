"use client"

import type { Track } from "@/lib/types"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Music2, Clock, Disc3 } from "lucide-react"

interface NowPlayingProps {
  track: Track
  timeRemaining: number
  nextTrack?: Track | null
  songProgress: number
  votingActive?: boolean
}

export function NowPlaying({ track, timeRemaining, nextTrack, songProgress, votingActive = false }: NowPlayingProps) {
  const [bars, setBars] = useState<number[]>([])

  useEffect(() => {
    const newBars = Array.from({ length: 80 }, () => 20 + Math.random() * 80)
    setBars(newBars)
  }, [track.id])

  const trackDuration = track.duration || 180
  const displayProgress = songProgress < 0 ? 0 : songProgress
  const progressPercentage = Math.min((displayProgress / trackDuration) * 100, 100)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        
        {votingActive && (
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
              <Clock className="w-4 h-4" />
              <span className="text-xl font-bold tabular-nums">{timeRemaining}s</span>
            </div>
          </div>
        )}

        <div className="relative flex flex-col lg:flex-row justify-between items-start gap-6 mb-6">
          <div className="flex flex-col w-full lg:w-auto">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Now Playing</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0 shadow-lg group">
                <Image
                  src={track.albumArt || "/placeholder.svg"}
                  alt={`${track.name} album`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Disc3 className="w-8 h-8 text-white animate-spin" style={{ animationDuration: "3s" }} />
                </div>
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <h2 className="text-lg md:text-xl font-bold truncate text-balance">{track.name || "Unknown Track"}</h2>
                <p className="text-sm md:text-base text-muted-foreground truncate">{track.artist || "Unknown Artist"}</p>
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{track.album || "Unknown Album"}</p>
              </div>
            </div>
          </div>

          {nextTrack && (
            <div className="flex flex-col w-full lg:w-auto lg:items-end">
              <div className="flex items-center gap-2 mb-3 lg:flex-row-reverse">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">Up Next</span>
              </div>
              <div className="flex items-center gap-4 lg:flex-row-reverse">
                <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0 shadow-md">
                  <Image
                    src={nextTrack.albumArt || "/placeholder.svg"}
                    alt={`${nextTrack.name} album`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center min-w-0 lg:text-right">
                  <h3 className="text-base md:text-lg font-semibold truncate">{nextTrack.name || "Unknown Track"}</h3>
                  <p className="text-sm text-muted-foreground truncate">{nextTrack.artist || "Unknown Artist"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="relative flex items-end gap-[2px] overflow-hidden rounded-lg bg-secondary/50 px-2 h-12 md:h-16">
            {bars.map((height, index) => {
              const barProgress = (index / bars.length) * 100
              const isPassed = barProgress <= progressPercentage

              return (
                <div
                  key={index}
                  className="flex-1 rounded-t-sm transition-all duration-200"
                  style={{
                    height: `${height}%`,
                    backgroundColor: isPassed ? "var(--primary)" : "var(--muted)",
                    opacity: isPassed ? 1 : 0.3,
                  }}
                />
              )
            })}

            <div
              className="absolute top-0 bottom-0 w-1 bg-foreground rounded-full shadow-lg transition-all duration-300 ease-linear"
              style={{ left: `calc(${Math.min(progressPercentage, 100)}% - 2px)` }}
            />
          </div>

          <div className="mt-3 flex justify-between items-center">
            <span className="text-sm font-medium tabular-nums">{formatTime(displayProgress)}</span>
            <div className="flex-1 mx-4 h-1 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">{formatTime(trackDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
