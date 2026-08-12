import type { RefObject } from 'react'
import { Button, Spinner } from '../ui'

interface LiveStageProps {
  videoRef: RefObject<HTMLDivElement | null>
  connecting: boolean
  connected: boolean
  error: string | null
  warning?: string | null
  isHost: boolean
  sellerName?: string | null
  viewerCount?: number | null
  micMuted?: boolean
  cameraOff?: boolean
  canSwitchCamera?: boolean
  reconnecting?: boolean
  needsTapToPlay?: boolean
  onToggleMic?: () => void
  onToggleCamera?: () => void
  onSwitchCamera?: () => void
  onFullscreen?: () => void
  onEndLive?: () => void
  onRetry?: () => void
  onResumePlayback?: () => void
  ending?: boolean
  liveEnded?: boolean
}

export function LiveStage({
  videoRef,
  connecting,
  connected,
  error,
  warning,
  isHost,
  sellerName,
  viewerCount,
  micMuted,
  cameraOff,
  canSwitchCamera,
  reconnecting,
  needsTapToPlay,
  onToggleMic,
  onToggleCamera,
  onSwitchCamera,
  onFullscreen,
  onEndLive,
  onRetry,
  onResumePlayback,
  ending,
  liveEnded,
}: LiveStageProps) {
  const showOverlay = Boolean(
    connecting || error || liveEnded || reconnecting || (!connected && !connecting),
  )

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#121816] text-white shadow-xl">
      <div className="relative aspect-[9/16] max-h-[52dvh] w-full sm:max-h-none sm:aspect-video">
        <div
          ref={videoRef}
          className="absolute inset-0 bg-black [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {liveEnded ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                Ended
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
            )}
            {sellerName ? (
              <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium backdrop-blur">
                {sellerName}
              </span>
            ) : null}
            {typeof viewerCount === 'number' && !liveEnded ? (
              <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs backdrop-blur">
                {viewerCount} watching
              </span>
            ) : null}
          </div>
        </div>

        {showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-6 text-center">
            {connecting ? <Spinner label="Connecting to stream…" /> : null}
            {liveEnded && !connecting ? (
              <p className="text-sm text-white/90">This live has ended.</p>
            ) : null}
            {!liveEnded && reconnecting && !error && !connecting ? (
              <p className="text-sm text-white/90">Connection interrupted. Reconnecting…</p>
            ) : null}
            {!liveEnded && error ? (
              <div className="max-w-sm space-y-3">
                <p className="text-sm text-red-200">{error}</p>
                {onRetry ? (
                  <Button variant="secondary" className="!bg-white/15 !text-white !border-white/20" onClick={onRetry}>
                    Retry
                  </Button>
                ) : null}
              </div>
            ) : null}
            {!connecting && !error && !liveEnded && !reconnecting && !connected ? (
              <p className="text-sm text-white/80">Waiting for video…</p>
            ) : null}
          </div>
        )}

        {needsTapToPlay && !liveEnded && !error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-6">
            <Button onClick={onResumePlayback}>Tap to play audio</Button>
          </div>
        ) : null}
      </div>

      {warning && !liveEnded ? (
        <div className="border-t border-amber-400/20 bg-amber-500/15 px-4 py-2 text-xs text-amber-100">
          {warning}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#0d1210] p-3">
        {isHost ? (
          <>
            <Button
              variant="secondary"
              className="min-h-11 !bg-white/10 !text-white !border-white/15"
              onClick={onToggleMic}
              disabled={!connected}
            >
              {micMuted ? 'Unmute' : 'Mute'}
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 !bg-white/10 !text-white !border-white/15"
              onClick={onToggleCamera}
              disabled={!connected}
            >
              {cameraOff ? 'Camera on' : 'Camera off'}
            </Button>
            {canSwitchCamera ? (
              <Button
                variant="secondary"
                className="min-h-11 !bg-white/10 !text-white !border-white/15"
                onClick={onSwitchCamera}
                disabled={!connected}
              >
                Switch camera
              </Button>
            ) : null}
            <Button
              variant="secondary"
              className="min-h-11 !bg-white/10 !text-white !border-white/15"
              onClick={onFullscreen}
            >
              Fullscreen
            </Button>
            <Button
              variant="danger"
              className="ml-auto min-h-11"
              onClick={onEndLive}
              disabled={ending}
            >
              {ending ? 'Ending…' : 'End live'}
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            className="ml-auto min-h-11 !bg-white/10 !text-white !border-white/15"
            onClick={onFullscreen}
          >
            Fullscreen
          </Button>
        )}
      </div>
    </div>
  )
}
