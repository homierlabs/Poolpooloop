"use client"

import { Card } from "@/components/ui/card"
import type { Track } from "@/lib/types"
import Image from "next/image"
import { Music } from "lucide-react"

interface NextUpBannerProps {
  track: Track | null
}

export function NextUpBanner({ track }: NextUpBannerProps) {
  if (!track) {
    return null
  }

  return (
    <Card className="p-6 bg-primary/5 border-primary/20">
      <div className="flex items-center gap-4">
        <Music className="w-6 h-6 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary mb-1">NEXT UP</p>
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 flex-shrink-0">
              <Image
                src={track.albumArt || "/placeholder.svg"}
                alt={track.album}
                fill
                className="object-cover rounded"
              />
            </div>
            <div>
              <p className="font-semibold">{track.name}</p>
              <p className="text-sm text-muted-foreground">{track.artist}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
