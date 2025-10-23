# DJ Voting Interface

An interactive DJ experience powered by Spotify where users vote for the next track to play.

## Features

- 🎵 Spotify integration with OAuth authentication
- 🗳️ Real-time voting system for next tracks
- ⏱️ Automatic voting rounds (opens halfway through each song)
- 🎨 Beautiful UI with album artwork and progress tracking
- 📊 Live vote counts and percentages

## Setup

1. **Environment Variables**

Create a `.env.local` file with your Spotify credentials:

\`\`\`env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/auth/spotify
\`\`\`

For production deployment on Vercel, use:
\`\`\`env
SPOTIFY_CLIENT_ID=5b2d5b209e66470397373e3aaa54afdf
SPOTIFY_CLIENT_SECRET=ec5847a56f1c44a99bd7714248b35984
NEXT_PUBLIC_REDIRECT_URI=https://looplooppool.vercel.app/auth/spotify
\`\`\`

2. **Spotify App Configuration**

Your Spotify app is already configured with:
- App name: **looplooppool**
- Redirect URI: `https://looplooppool.vercel.app/auth/spotify`
- For local development, add: `http://localhost:3000/auth/spotify`

3. **Install and Run**

\`\`\`bash
npm install
npm run dev
\`\`\`

## How It Works

1. Users connect their Spotify account
2. The app fetches their top tracks
3. A track starts playing (3-minute simulation)
4. Halfway through (90 seconds), voting opens for 15 seconds
5. Users vote from 6 random candidate tracks
6. The track with the most votes plays next
7. The cycle repeats

## Tech Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS v4
- Spotify Web API
- shadcn/ui components

## Deployment

Deploy to Vercel with one click or push to your connected GitHub repository. Make sure to add the environment variables in your Vercel project settings.
