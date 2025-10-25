import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DJ Voting Interface - Montaug",
  description: "Interactive DJ experience with Spotify integration",
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
        {/* Ensure the global callback exists before the SDK executes so the SDK doesn't throw */}
        <script
          // Define a safe callback and dispatch a custom event when called by the SDK
          dangerouslySetInnerHTML={{
            __html: `
              // If the SDK calls onSpotifyWebPlaybackSDKReady before the app mounts,
              // this ensures the callback exists and signals the app via an event.
              (function(){
                if (!window.onSpotifyWebPlaybackSDKReady) {
                  window.onSpotifyWebPlaybackSDKReady = function() {
                    try {
                      window.dispatchEvent(new Event('spotify-sdk-ready'));
                    } catch (e) {
                      // older browsers
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
        <script src="https://sdk.scdn.co/spotify-player.js" async></script>
      </head>
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
