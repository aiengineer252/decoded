import { useState } from 'react'
import type { Entry } from '../types'
import { useReadingLevel } from '../lib/readingLevel'
import ReadingLevelPicker from './ReadingLevelPicker'

/**
 * The orientation block that sits above the four views: what this is, at the
 * reader's level, plus the terms they would otherwise have to go look up.
 *
 * This exists because the four views assume you already know why you are here.
 * Landing straight on an architecture graph is great if you know the domain and
 * hostile if you do not.
 */
export default function EntryBrief({ entry }: { entry: Entry }) {
  const { level } = useReadingLevel()
  const [openTerm, setOpenTerm] = useState<string | null>(null)

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_300px] [&>*]:min-w-0">
      <div className="space-y-4">
        <div>
          <span className="label">what this actually is</span>
          {/* keyed on level so the text animates in on switch — the movement is
              what tells the reader the control did something */}
          <p
            key={level}
            className="rise mt-2 text-[1.08rem] leading-relaxed text-[var(--txt)]"
          >
            {entry.explainer[level]}
          </p>
        </div>

        {entry.prerequisites && entry.prerequisites.length > 0 && level !== 'expert' && (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-raised)] px-4 py-3">
            <span className="label">helps to know first</span>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {entry.prerequisites.map((p) => (
                <li
                  key={p}
                  className="flex items-baseline gap-2 text-[0.92rem] text-[var(--txt-dim)]"
                >
                  <span className="font-mono text-[var(--amber)]">&middot;</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry.glossary && entry.glossary.length > 0 && level === 'beginner' && (
          <div className="rise">
            <span className="label">terms used on this page</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {entry.glossary.map((g) => {
                const open = openTerm === g.term
                return (
                  <button
                    key={g.term}
                    onClick={() => setOpenTerm(open ? null : g.term)}
                    className="rounded-md border px-2.5 py-1 font-mono text-[0.82rem] transition-all"
                    style={{
                      borderColor: open ? 'var(--amber)' : 'var(--line-hi)',
                      color: open ? 'var(--amber)' : 'var(--txt-dim)',
                      background: open ? 'rgb(255 176 32 / .08)' : 'transparent',
                    }}
                  >
                    {g.term}
                  </button>
                )
              })}
            </div>
            {openTerm && (
              <p className="rise mt-3 border-l-2 border-[var(--amber)] pl-4 text-[0.96rem] leading-relaxed text-[var(--txt-dim)]">
                <span className="font-mono font-semibold text-[var(--txt)]">{openTerm}</span>
                {' — '}
                {entry.glossary.find((g) => g.term === openTerm)?.plain}
              </p>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <ReadingLevelPicker />
        {entry.readingMinutes && (
          <p className="font-mono text-[0.8rem] text-[var(--txt-faint)]">
            ~{entry.readingMinutes} min to read all four views
          </p>
        )}
      </aside>
    </section>
  )
}
