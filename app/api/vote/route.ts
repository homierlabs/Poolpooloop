import { NextResponse } from "next/server"

// In-memory vote storage (in production, use a database)
const voteStore = new Map<string, number>()

export async function POST(request: Request) {
  try {
    const { trackId } = await request.json()

    if (!trackId) {
      return NextResponse.json({ error: "Track ID required" }, { status: 400 })
    }

    const currentVotes = voteStore.get(trackId) || 0
    voteStore.set(trackId, currentVotes + 1)

    return NextResponse.json({ success: true, votes: currentVotes + 1 })
  } catch (error) {
    console.error("[v0] Vote processing failed:", error)
    return NextResponse.json({ error: "Failed to process vote" }, { status: 500 })
  }
}

export async function GET() {
  const votes = Object.fromEntries(voteStore)
  return NextResponse.json({ votes })
}
