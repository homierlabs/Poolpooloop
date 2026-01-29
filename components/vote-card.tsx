"use client"

import type { Track } from "@/lib/types"
import { Check, Music } from "lucide-react"
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
        "group relative bg-card border border-border rounded-xl text-left transition-all duration-300 overflow-hidden shadow-sm",
        "hover:shadow-md hover:border-primary/50 active:scale-[0.98]",
        "disabled:cursor-not-allowed",
        "flex flex-col",
        isVoted && "ring-2 ring-primary border-primary shadow-lg",
        isDisabled && !isVoted && "opacity-60",
      )}
    >
      <div className="relative w-full aspect-square bg-muted">
        <Image
          src={track.albumArt || "/placeholder.svg"}
          alt={track.name}
          fill
          className={cn(
            "object-cover transition-all duration-500",
            !isDisabled && "group-hover:scale-105",
          )}
        />
        
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300",
          !isDisabled && "group-hover:opacity-100",
        )} />

        {isVoted && (
          <div className="absolute inset-0 bg-primary/30 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in zoom-in duration-300">
            <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-xl">
              <Check className="w-7 h-7 text-primary-foreground stroke-[3]" />
            </div>
          </div>
        )}

        {voteCount > 0 && !isVoted && (
          <div className="absolute top-2 right-2 bg-background/95 backdrop-blur-sm text-foreground px-3 py-1 rounded-full text-sm font-bold shadow-md border border-border">
            {voteCount} {voteCount === 1 ? "vote" : "votes"}
          </div>
        )}
        
        {!isDisabled && !isVoted && (
          <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <div className="bg-primary text-primary-foreground text-center py-2 px-4 rounded-lg font-semibold text-sm shadow-lg">
              Vote for this track
            </div>
          </div>
        )}
      </div>

      <div className="p-3 md:p-4 bg-card border-t border-border">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <Music className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm md:text-base font-semibold truncate group-hover:text-primary transition-colors">
              {track.name}
            </h4>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{track.artist}</p>
          </div>
        </div>
      </div>
    </button>
  )
}
