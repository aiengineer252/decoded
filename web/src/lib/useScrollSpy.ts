import { useEffect, useState } from 'react'

/**
 * Reports which of the given sections currently owns the viewport.
 *
 * Used to drive the chapter rail while the reader scrolls. Deliberately
 * picks the section covering the *reading line* — a band near the top third
 * of the viewport — rather than the one with the largest intersection ratio:
 * a very tall section would otherwise stay "active" long after the reader's
 * eye has moved into the next one.
 */
export function useScrollSpy(ids: string[], enabled = true): number {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!enabled || ids.length === 0) return

    let lastRun = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const measure = () => {
      lastRun = Date.now()
      // The line the reader is actually looking along.
      const line = window.innerHeight * 0.32
      let best = 0

      ids.forEach((id, i) => {
        const el = document.getElementById(id)
        if (!el) return
        const r = el.getBoundingClientRect()
        // The last section whose top has passed the reading line wins.
        if (r.top - line <= 0) best = i
      })

      setActive((prev) => (prev === best ? prev : best))
    }

    // Time-based throttle rather than requestAnimationFrame. rAF is the usual
    // choice, but it does not fire in a throttled or non-compositing tab, and
    // a spy that never updates would leave every chapter but the first
    // rendered in its dimmed state. Timers keep running; this cannot wedge.
    const onScroll = () => {
      const since = Date.now() - lastRun
      if (since >= 60) {
        measure()
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = undefined
          measure()
        }, 60 - since)
      }
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ids.join('|'), enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return active
}
