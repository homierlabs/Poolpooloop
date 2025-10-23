import { NextResponse } from "next/server"
import { spotifyApi } from "@/lib/spotify"

export async function GET() {
  const authUrl = spotifyApi.getAuthUrl()
  return NextResponse.json({ url: authUrl })
}
