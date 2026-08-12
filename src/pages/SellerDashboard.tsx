import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Alert, Button, EmptyState, Spinner } from '../components/ui'
import { formatCurrency } from '../lib/format'
import { useAuth } from '../hooks/useAuth'
import { useSellerLiveActions } from '../hooks/useLive'
import { fetchSellerProducts } from '../services/products'
import { fetchSellerActiveLive } from '../services/live'
import type { Product } from '../types'

export function SellerDashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { start, starting } = useSellerLiveActions()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const active = await fetchSellerActiveLive(profile!.id)
        if (active) {
          navigate(`/seller/live/${active.id}`, { replace: true })
          return
        }
        const data = await fetchSellerProducts(profile!.id)
        if (!cancelled) setProducts(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load products.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [profile, navigate])

  async function handleGoLive(product: Product) {
    setActionError(null)
    setStartingId(product.id)
    try {
      if (product.status !== 'active') {
        throw new Error('Only active products can go live.')
      }
      const live = await start(product.id)
      navigate(`/seller/live/${live.id}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start live session.')
    } finally {
      setStartingId(null)
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Seller dashboard
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Your products</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Create products, then go live to present one to shoppers in real time.
          </p>
        </div>
        <Link to="/seller/products/new">
          <Button>Create product</Button>
        </Link>
      </div>

      {actionError ? (
        <div className="mt-4">
          <Alert>{actionError}</Alert>
        </div>
      ) : null}

      <div className="mt-8">
        {loading ? <Spinner label="Loading your products…" /> : null}
        {error ? <Alert>{error}</Alert> : null}
        {!loading && !error && products.length === 0 ? (
          <EmptyState
            title="No products yet"
            body="Create your first product with an image, price, and stock to start a live."
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90 shadow-sm"
            >
              <div className="aspect-[4/3] bg-[var(--surface)]">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                    No image
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-[var(--ink)]">{product.name}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      product.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {product.status}
                  </span>
                </div>
                <p className="text-lg font-bold text-[var(--accent-strong)]">
                  {formatCurrency(Number(product.price))}
                </p>
                <p className="text-xs text-[var(--muted)]">Stock: {product.stock}</p>
                <Button
                  className="w-full"
                  disabled={starting || product.status !== 'active'}
                  onClick={() => void handleGoLive(product)}
                >
                  {startingId === product.id ? 'Starting…' : 'Go live'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

export default SellerDashboardPage
