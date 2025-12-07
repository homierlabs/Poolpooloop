"use client"

import type { Track } from "@/lib/types"
import { VoteCard } from "@/components/vote-card"
import { Timer, Vote } from "lucide-react"

interface VotingGridProps {
  candidates: Track[]
  onVote: (index: number) => void
  votedIndex: number | null
  votes: number[]
  isActive?: boolean
  timeRemaining?: number
}

export function VotingGrid({
  candidates,
  onVote,
  votedIndex,
  votes,
  isActive = true,
  timeRemaining = 15,
}: VotingGridProps) {
  if (!isActive || candidates.length === 0) {
    return null
  }

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-700">
      {/* Header section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
            <Vote className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-white">Vote for Next Track</h3>
            <p className="text-zinc-500 text-sm">Choose the track that fits the vibe</p>
          </div>
        </div>

        {/* Timer badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 rounded-full border border-zinc-700/50">
          <Timer className="w-4 h-4 text-emerald-400" />
          <span className="text-white font-bold tabular-nums">{timeRemaining}s</span>
        </div>
      </div>

      {/* Voting cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {candidates.map((track, index) => (
          <VoteCard
            key={track.id}
            track={track}
            index={index}
            onVote={() => onVote(index)}
            isVoted={votedIndex === index}
            isDisabled={votedIndex !== null}
            voteCount={votes[index]}
          />
        ))}
      </div>

      {/* Voted confirmation */}
      {votedIndex !== null && (
        <div className="mt-4 text-center">
          <p className="text-emerald-400 text-sm font-medium animate-pulse">✓ Vote recorded! Waiting for results...</p>
        </div>
      )}
    </div>
  )
}
