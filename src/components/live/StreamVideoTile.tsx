import type { ReactNode, RefObject } from 'react'
import { useEffect, useRef } from 'react'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export interface StreamTileProps {
  name: string
  label?: string
  /** Local or remote video mount point */
  videoRef?: RefObject<HTMLDivElement | null>
  /** For remote tiles bound via callback */
  bindVideoEl?: (el: HTMLDivElement | null) => void
  hasVideo?: boolean
  muted?: boolean
  speaking?: boolean
  placeholder?: ReactNode
  className?: string
}

export function StreamVideoTile({
  name,
  label,
  videoRef,
  bindVideoEl,
  hasVideo = true,
  muted = false,
  speaking = false,
  placeholder,
  className = '',
}: StreamTileProps) {
  const fallbackRef = useRef<HTMLDivElement | null>(null)
  const mountRef = videoRef ?? fallbackRef

  useEffect(() => {
    if (!bindVideoEl) return
    bindVideoEl(mountRef.current)
    return () => bindVideoEl(null)
  }, [bindVideoEl, mountRef])

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/70 bg-[#d7e4e8] shadow-[0_8px_24px_rgba(20,37,35,0.08)] ${
        speaking ? 'ring-2 ring-[var(--accent)]' : ''
      } ${className}`}
    >
      <div
        ref={mountRef}
        className={`absolute inset-0 bg-[#c5d5da] [&_video]:h-full [&_video]:w-full [&_video]:object-cover ${
          hasVideo ? '' : 'invisible'
        }`}
      />

      {!hasVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#cfdce1] to-[#b7c9d0]">
          {placeholder ?? (
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] text-2xl font-bold text-white shadow-md">
              {initials(name)}
            </span>
          )}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {label ?? name}
          </span>
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
              muted ? 'bg-red-500/90 text-white' : 'bg-black/35 text-white'
            }`}
            aria-label={muted ? 'Muted' : 'Mic on'}
          >
            {muted ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l14 14" strokeLinecap="round" />
                <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-.4 1.5M9 9V6a3 3 0 0 1 3-3" strokeLinecap="round" />
                <path d="M5 11a7 7 0 0 0 11.5 5.3M19 11v1M12 19v2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
              </svg>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
