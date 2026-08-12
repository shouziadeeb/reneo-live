export type UserRole = 'seller' | 'customer'

export type ProductStatus = 'active' | 'inactive'

export type LiveStatus = 'scheduled' | 'live' | 'ended'

export type InteractionMode = 'audio' | 'audio_video'

export type InteractionOrigin = 'request' | 'invite'

export type InteractionStatus =
  | 'pending'
  | 'accepted'
  | 'active'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'ended'

export type ParticipantRole = 'speaker' | 'cohost'

export interface Profile {
  id: string
  name: string
  avatar: string | null
  role: UserRole
  created_at: string
}

export interface Product {
  id: string
  seller_id: string
  name: string
  description: string
  price: number
  image_url: string | null
  stock: number
  status: ProductStatus
  created_at: string
}

export interface LiveSession {
  id: string
  host_id: string
  product_id: string
  status: LiveStatus
  created_at: string
  ended_at: string | null
}

export interface Message {
  id: string
  live_id: string
  user_id: string
  message: string
  created_at: string
}

export interface LiveInteraction {
  id: string
  live_id: string
  user_id: string
  mode: InteractionMode
  origin: InteractionOrigin
  status: InteractionStatus
  participant_role: ParticipantRole | null
  created_at: string
  updated_at: string
  expires_at: string | null
  responded_at: string | null
  ended_at: string | null
}

export interface LiveInteractionWithUser extends LiveInteraction {
  user?: Pick<Profile, 'id' | 'name' | 'avatar'> | null
}

export interface MessageWithSender extends Message {
  sender?: Pick<Profile, 'id' | 'name' | 'avatar'> | null
}

export interface LiveSessionWithDetails extends LiveSession {
  product?: Product | null
  host?: Pick<Profile, 'id' | 'name' | 'avatar'> | null
}

export interface CartItem {
  productId: string
  name: string
  price: number
  imageUrl: string | null
  quantity: number
  stock: number
}

export interface CreateProductInput {
  name: string
  description: string
  price: number
  stock: number
  status: ProductStatus
  imageFile?: File | null
}

export interface AgoraTokenResponse {
  token: string
  appId: string
  channel: string
  uid: number
  role: 'host' | 'audience'
  expiresAt: number
}

/** Recommended max simultaneous Speakers/Co-hosts per live (enforced in RPCs). */
export const MAX_ACTIVE_PARTICIPANTS = 4

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          name: string
          avatar?: string | null
          role: UserRole
          created_at?: string
        }
        Update: {
          name?: string
          avatar?: string | null
          role?: UserRole
        }
        Relationships: []
      }
      products: {
        Row: Product
        Insert: {
          id?: string
          seller_id: string
          name: string
          description: string
          price: number
          image_url?: string | null
          stock: number
          status?: ProductStatus
          created_at?: string
        }
        Update: {
          name?: string
          description?: string
          price?: number
          image_url?: string | null
          stock?: number
          status?: ProductStatus
        }
        Relationships: [
          {
            foreignKeyName: 'products_seller_id_fkey'
            columns: ['seller_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      live_sessions: {
        Row: LiveSession
        Insert: {
          id?: string
          host_id: string
          product_id: string
          status?: LiveStatus
          created_at?: string
          ended_at?: string | null
        }
        Update: {
          status?: LiveStatus
          ended_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'live_sessions_host_id_fkey'
            columns: ['host_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'live_sessions_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: Message
        Insert: {
          id?: string
          live_id: string
          user_id: string
          message: string
          created_at?: string
        }
        Update: {
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_live_id_fkey'
            columns: ['live_id']
            isOneToOne: false
            referencedRelation: 'live_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      live_interactions: {
        Row: LiveInteraction
        Insert: {
          id?: string
          live_id: string
          user_id: string
          mode: InteractionMode
          origin: InteractionOrigin
          status: InteractionStatus
          participant_role?: ParticipantRole | null
          created_at?: string
          updated_at?: string
          expires_at?: string | null
          responded_at?: string | null
          ended_at?: string | null
        }
        Update: {
          mode?: InteractionMode
          status?: InteractionStatus
          participant_role?: ParticipantRole | null
          expires_at?: string | null
          responded_at?: string | null
          ended_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'live_interactions_live_id_fkey'
            columns: ['live_id']
            isOneToOne: false
            referencedRelation: 'live_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'live_interactions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      request_to_speak: {
        Args: { p_live_id: string; p_mode: InteractionMode }
        Returns: LiveInteraction
      }
      cancel_speak_request: {
        Args: { p_interaction_id: string }
        Returns: LiveInteraction
      }
      respond_to_speak_request: {
        Args: { p_interaction_id: string; p_accept: boolean }
        Returns: LiveInteraction
      }
      invite_to_speak: {
        Args: { p_live_id: string; p_user_id: string; p_mode: InteractionMode }
        Returns: LiveInteraction
      }
      respond_to_invite: {
        Args: { p_interaction_id: string; p_accept: boolean }
        Returns: LiveInteraction
      }
      confirm_participant_media: {
        Args: { p_interaction_id: string }
        Returns: LiveInteraction
      }
      end_intervention: {
        Args: { p_interaction_id: string }
        Returns: LiveInteraction
      }
      end_intervention_for_user: {
        Args: { p_live_id: string; p_user_id: string }
        Returns: number
      }
      expire_stale_live_interactions: {
        Args: { p_live_id?: string | null }
        Returns: number
      }
      user_can_publish_on_live: {
        Args: { p_live_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
