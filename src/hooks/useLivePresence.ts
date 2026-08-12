import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface PresenceMeta {
  user_id?: string
  role?: 'host' | 'audience'
  online_at?: string
}

interface UseLivePresenceOptions {
  liveId: string | null
  userId: string | null
  role: 'host' | 'audience'
  enabled: boolean
}

/**
 * Accurate connected-user count via Supabase Presence.
 * Agora live-mode audience peers are not visible in remoteUsers, so RTC
 * presence cannot be used for customer counts.
 */
export function useLivePresence({
  liveId,
  userId,
  role,
  enabled,
}: UseLivePresenceOptions): { viewerCount: number; customerCount: number } {
  const [viewerCount, setViewerCount] = useState(0)
  const [customerCount, setCustomerCount] = useState(0)

  useEffect(() => {
    if (!enabled || !liveId || !userId) {
      setViewerCount(0)
      setCustomerCount(0)
      return
    }

    const channel = supabase.channel(`live-presence-${liveId}`, {
      config: {
        presence: { key: userId },
      },
    })

    const syncCounts = () => {
      const state = channel.presenceState<PresenceMeta>()
      const uniqueUsers = Object.keys(state)
      const customers = uniqueUsers.filter((id) =>
        (state[id] ?? []).some((meta) => meta.role === 'audience'),
      )
      setViewerCount(uniqueUsers.length)
      setCustomerCount(customers.length)
    }

    channel
      .on('presence', { event: 'sync' }, syncCounts)
      .on('presence', { event: 'join' }, syncCounts)
      .on('presence', { event: 'leave' }, syncCounts)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        await channel.track({
          user_id: userId,
          role,
          online_at: new Date().toISOString(),
        })
      })

    return () => {
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  }, [enabled, liveId, userId, role])

  return { viewerCount, customerCount }
}
