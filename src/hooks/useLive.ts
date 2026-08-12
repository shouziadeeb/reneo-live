import { useCallback, useEffect, useState } from 'react'
import type { LiveSession, LiveSessionWithDetails } from '../types'
import {
  endLiveSession,
  fetchActiveLives,
  fetchLiveById,
  startLiveSession,
} from '../services/live'
import { supabase } from '../lib/supabase'

export function useLiveSession(liveId: string | undefined) {
  const [live, setLive] = useState<LiveSessionWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!liveId) {
      setLive(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await fetchLiveById(liveId)
      if (!data) {
        setError('Live session not found.')
        setLive(null)
      } else {
        setLive(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live session.')
      setLive(null)
    } finally {
      setLoading(false)
    }
  }, [liveId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!liveId) return

    const channel = supabase
      .channel(`live-session-${liveId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${liveId}`,
        },
        (payload) => {
          const next = payload.new as LiveSession
          setLive((current) => (current ? { ...current, ...next } : current))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [liveId])

  return { live, loading, error, reload }
}

export function useActiveLives() {
  const [lives, setLives] = useState<LiveSessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchActiveLives()
      setLives(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live sessions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()

    const channel = supabase
      .channel('active-lives')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_sessions' },
        () => {
          void reload()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [reload])

  return { lives, loading, error, reload }
}

export function useSellerLiveActions() {
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)

  const start = useCallback(async (productId: string) => {
    setStarting(true)
    try {
      return await startLiveSession(productId)
    } finally {
      setStarting(false)
    }
  }, [])

  const end = useCallback(async (liveId: string) => {
    setEnding(true)
    try {
      return await endLiveSession(liveId)
    } finally {
      setEnding(false)
    }
  }, [])

  return { start, end, starting, ending }
}
