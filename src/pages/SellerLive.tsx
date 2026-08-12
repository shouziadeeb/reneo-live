import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ChatPanel } from '../components/chat/ChatPanel'
import { LiveStage } from '../components/live/LiveStage'
import { FeaturedProductCard } from '../components/products/FeaturedProductCard'
import { Alert, Spinner } from '../components/ui'
import { useAgora } from '../hooks/useAgora'
import { useAuth } from '../hooks/useAuth'
import { useChat } from '../hooks/useChat'
import { useLiveSession, useSellerLiveActions } from '../hooks/useLive'
import { useLivePresence } from '../hooks/useLivePresence'

function requestStageFullscreen(node: HTMLDivElement) {
  if (document.fullscreenElement) {
    void document.exitFullscreen()
    return
  }

  const request = node.requestFullscreen?.bind(node)
  if (request) {
    void request().catch(() => {
      const video = node.querySelector('video') as HTMLVideoElement & {
        webkitEnterFullscreen?: () => void
      } | null
      video?.webkitEnterFullscreen?.()
    })
    return
  }

  const video = node.querySelector('video') as HTMLVideoElement & {
    webkitEnterFullscreen?: () => void
  } | null
  video?.webkitEnterFullscreen?.()
}

export function SellerLivePage() {
  const { liveId } = useParams<{ liveId: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const { live, loading, error } = useLiveSession(liveId)
  const { end, ending } = useSellerLiveActions()
  const [endError, setEndError] = useState<string | null>(null)

  const isHost = Boolean(live && profile && live.host_id === profile.id)
  const isLive = live?.status === 'live'

  const agora = useAgora({
    liveId: liveId ?? null,
    role: 'host',
    enabled: Boolean(isHost && isLive),
  })

  const presence = useLivePresence({
    liveId: liveId ?? null,
    userId: user?.id ?? null,
    role: 'host',
    enabled: Boolean(isHost && isLive),
  })

  const chat = useChat(isLive ? (liveId ?? null) : null, user?.id ?? null)

  const handleFullscreen = useCallback(() => {
    if (stageRef.current) requestStageFullscreen(stageRef.current)
  }, [])

  async function handleEnd() {
    if (!liveId) return
    setEndError(null)
    try {
      await end(liveId)
      await agora.leave().catch(() => undefined)
      navigate('/seller')
    } catch (err) {
      setEndError(
        err instanceof Error
          ? err.message
          : 'Could not end the live session. Check your connection and try again.',
      )
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Spinner label="Starting seller live…" />
      </AppShell>
    )
  }

  if (error || !live) {
    return (
      <AppShell>
        <Alert>{error || 'Live session not found.'}</Alert>
        <Link to="/seller" className="mt-4 inline-block text-sm font-semibold text-[var(--accent-strong)]">
          Back to dashboard
        </Link>
      </AppShell>
    )
  }

  if (!isHost) {
    return (
      <AppShell>
        <Alert>Only the host can broadcast on this live session.</Alert>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">You are live</h1>
          <p className="text-sm text-[var(--muted)]">
            Broadcasting as {profile?.name}. Viewers see your camera and the featured product.
          </p>
        </div>
      </div>

      {!isLive ? <Alert tone="info">This live session has ended.</Alert> : null}
      {endError ? (
        <div className="mb-4">
          <Alert>{endError}</Alert>
        </div>
      ) : null}
      {!live.product ? (
        <div className="mb-4">
          <Alert>The featured product is no longer available.</Alert>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.9fr)]">
        <div ref={stageRef}>
          <LiveStage
            videoRef={agora.localVideoRef}
            connecting={agora.connecting}
            connected={agora.connected}
            error={agora.error}
            warning={agora.warning}
            isHost
            sellerName={profile?.name}
            viewerCount={presence.customerCount}
            micMuted={agora.micMuted}
            cameraOff={agora.cameraOff}
            canSwitchCamera={agora.canSwitchCamera}
            reconnecting={agora.reconnecting}
            needsTapToPlay={agora.needsTapToPlay}
            onToggleMic={() => void agora.toggleMic()}
            onToggleCamera={() => void agora.toggleCamera()}
            onSwitchCamera={() => void agora.switchCamera()}
            onFullscreen={handleFullscreen}
            onEndLive={() => void handleEnd()}
            onRetry={agora.retry}
            onResumePlayback={agora.resumePlayback}
            ending={ending}
            liveEnded={!isLive}
          />
        </div>

        <div className="flex flex-col gap-4">
          {live.product ? <FeaturedProductCard product={live.product} showAddToCart={false} /> : null}
          <div className="min-h-[20rem] flex-1">
            <ChatPanel
              messages={chat.messages}
              loading={chat.loading}
              sending={chat.sending}
              error={chat.error}
              onSend={chat.send}
            />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default SellerLivePage
