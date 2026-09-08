import { useState } from 'react'
import type { Entry } from '../types'

/**
 * A verdict is a claim about the world on a particular date, and the world
 * moves. Showing the age of an entry — prominently, not in a footer — is part
 * of the honesty contract: a reader should never have to guess whether they are
 * looking at something current.
 */
export function relativeAge(iso: string): { text: string; days: number } {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return { text: iso, days: 0 }

  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return { text: 'today', days: 0 }
  if (days === 1) return { text: 'yesterday', days }
  if (days < 30) return { text: `${days} days ago`, days }
  if (days < 60) return { text: 'last month', days }
  if (days < 365) return { text: `${Math.floor(days / 30)} months ago`, days }
  const years = Math.floor(days / 365)
  return { text: years === 1 ? 'a year ago' : `${years} years ago`, days }
}

/** Past this, we say so rather than letting the reader assume it is current. */
const STALE_AFTER_DAYS = 180

export default function Freshness({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false)
  const updated = relativeAge(entry.updatedAt)
  const stale = updated.days > STALE_AFTER_DAYS
  const hasLog = !!entry.changelog?.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[0.8rem]"
          style={{
            borderColor: stale ? 'var(--sig-unproven)' : 'var(--line-hi)',
            color: stale ? 'var(--sig-unproven)' : 'var(--txt-dim)',
            background: stale ? 'rgb(255 154 77 / .08)' : 'transparent',
          }}
        >
          <span
            className={stale ? '' : 'live-dot'}
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: 99,
              background: stale ? 'var(--sig-unproven)' : 'var(--sig-real)',
            }}
          />
          updated {updated.text}
        </span>

        <span className="font-mono text-[0.8rem] text-[var(--txt-faint)]">
          first published {entry.publishedAt}
        </span>

        {hasLog && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="underline-grow font-mono text-[0.8rem] font-semibold text-[var(--txt-dim)] hover:text-[var(--amber)]"
          >
            {open ? 'hide' : 'see'} what changed ({entry.changelog!.length})
          </button>
        )}
      </div>

      {stale && (
        <p className="text-[0.9rem] leading-relaxed text-[var(--sig-unproven)]">
          This entry has not been re-checked in over six months. The mechanism is unlikely to have
          changed; the adoption and maturity scores may have.
        </p>
      )}

      {open && hasLog && (
        <ol className="rise space-y-3 border-l-2 border-[var(--line-hi)] pl-4">
          {entry.changelog!.map((c, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-[0.8rem] font-semibold text-[var(--amber)]">
                  {c.date}
                </span>
                {c.scoreFrom !== undefined && c.scoreTo !== undefined && (
                  <span className="font-mono text-[0.78rem] text-[var(--txt-faint)]">
                    score {c.scoreFrom}
                    <span className="text-[var(--amber)]"> &rarr; </span>
                    {c.scoreTo}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[0.94rem] leading-relaxed text-[var(--txt-dim)]">{c.note}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
