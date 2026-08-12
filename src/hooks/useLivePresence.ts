import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface PresenceViewer {
  userId: string
  name: string
  avatar: string | null
  role: 'host' | 'audience'
  onlineAt: string
}

interface PresenceMeta {
  user_id?: string
  name?: string
  avatar?: string | null
  role?: 'host' | 'audience'
  online_at?: string
}

interface UseLivePresenceOptions {
  liveId: string | null
  userId: string | null
  role: 'host' | 'audience'
  enabled: boolean
  displayName?: string | null
  avatar?: string | null
  /** Called when a previously-present audience user leaves (host-side cleanup). */
  onAudienceLeave?: (userId: string) => void
}

/**
 * Accurate connected-user count + viewer roster via Supabase Presence.
 * Agora live-mode audience peers are not visible in remoteUsers, so RTC
 * presence cannot be used for customer counts.
 */
export function useLivePresence({
  liveId,
  userId,
  role,
  enabled,
  displayName = null,
  avatar = null,
  onAudienceLeave,
}: UseLivePresenceOptions): {
  viewerCount: number
  customerCount: number
  viewers: PresenceViewer[]
} {
  const [viewerCount, setViewerCount] = useState(0)
  const [customerCount, setCustomerCount] = useState(0)
  const [viewers, setViewers] = useState<PresenceViewer[]>([])
  const knownAudienceRef = useRef<Set<string>>(new Set())
  const onLeaveRef = useRef(onAudienceLeave)

  useEffect(() => {
    onLeaveRef.current = onAudienceLeave
  }, [onAudienceLeave])

  useEffect(() => {
    if (!enabled || !liveId || !userId) {
      setViewerCount(0)
      setCustomerCount(0)
      setViewers([])
      knownAudienceRef.current = new Set()
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
      const nextViewers: PresenceViewer[] = []

      for (const id of uniqueUsers) {
        const metas = state[id] ?? []
        const meta = metas[metas.length - 1]
        if (!meta) continue
        nextViewers.push({
          userId: id,
          name: meta.name?.trim() || 'Viewer',
          avatar: meta.avatar ?? null,
          role: meta.role === 'host' ? 'host' : 'audience',
          onlineAt: meta.online_at ?? new Date().toISOString(),
        })
      }

      nextViewers.sort((a, b) => a.name.localeCompare(b.name))

      const customers = nextViewers.filter((v) => v.role === 'audience')
      const nextAudienceIds = new Set(customers.map((c) => c.userId))

      if (role === 'host' && onLeaveRef.current) {
        for (const prevId of knownAudienceRef.current) {
          if (!nextAudienceIds.has(prevId)) {
            onLeaveRef.current(prevId)
          }
        }
      }
      knownAudienceRef.current = nextAudienceIds

      setViewers(nextViewers)
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
          name: displayName ?? 'User',
          avatar: avatar ?? null,
          role,
          online_at: new Date().toISOString(),
        })
      })

    return () => {
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  }, [enabled, liveId, userId, role, displayName, avatar])

  return useMemo(
    () => ({ viewerCount, customerCount, viewers }),
    [viewerCount, customerCount, viewers],
  )
}
