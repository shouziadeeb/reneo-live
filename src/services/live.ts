import type { LiveSession, LiveSessionWithDetails } from '../types'
import { supabase } from '../lib/supabase'

function mapLiveError(message: string, fallback: string): Error {
  const lower = message.toLowerCase()
  if (/jwt|expired|not authenticated|unauthorized/i.test(message)) {
    return new Error('Your session expired. Please sign in again.')
  }
  if (lower.includes('product not found') || lower.includes('not owned')) {
    return new Error('That product was not found or is not available to go live.')
  }
  if (lower.includes('only sellers')) {
    return new Error('Only sellers can start a live session.')
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return new Error('Network request failed. Check your connection and try again.')
  }
  return new Error(message || fallback)
}

export async function startLiveSession(productId: string): Promise<LiveSession> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('You must be signed in to start a live session.')
  }

  const { data, error } = await supabase
    .from('live_sessions')
    .insert({
      product_id: productId,
      host_id: user.id,
      status: 'live',
    })
    .select('*')
    .single()

  if (error) throw mapLiveError(error.message, 'Could not create the live session.')
  return data as LiveSession
}

export async function endLiveSession(liveId: string): Promise<LiveSession> {
  const { data, error } = await supabase
    .from('live_sessions')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
    })
    .eq('id', liveId)
    .select('*')
    .single()

  if (error) throw mapLiveError(error.message, 'Could not end the live session.')
  if (!data) throw new Error('Live session not found or already ended.')
  return data
}

export async function fetchActiveLives(): Promise<LiveSessionWithDetails[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select(
      `
      *,
      product:products(*),
      host:profiles!live_sessions_host_id_fkey(id, name, avatar)
    `,
    )
    .eq('status', 'live')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as LiveSessionWithDetails[]) ?? []
}

export async function fetchLiveById(liveId: string): Promise<LiveSessionWithDetails | null> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select(
      `
      *,
      product:products(*),
      host:profiles!live_sessions_host_id_fkey(id, name, avatar)
    `,
    )
    .eq('id', liveId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as LiveSessionWithDetails | null
}

export async function fetchSellerActiveLive(hostId: string): Promise<LiveSession | null> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('host_id', hostId)
    .eq('status', 'live')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}
