import type { ReadingLevel } from '../types'
import { LEVEL_META, useReadingLevel } from '../lib/readingLevel'

const ORDER: ReadingLevel[] = ['beginner', 'practitioner', 'expert']

/**
 * Three tabs, one sliding highlight. Deliberately prominent rather than tucked
 * into a settings menu — a reader who never finds this control gets the wrong
 * version of every entry, which is worse than no control at all.
 */
export default function ReadingLevelPicker({ compact = false }: { compact?: boolean }) {
  const { level, setLevel } = useReadingLevel()
  const index = ORDER.indexOf(level)

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {!compact && <span className="label">explain it for</span>}

      <div
        className="relative grid grid-cols-3 gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg-raised)] p-1"
        role="tablist"
        aria-label="Reading level"
      >
        {/* the moving highlight, so switching feels like one control */}
        <span
          className="pointer-events-none absolute inset-y-1 rounded-md bg-[var(--panel-hi)] ring-1 ring-[var(--amber)]/40"
          style={{
            width: `calc((100% - 0.5rem) / 3)`,
            left: `calc(0.25rem + ${index} * ((100% - 0.5rem) / 3))`,
            transition: 'left .34s cubic-bezier(.22,1,.36,1)',
          }}
        />

        {ORDER.map((l) => {
          const active = l === level
          const meta = LEVEL_META[l]
          return (
            <button
              key={l}
              role="tab"
              aria-selected={active}
              onClick={() => setLevel(l)}
              className="relative z-10 rounded-md px-2 py-2 text-center transition-colors"
            >
              <span
                className="block font-mono text-[0.8rem] font-bold tracking-wide"
                style={{ color: active ? 'var(--amber)' : 'var(--txt-dim)' }}
              >
                {meta.label}
              </span>
              {!compact && (
                <span className="mt-0.5 block text-[0.72rem] leading-tight text-[var(--txt-faint)]">
                  {meta.blurb}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!compact && (
        <p key={level} className="rise text-[0.82rem] text-[var(--txt-faint)]">
          {LEVEL_META[level].assumes}
        </p>
      )}
    </div>
  )
}
