"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Music, Play } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Image from "next/image"

interface Track {
  id: string
  name: string
  artist: string
  albumArt: string
  duration: number
  previewUrl: string
}

export default function SelectSongPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/session")
      if (!response.ok) {
        router.push("/")
        return
      }
    } catch (error) {
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/tracks/search-songs?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()

      if (data.tracks) {
        setSearchResults(data.tracks)
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectSong = (trackId: string) => {
    router.push(`/dj?trackId=${trackId}`)
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
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-6 rounded-full">
              <Music className="w-16 h-16 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold">Choose Your Starting Track</h1>
          <p className="text-muted-foreground text-lg">Search for a song to kick off your DJ session</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a song or artist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>
          <Button type="submit" className="w-full h-12 text-lg" disabled={isSearching}>
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Search Results</h2>
            <div className="grid gap-4">
              {searchResults.map((track) => (
                <Card
                  key={track.id}
                  className="p-4 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleSelectSong(track.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                      {track.albumArt ? (
                        <Image
                          src={track.albumArt || "/placeholder.svg"}
                          alt={track.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{track.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Play className="w-4 h-4 mr-2" />
                      Start Session
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {searchQuery && searchResults.length === 0 && !isSearching && (
          <div className="text-center py-12 text-muted-foreground">No results found. Try a different search term.</div>
        )}
      </div>
    </div>
  )
}
