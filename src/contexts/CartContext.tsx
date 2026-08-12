import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CartItem, Product } from '../types'

const STORAGE_KEY = 'reneo-live-cart'

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  total: number
  addItem: (product: Product, quantity?: number) => void
  increase: (productId: string) => void
  decrease: (productId: string) => void
  removeItem: (productId: string) => void
  clear: () => void
}

export const CartContext = createContext<CartContextValue | undefined>(undefined)

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item) =>
        item &&
        typeof item.productId === 'string' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0,
    )
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addItem = useCallback((product: Product, quantity = 1) => {
    if (product.stock <= 0) {
      throw new Error('This product is out of stock.')
    }

    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing) {
        const nextQty = Math.min(existing.quantity + quantity, product.stock)
        return current.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: nextQty,
                stock: product.stock,
                name: product.name,
                price: Number(product.price),
                imageUrl: product.image_url,
              }
            : item,
        )
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          imageUrl: product.image_url,
          quantity: Math.min(quantity, product.stock),
          stock: product.stock,
        },
      ]
    })
  }, [])

  const increase = useCallback((productId: string) => {
    setItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) return item
        if (item.quantity >= item.stock) return item
        return { ...item, quantity: item.quantity + 1 }
      }),
    )
  }, [])

  const decrease = useCallback((productId: string) => {
    setItems((current) =>
      current
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.productId !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  )

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  )

  const value = useMemo(
    () => ({
      items,
      itemCount,
      total,
      addItem,
      increase,
      decrease,
      removeItem,
      clear,
    }),
    [items, itemCount, total, addItem, increase, decrease, removeItem, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
