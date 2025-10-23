"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { Track } from "@/lib/types"
import Image from "next/image"

interface NowPlayingProps {
  track: Track | null
  progress: number
  duration: number
}

export function NowPlaying({ track, progress, duration }: NowPlayingProps) {
  if (!track) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No track playing</p>
        </div>
      </Card>
    )
  }

  const progressPercent = (progress / duration) * 100

  return (
    <Card className="p-8">
      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="relative w-48 h-48 flex-shrink-0">
          <Image
            src={track.albumArt || "/placeholder.svg"}
            alt={track.album}
            fill
            className="object-cover rounded-lg"
          />
        </div>
        <div className="flex-1 w-full">
          <h2 className="text-3xl font-bold mb-2">{track.name}</h2>
          <p className="text-xl text-muted-foreground mb-4">{track.artist}</p>
          <p className="text-sm text-muted-foreground mb-6">{track.album}</p>
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
