import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ChatPanel } from '../components/chat/ChatPanel'
import { HostSpeakRequestBanner } from '../components/live/HostSpeakRequestBanner'
import {
  StreamParticipantGrid,
  type StreamGridTile,
} from '../components/live/StreamParticipantGrid'
import { StreamRoom } from '../components/live/StreamRoom'
import { ViewerManagementPanel } from '../components/live/ViewerManagementPanel'
import { FeaturedProductCard } from '../components/products/FeaturedProductCard'
import { Alert, Spinner } from '../components/ui'
import { useAgora } from '../hooks/useAgora'
import { useAuth } from '../hooks/useAuth'
import { useChat } from '../hooks/useChat'
import { useInteractiveLive } from '../hooks/useInteractiveLive'
import { useLiveSession, useSellerLiveActions } from '../hooks/useLive'
import { useLivePresence } from '../hooks/useLivePresence'
import { uidFromUserId } from '../lib/agora'

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
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'people' | 'product'>('chat')
  const [hostNotice, setHostNotice] = useState<string | null>(null)
  const seenPendingIdsRef = useRef<Set<string>>(new Set())
  const pendingBootstrappedRef = useRef(false)

  const isHost = Boolean(live && profile && live.host_id === profile.id)
  const isLive = live?.status === 'live'

  const interactive = useInteractiveLive({
    liveId: liveId ?? null,
    userId: user?.id ?? null,
    isHost: true,
    enabled: Boolean(isHost && isLive),
  })

  // Notify host + open People when a new speak request arrives.
  useEffect(() => {
    const pending = interactive.pendingRequests
    const ids = new Set(pending.map((r) => r.id))

    if (!pendingBootstrappedRef.current) {
      seenPendingIdsRef.current = ids
      pendingBootstrappedRef.current = true
      return
    }

    const newcomers = pending.filter((r) => !seenPendingIdsRef.current.has(r.id))
    seenPendingIdsRef.current = ids

    if (newcomers.length === 0) return

    const first = newcomers[0]
    const name = first.user?.name ?? 'A viewer'
    const mode = first.mode === 'audio_video' ? 'Audio + Video' : 'Audio'
    setHostNotice(
      newcomers.length === 1
        ? `${name} requested to speak (${mode}).`
        : `${newcomers.length} new speak requests received.`,
    )
    setSidebarTab('people')

    const timer = window.setTimeout(() => setHostNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [interactive.pendingRequests])

  const pendingCount = interactive.pendingRequests.length

  const {
    localVideoRef,
    bindRemoteVideoEl,
    connecting,
    connected,
    error: agoraError,
    warning,
    micMuted,
    cameraOff,
    canSwitchCamera,
    reconnecting,
    needsTapToPlay,
    remoteParticipants,
    toggleMic,
    toggleCamera,
    switchCamera,
    leave,
    retry,
    resumePlayback,
  } = useAgora({
    liveId: liveId ?? null,
    role: 'host',
    enabled: Boolean(isHost && isLive),
    hostUserId: profile?.id ?? null,
  })

  const presence = useLivePresence({
    liveId: liveId ?? null,
    userId: user?.id ?? null,
    role: 'host',
    enabled: Boolean(isHost && isLive),
    displayName: profile?.name ?? null,
    avatar: profile?.avatar ?? null,
    onAudienceLeave: (leftUserId) => {
      void interactive.cleanupDisconnectedUser(leftUserId)
    },
  })

  const chat = useChat(isLive ? (liveId ?? null) : null, user?.id ?? null)

  const nameForUid = useCallback(
    (uid: number, isSessionHost: boolean) => {
      if (isSessionHost) return profile?.name ?? 'Host'
      const match = presence.viewers.find((v) => uidFromUserId(v.userId) === uid)
      return match?.name ?? 'Guest'
    },
    [presence.viewers, profile?.name],
  )

  const gridTiles = useMemo<StreamGridTile[]>(() => {
    const tiles: StreamGridTile[] = [
      {
        key: 'local-host',
        name: profile?.name ?? 'You',
        label: profile?.name ?? 'You',
        hasVideo: !cameraOff,
        muted: micMuted,
        videoRef: localVideoRef,
      },
    ]

    for (const p of remoteParticipants) {
      if (!p.hasAudio && !p.hasVideo) continue
      const uid = p.uid
      tiles.push({
        key: `remote-${uid}`,
        name: nameForUid(uid, p.isSessionHost),
        label: p.hasVideo ? 'Co-host' : 'Speaker',
        hasVideo: p.hasVideo,
        muted: !p.hasAudio,
        bindVideoEl: (el) => bindRemoteVideoEl(uid, el),
      })
    }

    return tiles
  }, [
    cameraOff,
    micMuted,
    localVideoRef,
    remoteParticipants,
    bindRemoteVideoEl,
    nameForUid,
    profile?.name,
  ])

  const handleFullscreen = useCallback(() => {
    if (stageRef.current) requestStageFullscreen(stageRef.current)
  }, [])

  async function handleEnd() {
    if (!liveId) return
    setEndError(null)
    try {
      await end(liveId)
      await leave().catch(() => undefined)
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
      <AppShell wide>
        <Spinner label="Starting seller live…" />
      </AppShell>
    )
  }

  if (error || !live) {
    return (
      <AppShell wide>
        <Alert>{error || 'Live session not found.'}</Alert>
        <Link to="/seller" className="mt-4 inline-block text-sm font-semibold text-[var(--accent-strong)]">
          Back to dashboard
        </Link>
      </AppShell>
    )
  }

  if (!isHost) {
    return (
      <AppShell wide>
        <Alert>Only the host can broadcast on this live session.</Alert>
      </AppShell>
    )
  }

  const roomTitle = live.product?.name ?? 'Live session'

  return (
    <AppShell wide>
      <StreamRoom
        title={roomTitle}
        subtitle={`Hosting as ${profile?.name ?? 'seller'}`}
        backTo="/seller"
        backLabel="← Dashboard"
        liveEnded={!isLive}
        viewerCount={presence.customerCount}
        connecting={connecting || reconnecting}
        connected={connected}
        error={agoraError}
        warning={warning}
        needsTapToPlay={needsTapToPlay}
        onRetry={retry}
        onResumePlayback={resumePlayback}
        stageRef={(node) => {
          stageRef.current = node
        }}
        sidebarTab={sidebarTab}
        onSidebarTabChange={setSidebarTab}
        showPeopleTab={isLive}
        showProductTab={Boolean(live.product)}
        peopleBadgeCount={pendingCount}
        banner={
          endError || !live.product || hostNotice || (isLive && pendingCount > 0) ? (
            <div className="space-y-2">
              {endError ? <Alert>{endError}</Alert> : null}
              {!live.product ? <Alert>The featured product is no longer available.</Alert> : null}
              {hostNotice ? <Alert tone="info">{hostNotice}</Alert> : null}
              {isLive ? (
                <HostSpeakRequestBanner
                  pendingRequests={interactive.pendingRequests}
                  busyId={interactive.busyId}
                  onOpenPeople={() => setSidebarTab('people')}
                  onAccept={async (id) => {
                    await interactive.acceptRequest(id)
                    setHostNotice('Request accepted — waiting for the viewer to enable media.')
                    window.setTimeout(() => setHostNotice(null), 5000)
                  }}
                  onReject={async (id) => {
                    await interactive.rejectRequest(id)
                    setHostNotice('Request rejected.')
                    window.setTimeout(() => setHostNotice(null), 4000)
                  }}
                />
              ) : null}
            </div>
          ) : null
        }
        stage={<StreamParticipantGrid tiles={gridTiles} />}
        chatPanel={
          <ChatPanel
            variant="meeting"
            messages={chat.messages}
            loading={chat.loading}
            sending={chat.sending}
            error={chat.error}
            onSend={chat.send}
          />
        }
        peoplePanel={
          <ViewerManagementPanel
            customerCount={presence.customerCount}
            viewers={presence.viewers}
            interactionByUserId={interactive.interactionByUserId}
            pendingRequests={interactive.pendingRequests}
            busyId={interactive.busyId}
            error={interactive.actionError}
            onAcceptRequest={interactive.acceptRequest}
            onRejectRequest={interactive.rejectRequest}
            onInvite={interactive.invite}
            onReturnToAudience={interactive.returnToAudience}
          />
        }
        productPanel={
          live.product ? (
            <FeaturedProductCard product={live.product} showAddToCart={false} />
          ) : null
        }
        controls={{
          isHost: true,
          connected,
          micMuted,
          cameraOff,
          canSwitchCamera,
          ending,
          liveEnded: !isLive,
          onToggleMic: () => void toggleMic(),
          onToggleCamera: () => void toggleCamera(),
          onSwitchCamera: () => void switchCamera(),
          onFullscreen: handleFullscreen,
          onEndOrLeave: () => void handleEnd(),
        }}
      />
    </AppShell>
  )
}

export default SellerLivePage
