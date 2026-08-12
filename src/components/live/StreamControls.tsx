import type { ButtonHTMLAttributes, ReactNode } from 'react'

function ControlButton({
  label,
  active,
  danger,
  disabled,
  onClick,
  badge,
  children,
}: {
  label: string
  active?: boolean
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
  badge?: number
  children: ReactNode
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex min-w-[4.25rem] flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="relative">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
            danger
              ? 'border-red-500 bg-red-500 text-white shadow-md shadow-red-500/25'
              : active
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : badge && badge > 0
                  ? 'border-amber-500 bg-amber-50 text-amber-900'
                  : 'border-[#b7c8ce] bg-white text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]'
          }`}
        >
          {children}
        </span>
        {badge && badge > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      <span className="text-[11px] font-medium text-[var(--muted)] group-hover:text-[var(--ink)]">
        {label}
      </span>
    </button>
  )
}

export interface StreamControlsProps {
  isHost: boolean
  connected: boolean
  micMuted?: boolean
  cameraOff?: boolean
  canSwitchCamera?: boolean
  chatOpen?: boolean
  peopleOpen?: boolean
  ending?: boolean
  leaving?: boolean
  liveEnded?: boolean
  /** Participant publishing (speaker/cohost) — show mic controls */
  showMediaControls?: boolean
  /** Show camera toggle (host or co-host with video) */
  showCameraControl?: boolean
  onToggleMic?: () => void
  onToggleCamera?: () => void
  onSwitchCamera?: () => void
  onToggleChat?: () => void
  onTogglePeople?: () => void
  onFullscreen?: () => void
  onEndOrLeave?: () => void
  /** Pending speak-request count for People badge */
  peopleBadgeCount?: number
}

export function StreamControls({
  isHost,
  connected,
  micMuted,
  cameraOff,
  canSwitchCamera,
  chatOpen,
  peopleOpen,
  ending,
  leaving,
  liveEnded,
  showMediaControls = false,
  showCameraControl = false,
  onToggleMic,
  onToggleCamera,
  onSwitchCamera,
  onToggleChat,
  onTogglePeople,
  onFullscreen,
  onEndOrLeave,
  peopleBadgeCount = 0,
}: StreamControlsProps) {
  const media = isHost || showMediaControls
  const camera = isHost || showCameraControl

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
      {media ? (
        <ControlButton
          label={micMuted ? 'Unmute' : 'Audio'}
          active={micMuted}
          disabled={!connected || liveEnded}
          onClick={onToggleMic}
        >
          {micMuted ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l14 14" strokeLinecap="round" />
              <path d="M12 3a3 3 0 0 1 3 3v5M9 9V6a3 3 0 0 1 3-3" strokeLinecap="round" />
              <path d="M5 11a7 7 0 0 0 11.5 5.3M12 19v2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
            </svg>
          )}
        </ControlButton>
      ) : null}

      {camera ? (
        <ControlButton
          label={cameraOff ? 'Cam on' : 'Video'}
          active={cameraOff}
          disabled={!connected || liveEnded}
          onClick={onToggleCamera}
        >
          {cameraOff ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l18 18" strokeLinecap="round" />
              <path d="M7 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
              <path d="M15 10.5 21 7v10l-3.5-2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="6" width="13" height="12" rx="2" />
              <path d="m15 10 5-3v10l-5-3" />
            </svg>
          )}
        </ControlButton>
      ) : null}

      {isHost && canSwitchCamera ? (
        <ControlButton label="Flip" disabled={!connected || liveEnded} onClick={onSwitchCamera}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M16 4h4v4M8 20H4v-4" strokeLinecap="round" />
            <path d="M20 8A8 8 0 0 0 7 6.3M4 16a8 8 0 0 0 13 1.7" strokeLinecap="round" />
          </svg>
        </ControlButton>
      ) : null}

      <ControlButton label="Layout" disabled={!connected || liveEnded} onClick={onFullscreen}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="8" height="16" rx="1.5" />
          <rect x="13" y="4" width="8" height="7" rx="1.5" />
          <rect x="13" y="13" width="8" height="7" rx="1.5" />
        </svg>
      </ControlButton>

      {onTogglePeople ? (
        <ControlButton
          label="People"
          active={peopleOpen}
          badge={peopleBadgeCount}
          onClick={onTogglePeople}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="9" cy="8" r="3" />
            <circle cx="16" cy="9" r="2.5" />
            <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5M14 19c0-1.8 1.6-3.3 3.5-3.3S21 17.2 21 19" />
          </svg>
        </ControlButton>
      ) : null}

      <ControlButton label="Chat" active={chatOpen} onClick={onToggleChat}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </svg>
      </ControlButton>

      {onEndOrLeave && !liveEnded ? (
        <ControlButton
          label={isHost ? (ending ? 'Ending…' : 'End') : leaving ? 'Leaving…' : 'Leave'}
          danger
          disabled={ending || leaving}
          onClick={onEndOrLeave}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M6.6 2.4c.5-.5 1.3-.5 1.8 0l2.2 2.2c.5.5.5 1.2.1 1.7L9.2 8.2a12.4 12.4 0 0 0 6.6 6.6l1.9-1.5c.5-.4 1.2-.4 1.7.1l2.2 2.2c.5.5.5 1.3 0 1.8l-1.5 1.5c-.5.5-1.2.7-1.9.5C10.8 17.5 6.5 13.2 4.6 6.8c-.2-.7 0-1.4.5-1.9L6.6 2.4Z" />
          </svg>
        </ControlButton>
      ) : null}
    </div>
  )
}
