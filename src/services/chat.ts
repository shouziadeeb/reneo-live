import type { MessageWithSender } from '../types'
import { supabase } from '../lib/supabase'

const MAX_MESSAGE_LENGTH = 500

export function validateChatMessage(message: string): string | null {
  const trimmed = message.trim()
  if (!trimmed) return 'Message cannot be empty.'
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`
  }
  return null
}

export async function fetchMessages(liveId: string): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(
      `
      *,
      sender:profiles!messages_user_id_fkey(id, name, avatar)
    `,
    )
    .eq('live_id', liveId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) throw new Error(error.message)
  return (data as MessageWithSender[]) ?? []
}

export async function sendMessage(
  liveId: string,
  userId: string,
  message: string,
): Promise<MessageWithSender> {
  const validationError = validateChatMessage(message)
  if (validationError) throw new Error(validationError)

  const { data, error } = await supabase
    .from('messages')
    .insert({
      live_id: liveId,
      user_id: userId,
      message: message.trim(),
    })
    .select(
      `
      *,
      sender:profiles!messages_user_id_fkey(id, name, avatar)
    `,
    )
    .single()

  if (error) throw new Error(error.message)
  return data as MessageWithSender
}
