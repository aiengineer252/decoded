import { useMemo, useState } from 'react'
import FeedCard from '../components/FeedCard'
import DisplacementMap from '../components/DisplacementMap'
import ValueProp from '../components/ValueProp'
import ReadingLevelPicker from '../components/ReadingLevelPicker'
import DecodeText from '../components/DecodeText'
import { useReveal } from '../lib/useReveal'
import { sortedEntries } from '../data'
import type { Category } from '../types'

type Sort = 'recent' | 'score'

export default function Home() {
  const all = useMemo(() => sortedEntries(), [])
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [sort, setSort] = useState<Sort>('recent')

  const cats = useMemo(() => [...new Set(all.flatMap((e) => e.categories))].sort(), [all])

  const shown = useMemo(() => {
    const filtered = cat === 'all' ? all : all.filter((e) => e.categories.includes(cat))
    return sort === 'score'
      ? [...filtered].sort((a, b) => b.verdict.score - a.verdict.score)
      : filtered
  }, [all, cat, sort])

  useReveal([cat, sort])

  return (
    <div className="space-y-10">
      <section className="max-w-4xl">
        <p className="label mb-4 flex items-center gap-2.5">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />
          decoded · {all.length} entries traced to source
        </p>

        <h1 className="text-[2.6rem] leading-[1.12] font-bold tracking-tight sm:text-[3.2rem]">
          Every AI launch, traced down to{' '}
          <DecodeText
            as="span"
            text="what it actually does"
            duration={1100}
            className="text-[var(--amber)]"
          />{' '}
          — and what it makes obsolete.
        </h1>

        <p
          data-reveal
          className="mt-5 text-[1.15rem] leading-relaxed text-[var(--txt-dim)]"
        >
          Not a summary. Each entry is an interactive breakdown you step through: the architecture
          with its real code, a concrete input traced stage by stage, a line-by-line diff against
          the thing it replaces, and a credibility score where every point is click-to-verify.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--line)] pb-4">
            <FilterChip active={cat === 'all'} onClick={() => setCat('all')}>
              all
            </FilterChip>
            {cats.map((c) => (
              <FilterChip key={c} active={cat === c} onClick={() => setCat(c)}>
                {c}
              </FilterChip>
            ))}
            <div className="ml-auto flex items-center gap-2.5">
              <span className="label">sort</span>
              {(['recent', 'score'] as Sort[]).map((s) => (
                <FilterChip key={s} active={sort === s} onClick={() => setSort(s)}>
                  {s}
                </FilterChip>
              ))}
            </div>
          </div>

          <div key={`${cat}-${sort}`} data-reveal-stagger className="space-y-4">
            {shown.map((e, i) => (
              <div key={e.slug} data-reveal style={{ '--i': i } as React.CSSProperties}>
                <FeedCard entry={e} />
              </div>
            ))}
            {shown.length === 0 && (
              <p className="py-14 text-center font-mono text-[0.94rem] text-[var(--txt-faint)]">
                nothing in this category yet
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <DisplacementMap />

          <section className="panel rounded-lg p-5">
            <ReadingLevelPicker />
          </section>

          <section className="panel rounded-lg p-5">
            <span className="label">reading an entry</span>
            <ol className="mt-3 space-y-3.5">
              {[
                ['architecture', 'the system as boxes — click one for its real code'],
                ['trace', 'a concrete input, stepped through stage by stage'],
                ['displacement', 'the old way and the new way, side by side'],
                ['verdict', 'the score, with the evidence behind every factor'],
              ].map(([k, v], i) => (
                <li key={k} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line-hi)] font-mono text-[0.7rem] font-bold text-[var(--amber)]">
                    {i + 1}
                  </span>
                  <span className="text-[0.92rem] leading-snug">
                    <span className="font-mono font-semibold text-[var(--txt)]">{k}</span>
                    <span className="text-[var(--txt-dim)]"> — {v}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <div className="border-t border-[var(--line)] pt-10">
        <ValueProp />
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border px-3 py-1.5 font-mono text-[0.84rem] font-medium transition-all duration-200 hover:-translate-y-px"
      style={{
        borderColor: active ? 'var(--amber)' : 'var(--line)',
        color: active ? 'var(--amber)' : 'var(--txt-dim)',
        background: active ? 'rgb(255 176 32 / 0.1)' : 'transparent',
      }}
    >
      {children}
    </button>
  )
}
