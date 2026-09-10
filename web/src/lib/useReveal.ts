import { useEffect } from 'react'

/**
 * Scroll-triggered reveals via one shared IntersectionObserver.
 *
 * Any element carrying `data-reveal` starts hidden and animates in when it
 * enters the viewport. One observer for the whole page rather than one per
 * component: cheaper, and it keeps the reveal vocabulary in CSS where it can
 * be reasoned about as a whole.
 *
 * Elements are unobserved once revealed — re-animating on scroll-back is a
 * portfolio flourish that becomes irritating on a page you scroll through
 * twice while reading.
 */
/**
 * Elements are only hidden once we know we can reveal them again. If this
 * timer ever fires, something stopped IntersectionObserver from delivering —
 * a backgrounded tab, a non-compositing embed — and text is worth more than
 * a transition.
 */
const FAILSAFE_MS = 2500

export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])')
    if (nodes.length === 0) return

    const revealAll = () => nodes.forEach((n) => n.setAttribute('data-revealed', ''))

    // Reduced motion: reveal immediately, observe nothing.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealAll()
      return
    }

    // Arm only now. The hiding styles key off data-reveal-armed rather than
    // data-reveal, so if this module never runs — bundle error, JS disabled,
    // an old browser — every element renders plainly visible instead of
    // vanishing. Content must never depend on an animation succeeding.
    nodes.forEach((n) => n.setAttribute('data-reveal-armed', ''))

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          el.setAttribute('data-revealed', '')
          io.unobserve(el)
        }
      },
      // Fire slightly before the element is fully on screen, so the motion has
      // finished by the time the reader's eye actually arrives.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )

    nodes.forEach((n) => io.observe(n))

    const failsafe = setTimeout(revealAll, FAILSAFE_MS)

    return () => {
      clearTimeout(failsafe)
      io.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
