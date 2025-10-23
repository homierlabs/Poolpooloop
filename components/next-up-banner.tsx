import type { Track } from "@/lib/types"
import { Sparkles } from "lucide-react"

interface NextUpBannerProps {
  track: Track
}

export function NextUpBanner({ track }: NextUpBannerProps) {
  return (
    <div className="mb-8 animate-slide-up">
      <div className="bg-gradient-to-r from-accent/20 via-accent/10 to-transparent border border-accent/30 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center animate-pulse-glow">
            <Sparkles className="w-6 h-6 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm text-accent font-semibold mb-1">Next Up</p>
            <h3 className="text-2xl font-bold text-balance">
              {track.artist} - {track.name}
            </h3>
          </div>
        </div>
      </div>
    </div>
  )
}
