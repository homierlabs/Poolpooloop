"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Music } from "lucide-react"

export default function HomePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Always clear tokens and cookies for clean start
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      setIsLoading(false)
    })
  }, [])

  const handleLogin = async () => {
    try {
      const response = await fetch("/api/auth/login")
      const data = await response.json()
      window.location.href = data.url // always to Spotify
    } catch (error) {
      console.error("[v0] Login failed:", error)
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="flex justify-center">
          <div className="bg-primary/10 p-4 rounded-full">
            <Music className="w-12 h-12 text-primary" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">DJ Voting Interface</h1>
          <p className="text-muted-foreground">Connect your Spotify account to start the interactive DJ experience</p>
        </div>

        <div className="space-y-4">
          <Button onClick={handleLogin} className="w-full" size="lg">
            Connect with Spotify
          </Button>

          <div className="text-xs text-center text-muted-foreground">
            <p>By connecting, you agree to share your Spotify data</p>
          </div>
        </div>

        <div className="pt-4 border-t space-y-2">
          <h3 className="font-semibold text-sm">How it works:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Listen to tracks from your Spotify library</li>
            <li>• Vote for the next track to play</li>
            <li>• Voting opens halfway through each song</li>
            <li>• Most voted track plays next</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
