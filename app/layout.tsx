import type React from "react"
import type { Metadata } from "next"
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
    <html lang="en">
      <head>
        {/* Ensure the global callback exists before the SDK executes */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                if (!window.onSpotifyWebPlaybackSDKReady) {
                  window.onSpotifyWebPlaybackSDKReady = function() {
                    try {
                      window.dispatchEvent(new Event('spotify-sdk-ready'));
                    } catch (e) {
                      // Fallback for older browsers
                      var evt;
                      if (typeof Event === 'function') {
                        evt = new Event('spotify-sdk-ready');
                      } else {
                        evt = document.createEvent('Event');
                        evt.initEvent('spotify-sdk-ready', true, true);
                      }
                      window.dispatchEvent(evt);
                    }
                  };
                }
              })();
            `,
          }}
        />
        {/* Load Spotify Web Playback SDK */}
        <script src="https://sdk.scdn.co/spotify-player.js" async></script>
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
