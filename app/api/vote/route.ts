// FILE: app/api/vote/route.ts
// PURPOSE: Handle vote submission and retrieval with session tracking
// USAGE: POST to submit vote, GET to retrieve votes for a round

import { NextResponse } from "next/server"
import { cookies } from "next/headers"

// In-memory storage (in production, use a database like PostgreSQL, MongoDB, etc.)
const voteStore = new Map<string, number>()
const userVotes = new Map<string, Set<string>>() // roundId_sessionId -> Set of trackIds
const votingRounds = new Map<string, number>() // roundId -> timestamp

function getOrCreateSessionId(cookieStore: any): string {
  let sessionId = cookieStore.get("session_id")?.value

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
    cookieStore.set("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }

  return sessionId
}

export async function POST(request: Request) {
  try {
    const { trackId, roundId } = await request.json()

    if (!trackId) {
      return NextResponse.json({ error: "Track ID required" }, { status: 400 })
    }

    if (!roundId) {
      return NextResponse.json({ error: "Round ID required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const sessionId = getOrCreateSessionId(cookieStore)

    // Check if user already voted in this round
    const voteKey = `${roundId}_${trackId}`
    const userVoteKey = `${roundId}_${sessionId}`
    
    if (!userVotes.has(userVoteKey)) {
      userVotes.set(userVoteKey, new Set())
    }

    const userVotesInRound = userVotes.get(userVoteKey)!
    
    if (userVotesInRound.size > 0) {
      return NextResponse.json(
        { error: "Already voted in this round", votes: voteStore.get(voteKey) || 0 },
        { status: 400 }
      )
    }

    // Record vote
    userVotesInRound.add(trackId)
    const currentVotes = voteStore.get(voteKey) || 0
    voteStore.set(voteKey, currentVotes + 1)

    // Track round timestamp for cleanup
    if (!votingRounds.has(roundId)) {
      votingRounds.set(roundId, Date.now())
    }

    console.log("[v0] Vote recorded:", trackId, "Total:", currentVotes + 1, "Round:", roundId)

    return NextResponse.json({ success: true, votes: currentVotes + 1 })
  } catch (error) {
    console.error("[v0] Vote processing failed:", error)
    return NextResponse.json({ error: "Failed to process vote" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const roundId = searchParams.get("roundId")

  if (!roundId) {
    return NextResponse.json({ error: "Round ID required" }, { status: 400 })
  }

  // Get all votes for this round
  const votes: Record<string, number> = {}
  
  for (const [key, count] of voteStore.entries()) {
    if (key.startsWith(`${roundId}_`)) {
      const trackId = key.substring(roundId.length + 1)
      votes[trackId] = count
    }
  }

  return NextResponse.json({ votes })
}

// Clean up old voting rounds (optional - call this periodically)
export async function DELETE() {
  const now = Date.now()
  const oneHourAgo = now - 60 * 60 * 1000

  let cleanedCount = 0

  for (const [roundId, timestamp] of votingRounds.entries()) {
    if (timestamp < oneHourAgo) {
      // Remove all votes for this round
      for (const key of voteStore.keys()) {
        if (key.startsWith(`${roundId}_`)) {
          voteStore.delete(key)
          cleanedCount++
        }
      }
      for (const key of userVotes.keys()) {
        if (key.startsWith(`${roundId}_`)) {
          userVotes.delete(key)
        }
      }
      votingRounds.delete(roundId)
    }
  }

  console.log(`[v0] Cleaned up ${cleanedCount} old votes`)
  return NextResponse.json({ success: true, cleaned: cleanedCount })
}
