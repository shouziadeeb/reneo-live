import type {
  InteractionMode,
  LiveInteraction,
  LiveInteractionWithUser,
} from '../types'
import { supabase } from '../lib/supabase'

function mapInteractiveError(message: string, fallback: string): Error {
  const lower = message.toLowerCase()
  if (/jwt|expired|not authenticated|unauthorized/i.test(message)) {
    return new Error('Your session expired. Please sign in again.')
  }
  if (lower.includes('already have an active')) {
    return new Error('You already have a pending request or active intervention.')
  }
  if (lower.includes('maximum of 4')) {
    return new Error('This live already has the maximum number of speakers/co-hosts.')
  }
  if (lower.includes('expired')) {
    return new Error('That request or invitation has expired. Try again.')
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return new Error('Network request failed. Check your connection and try again.')
  }
  return new Error(message || fallback)
}

async function rpcInteraction(
  fn: string,
  args: Record<string, unknown>,
  fallback: string,
): Promise<LiveInteraction> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw mapInteractiveError(error.message, fallback)
  return data as LiveInteraction
}

export async function fetchLiveInteractions(
  liveId: string,
): Promise<LiveInteractionWithUser[]> {
  try {
    await supabase.rpc('expire_stale_live_interactions', { p_live_id: liveId })
  } catch {
    // Non-fatal: list query still works; stale rows may linger briefly.
  }

  const { data, error } = await supabase
    .from('live_interactions')
    .select(
      `
      *,
      user:profiles!live_interactions_user_id_fkey(id, name, avatar)
    `,
    )
    .eq('live_id', liveId)
    .order('created_at', { ascending: false })

  if (error) throw mapInteractiveError(error.message, 'Could not load interactions.')
  return (data as LiveInteractionWithUser[]) ?? []
}

export async function requestToSpeak(
  liveId: string,
  mode: InteractionMode,
): Promise<LiveInteraction> {
  return rpcInteraction(
    'request_to_speak',
    { p_live_id: liveId, p_mode: mode },
    'Could not send speak request.',
  )
}

export async function cancelSpeakRequest(interactionId: string): Promise<LiveInteraction> {
  return rpcInteraction(
    'cancel_speak_request',
    { p_interaction_id: interactionId },
    'Could not cancel the request.',
  )
}

export async function respondToSpeakRequest(
  interactionId: string,
  accept: boolean,
): Promise<LiveInteraction> {
  return rpcInteraction(
    'respond_to_speak_request',
    { p_interaction_id: interactionId, p_accept: accept },
    accept ? 'Could not accept the request.' : 'Could not reject the request.',
  )
}

export async function inviteToSpeak(
  liveId: string,
  userId: string,
  mode: InteractionMode,
): Promise<LiveInteraction> {
  return rpcInteraction(
    'invite_to_speak',
    { p_live_id: liveId, p_user_id: userId, p_mode: mode },
    'Could not send invitation.',
  )
}

export async function respondToInvite(
  interactionId: string,
  accept: boolean,
): Promise<LiveInteraction> {
  return rpcInteraction(
    'respond_to_invite',
    { p_interaction_id: interactionId, p_accept: accept },
    accept ? 'Could not accept the invitation.' : 'Could not decline the invitation.',
  )
}

export async function confirmParticipantMedia(
  interactionId: string,
): Promise<LiveInteraction> {
  return rpcInteraction(
    'confirm_participant_media',
    { p_interaction_id: interactionId },
    'Could not confirm media for the intervention.',
  )
}

export async function endIntervention(interactionId: string): Promise<LiveInteraction> {
  return rpcInteraction(
    'end_intervention',
    { p_interaction_id: interactionId },
    'Could not end the intervention.',
  )
}

export async function endInterventionForUser(
  liveId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('end_intervention_for_user', {
    p_live_id: liveId,
    p_user_id: userId,
  })
  if (error) throw mapInteractiveError(error.message, 'Could not clean up participant state.')
}
