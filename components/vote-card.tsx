"use client"

import type { Track } from "@/lib/types"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface VoteCardProps {
  track: Track
  index: number
  onVote: () => void
  isVoted: boolean
  isDisabled: boolean
  voteCount: number
}

export function VoteCard({ track, onVote, isVoted, isDisabled, voteCount }: VoteCardProps) {
  return (
    <button
      onClick={onVote}
      disabled={isDisabled}
      className={cn(
        "group relative bg-card rounded-2xl text-left transition-all duration-300 overflow-hidden",
        "hover:bg-secondary active:scale-[0.98]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "aspect-square flex flex-col",
        isVoted && "ring-2 ring-primary",
        !isDisabled && "hover:ring-2 hover:ring-accent",
      )}
    >
      {/* Album cover - takes up most of the card */}
      <div className="relative w-full flex-1 bg-muted">
        <Image
          src={
            track.albumArt || `/placeholder.svg?height=300&width=300&query=${encodeURIComponent(track.name + " album")}`
          }
          alt={track.name}
          fill
          className="object-cover"
        />

        {/* Vote indicators overlay */}
        {isVoted && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary rounded-full flex items-center justify-center shadow-lg">
              <Check className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground stroke-[3]" />
            </div>
          </div>
        )}

        {voteCount > 0 && !isVoted && (
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-background/90 backdrop-blur-sm text-foreground px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold shadow-lg">
            {voteCount}
          </div>
        )}
      </div>

      {/* Track info at bottom */}
      <div className="p-3 sm:p-4 bg-card">
        <h4 className="text-sm sm:text-base font-bold mb-0.5 truncate group-hover:text-primary transition-colors">
          {track.name}
        </h4>
        <p className="text-xs sm:text-sm text-muted-foreground truncate">{track.artist}</p>
      </div>
    </button>
  )
}
