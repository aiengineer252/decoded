import { useEffect, useRef, useState } from 'react'

const GLYPHS = '01{}[]<>/\\|=+*#$%&_~^'

interface Props {
  text: string
  /** ms for the whole string to resolve. */
  duration?: number
  /** Wait this long before starting. */
  delay?: number
  className?: string
  as?: 'span' | 'h1' | 'h2' | 'h3'
}

/**
 * Text that resolves out of noise, left to right.
 *
 * The site is called Decoded, so this is the one flourish that is actually
 * about the subject rather than borrowed atmosphere: the headline literally
 * decodes. Used sparingly — headings only, never body copy, because scrambled
 * paragraphs are unreadable rather than atmospheric.
 *
 * Resolves instantly under prefers-reduced-motion, and only fires once when
 * scrolled into view.
 */
export default function DecodeText({
  text,
  duration = 900,
  delay = 0,
  className,
  as: Tag = 'span',
}: Props) {
  const ref = useRef<HTMLElement>(null)
  const [display, setDisplay] = useState(text)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(text)
      return
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [text])

  useEffect(() => {
    if (!started) return

    let raf = 0
    let start = 0
    const chars = [...text]

    const tick = (now: number) => {
      if (!start) start = now + delay
      const t = Math.max(0, Math.min((now - start) / duration, 1))

      // Ease the resolve front so it decelerates into place rather than
      // sweeping at constant speed.
      const front = (1 - Math.pow(1 - t, 2)) * chars.length

      setDisplay(
        chars
          .map((c, i) => {
            if (c === ' ' || c === '\n') return c
            if (i < front) return c
            // Characters just ahead of the front flicker; far ones stay dim
            // symbols, so the whole line does not strobe at once.
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          })
          .join(''),
      )

      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplay(text)
    }

    raf = requestAnimationFrame(tick)

    // rAF does not fire in a backgrounded or non-compositing tab, which would
    // leave a headline frozen as "what it actua&{% $1{1" — visibly broken
    // rather than merely unanimated. Timers still run, so this guarantees the
    // text resolves either way.
    const settle = setTimeout(() => setDisplay(text), delay + duration + 80)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [started, text, duration, delay])

  return (
    <Tag ref={ref as never} className={className} aria-label={text}>
      <span aria-hidden>{display}</span>
    </Tag>
  )
}
