import type { Product } from '../../types'
import { Button } from '../ui'
import { formatCurrency } from '../../lib/format'
import { useCart } from '../../hooks/useCart'
import { useState } from 'react'
import { Alert } from '../ui'

interface ProductCardProps {
  product: Product
  onView?: () => void
  showAddToCart?: boolean
}

export function FeaturedProductCard({ product, onView, showAddToCart = true }: ProductCardProps) {
  const { addItem } = useCart()
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  function handleAdd() {
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
    <div className="rounded-2xl border border-[var(--line)] bg-white/95 p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--surface)]">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">No image</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{product.name}</p>
          <p className="mt-1 text-lg font-bold text-[var(--accent-strong)]">
            {formatCurrency(Number(product.price))}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        {onView ? (
          <Button variant="secondary" className="flex-1" onClick={onView}>
            View product
          </Button>
        ) : null}
        {showAddToCart ? (
          <Button className="flex-1" onClick={handleAdd} disabled={product.stock <= 0}>
            {added ? 'Added' : 'Add to cart'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
