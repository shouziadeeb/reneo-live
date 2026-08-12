import type { AgoraTokenResponse } from '../types'
import { supabase } from './supabase'

export const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID as string | undefined

export function liveChannelName(liveId: string): string {
  return `live_${liveId.replace(/-/g, '')}`
}

/** Numeric Agora UID derived from a UUID (stable, positive 32-bit). */
export function uidFromUserId(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) || 1
}

export async function fetchAgoraToken(
  liveId: string,
  role: 'host' | 'audience',
): Promise<AgoraTokenResponse> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.access_token) {
    throw new Error('You must be signed in to join a live session.')
  }

  const { data, error } = await supabase.functions.invoke<AgoraTokenResponse | { error: string; code?: string }>(
    'agora-token',
    { body: { liveId, role } },
  )

  if (error) {
    throw new Error(error.message || 'Failed to get Agora token.')
  }

  if (data && 'code' in data && 'error' in data && !('token' in data)) {
    throw new Error(`${data.error}${data.code ? ` (${data.code})` : ''}`)
  }

  if (!data || !('token' in data) || !data.token || !data.appId) {
    throw new Error('Invalid token response from server.')
  }

  return data
}
