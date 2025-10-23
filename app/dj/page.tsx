"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { NowPlaying } from "@/components/now-playing"
import { VotingGrid } from "@/components/voting-grid"
import { NextUpBanner } from "@/components/next-up-banner"
import { Button } from "@/components/ui/button"
import type { Track } from "@/lib/types"
import { LogOut } from "lucide-react"

export default function DJInterface() {
  const router = useRouter()
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [candidates, setCandidates] = useState<Track[]>([])
  const [nextTrack, setNextTrack] = useState<Track | null>(null)
  const [votedIndex, setVotedIndex] = useState<number | null>(null)
  const [songProgress, setSongProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(15)
  const [votes, setVotes] = useState<number[]>([0, 0, 0, 0, 0, 0])
  const [votingActive, setVotingActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  useEffect(() => {
    if (!currentTrack) return

    const songTimer = setInterval(() => {
      setSongProgress((prev) => {
        if (prev >= 180) {
          if (nextTrack) {
            setCurrentTrack(nextTrack)
            fetchNextRound()
          }
          return 0
        }
        if (prev === 90) {
          setVotingActive(true)
          setTimeRemaining(15)
        }
        return prev + 1
      })
    }, 1000)

    return () => clearInterval(songTimer)
  }, [currentTrack, nextTrack])

  useEffect(() => {
    if (!votingActive || candidates.length === 0) return

    const votingTimer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          selectWinner()
          setVotingActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(votingTimer)
  }, [votingActive, candidates, votes])

  const checkAuthAndFetch = async () => {
    try {
      const response = await fetch("/api/auth/session")
      if (!response.ok) {
        router.push("/")
        return
      }
      await fetchNextRound()
    } catch (error) {
      console.error("[v0] Auth check failed:", error)
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNextRound = async () => {
    try {
      const response = await fetch("/api/tracks")
      const data = await response.json()

      if (!currentTrack && data.tracks.length > 0) {
        setCurrentTrack(data.tracks[0])
        setSongProgress(0)
      }

      const nextCandidates = selectNextCandidates(currentTrack || data.tracks[0], data.tracks)
      setCandidates(nextCandidates)
      setVotedIndex(null)
      setNextTrack(null)
      setVotes([0, 0, 0, 0, 0, 0])
      setVotingActive(false)
    } catch (error) {
      console.error("[v0] Failed to fetch tracks:", error)
    }
  }

  const selectNextCandidates = (current: Track, tracks: Track[]): Track[] => {
    return tracks
      .filter((t) => t.id !== current.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
  }

  const handleVote = (index: number) => {
    if (!votingActive || votedIndex !== null) return

    setVotedIndex(index)
    setVotes((prev) => {
      const newVotes = [...prev]
      newVotes[index] += 1
      return newVotes
    })

    // Submit vote to server
    fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: candidates[index].id }),
    }).catch((error) => console.error("[v0] Vote submission failed:", error))
  }

  const selectWinner = () => {
    const maxVotes = Math.max(...votes)
    const winnerIndex = votes.indexOf(maxVotes)

    if (winnerIndex !== -1 && candidates[winnerIndex]) {
      setNextTrack(candidates[winnerIndex])
    }
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/")
    } catch (error) {
      console.error("[v0] Logout failed:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">DJ Interface</h1>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <NowPlaying track={currentTrack} progress={songProgress} duration={180} />

        {nextTrack && <NextUpBanner track={nextTrack} />}

        <VotingGrid
          candidates={candidates}
          votes={votes}
          votedIndex={votedIndex}
          onVote={handleVote}
          timeRemaining={timeRemaining}
          votingActive={votingActive}
        />
      </div>
    </div>
  )
}
