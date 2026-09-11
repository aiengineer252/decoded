import { useEffect, useState } from 'react'

export type SceneState = 'below' | 'active' | 'above'

/**
 * Tracks which full-viewport scene the reader is standing in, and whether the
 * others sit above or below them — the two directions matter, because a scene
 * you have already descended past should recede upward while one you have not
 * reached yet waits below.
 *
 * Deliberately measured from scroll position on a time-throttled listener
 * rather than IntersectionObserver + rAF. Both of those stall in a throttled
 * or non-compositing tab, and a stalled scene tracker would leave every scene
 * but the first in its "waiting" state — which is to say, dimmed and pushed
 * off its mark. Timers keep running; this cannot wedge.
 */
export function useScenes(ids: string[], enabled = true) {
  const [active, setActive] = useState(0)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!enabled || ids.length === 0) return

    // Arming is what switches the CSS from "everything visible" to the
    // choreographed states. Until this runs, the page is a plain readable
    // document — the failure mode is no animation, never no content.
    setArmed(true)

    let lastRun = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const measure = () => {
      lastRun = Date.now()
      const line = window.innerHeight * 0.4
      let best = 0
      ids.forEach((id, i) => {
        const el = document.getElementById(id)
        if (!el) return
        if (el.getBoundingClientRect().top - line <= 0) best = i
      })
      setActive((prev) => (prev === best ? prev : best))
    }

    const onScroll = () => {
      const since = Date.now() - lastRun
      if (since >= 60) measure()
      else if (!timer) {
        timer = setTimeout(() => {
          timer = undefined
          measure()
        }, 60 - since)
      }
    }

    measure()

    // Re-measure a few times while the page settles. Fonts, images and the
    // code blocks all change section offsets after first paint, and a reader
    // who lands on a deep link would otherwise be told they are on layer 00
    // until they happen to scroll.
    const settle = [120, 400, 1000].map((d) => setTimeout(measure, d))

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (timer) clearTimeout(timer)
      settle.forEach(clearTimeout)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ids.join('|'), enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const stateOf = (i: number): SceneState =>
    i === active ? 'active' : i < active ? 'above' : 'below'

  return { active, armed, stateOf, setActive }
}

/** Scroll to a scene by id, accounting for the sticky header. */
export function gotoScene(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  // Imported lazily so this module stays usable without the smooth-scroll
  // singleton being initialised (tests, reduced-motion, SSR).
  import('./smoothScroll').then(({ scrollTo }) => scrollTo(el, -96))
}
