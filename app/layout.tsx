import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ErrorBoundary } from "@/components/error-boundary"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DJ Voting Interface - Interactive Spotify DJ",
  description: "Interactive DJ experience with Spotify integration and real-time voting",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <head>
        <Script
          id="spotify-sdk-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.onSpotifyWebPlaybackSDKReady = function() {
                try {
                  window.dispatchEvent(new Event('spotify-sdk-ready'));
                } catch (e) {
                  var evt = document.createEvent('Event');
                  evt.initEvent('spotify-sdk-ready', true, true);
                  window.dispatchEvent(evt);
                }
              };
            `,
          }}
        />
        <Script
          id="spotify-sdk"
          src="https://sdk.scdn.co/spotify-player.js"
          strategy="beforeInteractive"
          async
        />
      </head>
      <body className="font-sans antialiased">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
