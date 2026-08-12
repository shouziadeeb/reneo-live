import { useEffect, useRef } from 'react'
import type { RemoteParticipantMedia } from '../../hooks/useAgora'

interface ParticipantTilesProps {
  participants: RemoteParticipantMedia[]
  bindRemoteVideoEl: (uid: number, el: HTMLDivElement | null) => void
  /** When true, show the session host in a tile (seller already has local preview). */
  includeHost?: boolean
}

function Tile({
  participant,
  bindRemoteVideoEl,
}: {
  participant: RemoteParticipantMedia
  bindRemoteVideoEl: (uid: number, el: HTMLDivElement | null) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bindRemoteVideoEl(participant.uid, ref.current)
    return () => bindRemoteVideoEl(participant.uid, null)
  }, [bindRemoteVideoEl, participant.uid])

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-[#121816] ring-1 ring-white/10">
      {participant.hasVideo ? (
        <div ref={ref} className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">
          {participant.isSessionHost ? 'Host audio' : 'Speaker'}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/90">
          {participant.isSessionHost
            ? 'Host'
            : participant.hasVideo
              ? 'Co-host'
              : 'Speaker'}
        </span>
      </div>
    </div>
  )
}

/**
 * Secondary tiles for remote publishers other than the main stage host feed.
 * Audience viewers do not get tiles — only Speakers/Co-hosts (and optionally host).
 */
export function ParticipantTiles({
  participants,
  bindRemoteVideoEl,
  includeHost = false,
}: ParticipantTilesProps) {
  const tiles = participants.filter((p) => {
    if (p.isSessionHost) return includeHost
    return p.hasAudio || p.hasVideo
  })

  if (tiles.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tiles.map((participant) => (
        <Tile
          key={participant.uid}
          participant={participant}
          bindRemoteVideoEl={bindRemoteVideoEl}
        />
      ))}
    </div>
  )
}
