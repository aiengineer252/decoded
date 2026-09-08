import { useEffect, useRef, useState } from 'react'
import { BAND_COLOR, BAND_LABEL, band } from '../lib/credibility'

interface Props {
  score: number
  size?: number
  compact?: boolean
}

/**
 * Counts from wherever it currently sits to the new value rather than
 * snapping. When the reader drags a factor weight in the Verdict view, seeing
 * the number travel is what makes the connection between the two — a snap
 * reads as a re-render, a count reads as a consequence.
 */
function useCountTo(target: number, ms = 650) {
  const [value, setValue] = useState(target)

  // Mirrors the rendered value every render, so when `target` changes the
  // animation starts from whatever is currently on screen — including
  // mid-flight, when the reader drags a slider faster than the tween lands.
  // Declared first so it has already updated by the time the effect below
  // reads it: React runs effects in declaration order.
  const displayed = useRef(value)
  useEffect(() => {
    displayed.current = value
  })

  useEffect(() => {
    const from = displayed.current
    if (Math.abs(from - target) < 0.5) {
      setValue(target)
      return
    }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1)
      // easeOutCubic — fast commit, soft landing
      setValue(from + (target - from) * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // rAF does not fire in a backgrounded or non-compositing tab, which would
    // otherwise leave the reader looking at a stale number forever. Timers
    // still run, so this guarantees the value lands on target either way.
    const settle = setTimeout(() => setValue(target), ms + 40)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [target, ms])

  return value
}

export default function Gauge({ score, size = 132, compact = false }: Props) {
  const animated = useCountTo(score)
  const b = band(score)
  const stroke = size < 90 ? 7 : 11
  const r = (size - stroke * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const SWEEP = 240
  const START = 150

  const polar = (angleDeg: number, radius: number) => {
    const a = (angleDeg * Math.PI) / 180
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const
  }

  const arc = (fromPct: number, toPct: number, radius: number) => {
    const a0 = START + SWEEP * fromPct
    const a1 = START + SWEEP * toPct
    const [x0, y0] = polar(a0, radius)
    const [x1, y1] = polar(a1, radius)
    const large = a1 - a0 > 180 ? 1 : 0
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`
  }

  const bands: [number, number, string][] = [
    [0, 0.35, 'var(--sig-hype)'],
    [0.35, 0.55, 'var(--sig-unproven)'],
    [0.55, 0.75, 'var(--sig-promising)'],
    [0.75, 1, 'var(--sig-real)'],
  ]

  const pct = Math.max(0, Math.min(100, animated)) / 100
  const [nx, ny] = polar(START + SWEEP * pct, r)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.8} viewBox={`0 0 ${size} ${size * 0.8}`}>
        {bands.map(([from, to, color]) => (
          <path
            key={from}
            d={arc(from, to, r)}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            opacity={0.16}
          />
        ))}
        <path
          d={arc(0, pct, r)}
          fill="none"
          stroke={BAND_COLOR[b]}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${BAND_COLOR[b]}70)` }}
        />
        <circle
          cx={nx}
          cy={ny}
          r={stroke * 0.68}
          fill={BAND_COLOR[b]}
          style={{ filter: `drop-shadow(0 0 8px ${BAND_COLOR[b]})` }}
        />
        <text
          x={cx}
          y={cy + (compact ? 5 : 3)}
          textAnchor="middle"
          className="font-mono"
          fontSize={size * (compact ? 0.3 : 0.34)}
          fill="var(--txt)"
          fontWeight={700}
        >
          {Math.round(animated)}
        </text>
        {!compact && (
          <text
            x={cx}
            y={cy + size * 0.2}
            textAnchor="middle"
            className="font-mono"
            fontSize={size * 0.11}
            fontWeight={600}
            letterSpacing="0.2em"
            fill={BAND_COLOR[b]}
          >
            {BAND_LABEL[b]}
          </text>
        )}
      </svg>
    </div>
  )
}

export function GaugeChip({ score }: { score: number }) {
  const b = band(score)
  return (
    <span
      className="inline-flex items-center gap-2 rounded border px-2.5 py-1 font-mono text-[0.78rem] font-semibold tracking-widest"
      style={{ borderColor: `${BAND_COLOR[b]}66`, color: BAND_COLOR[b], background: `${BAND_COLOR[b]}12` }}
    >
      <span
        className="live-dot inline-block h-2 w-2 rounded-full"
        style={{ background: BAND_COLOR[b] }}
      />
      {score} {BAND_LABEL[b]}
    </span>
  )
}
