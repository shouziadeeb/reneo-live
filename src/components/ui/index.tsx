import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}) {
  const styles: Record<string, string> = {
    primary:
      'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] disabled:opacity-60',
    secondary:
      'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] hover:bg-white disabled:opacity-60',
    danger: 'bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-60',
    ghost: 'bg-transparent text-[var(--ink)] hover:bg-black/5 disabled:opacity-60',
  }

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export function Input({
  label,
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-[var(--ink)]">{label}</span> : null}
      <input
        className={`w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2 ${className}`}
        {...props}
      />
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  )
}

export function Textarea({
  label,
  error,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-[var(--ink)]">{label}</span> : null}
      <textarea
        className={`w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2 ${className}`}
        {...props}
      />
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  )
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'info' | 'success'
  children: ReactNode
}) {
  const tones = {
    error: 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]',
    info: 'border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--ink)]',
    success: 'border-emerald-500/20 bg-emerald-50 text-emerald-800',
  }

  return (
    <div className={`rounded-xl border px-3.5 py-3 text-sm ${tones[tone]}`}>{children}</div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />
      {label}
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-10 text-center">
      <h3 className="font-display text-xl text-[var(--ink)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
    </div>
  )
}
