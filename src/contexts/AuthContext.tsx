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
  signUp: (input: {
    email: string
    password: string
    name: string
    role: UserRole
  }) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
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

  // Profile is created by DB trigger; this RPC backfills if it was missed.
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

  const signUp = useCallback(
    async (input: { email: string; password: string; name: string; role: UserRole }) => {
      const name = input.name.trim()
      if (!name) throw new Error('Name is required.')
      if (input.password.length < 6) {
        throw new Error('Password must be at least 6 characters.')
      }

      const { data, error } = await supabase.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: {
            name,
            role: input.role,
          },
        },
      })

      if (error) throw new Error(error.message)
      if (!data.user) throw new Error('Signup failed. Please try again.')

      // Profile is created server-side by the auth.users trigger.
      // Do not insert from the client here — without a session (email confirmation),
      // RLS would reject the row.
      if (!data.session) {
        throw new Error(
          'Account created. Check your email to confirm your address, then sign in.',
        )
      }
    },
    [],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
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
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, loading, signUp, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
