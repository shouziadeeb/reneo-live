import { useMemo, useState } from 'react'
import type { InteractionMode, LiveInteractionWithUser } from '../../types'
import type { PresenceViewer } from '../../hooks/useLivePresence'
import { Alert, Button, Spinner } from '../ui'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function Avatar({ name, avatar }: { name: string; avatar: string | null }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--line)]"
      />
    )
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent-strong)]">
      {initials(name)}
    </span>
  )
}

function statusLabel(interaction: LiveInteractionWithUser | undefined): string {
  if (!interaction) return 'Audience'
  if (interaction.status === 'pending' && interaction.origin === 'request') {
    return 'Request pending'
  }
  if (interaction.status === 'pending' && interaction.origin === 'invite') {
    return 'Invite pending'
  }
  if (interaction.status === 'accepted') {
    return interaction.mode === 'audio_video'
      ? 'Accepted — awaiting media'
      : 'Accepted — awaiting mic'
  }
  if (interaction.status === 'active') {
    return interaction.participant_role === 'cohost' ? 'Co-host' : 'Speaker'
  }
  return 'Audience'
}

interface ViewerManagementPanelProps {
  customerCount: number
  viewers: PresenceViewer[]
  interactionByUserId: Map<string, LiveInteractionWithUser>
  pendingRequests: LiveInteractionWithUser[]
  busyId: string | null
  error: string | null
  onAcceptRequest: (id: string) => Promise<unknown>
  onRejectRequest: (id: string) => Promise<unknown>
  onInvite: (userId: string, mode: InteractionMode) => Promise<unknown>
  onReturnToAudience: (id: string) => Promise<unknown>
}

export function ViewerManagementPanel({
  customerCount,
  viewers,
  interactionByUserId,
  pendingRequests,
  busyId,
  error,
  onAcceptRequest,
  onRejectRequest,
  onInvite,
  onReturnToAudience,
}: ViewerManagementPanelProps) {
  const [inviteFor, setInviteFor] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const audienceViewers = useMemo(
    () => viewers.filter((v) => v.role === 'audience'),
    [viewers],
  )

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return audienceViewers
    return audienceViewers.filter((v) => v.name.toLowerCase().includes(q))
  }, [audienceViewers, filter])

  return (
    <div className="flex h-full max-h-full flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white/80">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-[var(--ink)]">Viewers</h2>
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-strong)]">
            {customerCount} watching
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Accept requests, invite speakers, or return participants to audience.
        </p>
      </div>

      {error ? (
        <div className="px-4 pt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {pendingRequests.length > 0 ? (
        <div className="border-b border-amber-300/50 bg-amber-50 px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-900">
            Pending requests
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-white">
              {pendingRequests.length}
            </span>
          </h3>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {pendingRequests.map((req) => (
              <li
                key={req.id}
                className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-white px-2.5 py-2 shadow-sm"
              >
                <Avatar name={req.user?.name ?? 'Viewer'} avatar={req.user?.avatar ?? null} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">
                    {req.user?.name ?? 'Viewer'}
                  </p>
                  <p className="text-xs text-amber-800">
                    {req.mode === 'audio_video' ? 'Audio + Video' : 'Audio only'} · waiting
                  </p>
                </div>
                <Button
                  className="!px-2.5 !py-1.5 text-xs"
                  disabled={busyId === req.id}
                  onClick={() => void onAcceptRequest(req.id)}
                >
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  className="!px-2.5 !py-1.5 text-xs"
                  disabled={busyId === req.id}
                  onClick={() => void onRejectRequest(req.id)}
                >
                  Reject
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-b border-[var(--line)] px-4 py-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search viewers…"
          className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
        />
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-[var(--muted)]">
            No viewers connected yet.
          </li>
        ) : (
          filtered.map((viewer) => {
            const interaction = interactionByUserId.get(viewer.userId)
            const status = statusLabel(interaction)
            const canInvite = !interaction
            const canReturn =
              interaction &&
              (interaction.status === 'active' || interaction.status === 'accepted')

            return (
              <li
                key={viewer.userId}
                className="rounded-xl px-2 py-2 hover:bg-[var(--surface)]"
              >
                <div className="flex items-center gap-2">
                  <Avatar name={viewer.name} avatar={viewer.avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                      {viewer.name}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{status}</p>
                  </div>
                  {canReturn && interaction ? (
                    <Button
                      variant="secondary"
                      className="!px-2.5 !py-1.5 text-xs"
                      disabled={busyId === interaction.id}
                      onClick={() => void onReturnToAudience(interaction.id)}
                    >
                      Return to Audience
                    </Button>
                  ) : null}
                  {canInvite ? (
                    <Button
                      variant="secondary"
                      className="!px-2.5 !py-1.5 text-xs"
                      onClick={() =>
                        setInviteFor((current) =>
                          current === viewer.userId ? null : viewer.userId,
                        )
                      }
                    >
                      Invite
                    </Button>
                  ) : null}
                </div>

                {inviteFor === viewer.userId ? (
                  <div className="mt-2 flex flex-wrap gap-2 pl-11">
                    <Button
                      className="!px-2.5 !py-1.5 text-xs"
                      disabled={busyId === `invite-${viewer.userId}`}
                      onClick={() =>
                        void onInvite(viewer.userId, 'audio').then(() => setInviteFor(null))
                      }
                    >
                      Audio
                    </Button>
                    <Button
                      className="!px-2.5 !py-1.5 text-xs"
                      disabled={busyId === `invite-${viewer.userId}`}
                      onClick={() =>
                        void onInvite(viewer.userId, 'audio_video').then(() =>
                          setInviteFor(null),
                        )
                      }
                    >
                      Audio + Video
                    </Button>
                    <Button
                      variant="ghost"
                      className="!px-2.5 !py-1.5 text-xs"
                      onClick={() => setInviteFor(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })
        )}
      </ul>

      {busyId === 'request' ? (
        <div className="border-t border-[var(--line)] px-4 py-2">
          <Spinner label="Working…" />
        </div>
      ) : null}
    </div>
  )
}
