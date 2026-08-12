import type { LiveSession, LiveSessionWithDetails } from '../types'
import { supabase } from '../lib/supabase'

export async function startLiveSession(productId: string): Promise<LiveSession> {
  const { data, error } = await supabase
    .from('live_sessions')
    .insert({
      product_id: productId,
      host_id: (await supabase.auth.getUser()).data.user?.id ?? '',
      status: 'live',
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
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

  if (error) throw new Error(error.message)
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
