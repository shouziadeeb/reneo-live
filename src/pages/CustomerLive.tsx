import { useCallback, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ChatPanel } from '../components/chat/ChatPanel'
import { LiveStage } from '../components/live/LiveStage'
import { FeaturedProductCard } from '../components/products/FeaturedProductCard'
import { ProductDrawer } from '../components/products/ProductDrawer'
import { Alert, Spinner } from '../components/ui'
import { useAgora } from '../hooks/useAgora'
import { useAuth } from '../hooks/useAuth'
import { useChat } from '../hooks/useChat'
import { useLiveSession } from '../hooks/useLive'

export function CustomerLivePage() {
  const { liveId } = useParams<{ liveId: string }>()
  const { user } = useAuth()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { live, loading, error } = useLiveSession(liveId)

  const isLive = live?.status === 'live'

  const agora = useAgora({
    liveId: liveId ?? null,
    role: 'audience',
    enabled: Boolean(isLive),
  })

  const chat = useChat(isLive ? (liveId ?? null) : null, user?.id ?? null)

  const handleFullscreen = useCallback(() => {
    const node = stageRef.current
    if (!node) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void node.requestFullscreen()
    }
  }, [])

  if (loading) {
    return (
      <AppShell>
        <Spinner label="Joining live session…" />
      </AppShell>
    )
  }

  if (error || !live) {
    return (
      <AppShell>
        <Alert>{error || 'Live session not found.'}</Alert>
        <Link to="/lives" className="mt-4 inline-block text-sm font-semibold text-[var(--accent-strong)]">
          Browse lives
        </Link>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/lives" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
          ← All lives
        </Link>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl">
          {live.host?.name ?? 'Seller'} is live
        </h1>
      </div>

      {!isLive ? (
        <div className="mb-4">
          <Alert tone="info">This live has ended. You can still review the featured product.</Alert>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.95fr)]">
        <div className="space-y-4">
          <div ref={stageRef}>
            <LiveStage
              videoRef={agora.remoteVideoRef}
              connecting={agora.connecting}
              connected={agora.connected}
              error={agora.error}
              isHost={false}
              sellerName={live.host?.name}
              viewerCount={agora.viewerCount}
              onFullscreen={handleFullscreen}
              liveEnded={!isLive}
            />
          </div>

          {/* Mobile product + chat stack under video */}
          <div className="grid gap-4 lg:hidden">
            {live.product ? (
              <FeaturedProductCard
                product={live.product}
                onView={() => setDrawerOpen(true)}
              />
            ) : null}
            <ChatPanel
              messages={chat.messages}
              loading={chat.loading}
              sending={chat.sending}
              error={chat.error}
              onSend={chat.send}
              compact
            />
          </div>
        </div>

        <div className="hidden flex-col gap-4 lg:flex">
          {live.product ? (
            <FeaturedProductCard
              product={live.product}
              onView={() => setDrawerOpen(true)}
            />
          ) : null}
          <div className="min-h-[22rem] flex-1">
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

      <ProductDrawer
        product={live.product ?? null}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </AppShell>
  )
}

export default CustomerLivePage
