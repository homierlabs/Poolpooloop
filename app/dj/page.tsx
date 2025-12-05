"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { NowPlaying } from "@/components/now-playing"
import { VotingGrid } from "@/components/voting-grid"
import { NextUpBanner } from "@/components/next-up-banner"
import { SpotifyPlayer } from "@/components/spotify-player"
import { Button } from "@/components/ui/button"
import type { Track } from "@/lib/types"
import { LogOut } from "lucide-react"

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

  const currentTrackIdRef = useRef<string>("")
  const votingTriggeredForTrackRef = useRef<string>("")
  const isTransitioningRef = useRef(false)

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  useEffect(() => {
    if (!votingActive) return

    const votingTimer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          selectWinner()
          clearInterval(votingTimer)
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
        currentTrackIdRef.current = data.track.id
        setCurrentTrack(data.track)
        await fetchSimilarTracks(data.track)
      } else {
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

        setCandidates(similarTracks)
        setRoundId(`round_${Date.now()}_${track.id}`)
      } else {
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

    const selectedTrack = candidates[index]
    setVotedIndex(index)
    setNextTrack(selectedTrack)

    setVotes((prev) => {
      const newVotes = [...prev]
      newVotes[index] += 1
      return newVotes
    })

    try {
      await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: candidates[index].id,
          roundId,
        }),
      })
    } catch (error) {
      console.error("[v0] Vote submission failed:", error)
    }
  }

  const selectWinner = () => {
    console.log("[v0] Voting ended, selecting winner")

    if (votedIndex !== null && nextTrack) {
      console.log("[v0] User voted for:", nextTrack.name)
    } else if (votes.length > 0) {
      const maxVotes = Math.max(...votes)
      if (maxVotes > 0) {
        const winnerIndices = votes
          .map((v, i) => ({ votes: v, index: i }))
          .filter((v) => v.votes === maxVotes)
          .map((v) => v.index)

        const winnerIndex = winnerIndices[Math.floor(Math.random() * winnerIndices.length)]
        setNextTrack(candidates[winnerIndex])
      } else {
        setNextTrack(candidates[0])
      }
    }

    setVotingActive(false)
    setTimeRemaining(VOTING_DURATION)
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
    if (isTransitioningRef.current) return

    setSongProgress(progress)

    if (!currentTrack || progress <= 0) return

    const trackDuration = currentTrack.duration || TRACK_DURATION_FALLBACK
    const midPoint = Math.floor(trackDuration / 2)

    const alreadyVotedThisTrack = votingTriggeredForTrackRef.current === currentTrack.id

    if (
      progress >= midPoint &&
      progress < trackDuration - 10 &&
      !votingActive &&
      !alreadyVotedThisTrack &&
      candidates.length >= 4 &&
      !nextTrack
    ) {
      console.log("[v0] Activating voting at midpoint:", progress, "/ duration:", trackDuration)
      votingTriggeredForTrackRef.current = currentTrack.id
      setVotingActive(true)
      setTimeRemaining(VOTING_DURATION)
      setVotes([0, 0, 0, 0])
      setVotedIndex(null)
    }
  }

  const handleTrackEnd = () => {
    console.log("[v0] ===== TRACK ENDED =====")

    if (nextTrack) {
      const upcomingTrack = { ...nextTrack }
      console.log("[v0] Transitioning to:", upcomingTrack.name)

      isTransitioningRef.current = true

      currentTrackIdRef.current = upcomingTrack.id

      // Reset all state for new track
      setNextTrack(null)
      setVotingActive(false)
      setVotedIndex(null)
      setVotes([0, 0, 0, 0])
      setTimeRemaining(VOTING_DURATION)
      setSongProgress(0)
      setCandidates([])

      // Set new current track
      setCurrentTrack(upcomingTrack)

      setTimeout(() => {
        isTransitioningRef.current = false
        fetchSimilarTracks(upcomingTrack)
      }, 2000)
    } else {
      console.log("[v0] No next track queued")
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
      <SpotifyPlayer
        track={currentTrack}
        nextTrack={nextTrack}
        onProgress={handlePlayerProgress}
        onTrackEnd={handleTrackEnd}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">DJ Interface</h1>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <NowPlaying
          key={currentTrackIdRef.current}
          track={currentTrack}
          timeRemaining={timeRemaining}
          nextTrack={nextTrack}
          songProgress={songProgress}
          votingActive={votingActive}
        />

        {nextTrack && !votingActive && <NextUpBanner track={nextTrack} />}

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
