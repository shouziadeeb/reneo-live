import type { LiveInteractionWithUser } from '../../types'
import { Button } from '../ui'

interface HostSpeakRequestBannerProps {
  pendingRequests: LiveInteractionWithUser[]
  busyId: string | null
  onOpenPeople: () => void
  onAccept: (id: string) => Promise<unknown>
  onReject: (id: string) => Promise<unknown>
}

/**
 * Persistent host alert so speak requests are visible even while Chat is open.
 */
export function HostSpeakRequestBanner({
  pendingRequests,
  busyId,
  onOpenPeople,
  onAccept,
  onReject,
}: HostSpeakRequestBannerProps) {
  if (pendingRequests.length === 0) return null

  const latest = pendingRequests[0]
  const name = latest.user?.name ?? 'A viewer'
  const modeLabel = latest.mode === 'audio_video' ? 'Audio + Video' : 'Audio only'
  const extra = pendingRequests.length - 1

  return (
    <div
      className="rounded-2xl border border-amber-400/60 bg-amber-50 px-3 py-3 shadow-sm sm:px-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950">
            {pendingRequests.length === 1
              ? `${name} wants to join`
              : `${pendingRequests.length} viewers want to join`}
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80">
            {name} requested <span className="font-semibold">{modeLabel}</span>
            {extra > 0 ? ` · +${extra} more pending` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="!px-3 !py-1.5 text-xs"
            disabled={busyId === latest.id}
            onClick={() => void onAccept(latest.id)}
          >
            Accept
          </Button>
          <Button
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            disabled={busyId === latest.id}
            onClick={() => void onReject(latest.id)}
          >
            Reject
          </Button>
          {pendingRequests.length > 1 ? (
            <Button
              variant="ghost"
              className="!px-3 !py-1.5 text-xs"
              onClick={onOpenPeople}
            >
              View all
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
