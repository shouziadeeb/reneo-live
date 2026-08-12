import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ChatPanel } from '../components/chat/ChatPanel'
import {
  StreamParticipantGrid,
  type StreamGridTile,
} from '../components/live/StreamParticipantGrid'
import { StreamRoom } from '../components/live/StreamRoom'
import { RequestToSpeakPanel } from '../components/live/RequestToSpeakPanel'
import { FeaturedProductCard } from '../components/products/FeaturedProductCard'
import { ProductDrawer } from '../components/products/ProductDrawer'
import { Alert, Spinner } from '../components/ui'
import { useAgora } from '../hooks/useAgora'
import { useAuth } from '../hooks/useAuth'
import { useChat } from '../hooks/useChat'
import { useInteractiveLive } from '../hooks/useInteractiveLive'
import { useLiveSession } from '../hooks/useLive'
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

export function CustomerLivePage() {
  const { liveId } = useParams<{ liveId: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'people' | 'product'>('chat')
  const { live, loading, error } = useLiveSession(liveId)

  const isLive = live?.status === 'live'

  const interactive = useInteractiveLive({
    liveId: liveId ?? null,
    userId: user?.id ?? null,
    isHost: false,
    enabled: Boolean(isLive),
  })

  const {
    localVideoRef,
    remoteVideoRef,
    bindRemoteVideoEl,
    connecting,
    connected,
    error: agoraError,
    warning,
    reconnecting,
    needsTapToPlay,
    publishing,
    publishError,
    remoteParticipants,
    micMuted,
    cameraOff,
    canSwitchCamera,
    toggleMic,
    toggleCamera,
    switchCamera,
    leave,
    retry,
    resumePlayback,
    publishAsParticipant,
    unpublishAsParticipant,
  } = useAgora({
    liveId: liveId ?? null,
    role: 'audience',
    enabled: Boolean(isLive),
    hostUserId: live?.host_id ?? null,
  })

  const presence = useLivePresence({
    liveId: liveId ?? null,
    userId: user?.id ?? null,
    role: 'audience',
    enabled: Boolean(isLive),
    displayName: profile?.name ?? null,
    avatar: profile?.avatar ?? null,
  })

  const chat = useChat(isLive ? (liveId ?? null) : null, user?.id ?? null)

  const myInteraction = interactive.myOpenInteraction
  const previousStatusRef = useRef<string | null>(null)

  useEffect(() => {
    const prev = previousStatusRef.current
    const next = myInteraction?.status ?? null
    previousStatusRef.current = next

    const wasPublishing = prev === 'active' || prev === 'accepted'
    const shouldStop =
      !next ||
      next === 'ended' ||
      next === 'cancelled' ||
      next === 'rejected' ||
      next === 'expired'

    if (wasPublishing && shouldStop) {
      void unpublishAsParticipant()
    }
  }, [myInteraction?.status, unpublishAsParticipant])

  useEffect(() => {
    if (!isLive) {
      void unpublishAsParticipant()
    }
  }, [isLive, unpublishAsParticipant])

  const nameForUid = useCallback(
    (uid: number, isSessionHost: boolean) => {
      if (isSessionHost) return live?.host?.name ?? 'Host'
      const match = presence.viewers.find((v) => uidFromUserId(v.userId) === uid)
      return match?.name ?? 'Guest'
    },
    [live?.host?.name, presence.viewers],
  )

  const hostUid = live?.host_id ? uidFromUserId(live.host_id) : null
  const hostRemote = remoteParticipants.find((p) => p.isSessionHost)
  const otherRemotes = remoteParticipants.filter((p) => !p.isSessionHost)

  const gridTiles = useMemo<StreamGridTile[]>(() => {
    const tiles: StreamGridTile[] = []

    // Main host tile — prefer remote host track; fall back to remoteVideoRef mount
    tiles.push({
      key: 'host',
      name: live?.host?.name ?? 'Host',
      label: live?.host?.name ?? 'Host',
      hasVideo: hostRemote ? hostRemote.hasVideo : true,
      muted: hostRemote ? !hostRemote.hasAudio : false,
      videoRef: remoteVideoRef,
      bindVideoEl:
        hostUid != null
          ? (el) => {
              if (el) bindRemoteVideoEl(hostUid, el)
            }
          : undefined,
    })

    for (const p of otherRemotes) {
      if (!p.hasAudio && !p.hasVideo) continue
      tiles.push({
        key: `remote-${p.uid}`,
        name: nameForUid(p.uid, false),
        label: p.hasVideo ? 'Co-host' : 'Speaker',
        hasVideo: p.hasVideo,
        muted: !p.hasAudio,
        bindVideoEl: (el) => bindRemoteVideoEl(p.uid, el),
      })
    }

    if (publishing && myInteraction?.status === 'active') {
      tiles.push({
        key: 'local-self',
        name: profile?.name ?? 'You',
        label: myInteraction.mode === 'audio_video' ? 'You (Co-host)' : 'You (Speaker)',
        hasVideo: myInteraction.mode === 'audio_video' && !cameraOff,
        muted: micMuted,
        videoRef: localVideoRef,
      })
    }

    return tiles
  }, [
    live?.host?.name,
    hostRemote,
    hostUid,
    otherRemotes,
    nameForUid,
    bindRemoteVideoEl,
    remoteVideoRef,
    publishing,
    myInteraction,
    profile?.name,
    cameraOff,
    micMuted,
    localVideoRef,
  ])

  const handleFullscreen = useCallback(() => {
    if (stageRef.current) requestStageFullscreen(stageRef.current)
  }, [])

  async function handleLeave() {
    setLeaving(true)
    try {
      if (myInteraction && ['pending', 'accepted', 'active'].includes(myInteraction.status)) {
        await interactive.returnToAudience(myInteraction.id).catch(() => undefined)
      }
      await unpublishAsParticipant().catch(() => undefined)
      await leave()
      navigate('/lives')
    } catch {
      navigate('/lives')
    }
  }

  async function handleEnableMedia() {
    if (!myInteraction || myInteraction.status !== 'accepted') {
      throw new Error('Waiting for acceptance before enabling media.')
    }
    await publishAsParticipant(myInteraction.mode)
    await interactive.confirmMedia(myInteraction.id)
  }

  async function handleLeaveIntervention(interactionId: string) {
    await interactive.returnToAudience(interactionId)
    await unpublishAsParticipant()
  }

  if (loading) {
    return (
      <AppShell wide>
        <Spinner label="Joining live session…" />
      </AppShell>
    )
  }

  if (error || !live) {
    return (
      <AppShell wide>
        <Alert>{error || 'Live session not found.'}</Alert>
        <Link to="/lives" className="mt-4 inline-block text-sm font-semibold text-[var(--accent-strong)]">
          Browse lives
        </Link>
      </AppShell>
    )
  }

  const isCohost = publishing && myInteraction?.status === 'active' && myInteraction.mode === 'audio_video'
  const isSpeaker = publishing && myInteraction?.status === 'active'
  const roomTitle = live.product?.name ?? `${live.host?.name ?? 'Seller'} Live`

  return (
    <AppShell wide>
      <StreamRoom
        title={roomTitle}
        subtitle={`${live.host?.name ?? 'Seller'} is live`}
        backTo="/lives"
        backLabel="← All lives"
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
        showProductTab={Boolean(live.product)}
        banner={
          !live.product ? <Alert>The featured product is no longer available.</Alert> : null
        }
        stage={<StreamParticipantGrid tiles={gridTiles} />}
        belowStage={
          isLive ? (
            <RequestToSpeakPanel
              interaction={
                myInteraction ??
                interactive.interactions.find((row) => row.user_id === user?.id) ??
                null
              }
              busyId={interactive.busyId}
              error={interactive.actionError}
              publishError={publishError}
              publishing={publishing}
              connected={connected}
              onRequest={interactive.requestSpeak}
              onCancelRequest={interactive.cancelRequest}
              onAcceptInvite={interactive.acceptInvite}
              onRejectInvite={interactive.rejectInvite}
              onEnableMedia={handleEnableMedia}
              onLeaveIntervention={handleLeaveIntervention}
            />
          ) : null
        }
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
        productPanel={
          live.product ? (
            <FeaturedProductCard
              product={live.product}
              onView={() => setDrawerOpen(true)}
            />
          ) : null
        }
        controls={{
          isHost: false,
          connected,
          micMuted,
          cameraOff,
          canSwitchCamera: isCohost && canSwitchCamera,
          showMediaControls: isSpeaker,
          showCameraControl: isCohost,
          leaving,
          liveEnded: !isLive,
          onToggleMic: isSpeaker ? () => void toggleMic() : undefined,
          onToggleCamera: isCohost ? () => void toggleCamera() : undefined,
          onSwitchCamera: isCohost ? () => void switchCamera() : undefined,
          onFullscreen: handleFullscreen,
          onEndOrLeave: () => void handleLeave(),
        }}
      />

      <ProductDrawer
        product={live.product ?? null}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </AppShell>
  )
}

export default CustomerLivePage
