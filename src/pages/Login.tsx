import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Alert, Button, Input, PasswordInput } from '../components/ui'

export function LoginPage() {
  const { signIn, user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loading && user && profile) {
    const from = (location.state as { from?: string } | null)?.from
    if (from) return <Navigate to={from} replace />
    return <Navigate to={profile.role === 'seller' ? '/seller' : '/lives'} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid login. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to host a live or join a shopping session."
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        New here?{' '}
        <Link className="font-semibold text-[var(--accent-strong)]" to="/signup">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}

export function SignupPage() {
  const { signUp, user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'seller' | 'customer'>('customer')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loading && user && profile) {
    return <Navigate to={profile.role === 'seller' ? '/seller' : '/lives'} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signUp({ email, password, name, role })
      navigate(role === 'seller' ? '/seller' : '/lives')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Join Reneo Live"
      subtitle="Create a seller account to go live, or a customer account to shop."
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input
          label="Name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[var(--ink)]">I am a…</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['customer', 'seller'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold capitalize transition ${
                  role === option
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-white text-[var(--muted)]'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        Already have an account?{' '}
        <Link className="font-semibold text-[var(--accent-strong)]" to="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-[var(--accent)]/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[var(--warm)]/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(28, 45, 42, 0.1) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <p className="font-display text-4xl tracking-tight">
            Reneo <span className="text-[var(--accent-strong)]">Live</span>
          </p>
          <h1 className="mt-4 font-display text-2xl">{title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
        <div className="rounded-3xl border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur">
          {children}
        </div>
      </div>
    </div>
  )
}
