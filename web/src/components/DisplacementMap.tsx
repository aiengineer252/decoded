import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { displacementLinks } from '../data'
import { BAND_COLOR, band } from '../lib/credibility'

/**
 * The sidebar graph: everything on the left is being displaced by something on
 * the right. It is deliberately a bipartite list-graph rather than a force
 * layout — the reader needs to read the labels, and force layouts hide them.
 */
export default function DisplacementMap() {
  const links = useMemo(() => displacementLinks(), [])
  const [hover, setHover] = useState<string | null>(null)

  const olds = useMemo(() => [...new Set(links.map((l) => l.from))], [links])
  const news = useMemo(() => [...new Set(links.map((l) => l.to))], [links])

  const ROW = 31
  const height = Math.max(olds.length, news.length) * ROW + 18
  const width = 320
  const leftX = 4
  const rightX = width - 4

  const oldY = (name: string) => 14 + olds.indexOf(name) * ROW
  const newY = (name: string) => 14 + news.indexOf(name) * ROW + ((olds.length - news.length) * ROW) / 2

  return (
    <section className="panel rounded-lg p-5">
      <div className="flex items-baseline justify-between">
        <span className="label">displacement map</span>
        <span className="font-mono text-[0.76rem] text-[var(--txt-faint)]">
          {links.length} claims
        </span>
      </div>
      <p className="mt-2 mb-4 text-[0.9rem] leading-snug text-[var(--txt-dim)]">
        What is being made obsolete, by what. Hover a row to isolate it.
      </p>

      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {links.map((l, i) => {
          const y0 = oldY(l.from)
          const y1 = newY(l.to)
          const active = hover === null || hover === l.to || hover === l.from
          const color = BAND_COLOR[band(l.score)]
          return (
            <path
              key={i}
              d={`M ${leftX + 96} ${y0} C ${width / 2} ${y0}, ${width / 2} ${y1}, ${rightX - 92} ${y1}`}
              fill="none"
              stroke={active ? color : 'var(--line)'}
              strokeWidth={active ? 1.3 : 0.8}
              opacity={active ? 0.75 : 0.25}
            />
          )
        })}

        {olds.map((o) => {
          const active = hover === null || hover === o || links.some((l) => l.from === o && l.to === hover)
          return (
            <g key={o} onMouseEnter={() => setHover(o)} onMouseLeave={() => setHover(null)}>
              <text
                x={leftX + 92}
                y={oldY(o) + 3}
                textAnchor="end"
                className="font-mono"
                fontSize={11.5}
                fill={active ? 'var(--txt-dim)' : 'var(--txt-faint)'}
                style={{ textDecoration: 'line-through' }}
              >
                {truncate(o, 20)}
              </text>
            </g>
          )
        })}

        {news.map((n) => {
          const link = links.find((l) => l.to === n)!
          const active = hover === null || hover === n || links.some((l) => l.to === n && l.from === hover)
          return (
            <g key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}>
              <a href={`#/entry/${link.slug}`}>
                <text
                  x={rightX - 88}
                  y={newY(n) + 3}
                  className="font-mono"
                  fontSize={11.5}
                  fill={active ? BAND_COLOR[band(link.score)] : 'var(--txt-faint)'}
                >
                  {truncate(n, 20)}
                </text>
              </a>
            </g>
          )
        })}
      </svg>

      <div className="mt-4 border-t border-[var(--line)] pt-4">
        <Link
          to="/about"
          className="underline-grow font-mono text-[0.78rem] font-semibold tracking-widest text-[var(--txt-dim)] uppercase hover:text-[var(--amber)]"
        >
          how displacement is decided &rarr;
        </Link>
      </div>
    </section>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
