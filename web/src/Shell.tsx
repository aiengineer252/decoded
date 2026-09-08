import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Ticker from './components/Ticker'

export default function Shell() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="relative z-10 flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-4 py-4 sm:px-6">
          <Link to="/" className="group flex items-baseline gap-2.5">
            <span className="font-mono text-[1.4rem] leading-none font-bold tracking-[0.16em] text-[var(--txt)] transition-colors group-hover:text-[var(--amber)]">
              DECODED
            </span>
            <span className="hidden font-mono text-[0.74rem] tracking-[0.2em] text-[var(--amber)] sm:inline">
              /truth-engine
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-6 font-mono text-[0.84rem] font-semibold tracking-[0.14em] uppercase">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `relative py-1 transition-colors ${
                  isActive
                    ? 'text-[var(--amber)] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-[var(--amber)]'
                    : 'text-[var(--txt-faint)] hover:text-[var(--txt-dim)]'
                }`
              }
            >
              feed
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `relative py-1 transition-colors ${
                  isActive
                    ? 'text-[var(--amber)] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-[var(--amber)]'
                    : 'text-[var(--txt-faint)] hover:text-[var(--txt-dim)]'
                }`
              }
            >
              method
            </NavLink>
          </nav>
        </div>
        <Ticker />
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-10 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-7 font-mono text-[0.82rem] text-[var(--txt-faint)] sm:px-6">
          <span>Decoded — mechanism, not marketing copy.</span>
          <Link to="/about" className="underline-grow hover:text-[var(--amber)]">
            how the score is computed &rarr;
          </Link>
        </div>
      </footer>
    </div>
  )
}
