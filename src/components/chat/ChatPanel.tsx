import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { MessageWithSender } from '../../types'
import { Alert, Spinner } from '../ui'
import { formatTime } from '../../lib/format'
import { useAuth } from '../../hooks/useAuth'

interface ChatPanelProps {
  messages: MessageWithSender[]
  loading: boolean
  sending: boolean
  error: string | null
  onSend: (message: string) => Promise<void>
  compact?: boolean
  /** Meeting-room bubble layout used on the stream page */
  variant?: 'default' | 'meeting'
}

export function ChatPanel({
  messages,
  loading,
  sending,
  error,
  onSend,
  compact = false,
  variant = 'default',
}: ChatPanelProps) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    try {
      await onSend(text)
      setText('')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to send.')
    }
  }

  if (variant === 'meeting') {
    return (
      <div className="flex h-full min-h-[16rem] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {loading ? <Spinner label="Loading messages…" /> : null}
          {!loading && messages.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Say hello — be the first in chat.</p>
          ) : null}
          {messages.map((message) => {
            const mine = Boolean(user?.id && message.user_id === user.id)
            return (
              <div
                key={message.id}
                className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-1 flex items-center gap-2 px-1">
                  {!mine ? (
                    <span className="text-xs font-semibold text-[var(--ink)]">
                      {message.sender?.name ?? 'Viewer'}
                    </span>
                  ) : null}
                  <span className="text-[10px] text-[var(--muted)]">
                    {formatTime(message.created_at)}
                  </span>
                </div>
                <div
                  className={`max-w-[90%] break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    mine
                      ? 'rounded-br-md bg-[var(--accent)] text-white'
                      : 'rounded-bl-md bg-[#edf2f4] text-[var(--ink)]'
                  }`}
                >
                  {message.message}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {(error || localError) && (
          <div className="pt-2">
            <Alert>{localError || error}</Alert>
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mt-3 flex items-center gap-2 border-t border-[#c5d4d9]/80 pt-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Type your message..."
            className="min-w-0 flex-1 rounded-full border border-[#b7c8ce] bg-white px-4 py-2.5 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-md disabled:opacity-50"
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M3.4 20.6 21 12 3.4 3.4 3 10l11 2-11 2z" />
            </svg>
          </button>
        </form>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border border-[var(--line)] bg-white/90 ${
        compact ? 'h-72' : 'h-full min-h-[18rem]'
      }`}
    >
      <div className="border-b border-[var(--line)] px-4 py-3">
        <h3 className="text-sm font-semibold tracking-wide text-[var(--ink)]">Live chat</h3>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading ? <Spinner label="Loading messages…" /> : null}
        {!loading && messages.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Say hello — be the first in chat.</p>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-[var(--ink)]">
                {message.sender?.name ?? 'Viewer'}
              </span>
              <span className="text-[11px] text-[var(--muted)]">{formatTime(message.created_at)}</span>
            </div>
            <p className="mt-0.5 break-words text-[var(--ink)]/90">{message.message}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {(error || localError) && (
        <div className="px-4 pb-2">
          <Alert>{localError || error}</Alert>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2 border-t border-[var(--line)] p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Send a message"
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          disabled={sending}
        />
        <button
          type="submit"
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={sending || !text.trim()}
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
