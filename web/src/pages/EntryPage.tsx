import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEntry } from '../data'
import type { EntryView } from '../types'
import { GaugeChip } from '../components/Gauge'
import ArchitectureView from '../components/views/ArchitectureView'
import TraceView from '../components/views/TraceView'
import DisplacementView from '../components/views/DisplacementView'
import VerdictView from '../components/views/VerdictView'
import { computeScore } from '../lib/credibility'
import EntryBrief from '../components/EntryBrief'
import Freshness from '../components/Freshness'
import StartHere from '../components/StartHere'
import DecodeText from '../components/DecodeText'
import { useReveal } from '../lib/useReveal'
import { useScrollSpy } from '../lib/useScrollSpy'
import { scrollTo } from '../lib/smoothScroll'

/**
 * The four views are four chapters of one argument, and you reach them by
 * scrolling rather than by clicking tabs. Each carries what you are about to
 * learn and what you will know when you finish.
 */
const VIEWS: {
  key: EntryView
  label: string
  hint: string
  learn: string
  takeaway: string
}[] = [
  {
    key: 'architecture',
    label: 'architecture',
    hint: 'what it is made of',
    learn: 'The parts of the system and how data moves between them. The diagram builds itself along the data path — hover a box to see only what it connects to, click it for the real code.',
    takeaway: 'You can now name the parts, and you know which one holds the actual idea.',
  },
  {
    key: 'trace',
    label: 'trace',
    hint: 'what it does to one real input',
    learn: 'One concrete example pushed through the system, step by step, showing the real data at every stage. This is the chapter that turns "I get the idea" into "I could explain it".',
    takeaway: 'You have seen the mechanism run on a real value, and you know what the numbers look like at each stage.',
  },
  {
    key: 'displacement',
    label: 'displacement',
    hint: 'what it replaces',
    learn: 'The code you write today next to the code you would write with this, line by line. Then the two lists that matter: what goes away, and what you now pay instead.',
    takeaway: 'You know what this would remove from your stack, what it would not, and what the bill looks like.',
  },
  {
    key: 'verdict',
    label: 'verdict',
    hint: 'is it real',
    learn: 'Five factors, each with its evidence attached, combined into one score you can recompute — or re-weight — yourself.',
    takeaway: 'You can defend a yes or a no on this with sources, not vibes.',
  },
]

const sectionId = (k: EntryView) => `chapter-${k}`

