import { useEffect, useState } from 'react'

/**
 * A hairline progress bar pinned under the header.
 *
 * Entries are long and layered, and the reference sites all give you some
 * persistent sense of position. This is the version of that idea which costs
 * nothing and helps: it answers "how much of this is left" without adding a
 * scroll-jacked chapter rail.
 */
export default function ReadingProgress() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    let raf = 0

    const measure = () => {
      raf = 0
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      setPct(scrollable <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / scrollable)))
    }

    // rAF-coalesced: scroll fires far more often than we need to repaint a bar.
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="absolute inset-x-0 bottom-0 h-px bg-transparent" aria-hidden>
      <div
        className="h-full origin-left bg-[var(--amber)]"
        style={{
          transform: `scaleX(${pct})`,
          boxShadow: pct > 0.01 ? '0 0 10px var(--amber)' : undefined,
        }}
      />
    </div>
  )
}
