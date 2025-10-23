import type { Track } from "@/lib/types"
import { VoteCard } from "@/components/vote-card"

interface VotingGridProps {
  candidates: Track[]
  onVote: (index: number) => void
  votedIndex: number | null
  votes: number[]
  isActive?: boolean
}

export function VotingGrid({ candidates, onVote, votedIndex, votes, isActive = true }: VotingGridProps) {
  if (!isActive || candidates.length === 0) {
    return null
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Vote for the next track</h3>
        <p className="text-muted-foreground text-sm sm:text-base">Choose the track that best fits the vibe</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
    </div>
  )
}
