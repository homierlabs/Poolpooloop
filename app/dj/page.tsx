"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { NowPlaying } from "@/components/now-playing"
import { VotingGrid } from "@/components/voting-grid"
import { SpotifyPlayer } from "@/components/spotify-player"
import { Button } from "@/components/ui/button"
import type { Track } from "@/lib/types"
import { LogOut, Music2 } from "lucide-react"

const VOTING_DURATION = 15
const TRACK_DURATION_FALLBACK = 180

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
  const [trackKey, setTrackKey] = useState<number>(0)

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
        setCurrentTrack(data.track)
        setTrackKey(Date.now())
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

      // Reset all state for new track
      setNextTrack(null)
      setVotingActive(false)
      setVotedIndex(null)
      setVotes([0, 0, 0, 0])
      setTimeRemaining(VOTING_DURATION)
      setSongProgress(0)
      setCandidates([])

      // Set new current track and force UI update
      setCurrentTrack(upcomingTrack)
      setTrackKey(Date.now())

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Music2 className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-muted-foreground animate-pulse">Loading session...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5">
        <div className="text-center space-y-4 p-8 bg-card rounded-2xl border shadow-lg max-w-md">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Music2 className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-destructive font-medium">{error}</p>
          <Button onClick={() => router.push("/select-song")} className="w-full">
            Back to Song Selection
          </Button>
        </div>
      </div>
    )
  }

  if (!currentTrack) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Music2 className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-muted-foreground animate-pulse">Preparing track...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SpotifyPlayer
        track={currentTrack}
        nextTrack={nextTrack}
        onProgress={handlePlayerProgress}
        onTrackEnd={handleTrackEnd}
      />

      <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-10 space-y-8">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Music2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">DJ Session</h1>
              <p className="text-sm text-muted-foreground">Vote for what plays next</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm" className="gap-2 bg-transparent">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </header>

        <NowPlaying
          key={trackKey}
          track={currentTrack}
          timeRemaining={timeRemaining}
          nextTrack={nextTrack}
          songProgress={songProgress}
          votingActive={votingActive}
        />

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
