import { useEffect } from 'react'
import type { Product } from '../../types'
import { Button } from '../ui'
import { formatCurrency } from '../../lib/format'
import { useCart } from '../../hooks/useCart'
import { useState } from 'react'
import { Alert } from '../ui'

interface ProductDrawerProps {
  product: Product | null
  open: boolean
  onClose: () => void
}

export function ProductDrawer({ product, open, onClose }: ProductDrawerProps) {
  const { addItem } = useCart()
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !product) return null

  function handleAdd() {
    if (!product) return
    setError(null)
    try {
      addItem(product, 1)
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to cart.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close product details"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-drawer-title"
        className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Featured product
            </p>
            <h2 id="product-drawer-title" className="mt-1 font-display text-2xl text-[var(--ink)]">
              {product.name}
            </h2>
          </div>
          <Button variant="ghost" onClick={onClose} className="!px-2">
            Close
          </Button>
        </div>

        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[var(--surface)]">
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

        <p className="mt-4 text-2xl font-bold text-[var(--accent-strong)]">
          {formatCurrency(Number(product.price))}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]/85">
          {product.description || 'No description provided.'}
        </p>

        {error ? (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        <Button className="mt-5 w-full" onClick={handleAdd} disabled={product.stock <= 0}>
          {added ? 'Added to cart' : 'Add to cart'}
        </Button>
      </div>
    </div>
  )
}
