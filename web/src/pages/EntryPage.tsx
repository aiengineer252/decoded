import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEntry } from '../data'
import type { EntryView } from '../types'
import { GaugeChip } from '../components/Gauge'
import EntryBrief from '../components/EntryBrief'
import Freshness from '../components/Freshness'
import StartHere from '../components/StartHere'
import ArchitectureView from '../components/views/ArchitectureView'
import TraceView from '../components/views/TraceView'
import DisplacementView from '../components/views/DisplacementView'
import VerdictView from '../components/views/VerdictView'
import { computeScore } from '../lib/credibility'

/**
 * The four views are four chapters of one argument, so each carries what the
 * reader is about to learn and what they will know when they finish. The
 * progression is fixed: what it is -> what it does -> what it changes -> whether
 * to trust it. A reader who jumps around still gets the framing.
 */
const VIEWS: {
  key: EntryView
  label: string
  hint: string
  learn: string
  takeaway: string
  next: string
}[] = [
  {
    key: 'architecture',
    label: 'architecture',
    hint: 'what it is made of',
    learn: 'The parts of the system and how data moves between them. Click a box to open it — each one carries an explanation and, where we have it, a guided walk through the real code.',
    takeaway: 'You can now name the parts, and you know which one holds the actual idea.',
    next: 'Now watch one real input go through it',
  },
  {
    key: 'trace',
    label: 'trace',
    hint: 'what it does to one real input',
    learn: 'One concrete example pushed through the system, step by step, showing the real data at every stage. This is the chapter that turns "I get the idea" into "I could explain it".',
    takeaway: 'You have seen the mechanism run on a real value, and you know what the numbers look like at each stage.',
    next: 'Now see what it replaces',
  },
  {
    key: 'displacement',
    label: 'displacement',
    hint: 'what it replaces',
    learn: 'The code you write today next to the code you would write with this, line by line. Then the two lists that matter: what goes away, and what you now pay instead.',
    takeaway: 'You know what this would remove from your stack, what it would not, and what the bill looks like.',
    next: 'Now the verdict — is it real?',
  },
  {
    key: 'verdict',
    label: 'verdict',
    hint: 'is it real',
    learn: 'Five factors, each with its evidence attached, combined into one score you can recompute — or re-weight — yourself.',
    takeaway: 'You can defend a yes or a no on this with sources, not vibes.',
    next: '',
  },
]

