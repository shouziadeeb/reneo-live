export type UserRole = 'seller' | 'customer'

export type ProductStatus = 'active' | 'inactive'

export type LiveStatus = 'scheduled' | 'live' | 'ended'

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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
