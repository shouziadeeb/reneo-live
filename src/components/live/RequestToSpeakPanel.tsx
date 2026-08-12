import { useState } from 'react'
import type { InteractionMode, LiveInteractionWithUser } from '../../types'
import { Alert, Button } from '../ui'

interface RequestToSpeakPanelProps {
  interaction: LiveInteractionWithUser | null
  busyId: string | null
  error: string | null
  publishError: string | null
  publishing: boolean
  connected: boolean
  onRequest: (mode: InteractionMode) => Promise<unknown>
  onCancelRequest: (id: string) => Promise<unknown>
  onAcceptInvite: (id: string) => Promise<unknown>
  onRejectInvite: (id: string) => Promise<unknown>
  onEnableMedia: () => Promise<void>
  onLeaveIntervention: (id: string) => Promise<unknown>
}

export function RequestToSpeakPanel({
  interaction,
  busyId,
  error,
  publishError,
  publishing,
  connected,
  onRequest,
  onCancelRequest,
  onAcceptInvite,
  onRejectInvite,
  onEnableMedia,
  onLeaveIntervention,
}: RequestToSpeakPanelProps) {
  const [choosing, setChoosing] = useState(false)
  const [joining, setJoining] = useState(false)

  async function handleEnableMedia() {
    setJoining(true)
    try {
      await onEnableMedia()
    } finally {
      setJoining(false)
    }
  }

  const statusBanner = (() => {
    if (!interaction) return null
    if (interaction.status === 'pending' && interaction.origin === 'request') {
      return {
        tone: 'info' as const,
        text: `Request pending (${interaction.mode === 'audio_video' ? 'Audio + Video' : 'Audio only'}). Waiting for the seller…`,
      }
    }
    if (interaction.status === 'pending' && interaction.origin === 'invite') {
      return {
        tone: 'info' as const,
        text: `Invitation received: join as ${
          interaction.mode === 'audio_video' ? 'Co-host (Audio + Video)' : 'Speaker (Audio)'
        }.`,
      }
    }
    if (interaction.status === 'accepted') {
      return {
        tone: 'success' as const,
        text:
          interaction.mode === 'audio_video'
            ? 'Seller accepted! Enable your microphone and camera to join as Co-host.'
            : 'Seller accepted! Enable your microphone to join as Speaker.',
      }
    }
    if (interaction.status === 'active') {
      return {
        tone: 'success' as const,
        text:
          interaction.participant_role === 'cohost'
            ? 'You are a Co-host. The seller and viewers can see and hear you.'
            : 'You are a Speaker. The seller and viewers can hear you.',
      }
    }
    if (interaction.status === 'rejected') {
      return { tone: 'error' as const, text: 'Your request or invitation was rejected.' }
    }
    if (interaction.status === 'expired') {
      return { tone: 'error' as const, text: 'Your request or invitation expired.' }
    }
    if (interaction.status === 'ended' || interaction.status === 'cancelled') {
      return { tone: 'info' as const, text: 'Returned to audience. You can still watch the live.' }
    }
    return null
  })()

  return (
    <div
      className={`rounded-2xl border bg-white/80 p-4 ${
        interaction?.status === 'pending' || interaction?.status === 'accepted'
          ? 'border-amber-400/70 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]'
          : 'border-[var(--line)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-[var(--ink)]">Interactive live</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Request to speak, or respond if the seller invites you. Mic/camera never turn on
            automatically.
          </p>
        </div>
        {interaction?.status === 'pending' ? (
          <span className="shrink-0 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Pending
          </span>
        ) : null}
        {interaction?.status === 'accepted' ? (
          <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Accepted
          </span>
        ) : null}
        {interaction?.status === 'active' ? (
          <span className="shrink-0 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Live
          </span>
        ) : null}
        {interaction?.status === 'rejected' ? (
          <span className="shrink-0 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Rejected
          </span>
        ) : null}
      </div>
      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {publishError ? (
        <div className="mt-3">
          <Alert>{publishError}</Alert>
        </div>
      ) : null}
      {statusBanner ? (
        <div className="mt-3">
          <Alert tone={statusBanner.tone}>{statusBanner.text}</Alert>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {!interaction ||
        ['rejected', 'cancelled', 'expired', 'ended'].includes(interaction.status) ? (
          choosing ? (
            <>
              <Button
                disabled={!connected || busyId === 'request'}
                onClick={() => void onRequest('audio').then(() => setChoosing(false))}
              >
                Audio only
              </Button>
              <Button
                disabled={!connected || busyId === 'request'}
                onClick={() => void onRequest('audio_video').then(() => setChoosing(false))}
              >
                Audio + Video
              </Button>
              <Button variant="ghost" onClick={() => setChoosing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button disabled={!connected} onClick={() => setChoosing(true)}>
              Request to speak
            </Button>
          )
        ) : null}

        {interaction?.status === 'pending' && interaction.origin === 'request' ? (
          <Button
            variant="secondary"
            disabled={busyId === interaction.id}
            onClick={() => void onCancelRequest(interaction.id)}
          >
            Cancel request
          </Button>
        ) : null}

        {interaction?.status === 'pending' && interaction.origin === 'invite' ? (
          <>
            <Button
              disabled={busyId === interaction.id}
              onClick={() => void onAcceptInvite(interaction.id)}
            >
              Accept invitation
            </Button>
            <Button
              variant="secondary"
              disabled={busyId === interaction.id}
              onClick={() => void onRejectInvite(interaction.id)}
            >
              Reject
            </Button>
          </>
        ) : null}

        {interaction?.status === 'accepted' ? (
          <>
            <Button
              disabled={!connected || joining || publishing}
              onClick={() => void handleEnableMedia()}
            >
              {joining
                ? 'Joining…'
                : interaction.mode === 'audio_video'
                  ? 'Enable mic + camera'
                  : 'Enable microphone'}
            </Button>
            <Button
              variant="secondary"
              disabled={busyId === interaction.id}
              onClick={() => void onLeaveIntervention(interaction.id)}
            >
              Stay as audience
            </Button>
          </>
        ) : null}

        {interaction?.status === 'active' ? (
          <Button
            variant="secondary"
            disabled={busyId === interaction.id}
            onClick={() => void onLeaveIntervention(interaction.id)}
          >
            Leave intervention
          </Button>
        ) : null}
      </div>
    </div>
  )
}