export default function EntryPage() {
  const { slug } = useParams()
  const entry = slug ? getEntry(slug) : undefined

  const ids = useMemo(() => VIEWS.map((v) => sectionId(v.key)), [])
  const active = useScrollSpy(ids, !!entry)

  // Chapters the reader has actually arrived at, for the rail's tick marks.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))
  useEffect(() => {
    setSeen((s) => (s.has(active) ? s : new Set(s).add(active)))
  }, [active])

  // Number keys jump between chapters — the keyboard equivalent of scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      const i = ['1', '2', '3', '4'].indexOf(e.key)
      if (i >= 0) {
        const el = document.getElementById(sectionId(VIEWS[i].key))
        if (el) scrollTo(el, -150)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useReveal([slug])

  if (!entry) {
    return (
      <div className="py-24 text-center">
        <p className="font-mono text-[1rem] text-[var(--txt-dim)]">no entry at this address</p>
        <Link to="/" className="mt-4 inline-block font-mono text-[0.9rem] text-[var(--amber)]">
          &larr; back to feed
        </Link>
      </div>
    )
  }

  const recomputed = computeScore(entry.verdict.factors)
  const scoreDrift = Math.abs(recomputed - entry.verdict.score) > 1

  const jump = (i: number) => {
    const el = document.getElementById(sectionId(VIEWS[i].key))
    if (el) scrollTo(el, -150)
  }

  return (
    <article className="space-y-7">
      <Link
        to="/"
        className="underline-grow inline-block font-mono text-[0.84rem] text-[var(--txt-dim)] hover:text-[var(--amber)]"
      >
        &larr; feed
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <DecodeText
            as="h1"
            text={entry.name}
            duration={800}
            className="text-[2.6rem] leading-[1.1] font-bold tracking-tight"
          />
          <GaugeChip score={entry.verdict.score} />
          {entry.status === 'demo' && (
            <span className="rounded border border-[var(--line-hi)] px-2.5 py-1 font-mono text-[0.72rem] font-semibold tracking-widest text-[var(--txt-faint)] uppercase">
              seed entry
            </span>
          )}
        </div>

        <p className="max-w-4xl text-[1.15rem] leading-relaxed text-[var(--txt-dim)]">
          {entry.tagline}
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[0.82rem] text-[var(--txt-faint)]">
          <span>{entry.org}</span>
          {entry.reviewedBy && <span>reviewed by {entry.reviewedBy}</span>}
          <span>{entry.sources.length} sources</span>
        </div>

        <Freshness entry={entry} />

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {entry.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="underline-grow font-mono text-[0.84rem] text-[var(--txt-dim)] hover:text-[var(--amber)]"
            >
              [{s.kind}] {s.label}
            </a>
          ))}
        </div>
      </header>

      {entry.status === 'demo' && (
        <div className="rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] px-5 py-4">
          <p className="text-[0.94rem] leading-relaxed text-[var(--txt-dim)]">
            <span className="font-mono font-semibold text-[var(--amber)]">seed entry — </span>
            hand-written to pin down the format before the triage pipeline runs. The mechanism,
            trace and diff describe the real system and every source is linked; the credibility
            factors are a human judgement, not pipeline output.
          </p>
        </div>
      )}

      {entry.status === 'auto' && (
        <div className="rounded-lg border border-[var(--sig-unproven)]/50 bg-[var(--sig-unproven)]/5 px-5 py-4">
          <p className="text-[0.94rem] leading-relaxed text-[var(--txt-dim)]">
            <span className="font-mono font-semibold text-[var(--sig-unproven)]">
              not yet reviewed —{' '}
            </span>
            this entry is raw pipeline output. No human has checked that the mechanism matches the
            source, that the evidence links support their claims, or that the code was quoted rather
            than reconstructed.
          </p>
        </div>
      )}

      {scoreDrift && (
        <div className="rounded-lg border border-[var(--sig-hype)]/50 bg-[var(--sig-hype)]/5 px-5 py-3 font-mono text-[0.9rem] font-semibold text-[var(--sig-hype)]">
          score drift: stored {entry.verdict.score}, factors compute to {recomputed}
        </div>
      )}

      <div className="space-y-3">
        <span className="label">start here</span>
        <span data-reveal="rule" className="block h-px w-full bg-[var(--line-hi)]" />
        <StartHere entry={entry} />
      </div>

      <EntryBrief entry={entry} />

      {/* Chapter rail. No longer a tab bar that swaps content — it reflects
          where scrolling has taken you, and clicking scrolls you there. */}
      <nav
        aria-label="Chapters"
        className="sticky top-[108px] z-20 -mx-4 border-y border-[var(--line)] bg-[var(--bg)]/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6"
      >
        <div className="relative flex gap-1 overflow-x-auto">
          {VIEWS.map((v, i) => {
            const isHere = i === active
            const visited = seen.has(i) && !isHere
            return (
              <button
                key={v.key}
                onClick={() => jump(i)}
                aria-current={isHere ? 'true' : undefined}
                className="group relative shrink-0 px-4 py-4 text-left transition-colors"
              >
                <span className="flex items-baseline gap-2.5">
                  <span
                    className="font-mono text-[0.78rem] font-bold tabular-nums transition-all duration-400"
                    style={{
                      color: isHere
                        ? 'var(--amber)'
                        : visited
                          ? 'var(--sig-real)'
                          : 'var(--txt-faint)',
                      letterSpacing: isHere ? '0.24em' : '0.14em',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="font-mono text-[0.94rem] font-bold tracking-wider uppercase transition-colors duration-300"
                    style={{ color: isHere ? 'var(--amber)' : 'var(--txt-dim)' }}
                  >
                    {v.label}
                  </span>
                </span>
                <span className="mt-1 block pl-7 text-[0.8rem] text-[var(--txt-faint)]">
                  {v.hint}
                </span>
                {isHere && (
                  <span className="rail-marker absolute inset-x-2 -bottom-px h-[3px] rounded-t bg-[var(--amber)] shadow-[0_0_12px_var(--amber)]" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      <p className="font-mono text-[0.8rem] text-[var(--txt-faint)]">
        scroll to move through the four chapters · keys 1–4 jump
      </p>

      {/* The narrative. All four chapters are on the page; scrolling is how
          you travel through them. */}
      {VIEWS.map((v, i) => {
        const isHere = i === active
        return (
          <section
            key={v.key}
            id={sectionId(v.key)}
            data-state={isHere ? 'here' : 'away'}
            className="chapter-section relative scroll-mt-44 border-t border-[var(--line)] pt-8"
          >
            {/* the chapter numeral, drifting behind its own content */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-2 right-0 z-0 font-mono text-[7.5rem] leading-none font-bold text-[var(--amber)] transition-opacity duration-700 select-none"
              style={{ opacity: isHere ? 0.09 : 0.03 }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            <div className="relative z-10 space-y-6">
              <div className="flex gap-4">
                <span
                  className="chapter-spine mt-1 w-1 shrink-0 rounded-full"
                  style={{
                    background: isHere ? 'var(--amber)' : 'var(--line-hi)',
                    transform: `scaleY(${isHere ? 1 : 0.35})`,
                  }}
                />
                <div>
                  <span className="label">
                    chapter {i + 1} of 4 · in this chapter
                  </span>
                  <p className="mt-1.5 max-w-3xl text-[1.02rem] leading-relaxed text-[var(--txt-dim)]">
                    {v.learn}
                  </p>
                </div>
              </div>

              {v.key === 'architecture' && <ArchitectureView architecture={entry.architecture} />}
              {v.key === 'trace' && (
                <TraceView trace={entry.trace} architecture={entry.architecture} active={isHere} />
              )}
              {v.key === 'displacement' && <DisplacementView displacement={entry.displacement} />}
              {v.key === 'verdict' && <VerdictView verdict={entry.verdict} />}

              <div className="flex gap-3 rounded-lg border border-[var(--sig-real)]/35 bg-[var(--sig-real)]/5 px-5 py-4">
                <span className="mt-0.5 font-mono font-bold text-[var(--sig-real)]">x</span>
                <div>
                  <span className="label" style={{ color: 'var(--sig-real)' }}>
                    you now know
                  </span>
                  <p className="mt-1 text-[0.98rem] leading-relaxed text-[var(--txt)]">
                    {v.takeaway}
                  </p>
                </div>
              </div>

              {i < VIEWS.length - 1 && (
                <button
                  onClick={() => jump(i + 1)}
                  className="lift group flex w-full items-center justify-between rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] px-6 py-5 text-left hover:border-[var(--amber)]"
                >
                  <span>
                    <span className="label">keep scrolling</span>
                    <span className="mt-1 block text-[1.1rem] font-semibold text-[var(--txt)]">
                      {VIEWS[i + 1].learn.split('.')[0]}.
                    </span>
                  </span>
                  <span className="flex items-center gap-3 font-mono text-[0.94rem] font-bold tracking-wider text-[var(--amber)] uppercase">
                    {VIEWS[i + 1].label}
                    <span className="inline-block transition-transform duration-300 group-hover:translate-y-1">
                      &darr;
                    </span>
                  </span>
                </button>
              )}
            </div>
          </section>
        )
      })}

      <Link
        to="/"
        className="lift group flex w-full items-center justify-between rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] px-6 py-5 hover:border-[var(--amber)]"
      >
        <span>
          <span className="label">done</span>
          <span className="mt-1 block text-[1.15rem] font-semibold text-[var(--txt)]">
            That&apos;s the whole breakdown. Next entry?
          </span>
        </span>
        <span className="flex items-center gap-3 font-mono text-[0.94rem] font-bold tracking-wider text-[var(--amber)] uppercase">
          feed
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
            &rarr;
          </span>
        </span>
      </Link>
    </article>
  )
}
