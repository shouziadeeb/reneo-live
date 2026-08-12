import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { MessageWithSender } from '../../types'
import { Alert, Button, Spinner } from '../ui'
import { formatTime } from '../../lib/format'

interface ChatPanelProps {
  messages: MessageWithSender[]
  loading: boolean
  sending: boolean
  error: string | null
  onSend: (message: string) => Promise<void>
  compact?: boolean
}

export function ChatPanel({
  messages,
  loading,
  sending,
  error,
  onSend,
  compact = false,
}: ChatPanelProps) {
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
        <Button type="submit" className="min-h-11" disabled={sending || !text.trim()}>
          {sending ? '…' : 'Send'}
        </Button>
      </form>
    </div>
  )
}
