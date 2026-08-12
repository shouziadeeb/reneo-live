import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Alert, EmptyState, Spinner } from '../components/ui'
import { formatCurrency } from '../lib/format'
import { useActiveLives } from '../hooks/useLive'

export function CustomerLivesPage() {
  const { lives, loading, error, reload } = useActiveLives()

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Discover
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Live right now</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Join a session to watch, chat, and shop without leaving the stream.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="text-sm font-semibold text-[var(--accent-strong)]"
        >
          Refresh
        </button>
      </div>

      <div className="mt-8">
        {loading ? <Spinner label="Finding active lives…" /> : null}
        {error ? <Alert>{error}</Alert> : null}
        {!loading && !error && lives.length === 0 ? (
          <EmptyState
            title="No live sessions"
            body="When a seller goes live, their session will appear here."
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lives.map((live) => (
            <Link
              key={live.id}
              to={`/lives/${live.id}`}
              className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] bg-[var(--surface)]">
                {live.product?.image_url ? (
                  <img
                    src={live.product.image_url}
                    alt={live.product.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                    Live session
                  </div>
                )}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </span>
              </div>
              <div className="space-y-1 p-4">
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {live.host?.name ?? 'Seller'}
                </p>
                <p className="truncate text-sm text-[var(--muted)]">
                  {live.product?.name ?? 'Featured product'}
                </p>
                {live.product ? (
                  <p className="text-base font-bold text-[var(--accent-strong)]">
                    {formatCurrency(Number(live.product.price))}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

export default CustomerLivesPage
