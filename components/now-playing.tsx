"use client"

import type { Track } from "@/lib/types"
import Image from "next/image"
import { useEffect, useState } from "react"

interface NowPlayingProps {
  track: Track
  timeRemaining: number
  nextTrack?: Track | null
  songProgress: number
}

export function NowPlaying({ track, timeRemaining, nextTrack, songProgress }: NowPlayingProps) {
  const [bars, setBars] = useState<number[]>([])

  useEffect(() => {
    const newBars = Array.from({ length: 100 }, () => Math.random() * 100)
    setBars(newBars)
  }, [])

  const trackDuration = track.duration || 180
  const progressPercentage = (songProgress / trackDuration) * 100

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="mb-6 sm:mb-8 animate-slide-up">
      <div className="bg-gradient-to-b from-card to-secondary/50 rounded-lg sm:rounded-xl p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
          <div className="bg-primary text-primary-foreground px-3 py-1.5 sm:px-4 sm:py-2 rounded-full">
            <div className="text-lg sm:text-2xl font-bold">{timeRemaining}s</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div className="flex flex-col w-full sm:w-auto">
            <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Now Playing
            </div>
            <div className="flex items-end gap-3 sm:gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0 shadow-lg">
                <Image
                  src={track.albumArt || "/placeholder.svg"}
                  alt={`${track.name} album`}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-foreground flex flex-col justify-end pb-0.5 min-w-0">
                <div className="text-base sm:text-lg font-bold truncate">{track.name || "Unknown Track"}</div>
                <div className="text-xs sm:text-sm text-muted-foreground truncate">{track.artist || "Unknown Artist"}</div>
                <div className="text-xs text-muted-foreground/70 truncate">{track.album || "Unknown Album"}</div>
                {track.year && <div className="text-xs text-muted-foreground/70">{track.year}</div>}
              </div>
            </div>
          </div>

          {nextTrack && (
            <div className="flex flex-col w-full sm:w-auto">
              <div className="text-xs sm:text-sm font-bold text-primary uppercase tracking-wider mb-2 sm:text-right">
                Up Next
              </div>
              <div className="flex items-end gap-3 sm:gap-4">
                <div className="text-foreground flex flex-col justify-end pb-0.5 min-w-0 sm:text-right sm:order-1">
                  <div className="text-base sm:text-lg font-bold truncate">{nextTrack.name || "Unknown Track"}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    {nextTrack.artist || "Unknown Artist"}
                  </div>
                  <div className="text-xs text-muted-foreground/70 truncate">{nextTrack.album || "Unknown Album"}</div>
                  {nextTrack.year && <div className="text-xs text-muted-foreground/70">{nextTrack.year}</div>}
                </div>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0 shadow-lg sm:order-2">
                  <Image
                    src={nextTrack.albumArt || "/placeholder.svg"}
                    alt={`${nextTrack.name} album`}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex items-center gap-[1px] sm:gap-[2px] overflow-hidden rounded bg-secondary/80 px-1 sm:px-2 h-10 sm:h-14">
          {bars.map((height, index) => {
            const barProgress = (index / bars.length) * 100
            const isPassed = barProgress <= progressPercentage

            return (
              <div
                key={index}
                className="flex-1 transition-all duration-300 rounded-sm"
                style={{
                  height: `${height}%`,
                  backgroundColor: isPassed ? "#1db954" : "#535353",
                  opacity: isPassed ? 1 : 0.4,
                }}
              />
            )
          })}

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/60 transition-all duration-500 ease-linear"
            style={{ left: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(songProgress)}</span>
          <span>{formatTime(trackDuration)}</span>
        </div>
      </div>
    </div>
  )
}
