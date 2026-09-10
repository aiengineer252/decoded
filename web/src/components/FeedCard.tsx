import { Link } from 'react-router-dom'
import type { Entry } from '../types'
import { BAND_COLOR, BAND_LABEL, band } from '../lib/credibility'

export default function FeedCard({ entry }: { entry: Entry }) {
  const b = band(entry.verdict.score)
  const color = BAND_COLOR[b]

  return (
    <Link
      to={`/entry/${entry.slug}`}
      onPointerMove={(e) => {
        // Feed the sheen gradient the pointer position, in element space.
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
      className="lift tilt group panel relative block overflow-hidden rounded-lg p-5 hover:border-[var(--line-hi)] hover:bg-[var(--panel-hi)]"
    >
      <div className="flex items-start gap-5">
        {/* score block */}
        <div
          className="flex w-[4.5rem] shrink-0 flex-col items-center rounded-md border py-2.5 transition-transform duration-300 group-hover:scale-105"
          style={{ borderColor: `${color}55`, background: `${color}14` }}
        >
          <span className="font-mono text-[1.9rem] leading-none font-bold" style={{ color }}>
            {entry.verdict.score}
          </span>
          <span
            className="mt-1.5 font-mono text-[0.6rem] font-bold tracking-[0.16em]"
            style={{ color }}
          >
            {BAND_LABEL[b]}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <h3 className="text-[1.35rem] leading-tight font-semibold transition-colors group-hover:text-[var(--amber)]">
              {entry.name}
            </h3>
            <span className="font-mono text-[0.8rem] text-[var(--txt-faint)]">{entry.org}</span>
            {entry.status === 'demo' && (
              <span className="rounded border border-[var(--line-hi)] px-2 py-0.5 font-mono text-[0.62rem] font-semibold tracking-widest text-[var(--txt-faint)] uppercase">
                seed
              </span>
            )}
            {entry.status === 'auto' && (
              <span className="rounded border border-[var(--sig-unproven)]/60 bg-[var(--sig-unproven)]/10 px-2 py-0.5 font-mono text-[0.62rem] font-semibold tracking-widest text-[var(--sig-unproven)] uppercase">
                unreviewed
              </span>
            )}
          </div>

          <p className="mt-2 text-[0.98rem] leading-relaxed text-[var(--txt-dim)]">
            {entry.tagline}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="label">replaces</span>
            {entry.displacement.replaces.slice(0, 3).map((r) => (
              <span
                key={r}
                className="font-mono text-[0.84rem] text-[var(--txt-dim)] line-through decoration-[var(--sig-hype)] decoration-2"
              >
                {r}
              </span>
            ))}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {entry.categories.map((c) => (
              <span
                key={c}
                className="rounded bg-[var(--bg-raised)] px-2 py-1 font-mono text-[0.74rem] text-[var(--txt-dim)]"
              >
                {c}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-2 font-mono text-[0.76rem] text-[var(--txt-faint)]">
              {entry.trace.steps.length} trace steps · {entry.architecture.nodes.length} components
              <span className="text-[var(--amber)] opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                &rarr;
              </span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
