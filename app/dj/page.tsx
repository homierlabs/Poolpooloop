"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from 'next/navigation'
import { NowPlaying } from "@/components/now-playing"
import { VotingGrid } from "@/components/voting-grid"
import { NextUpBanner } from "@/components/next-up-banner"
import { SpotifyPlayer } from "@/components/spotify-player"
import { Button } from "@/components/ui/button"
import type { Track } from "@/lib/types"
import { LogOut } from 'lucide-react'

const VOTING_DURATION = 15 // seconds
const TRACK_DURATION_FALLBACK = 180 // 3 minutes if duration unknown

export default function DJInterface() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [candidates, setCandidates] = useState<Track[]>([])
  const [nextTrack, setNextTrack] = useState<Track | null>(null)
  const [votedIndex, setVotedIndex] = useState<number | null>(null)
  const [songProgress, setSongProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(VOTING_DURATION)
  const [votes, setVotes] = useState<number[]>([0, 0, 0, 0])
  const [votingActive, setVotingActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [roundId, setRoundId] = useState<string>("")

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  useEffect(() => {
    if (!votingActive) return

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

      const trackId = searchParams.get("trackId")
      if (!trackId) {
        console.log("[v0] No trackId provided, redirecting to song selection")
        router.push("/select-song")
        return
      }

      await fetchInitialTrack(trackId)
    } catch (error) {
      console.error("[v0] Auth check failed:", error)
      setError("Authentication failed")
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInitialTrack = async (trackId: string) => {
    try {
      const response = await fetch(`/api/tracks/by-id?id=${trackId}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch track")
      }

      const data = await response.json()

      if (data.track) {
        console.log("[v0] Loaded selected track:", data.track)
        setCurrentTrack(data.track)
        await fetchSimilarTracks(data.track)
      } else {
        console.error("[v0] Track not found, redirecting to song selection")
        router.push("/select-song")
      }
    } catch (error) {
      console.error("[v0] Failed to fetch initial track:", error)
      setError("Failed to load track")
      router.push("/select-song")
    }
  }

  const fetchSimilarTracks = async (track: Track) => {
    try {
      const response = await fetch(`/api/tracks/similar?trackId=${track.id}`)
      const data = await response.json()

      if (data.tracks && data.tracks.length >= 4) {
        const similarTracks = data.tracks
          .filter((t: Track) => t.id !== track.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 4)

        console.log("[v0] Loaded 4 similar tracks")
        setCandidates(similarTracks)
        // Create new voting round
        setRoundId(`round_${Date.now()}_${track.id}`)
      } else {
        console.warn("[v0] Not enough similar tracks, fetching fallback")
        const fallbackResponse = await fetch("/api/tracks")
        const fallbackData = await fallbackResponse.json()
        
        if (fallbackData.tracks && fallbackData.tracks.length > 0) {
          const nextCandidates = fallbackData.tracks
            .filter((t: Track) => t.id !== track.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 4)
          setCandidates(nextCandidates)
          setRoundId(`round_${Date.now()}_${track.id}`)
        }
      }
    } catch (error) {
      console.error("[v0] Failed to fetch similar tracks:", error)
      setError("Failed to load candidate tracks")
    }
  }

  const handleVote = async (index: number) => {
    if (!votingActive || votedIndex !== null || !roundId) return

    setVotedIndex(index)
    
    setVotes((prev) => {
      const newVotes = [...prev]
      newVotes[index] += 1
      return newVotes
    })

    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          trackId: candidates[index].id,
          roundId 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("[v0] Vote failed:", data.error)
        // Revert optimistic update
        setVotes((prev) => {
          const newVotes = [...prev]
          newVotes[index] = Math.max(0, newVotes[index] - 1)
          return newVotes
        })
        setVotedIndex(null)
      } else {
        console.log("[v0] Vote recorded successfully for:", candidates[index].name)
      }
    } catch (error) {
      console.error("[v0] Vote submission failed:", error)
      // Revert optimistic update
      setVotes((prev) => {
        const newVotes = [...prev]
        newVotes[index] = Math.max(0, newVotes[index] - 1)
        return newVotes
      })
      setVotedIndex(null)
    }
  }

  const selectWinner = () => {
    const maxVotes = Math.max(...votes)
    
    // Handle tie - pick random winner among tied tracks
    const winnerIndices = votes
      .map((v, i) => ({ votes: v, index: i }))
      .filter(v => v.votes === maxVotes)
      .map(v => v.index)
    
    const winnerIndex = winnerIndices[Math.floor(Math.random() * winnerIndices.length)]

    if (winnerIndex !== undefined && candidates[winnerIndex]) {
      const winningTrack = candidates[winnerIndex]
      console.log("[v0] Winner selected:", winningTrack.name, "at index", winnerIndex, "with", maxVotes, "votes")
      setNextTrack(winningTrack)
    } else {
      // Fallback: pick first candidate
      console.log("[v0] No clear winner, selecting first candidate as fallback")
      setNextTrack(candidates[0])
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

  const handlePlayerProgress = (progress: number) => {
    setSongProgress(progress)

    if (!currentTrack || progress <= 0) return

    const trackDuration = currentTrack.duration || TRACK_DURATION_FALLBACK
    const midPoint = Math.floor(trackDuration / 2)
    
    if (progress >= midPoint && !votingActive && candidates.length >= 4 && !nextTrack) {
      setVotingActive(true)
      setTimeRemaining(VOTING_DURATION)
      setVotes([0, 0, 0, 0])
      setVotedIndex(null)
    }
  }

  const handleTrackEnd = () => {
    if (nextTrack) {
      console.log("[v0] Moving to next track:", nextTrack.name)
      setCurrentTrack(nextTrack)
      setSongProgress(0)
      setVotingActive(false)
      setVotedIndex(null)
      setVotes([0, 0, 0, 0])
      setTimeRemaining(VOTING_DURATION)
      
      const nextTrackCopy = nextTrack
      setNextTrack(null)
      fetchSimilarTracks(nextTrackCopy)
    } else {
      console.log("[v0] No next track selected, track will loop or stop")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => router.push("/select-song")}>Back to Song Selection</Button>
        </div>
      </div>
    )
  }

  if (!currentTrack) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <SpotifyPlayer track={currentTrack} onProgress={handlePlayerProgress} onTrackEnd={handleTrackEnd} />

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">DJ Interface</h1>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <NowPlaying
          track={currentTrack}
          timeRemaining={timeRemaining}
          nextTrack={nextTrack}
          songProgress={songProgress}
          votingActive={votingActive}
        />

        {nextTrack && <NextUpBanner track={nextTrack} />}

        <VotingGrid
          candidates={candidates}
          votes={votes}
          votedIndex={votedIndex}
          onVote={handleVote}
          isActive={votingActive}
        />
      </div>
    </div>
  )
}
