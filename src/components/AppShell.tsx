import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'
import { Button } from './ui'

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const { itemCount } = useCart()

  const seller = profile?.role === 'seller'

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[var(--accent)]/10 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-[var(--warm)]/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(28, 45, 42, 0.08) 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-[var(--line)]/80 bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to={seller ? '/seller' : '/lives'} className="group flex items-baseline gap-2">
            <span className="font-display text-2xl tracking-tight text-[var(--ink)]">Reneo</span>
            <span className="rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
              Live
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            {seller ? (
              <>
                <NavLink
                  to="/seller"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 ${isActive ? 'bg-white font-semibold shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/seller/products/new"
                  className={({ isActive }) =>
                    `hidden rounded-lg px-3 py-2 sm:inline ${isActive ? 'bg-white font-semibold shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`
                  }
                >
                  New product
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to="/lives"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 ${isActive ? 'bg-white font-semibold shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`
                  }
                >
                  Lives
                </NavLink>
                <NavLink
                  to="/cart"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 ${isActive ? 'bg-white font-semibold shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`
                  }
                >
                  Cart{itemCount > 0 ? ` (${itemCount})` : ''}
                </NavLink>
              </>
            )}

            <div className="ml-1 hidden items-center gap-2 border-l border-[var(--line)] pl-3 sm:flex">
              <span className="max-w-[10rem] truncate text-xs text-[var(--muted)]">
                {profile?.name}
              </span>
              <Button variant="ghost" className="!px-2 !py-1.5 text-xs" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
            <Button
              variant="ghost"
              className="!px-2 !py-1.5 text-xs sm:hidden"
              onClick={() => void signOut()}
            >
              Out
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
