import Lenis from 'lenis'

/**
 * Smooth scrolling, as a module-level singleton.
 *
 * A singleton rather than a hook return value because React Router's scroll
 * reset in Shell needs to reach it, and threading a ref through context for
 * one call is more machinery than the problem deserves.
 *
 * Deliberately short duration (0.9s): long easing looks luxurious on a
 * portfolio and feels broken on a site people are trying to read. Disabled
 * entirely under prefers-reduced-motion — hijacking scroll from someone who
 * asked for less motion is exactly the wrong move.
 */
let lenis: Lenis | null = null
let rafId = 0

export function startSmoothScroll(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  if (lenis) return () => {}

  lenis = new Lenis({
    duration: 0.9,
    // expo-out: takes off immediately, settles softly. Keeps the page feeling
    // responsive to the wheel rather than laggy.
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // Touch devices already have good native inertia; overriding it fights
    // the platform and feels worse, not better.
    syncTouch: false,
  })

  const loop = (time: number) => {
    lenis?.raf(time)
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(rafId)
    lenis?.destroy()
    lenis = null
  }
}

/** Jump to top without animating — for route changes. */
export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true })
  else window.scrollTo(0, 0)
}

/** Animated scroll to a y offset or element. Falls back to native. */
export function scrollTo(target: number | string | HTMLElement, offset = 0) {
  if (lenis) lenis.scrollTo(target, { offset, duration: 0.8 })
  else if (typeof target === 'number') window.scrollTo({ top: target + offset, behavior: 'smooth' })
}
