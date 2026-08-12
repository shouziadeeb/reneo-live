import type { RefObject } from 'react'
import { StreamVideoTile } from './StreamVideoTile'

export interface StreamGridTile {
  key: string
  name: string
  label?: string
  hasVideo: boolean
  muted?: boolean
  videoRef?: RefObject<HTMLDivElement | null>
  bindVideoEl?: (el: HTMLDivElement | null) => void
}

interface StreamParticipantGridProps {
  tiles: StreamGridTile[]
}

function gridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2'
  if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2'
  return 'grid-cols-1 sm:grid-cols-2'
}

export function StreamParticipantGrid({ tiles }: StreamParticipantGridProps) {
  const count = tiles.length

  return (
    <div className={`grid h-full min-h-[18rem] gap-3 ${gridClass(Math.max(count, 1))}`}>
      {tiles.map((tile) => (
        <StreamVideoTile
          key={tile.key}
          name={tile.name}
          label={tile.label}
          hasVideo={tile.hasVideo}
          muted={tile.muted}
          videoRef={tile.videoRef}
          bindVideoEl={tile.bindVideoEl}
          className={count <= 1 ? 'min-h-[18rem] sm:min-h-[22rem]' : 'min-h-[10rem] sm:min-h-[12rem]'}
        />
      ))}
      {count === 0 ? (
        <div className="flex min-h-[18rem] items-center justify-center rounded-2xl border border-dashed border-[#b7c8ce] bg-white/40 text-sm text-[var(--muted)]">
          Waiting for participants…
        </div>
      ) : null}
    </div>
  )
}
