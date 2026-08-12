import type { AgoraTokenResponse } from '../types'
import { supabase } from './supabase'

export const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID as string | undefined

export class AgoraTokenError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'AgoraTokenError'
    this.code = code
  }
}

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

async function readFunctionError(
  error: { message?: string; context?: unknown },
): Promise<{ message: string; code?: string }> {
  const fallback = error.message || 'Failed to get Agora token.'
  const context = error.context as
    | { json?: () => Promise<unknown>; body?: unknown }
    | Response
    | undefined

  try {
    if (context && typeof Response !== 'undefined' && context instanceof Response) {
      const body = (await context.clone().json()) as { error?: string; code?: string }
      if (body?.error) return { message: body.error, code: body.code }
    }
    if (context && typeof context === 'object' && 'json' in context && typeof context.json === 'function') {
      const body = (await context.json()) as { error?: string; code?: string }
      if (body?.error) return { message: body.error, code: body.code }
    }
  } catch {
    // ignore parse failures
  }

  return { message: fallback }
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
    throw new AgoraTokenError(
      'Your session expired. Please sign in again to join the live.',
      'INVALID_SESSION',
    )
  }

  const { data, error } = await supabase.functions.invoke<
    AgoraTokenResponse | { error: string; code?: string }
  >('agora-token', { body: { liveId, role } })

  if (data && typeof data === 'object' && 'error' in data && !('token' in data)) {
    const code = 'code' in data ? data.code : undefined
    if (code === 'LIVE_NOT_ACTIVE') {
      throw new AgoraTokenError('This live has ended.', code)
    }
    if (code === 'INVALID_SESSION') {
      throw new AgoraTokenError(
        'Your session expired. Please sign in again to join the live.',
        code,
      )
    }
    throw new AgoraTokenError(data.error, code)
  }

  if (error) {
    const parsed = await readFunctionError(error)
    if (parsed.code === 'LIVE_NOT_ACTIVE') {
      throw new AgoraTokenError('This live has ended.', parsed.code)
    }
    throw new AgoraTokenError(parsed.message, parsed.code)
  }

  if (!data || typeof data !== 'object' || !('token' in data) || !('appId' in data)) {
    throw new AgoraTokenError('Invalid token response from server.')
  }

  const tokenData = data as AgoraTokenResponse
  if (!tokenData.token || !tokenData.appId) {
    throw new AgoraTokenError('Invalid token response from server.')
  }

  return tokenData
}
