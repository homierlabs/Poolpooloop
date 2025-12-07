"use client"

import type { Track } from "@/lib/types"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Disc3, Sparkles } from "lucide-react"

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
    const newBars = Array.from({ length: 80 }, () => Math.random() * 100)
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
      {/* Main player card */}
      <div className="relative bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-800/50 overflow-hidden">
        {/* Glow effect behind album art */}
        <div
          className="absolute top-0 left-0 w-64 h-64 opacity-30 blur-3xl pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)`,
          }}
        />

        <div className="relative p-6 md:p-8">
          {/* Voting countdown badge */}
          {votingActive && (
            <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 rounded-full blur-lg opacity-50 animate-pulse" />
                <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-xl font-bold tabular-nums">{timeRemaining}s</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
            {/* Album art section */}
            <div className="flex-shrink-0">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-xl overflow-hidden shadow-2xl">
                  <Image
                    src={track.albumArt || "/placeholder.svg?height=224&width=224&query=album cover"}
                    alt={`${track.name} album`}
                    fill
                    className="object-cover"
                  />
                  {/* Spinning disc overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Disc3 className="w-12 h-12 text-white animate-spin-slow" />
                  </div>
                </div>
              </div>
            </div>

            {/* Track info section */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20">
                    NOW PLAYING
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white truncate mb-2">
                  {track.name || "Unknown Track"}
                </h2>
                <p className="text-lg text-zinc-400 truncate mb-1">{track.artist || "Unknown Artist"}</p>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span className="truncate">{track.album || "Unknown Album"}</span>
                  {track.year && (
                    <>
                      <span>•</span>
                      <span>{track.year}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Progress section */}
              <div className="mt-6">
                {/* Waveform visualization */}
                <div className="relative h-16 md:h-20 bg-zinc-800/50 rounded-xl overflow-hidden px-2">
                  <div className="absolute inset-0 flex items-center gap-[2px]">
                    {bars.map((height, index) => {
                      const barProgress = (index / bars.length) * 100
                      const isPassed = barProgress <= progressPercentage

                      return (
                        <div
                          key={index}
                          className="flex-1 transition-all duration-200 rounded-sm"
                          style={{
                            height: `${height}%`,
                            backgroundColor: isPassed ? "#10b981" : "#3f3f46",
                            opacity: isPassed ? 1 : 0.5,
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* Progress line indicator */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg shadow-white/50 transition-all duration-500 ease-linear"
                    style={{ left: `${Math.min(progressPercentage, 100)}%` }}
                  />
                </div>

                {/* Time display */}
                <div className="flex justify-between items-center mt-3 text-sm">
                  <span className="text-white font-medium tabular-nums">{formatTime(displayProgress)}</span>
                  <span className="text-zinc-500 tabular-nums">{formatTime(trackDuration)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Up Next section */}
      {nextTrack && !votingActive && (
        <div className="bg-zinc-900/60 backdrop-blur-xl rounded-xl border border-zinc-800/50 p-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 relative">
              <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/30 to-transparent rounded-lg blur-sm" />
              <div className="relative w-14 h-14 rounded-lg overflow-hidden">
                <Image
                  src={nextTrack.albumArt || "/placeholder.svg?height=56&width=56&query=album"}
                  alt={`${nextTrack.name} album`}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Up Next</span>
              </div>
              <p className="text-white font-semibold truncate">{nextTrack.name}</p>
              <p className="text-zinc-400 text-sm truncate">{nextTrack.artist}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
