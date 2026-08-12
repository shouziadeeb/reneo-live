import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile, UserRole } from '../types'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  sendOtp: (input: {
    email: string
    name?: string
    role?: UserRole
    isSignup: boolean
  }) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data) return data

  const { data: ensured, error: ensureError } = await supabase.rpc('ensure_profile')
  if (ensureError) throw new Error(ensureError.message)
  return ensured as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      return
    }
    const next = await loadProfile(user.id)
    setProfile(next)
  }, [user])

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!mounted) return

        setSession(data.session)
        setUser(data.session?.user ?? null)

        if (data.session?.user) {
          const nextProfile = await loadProfile(data.session.user.id)
          if (mounted) setProfile(nextProfile)
        }
      } catch (error) {
        console.error(error)
        if (mounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const nextProfile = await loadProfile(nextSession.user.id)
        setProfile(nextProfile)
      } catch (error) {
        console.error(error)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const sendOtp = useCallback(
    async (input: {
      email: string
      name?: string
      role?: UserRole
      isSignup: boolean
    }) => {
      const email = input.email.trim()
      if (!email) throw new Error('Email is required.')

      if (input.isSignup) {
        if (!input.name?.trim()) throw new Error('Name is required.')
        if (!input.role) throw new Error('Please choose seller or customer.')
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: input.isSignup,
          data: input.isSignup
            ? {
                name: input.name!.trim(),
                role: input.role,
              }
            : undefined,
        },
      })

      if (error) throw new Error(error.message)
    },
    [],
  )

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const code = token.trim()
    if (code.length !== 6) {
      throw new Error('Enter the 6-digit code from your email.')
    }

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: 'email',
    })

    if (error) throw new Error(error.message)
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      sendOtp,
      verifyOtp,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, loading, sendOtp, verifyOtp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
