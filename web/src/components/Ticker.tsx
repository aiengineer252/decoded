import { Link } from 'react-router-dom'
import { sortedEntries } from '../data'
import { BAND_COLOR, band } from '../lib/credibility'

/**
 * The strip under the nav. Its job is to make the site feel like something
 * that is running, not something that was published — which is the difference
 * between a feed and a blog.
 */
export default function Ticker() {
  const items = sortedEntries()
  const demoCount = items.filter((e) => e.status === 'demo').length

  return (
    <div className="flex items-center gap-5 border-t border-[var(--line)] bg-[var(--bg-raised)] px-4 py-2 sm:px-6">
      <span className="flex shrink-0 items-center gap-2.5 font-mono text-[0.76rem] font-semibold tracking-[0.14em] uppercase">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-[var(--amber)]" />
        <span className="shimmer">
          {items.length} entries
          {demoCount > 0 && ` · ${demoCount} seed`}
        </span>
      </span>

      <div className="flex-1 overflow-hidden">
        <div className="flex gap-7 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((e) => {
            const b = band(e.verdict.score)
            return (
              <Link
                key={e.slug}
                to={`/entry/${e.slug}`}
                className="group flex shrink-0 items-center gap-2.5 font-mono text-[0.82rem] whitespace-nowrap"
              >
                <span className="font-bold" style={{ color: BAND_COLOR[b] }}>
                  {e.verdict.score}
                </span>
                <span className="text-[var(--txt-dim)] transition-colors group-hover:text-[var(--txt)]">
                  {e.name}
                </span>
                <span className="text-[var(--txt-faint)]">
                  replaces {e.displacement.replaces[0]}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
