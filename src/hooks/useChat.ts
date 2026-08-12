import { useCallback, useEffect, useState } from 'react'
import type { MessageWithSender } from '../types'
import { fetchMessages, sendMessage, validateChatMessage } from '../services/chat'
import { supabase } from '../lib/supabase'

export function useChat(liveId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!liveId) {
      setMessages([])
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchMessages(liveId!)
        if (!cancelled) setMessages(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chat.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    const channel = supabase
      .channel(`chat-${liveId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `live_id=eq.${liveId}`,
        },
        async (payload) => {
          const row = payload.new as MessageWithSender
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, name, avatar')
            .eq('id', row.user_id)
            .maybeSingle()

          setMessages((current) => {
            if (current.some((m) => m.id === row.id)) return current
            return [...current, { ...row, sender }]
          })
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setError('Realtime chat disconnected. Messages may be delayed.')
        }
      })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [liveId])

  const send = useCallback(
    async (text: string) => {
      if (!liveId || !userId) {
        throw new Error('You must be signed in to chat.')
      }
      const validationError = validateChatMessage(text)
      if (validationError) throw new Error(validationError)

      setSending(true)
      setError(null)
      try {
        const message = await sendMessage(liveId, userId, text)
        setMessages((current) => {
          if (current.some((m) => m.id === message.id)) return current
          return [...current, message]
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message.'
        setError(message)
        throw err
      } finally {
        setSending(false)
      }
    },
    [liveId, userId],
  )

  return { messages, loading, sending, error, send }
}
