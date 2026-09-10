import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Ticker from './components/Ticker'
import Atmosphere from './components/Atmosphere'
import ReadingProgress from './components/ReadingProgress'
import { scrollToTop, startSmoothScroll } from './lib/smoothScroll'

export default function Shell() {
  const { pathname } = useLocation()

  useEffect(() => startSmoothScroll(), [])

  // Route changes jump to top instantly. Going through the smooth-scroll
  // singleton rather than window.scrollTo, because Lenis owns the scroll
  // position while it is running and would otherwise fight this.
  useEffect(() => {
    scrollToTop()
  }, [pathname])

  return (
    <>
      <Atmosphere />

      <div className="relative z-10 flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur-xl">
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
              {[
                { to: '/', label: 'feed', end: true },
                { to: '/about', label: 'method', end: false },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `relative py-1 transition-colors duration-300 ${
                      isActive
                        ? 'text-[var(--amber)]'
                        : 'text-[var(--txt-faint)] hover:text-[var(--txt-dim)]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.label}
                      {/* underline grows from the left rather than appearing */}
                      <span
                        className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left bg-[var(--amber)] transition-transform duration-400"
                        style={{
                          transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                          transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
                        }}
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <Ticker />
          <ReadingProgress />
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
    </>
  )
}