export default function EntryPage() {
  const { slug } = useParams()
  const entry = slug ? getEntry(slug) : undefined
  const [view, setView] = useState<EntryView>('architecture')
  const [seen, setSeen] = useState<Set<EntryView>>(new Set(['architecture']))

  const tabsRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const index = VIEWS.findIndex((v) => v.key === view)

  const go = (key: EntryView) => {
    setView(key)
    setSeen((s) => new Set(s).add(key))
  }

  // Slide the underline between tabs instead of redrawing it. The movement is
  // what tells the reader these four are one sequence, not four unrelated tabs.
  useLayoutEffect(() => {
    const container = tabsRef.current
    if (!container) return
    const el = container.querySelectorAll('button')[index] as HTMLElement | undefined
    if (!el) return
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [index, entry])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = ['1', '2', '3', '4'].indexOf(e.key)
      if (i >= 0 && !e.metaKey && !e.ctrlKey) go(VIEWS[i].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  // The stored score must equal the score its own factors produce. If it ever
  // doesn't, the entry is lying and the page says so rather than hiding it.
  const recomputed = computeScore(entry.verdict.factors)
  const scoreDrift = Math.abs(recomputed - entry.verdict.score) > 1
  const nextView = VIEWS[index + 1]

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
          <h1 className="text-[2.6rem] leading-[1.1] font-bold tracking-tight">{entry.name}</h1>
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
            factors are a human judgement, not pipeline output. Entries produced automatically will
            be labelled <span className="font-mono">auto</span> or{' '}
            <span className="font-mono">reviewed</span>.
          </p>
        </div>
      )}

      {/* Defensive: an `auto` entry should never reach the site, because the
          export step ships reviewed entries only. If one does, the reader is
          told rather than served unverified output silently. */}
      {entry.status === 'auto' && (
        <div className="rounded-lg border border-[var(--sig-unproven)]/50 bg-[var(--sig-unproven)]/5 px-5 py-4">
          <p className="text-[0.94rem] leading-relaxed text-[var(--txt-dim)]">
            <span className="font-mono font-semibold text-[var(--sig-unproven)]">
              not yet reviewed —{' '}
            </span>
            this entry is raw pipeline output. No human has checked that the mechanism matches the
            source, that the evidence links support their claims, or that the code was quoted rather
            than reconstructed. Read it with that in mind.
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
        <StartHere entry={entry} />
      </div>

      <EntryBrief entry={entry} />

      <nav className="sticky top-[108px] z-20 -mx-4 border-y border-[var(--line)] bg-[var(--bg)]/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div ref={tabsRef} className="relative flex gap-1 overflow-x-auto">
          {VIEWS.map((v, i) => {
            const active = view === v.key
            const visited = seen.has(v.key)
            return (
              <button
                key={v.key}
                onClick={() => go(v.key)}
                className="group relative shrink-0 px-4 py-4 text-left transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[0.72rem] font-bold transition-all duration-300"
                    style={{
                      background: active
                        ? 'var(--amber)'
                        : visited
                          ? 'transparent'
                          : 'var(--bg-raised)',
                      color: active ? '#07090c' : visited ? 'var(--sig-real)' : 'var(--txt-faint)',
                      border: `1px solid ${active ? 'var(--amber)' : visited ? 'var(--sig-real)' : 'var(--line-hi)'}`,
                    }}
                  >
                    {visited && !active ? 'x' : i + 1}
                  </span>
                  <span
                    className="font-mono text-[0.94rem] font-bold tracking-wider uppercase transition-colors"
                    style={{ color: active ? 'var(--amber)' : 'var(--txt-dim)' }}
                  >
                    {v.label}
                  </span>
                </span>
                <span className="mt-1 block pl-8.5 text-[0.8rem] text-[var(--txt-faint)]">
                  {v.hint}
                </span>
              </button>
            )
          })}

          {/* the sliding indicator */}
          <span
            className="pointer-events-none absolute bottom-0 h-[3px] rounded-t bg-[var(--amber)]"
            style={{
              left: indicator.left + 8,
              width: Math.max(indicator.width - 16, 0),
              transition: 'left .38s cubic-bezier(.22,1,.36,1), width .38s cubic-bezier(.22,1,.36,1)',
              boxShadow: '0 0 12px var(--amber)',
            }}
          />
        </div>
      </nav>

      <div key={view} className="rise space-y-6">
        {/* chapter opener */}
        <div className="flex gap-4">
          <div className="mt-1 h-auto w-1 shrink-0 rounded-full bg-[var(--amber)] rule-in" style={{ transformOrigin: 'top' }} />
          <div>
            <span className="label">
              chapter {index + 1} of 4 · in this chapter
            </span>
            <p className="mt-1.5 max-w-3xl text-[1.02rem] leading-relaxed text-[var(--txt-dim)]">
              {VIEWS[index].learn}
            </p>
          </div>
        </div>

        {view === 'architecture' && <ArchitectureView architecture={entry.architecture} />}
        {view === 'trace' && <TraceView trace={entry.trace} architecture={entry.architecture} />}
        {view === 'displacement' && <DisplacementView displacement={entry.displacement} />}
        {view === 'verdict' && <VerdictView verdict={entry.verdict} />}

        {/* chapter close — what the reader now has, before the handoff */}
        <div className="flex gap-3 rounded-lg border border-[var(--sig-real)]/35 bg-[var(--sig-real)]/5 px-5 py-4">
          <span className="mt-0.5 font-mono font-bold text-[var(--sig-real)]">x</span>
          <div>
            <span className="label" style={{ color: 'var(--sig-real)' }}>
              you now know
            </span>
            <p className="mt-1 text-[0.98rem] leading-relaxed text-[var(--txt)]">{VIEWS[index].takeaway}</p>
          </div>
        </div>
      </div>

      {/* Forward motion. Four views only read as one argument if the page
          actually walks you from one to the next. */}
      {nextView ? (
        <button
          onClick={() => {
            go(nextView.key)
            window.scrollTo({ top: 260, behavior: 'smooth' })
          }}
          className="lift group flex w-full items-center justify-between rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] px-6 py-5 text-left hover:border-[var(--amber)]"
        >
          <span>
            <span className="label">next</span>
            <span className="mt-1 block text-[1.15rem] font-semibold text-[var(--txt)]">
              {VIEWS[index].next}
            </span>
          </span>
          <span className="flex items-center gap-3 font-mono text-[0.94rem] font-bold tracking-wider text-[var(--amber)] uppercase">
            {nextView.label}
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
              &rarr;
            </span>
          </span>
        </button>
      ) : (
        <Link
          to="/"
          className="lift group flex w-full items-center justify-between rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] px-6 py-5 hover:border-[var(--amber)]"
        >
          <span>
            <span className="label">done</span>
            <span className="mt-1 block text-[1.15rem] font-semibold text-[var(--txt)]">
              That's the whole breakdown. Next entry?
            </span>
          </span>
          <span className="flex items-center gap-3 font-mono text-[0.94rem] font-bold tracking-wider text-[var(--amber)] uppercase">
            feed
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
              &rarr;
            </span>
          </span>
        </Link>
      )}

      <p className="border-t border-[var(--line)] pt-5 font-mono text-[0.8rem] text-[var(--txt-faint)]">
        keys: 1–4 switch view · arrow keys step the trace
      </p>
    </article>
  )
}
