import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Alert, Button, Input, Textarea } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { createProduct } from '../services/products'
import type { ProductStatus } from '../types'

export function CreateProductPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('19.99')
  const [stock, setStock] = useState('10')
  const [status, setStatus] = useState<ProductStatus>('active')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile) return

    setSubmitting(true)
    setError(null)
    try {
      await createProduct(profile.id, {
        name,
        description,
        price: Number(price),
        stock: Number(stock),
        status,
        imageFile,
      })
      navigate('/seller')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create product.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link to="/seller" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl">Create product</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Add the item you will feature during a live session.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-w-xl space-y-4 rounded-3xl border border-[var(--line)] bg-white/90 p-5 sm:p-6"
      >
        <Input
          label="Name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label="Description"
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Price (USD)"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Input
            label="Stock"
            type="number"
            min="0"
            step="1"
            required
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus)}
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--ink)]">Product image</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--ink)]"
          />
          <span className="text-xs text-[var(--muted)]">JPEG, PNG, WebP, or GIF up to 5MB.</span>
        </label>

        {error ? <Alert>{error}</Alert> : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save product'}
        </Button>
      </form>
    </AppShell>
  )
}

export default CreateProductPage
