"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { Track } from "@/lib/types"
import Image from "next/image"
import { Check } from "lucide-react"

interface VotingGridProps {
  candidates: Track[]
  votes: number[]
  votedIndex: number | null
  onVote: (index: number) => void
  timeRemaining: number
  votingActive: boolean
}

export function VotingGrid({ candidates, votes, votedIndex, onVote, timeRemaining, votingActive }: VotingGridProps) {
  const totalVotes = votes.reduce((sum, v) => sum + v, 0)

  if (candidates.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">Vote for Next Track</h3>
        {votingActive && (
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">Time remaining: {timeRemaining}s</span>
            <Progress value={(timeRemaining / 15) * 100} className="w-32 h-2" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {candidates.map((track, index) => {
          const votePercent = totalVotes > 0 ? (votes[index] / totalVotes) * 100 : 0
          const hasVoted = votedIndex === index

          return (
            <Card
              key={track.id}
              className={`p-4 transition-all ${
                hasVoted ? "ring-2 ring-primary" : ""
              } ${!votingActive ? "opacity-50" : ""}`}
            >
              <div className="space-y-3">
                <div className="relative w-full aspect-square">
                  <Image
                    src={track.albumArt || "/placeholder.svg"}
                    alt={track.album}
                    fill
                    className="object-cover rounded-md"
                  />
                  {hasVoted && (
                    <div className="absolute inset-0 bg-primary/20 rounded-md flex items-center justify-center">
                      <div className="bg-primary rounded-full p-2">
                        <Check className="w-8 h-8 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold truncate">{track.name}</h4>
                  <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                </div>

                <div className="space-y-2">
                  <Progress value={votePercent} className="h-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {votes[index]} votes ({votePercent.toFixed(0)}%)
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => onVote(index)}
                  disabled={!votingActive || hasVoted}
                  className="w-full"
                  variant={hasVoted ? "default" : "outline"}
                >
                  {hasVoted ? "Voted" : "Vote"}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
