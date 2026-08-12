import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { UserRole } from '../../types'
import { Alert, Button, Input } from '../ui'

type OtpStep = 'email' | 'code'

interface OtpAuthFormProps {
  mode: 'login' | 'signup'
  onSendOtp: (input: {
    email: string
    name?: string
    role?: UserRole
  }) => Promise<void>
  onVerifyOtp: (email: string, token: string) => Promise<void>
  alternateLink: { href: string; label: string; prompt: string }
}

export function OtpAuthForm({
  mode,
  onSendOtp,
  onVerifyOtp,
  alternateLink,
}: OtpAuthFormProps) {
  const [step, setStep] = useState<OtpStep>('email')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('customer')
  const [otp, setOtp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      await onSendOtp({
        email,
        name: mode === 'signup' ? name : undefined,
        role: mode === 'signup' ? role : undefined,
      })
      setStep('code')
      setInfo(`We sent a 6-digit code to ${email.trim()}. Check your inbox (and spam).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onVerifyOtp(email, otp)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setSubmitting(true)
    setError(null)
    try {
      await onSendOtp({
        email,
        name: mode === 'signup' ? name : undefined,
        role: mode === 'signup' ? role : undefined,
      })
      setInfo('A new code was sent to your email.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'code') {
    return (
      <>
        {info ? <Alert tone="info">{info}</Alert> : null}
        <form onSubmit={(e) => void handleVerifyOtp(e)} className="mt-4 space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            disabled
          />
          <Input
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            required
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            value={otp}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
          />
          {error ? <Alert>{error}</Alert> : null}
          <Button type="submit" className="w-full" disabled={submitting || otp.length !== 6}>
            {submitting ? 'Verifying…' : 'Verify & continue'}
          </Button>
        </form>
        <div className="mt-4 flex flex-col gap-2 text-center text-sm">
          <button
            type="button"
            className="font-semibold text-[var(--accent-strong)] disabled:opacity-60"
            onClick={() => void handleResend()}
            disabled={submitting}
          >
            Resend code
          </button>
          <button
            type="button"
            className="text-[var(--muted)]"
            onClick={() => {
              setStep('email')
              setOtp('')
              setError(null)
              setInfo(null)
            }}
          >
            Use a different email
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <form onSubmit={(e) => void handleSendOtp(e)} className="space-y-4">
        {mode === 'signup' ? (
          <Input
            label="Name"
            required
            maxLength={80}
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        ) : null}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
        />

        {mode === 'signup' ? (
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
        ) : null}

        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Sending code…' : 'Send login code'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        {alternateLink.prompt}{' '}
        <Link className="font-semibold text-[var(--accent-strong)]" to={alternateLink.href}>
          {alternateLink.label}
        </Link>
      </p>
    </>
  )
}

export function AuthLayout({
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
