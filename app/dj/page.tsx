"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { NowPlaying } from "@/components/now-playing"
import { VotingGrid } from "@/components/voting-grid"
import { NextUpBanner } from "@/components/next-up-banner"
import { Button } from "@/components/ui/button"
import type { Track } from "@/lib/types"
import { LogOut } from "lucide-react"

export default function DJInterface() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [candidates, setCandidates] = useState<Track[]>([])
  const [nextTrack, setNextTrack] = useState<Track | null>(null)
  const [votedIndex, setVotedIndex] = useState<number | null>(null)
  const [songProgress, setSongProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(15)
  const [votes, setVotes] = useState<number[]>([0, 0, 0, 0])
  const [votingActive, setVotingActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  useEffect(() => {
    if (!currentTrack) return

    const songTimer = setInterval(() => {
      setSongProgress((prev) => {
        if (prev >= currentTrack.duration) {
          if (nextTrack) {
            setCurrentTrack(nextTrack)
            setSongProgress(0)
            setVotingActive(false)
            setVotedIndex(null)
            setVotes([0, 0, 0, 0])
            setNextTrack(null)
            fetchSimilarTracks(nextTrack)
          }
          return 0
        }
        const midPoint = Math.floor(currentTrack.duration / 2)
        if (prev === midPoint && !votingActive && candidates.length > 0) {
          console.log("[v0] Activating voting at midpoint:", midPoint, "seconds")
          setVotingActive(true)
          setTimeRemaining(15)
        }
        return prev + 1
      })
    }, 1000)

    return () => clearInterval(songTimer)
  }, [currentTrack, nextTrack, votingActive, candidates])

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

      const trackId = searchParams.get("trackId")
      if (!trackId) {
        console.log("[v0] No trackId provided, redirecting to song selection")
        router.push("/select-song")
        return
      }

      await fetchInitialTrack()
    } catch (error) {
      console.error("[v0] Auth check failed:", error)
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInitialTrack = async () => {
    try {
      const trackId = searchParams.get("trackId")

      if (!trackId) {
        router.push("/select-song")
        return
      }

      const response = await fetch(`/api/tracks/by-id?id=${trackId}`)
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

        console.log("[v0] Loaded 4 similar tracks based on audio features (BPM, danceability, energy)")
        setCandidates(similarTracks)
      } else {
        const fallbackResponse = await fetch("/api/tracks")
        const fallbackData = await fallbackResponse.json()
        const nextCandidates = selectNextCandidates(track, fallbackData.tracks)
        setCandidates(nextCandidates)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch similar tracks:", error)
    }
  }

  const selectNextCandidates = (current: Track, tracks: Track[]): Track[] => {
    return tracks
      .filter((t) => t.id !== current.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
  }

  const handleVote = (index: number) => {
    if (!votingActive || votedIndex !== null) return

    setVotedIndex(index)
    setVotes((prev) => {
      const newVotes = [...prev]
      newVotes[index] += 1
      return newVotes
    })

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
      console.log("[v0] Winner selected:", candidates[winnerIndex].name)
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

  if (isLoading || !currentTrack) {
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

        <NowPlaying
          track={currentTrack}
          timeRemaining={timeRemaining}
          nextTrack={nextTrack}
          songProgress={songProgress}
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
