import type { Track } from "@/lib/types"
import { VoteCard } from "@/components/vote-card"
import { Vote } from "lucide-react"

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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <Vote className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Vote for Next Track</h3>
          <p className="text-sm text-muted-foreground">Tap your choice to queue it up</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
