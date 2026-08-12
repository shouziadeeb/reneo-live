import { Navigate, Outlet } from 'react-router-dom'
import type { UserRole } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui'

export function RoleRoute({ role }: { role: UserRole }) {
  const { profile, loading, user, signOut, refreshProfile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--ink)]">
        <p className="text-sm tracking-wide text-[var(--muted)]">Loading profile…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 text-center">
        <div>
          <h1 className="font-display text-2xl text-[var(--ink)]">Profile missing</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Your account authenticated, but no profile was found. Sign out and sign in again.
            If this continues, your session may have expired.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => void refreshProfile()}>
              Retry
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (profile.role !== role) {
    const fallback = profile.role === 'seller' ? '/seller' : '/lives'
    return <Navigate to={fallback} replace />
  }

  return <Outlet />
}
