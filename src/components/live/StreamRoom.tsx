import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '../ui'
import { StreamControls, type StreamControlsProps } from './StreamControls'

type SidebarTab = 'chat' | 'people' | 'product'

export interface StreamRoomProps {
  title: string
  subtitle?: string
  backTo: string
  backLabel: string
  liveEnded?: boolean
  viewerCount?: number | null
  connecting?: boolean
  connected?: boolean
  error?: string | null
  warning?: string | null
  needsTapToPlay?: boolean
  onRetry?: () => void
  onResumePlayback?: () => void
  /** Video grid content */
  stage: ReactNode
  /** Optional strip below grid (interactive panels on mobile, etc.) */
  belowStage?: ReactNode
  sidebarTab: SidebarTab
  onSidebarTabChange: (tab: SidebarTab) => void
  showPeopleTab?: boolean
  showProductTab?: boolean
  chatPanel: ReactNode
  peoplePanel?: ReactNode
  productPanel?: ReactNode
  stageRef?: (node: HTMLDivElement | null) => void
  controls: StreamControlsProps
  banner?: ReactNode
  /** Pending speak requests — shows on People icons / tabs */
  peopleBadgeCount?: number
}

export function StreamRoom({
  title,
  subtitle,
  backTo,
  backLabel,
  liveEnded,
  viewerCount,
  connecting,
  connected,
  error,
  warning,
  needsTapToPlay,
  onRetry,
  onResumePlayback,
  stage,
  belowStage,
  sidebarTab,
  onSidebarTabChange,
  showPeopleTab = false,
  showProductTab = false,
  chatPanel,
  peoplePanel,
  productPanel,
  stageRef,
  controls,
  banner,
  peopleBadgeCount = 0,
}: StreamRoomProps) {
  const sidebarOpen =
    sidebarTab === 'chat' ||
    (sidebarTab === 'people' && showPeopleTab) ||
    (sidebarTab === 'product' && showProductTab)

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col rounded-3xl border border-[#c5d4d9] bg-gradient-to-br from-[#eef5f7] via-[#e7f0f3] to-[#dce8ec] shadow-[0_20px_60px_rgba(20,37,35,0.08)]">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c5d4d9]/80 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={backTo}
            className="shrink-0 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {backLabel}
          </Link>
          <div className="hidden h-5 w-px bg-[#c5d4d9] sm:block" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {liveEnded ? (
                <span className="rounded-full bg-stone-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Ended
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </span>
              )}
              <h1 className="truncate font-display text-lg text-[var(--ink)] sm:text-xl">{title}</h1>
              <button
                type="button"
                className="hidden rounded-md border border-[#b7c8ce] bg-white/70 p-1 text-[var(--muted)] hover:text-[var(--ink)] sm:inline-flex"
                title="Session id"
                onClick={() => void navigator.clipboard?.writeText(title)}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <path d="M4 16V6a2 2 0 0 1 2-2h10" />
                </svg>
              </button>
            </div>
            {subtitle ? <p className="truncate text-xs text-[var(--muted)]">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {typeof viewerCount === 'number' && !liveEnded ? (
            <span className="mr-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-[var(--ink)] ring-1 ring-[#b7c8ce]">
              {viewerCount} watching
            </span>
          ) : null}
          {showPeopleTab ? (
            <HeaderIconButton
              label="People"
              active={sidebarTab === 'people'}
              badge={peopleBadgeCount}
              onClick={() => onSidebarTabChange(sidebarTab === 'people' ? 'chat' : 'people')}
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="9" cy="8" r="3" />
                <circle cx="16" cy="9" r="2.5" />
                <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" />
              </svg>
            </HeaderIconButton>
          ) : null}
          <HeaderIconButton
            label="Chat"
            active={sidebarTab === 'chat'}
            onClick={() => onSidebarTabChange('chat')}
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
            </svg>
          </HeaderIconButton>
          {showProductTab ? (
            <HeaderIconButton
              label="Product"
              active={sidebarTab === 'product'}
              onClick={() => onSidebarTabChange(sidebarTab === 'product' ? 'chat' : 'product')}
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 8h16l-1.2 11.2A2 2 0 0 1 16.8 21H7.2a2 2 0 0 1-2-1.8L4 8Z" />
                <path d="M8 8V6a4 4 0 0 1 8 0v2" />
              </svg>
            </HeaderIconButton>
          ) : null}
        </div>
      </header>

      {banner ? <div className="border-b border-[#c5d4d9]/80 px-4 py-2 sm:px-5">{banner}</div> : null}

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={stageRef} className="relative min-h-[18rem] flex-1 p-3 sm:p-4">
            <div className="relative h-full min-h-[18rem] w-full">{stage}</div>

            {(connecting || error || (!connected && !connecting && !liveEnded) || needsTapToPlay) && (
              <div className="absolute inset-3 z-10 flex items-center justify-center rounded-2xl bg-[#142523]/45 px-6 text-center backdrop-blur-[2px] sm:inset-4">
                {connecting ? <Spinner label="Connecting to stream…" /> : null}
                {!connecting && error ? (
                  <div className="max-w-sm space-y-3">
                    <p className="text-sm text-red-100">{error}</p>
                    {onRetry ? (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25"
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {!connecting && !error && !connected && !liveEnded ? (
                  <p className="text-sm text-white/90">Waiting for video…</p>
                ) : null}
                {needsTapToPlay && !error && !liveEnded ? (
                  <button
                    type="button"
                    onClick={onResumePlayback}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Tap to play audio
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {warning && !liveEnded ? (
            <div className="mx-4 mb-2 rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {warning}
            </div>
          ) : null}

          {belowStage ? <div className="space-y-3 px-3 pb-2 sm:px-4">{belowStage}</div> : null}

          <div className="border-t border-[#c5d4d9]/80 px-3 py-3 sm:px-4">
            <StreamControls
              {...controls}
              chatOpen={sidebarTab === 'chat'}
              peopleOpen={sidebarTab === 'people'}
              peopleBadgeCount={peopleBadgeCount}
              onToggleChat={() => onSidebarTabChange('chat')}
              onTogglePeople={
                showPeopleTab
                  ? () => onSidebarTabChange(sidebarTab === 'people' ? 'chat' : 'people')
                  : undefined
              }
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside
          className={`flex w-full flex-col border-t border-[#c5d4d9]/80 bg-white/75 lg:w-[22rem] lg:border-l lg:border-t-0 ${
            sidebarOpen ? '' : 'hidden lg:flex'
          }`}
        >
          <div className="flex gap-1 border-b border-[#c5d4d9]/80 px-3 pt-3">
            <TabButton
              active={sidebarTab === 'chat'}
              onClick={() => onSidebarTabChange('chat')}
            >
              Group
            </TabButton>
            {showPeopleTab ? (
              <TabButton
                active={sidebarTab === 'people'}
                badge={peopleBadgeCount}
                onClick={() => onSidebarTabChange('people')}
              >
                People
              </TabButton>
            ) : null}
            {showProductTab ? (
              <TabButton
                active={sidebarTab === 'product'}
                onClick={() => onSidebarTabChange('product')}
              >
                Product
              </TabButton>
            ) : (
              <TabButton active={false} disabled>
                Private
              </TabButton>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-3">
            {sidebarTab === 'chat' ? chatPanel : null}
            {sidebarTab === 'people' && showPeopleTab ? peoplePanel : null}
            {sidebarTab === 'product' && showProductTab ? productPanel : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

function HeaderIconButton({
  label,
  active,
  badge,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  badge?: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={badge && badge > 0 ? `${label}, ${badge} pending` : label}
      onClick={onClick}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
          : badge && badge > 0
            ? 'border-amber-500 bg-amber-50 text-amber-900'
            : 'border-[#b7c8ce] bg-white/80 text-[var(--muted)] hover:text-[var(--ink)]'
      }`}
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  )
}

function TabButton({
  active,
  badge,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  badge?: number
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative rounded-t-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-b-2 border-[var(--accent)] text-[var(--accent-strong)]'
          : 'text-[var(--muted)] hover:text-[var(--ink)]'
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {badge && badge > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
    </button>
  )
}
