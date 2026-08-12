import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  InteractionMode,
  LiveInteraction,
  LiveInteractionWithUser,
} from '../types'
import {
  cancelSpeakRequest,
  confirmParticipantMedia,
  endIntervention,
  endInterventionForUser,
  fetchLiveInteractions,
  inviteToSpeak,
  requestToSpeak,
  respondToInvite,
  respondToSpeakRequest,
} from '../services/interactive'
import { supabase } from '../lib/supabase'

const OPEN_STATUSES = new Set(['pending', 'accepted', 'active'])

function upsertInteraction(
  list: LiveInteractionWithUser[],
  row: LiveInteractionWithUser,
): LiveInteractionWithUser[] {
  const without = list.filter((item) => item.id !== row.id)
  return [row, ...without].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

interface UseInteractiveLiveOptions {
  liveId: string | null
  userId: string | null
  isHost: boolean
  enabled: boolean
}

export function useInteractiveLive({
  liveId,
  userId,
  isHost,
  enabled,
}: UseInteractiveLiveOptions) {
  const [interactions, setInteractions] = useState<LiveInteractionWithUser[]>([])
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const profileCacheRef = useRef<Map<string, { id: string; name: string; avatar: string | null }>>(
    new Map(),
  )

  const load = useCallback(async () => {
    if (!liveId || !enabled) {
      setInteractions([])
      return
    }
    setLoading(true)
    try {
      const data = await fetchLiveInteractions(liveId)
      for (const row of data) {
        if (row.user) profileCacheRef.current.set(row.user_id, row.user)
      }
      setInteractions(data)
      setActionError(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load interactions.')
    } finally {
      setLoading(false)
    }
  }, [enabled, liveId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!liveId || !enabled) return

    const channel = supabase
      .channel(`live-interactions-${liveId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_interactions',
          filter: `live_id=eq.${liveId}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as LiveInteraction
            setInteractions((current) => current.filter((row) => row.id !== oldRow.id))
            return
          }

          const row = payload.new as LiveInteraction
          let user = profileCacheRef.current.get(row.user_id) ?? null
          if (!user) {
            const { data } = await supabase
              .from('profiles')
              .select('id, name, avatar')
              .eq('id', row.user_id)
              .maybeSingle()
            if (data) {
              user = data
              profileCacheRef.current.set(row.user_id, data)
            }
          }

          setInteractions((current) => upsertInteraction(current, { ...row, user }))
        },
      )
      .subscribe()

    const expireTimer = window.setInterval(() => {
      void supabase.rpc('expire_stale_live_interactions', { p_live_id: liveId })
    }, 30_000)

    return () => {
      window.clearInterval(expireTimer)
      void supabase.removeChannel(channel)
    }
  }, [enabled, liveId])

  const myOpenInteraction = useMemo(() => {
    if (!userId) return null
    return (
      interactions.find(
        (row) => row.user_id === userId && OPEN_STATUSES.has(row.status),
      ) ?? null
    )
  }, [interactions, userId])

  const pendingRequests = useMemo(
    () =>
      interactions.filter(
        (row) => row.origin === 'request' && row.status === 'pending',
      ),
    [interactions],
  )

  const activeParticipants = useMemo(
    () => interactions.filter((row) => row.status === 'active' || row.status === 'accepted'),
    [interactions],
  )

  const interactionByUserId = useMemo(() => {
    const map = new Map<string, LiveInteractionWithUser>()
    for (const row of interactions) {
      if (OPEN_STATUSES.has(row.status)) {
        map.set(row.user_id, row)
      }
    }
    return map
  }, [interactions])

  const runAction = useCallback(async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    setBusyId(key)
    setActionError(null)
    try {
      return await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed.'
      setActionError(message)
      throw err
    } finally {
      setBusyId((current) => (current === key ? null : current))
    }
  }, [])

  const requestSpeak = useCallback(
    async (mode: InteractionMode) => {
      if (!liveId) throw new Error('Missing live session.')
      return runAction('request', () => requestToSpeak(liveId, mode))
    },
    [liveId, runAction],
  )

  const cancelRequest = useCallback(
    async (interactionId: string) => {
      return runAction(interactionId, () => cancelSpeakRequest(interactionId))
    },
    [runAction],
  )

  const acceptRequest = useCallback(
    async (interactionId: string) => {
      return runAction(interactionId, () => respondToSpeakRequest(interactionId, true))
    },
    [runAction],
  )

  const rejectRequest = useCallback(
    async (interactionId: string) => {
      return runAction(interactionId, () => respondToSpeakRequest(interactionId, false))
    },
    [runAction],
  )

  const invite = useCallback(
    async (targetUserId: string, mode: InteractionMode) => {
      if (!liveId) throw new Error('Missing live session.')
      return runAction(`invite-${targetUserId}`, () =>
        inviteToSpeak(liveId, targetUserId, mode),
      )
    },
    [liveId, runAction],
  )

  const acceptInvite = useCallback(
    async (interactionId: string) => {
      return runAction(interactionId, () => respondToInvite(interactionId, true))
    },
    [runAction],
  )

  const rejectInvite = useCallback(
    async (interactionId: string) => {
      return runAction(interactionId, () => respondToInvite(interactionId, false))
    },
    [runAction],
  )

  const confirmMedia = useCallback(
    async (interactionId: string) => {
      return runAction(`media-${interactionId}`, () =>
        confirmParticipantMedia(interactionId),
      )
    },
    [runAction],
  )

  const returnToAudience = useCallback(
    async (interactionId: string) => {
      return runAction(interactionId, () => endIntervention(interactionId))
    },
    [runAction],
  )

  const cleanupDisconnectedUser = useCallback(
    async (targetUserId: string) => {
      if (!liveId || !isHost) return
      const open = interactions.find(
        (row) => row.user_id === targetUserId && OPEN_STATUSES.has(row.status),
      )
      if (!open) return
      try {
        await endInterventionForUser(liveId, targetUserId)
      } catch {
        // Best-effort cleanup; realtime will reconcile.
      }
    },
    [interactions, isHost, liveId],
  )

  return {
    interactions,
    loading,
    actionError,
    busyId,
    myOpenInteraction,
    pendingRequests,
    activeParticipants,
    interactionByUserId,
    requestSpeak,
    cancelRequest,
    acceptRequest,
    rejectRequest,
    invite,
    acceptInvite,
    rejectInvite,
    confirmMedia,
    returnToAudience,
    cleanupDisconnectedUser,
    reload: load,
    clearError: () => setActionError(null),
  }
}
