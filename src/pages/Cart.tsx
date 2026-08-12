import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Alert, Button, EmptyState } from '../components/ui'
import { formatCurrency } from '../lib/format'
import { useCart } from '../hooks/useCart'

export function CartPage() {
  const { items, total, increase, decrease, removeItem, clear } = useCart()

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Your cart</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Cart is saved on this device. No payment is required for this MVP.
          </p>
        </div>
        {items.length > 0 ? (
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
        ) : null}
      </div>

      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState
            title="Cart is empty"
            body="Join a live and add the featured product while you watch."
          />
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const capped = item.quantity >= item.stock
              return (
                <article
                  key={item.productId}
                  className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-white/90 p-4 sm:flex-row sm:items-center"
                >
                  <div className="h-20 w-20 overflow-hidden rounded-xl bg-[var(--surface)]">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-[var(--ink)]">{item.name}</h2>
                    <p className="text-sm text-[var(--muted)]">
                      {formatCurrency(item.price)} · {item.stock} available
                    </p>
                    {capped ? (
                      <div className="mt-2">
                        <Alert tone="info">Quantity is capped at available stock.</Alert>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => decrease(item.productId)}>
                      −
                    </Button>
                    <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <Button
                      variant="secondary"
                      onClick={() => increase(item.productId)}
                      disabled={capped}
                    >
                      +
                    </Button>
                    <Button variant="ghost" onClick={() => removeItem(item.productId)}>
                      Remove
                    </Button>
                  </div>
                </article>
              )
            })}

            <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white px-4 py-4">
              <span className="text-sm font-medium text-[var(--muted)]">Total</span>
              <span className="text-xl font-bold text-[var(--accent-strong)]">
                {formatCurrency(total)}
              </span>
            </div>

            <Link to="/lives" className="inline-block text-sm font-semibold text-[var(--accent-strong)]">
              ← Continue shopping lives
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  )
}

export default CartPage
