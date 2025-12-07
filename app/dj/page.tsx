"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
  const [trackKey, setTrackKey] = useState<string>("")

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
        setTrackKey(data.track.id)
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

  const handleTrackEnd = useCallback(() => {
    console.log("[v0] ===== TRACK ENDED =====")

    if (nextTrack) {
      const upcomingTrack = { ...nextTrack }
      console.log("[v0] Transitioning to:", upcomingTrack.name)

      isTransitioningRef.current = true

      setTrackKey(upcomingTrack.id)

      setNextTrack(null)
      setVotingActive(false)
      setVotedIndex(null)
      setVotes([0, 0, 0, 0])
      setTimeRemaining(VOTING_DURATION)
      setSongProgress(0)
      setCandidates([])

      setCurrentTrack(upcomingTrack)

      setTimeout(() => {
        isTransitioningRef.current = false
        fetchSimilarTracks(upcomingTrack)
      }, 2000)
    } else {
      console.log("[v0] No next track queued")
    }
  }, [nextTrack])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <Music2 className="w-6 h-6 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-zinc-400 text-sm animate-pulse">Loading your session...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-red-400">{error}</p>
          <Button onClick={() => router.push("/select-song")} className="bg-emerald-600 hover:bg-emerald-700">
            Back to Song Selection
          </Button>
        </div>
      </div>
    )
  }

  if (!currentTrack) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Background ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-emerald-500/3 rounded-full blur-3xl" />
      </div>

      <SpotifyPlayer
        track={currentTrack}
        nextTrack={nextTrack}
        onProgress={handlePlayerProgress}
        onTrackEnd={handleTrackEnd}
      />

      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Music2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">DJ Session</h1>
              <p className="text-zinc-500 text-sm">Interactive voting experience</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Exit
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
          timeRemaining={timeRemaining}
        />
      </div>
    </div>
  )
}
