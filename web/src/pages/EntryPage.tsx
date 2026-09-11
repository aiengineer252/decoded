import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEntry } from '../data'
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
import Scene from '../components/Scene'
import DepthHud from '../components/DepthHud'
import { gotoScene, useScenes } from '../lib/useScenes'

/**
 * The descent. Five layers: the brief that says what problem this thing
 * solves, then the four modules that answer it.
 *
 * `takeaway` closes each layer so a reader always knows what they just
 * gained, and `next` names the layer below so descending is a decision
 * rather than a surprise.
 */
const LAYERS = [
  {
    key: 'brief',
    index: '00',
    label: 'brief',
    scene: 'What problem does this solve, and what is the idea.',
    takeaway: '',
    next: 'Open the system and see what it is made of',
  },
  {
    key: 'architecture',
    index: '01',
    label: 'architecture',
    scene: 'System topology. The diagram builds along the data path — hover a module to isolate its connections, open one for the real code.',
    takeaway: 'You can name the parts, and you know which one holds the actual idea.',
    next: 'Push one real input through it',
  },
  {
    key: 'trace',
    index: '02',
    label: 'trace',
    scene: 'Execution walk. One concrete input, stepped through every stage, with the real intermediate values.',
    takeaway: 'You have seen the mechanism run on a real value, and you know what the numbers look like at each stage.',
    next: 'Diff it against what you write today',
  },
  {
    key: 'displacement',
    index: '03',
    label: 'displacement',
    scene: 'Before and after, line by line. Then what goes away, and what you now pay instead.',
    takeaway: 'You know what this removes from your stack, what it does not, and what the bill looks like.',
    next: 'Weigh the evidence and decide',
  },
  {
    key: 'verdict',
    index: '04',
    label: 'verdict',
    scene: 'Credibility breakdown. Five factors, each with its evidence attached, combined into a score you can recompute or re-weight.',
    takeaway: 'You can defend a yes or a no on this with sources, not vibes.',
    next: '',
  },
] as const

const sceneId = (k: string) => `layer-${k}`

export default function EntryPage() {
  const { slug } = useParams()
  const entry = slug ? getEntry(slug) : undefined

  const ids = useMemo(() => LAYERS.map((l) => sceneId(l.key)), [])
  const { active, armed, stateOf } = useScenes(ids, !!entry)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Number keys descend directly to a layer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      const i = ['0', '1', '2', '3', '4'].indexOf(e.key)
      if (i >= 0 && i < LAYERS.length) gotoScene(sceneId(LAYERS[i].key))
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

  const recomputed = computeScore(entry.verdict.factors)
  const scoreDrift = Math.abs(recomputed - entry.verdict.score) > 1

  const Descend = ({ i }: { i: number }) =>
    i < LAYERS.length - 1 ? (
      <button
        onClick={() => gotoScene(sceneId(LAYERS[i + 1].key))}
        className="lift group mt-10 flex w-full items-center justify-between rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] px-6 py-5 text-left hover:border-[var(--amber)]"
      >
        <span>
          <span className="label">descend &middot; layer {LAYERS[i + 1].index}</span>
          <span className="mt-1 block text-[1.1rem] font-semibold text-[var(--txt)]">
            {LAYERS[i].next}
          </span>
        </span>
        <span className="flex items-center gap-3 font-mono text-[0.94rem] font-bold tracking-wider text-[var(--amber)] uppercase">
          {LAYERS[i + 1].label}
          <span className="inline-block transition-transform duration-300 group-hover:translate-y-1">
            &darr;
          </span>
        </span>
      </button>
    ) : null

  const Takeaway = ({ i }: { i: number }) =>
    LAYERS[i].takeaway ? (
      <div className="mt-8 flex gap-3 rounded-lg border border-[var(--sig-real)]/35 bg-[var(--sig-real)]/5 px-5 py-4">
        <span className="mt-0.5 font-mono font-bold text-[var(--sig-real)]">x</span>
        <div>
          <span className="label" style={{ color: 'var(--sig-real)' }}>
            you now know
          </span>
          <p className="mt-1 text-[0.98rem] leading-relaxed text-[var(--txt)]">
            {LAYERS[i].takeaway}
          </p>
        </div>
      </div>
    ) : null

  return (
    <article className={booted ? 'rise' : undefined}>
      <DepthHud
        scenes={LAYERS.map((l) => ({ id: sceneId(l.key), index: l.index, label: l.label }))}
        active={active}
        context={entry.slug.slice(0, 14)}
      />

      {/* ---------------------------------------------------------------- */}
      <Scene
        id={sceneId('brief')}
        index="00"
        label="brief"
        state={stateOf(0)}
        armed={armed}
        brief={LAYERS[0].scene}
      >
        <div className="space-y-7">
          <Link
            to="/"
            className="underline-grow inline-block font-mono text-[0.84rem] text-[var(--txt-dim)] hover:text-[var(--amber)]"
          >
            &larr; index
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
              {entry.status === 'auto' && (
                <span className="rounded border border-[var(--sig-unproven)]/60 bg-[var(--sig-unproven)]/10 px-2.5 py-1 font-mono text-[0.72rem] font-semibold tracking-widest text-[var(--sig-unproven)] uppercase">
                  unreviewed
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
                raw pipeline output. No human has checked that the mechanism matches the source.
              </p>
            </div>
          )}

          {scoreDrift && (
            <div className="rounded-lg border border-[var(--sig-hype)]/50 bg-[var(--sig-hype)]/5 px-5 py-3 font-mono text-[0.9rem] font-semibold text-[var(--sig-hype)]">
              score drift: stored {entry.verdict.score}, factors compute to {recomputed}
            </div>
          )}

          <StartHere entry={entry} />
          <EntryBrief entry={entry} />
          <Descend i={0} />
        </div>
      </Scene>

      {/* ---------------------------------------------------------------- */}
      <Scene
        id={sceneId('architecture')}
        index="01"
        label="architecture"
        state={stateOf(1)}
        armed={armed}
        brief={LAYERS[1].scene}
      >
        <ArchitectureView architecture={entry.architecture} />
        <Takeaway i={1} />
        <Descend i={1} />
      </Scene>

      {/* ---------------------------------------------------------------- */}
      <Scene
        id={sceneId('trace')}
        index="02"
        label="trace"
        state={stateOf(2)}
        armed={armed}
        brief={LAYERS[2].scene}
      >
        <TraceView
          trace={entry.trace}
          architecture={entry.architecture}
          active={!armed || active === 2}
        />
        <Takeaway i={2} />
        <Descend i={2} />
      </Scene>

      {/* ---------------------------------------------------------------- */}
      <Scene
        id={sceneId('displacement')}
        index="03"
        label="displacement"
        state={stateOf(3)}
        armed={armed}
        brief={LAYERS[3].scene}
      >
        <DisplacementView displacement={entry.displacement} />
        <Takeaway i={3} />
        <Descend i={3} />
      </Scene>

      {/* ---------------------------------------------------------------- */}
      <Scene
        id={sceneId('verdict')}
        index="04"
        label="verdict"
        state={stateOf(4)}
        armed={armed}
        brief={LAYERS[4].scene}
      >
        <VerdictView verdict={entry.verdict} />
        <Takeaway i={4} />

        <Link
          to="/"
          className="lift group mt-10 flex w-full items-center justify-between rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] px-6 py-5 hover:border-[var(--amber)]"
        >
          <span>
            <span className="label">surface</span>
            <span className="mt-1 block text-[1.15rem] font-semibold text-[var(--txt)]">
              That&apos;s the whole breakdown. Next entry?
            </span>
          </span>
          <span className="flex items-center gap-3 font-mono text-[0.94rem] font-bold tracking-wider text-[var(--amber)] uppercase">
            index
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
              &rarr;
            </span>
          </span>
        </Link>
      </Scene>

      <p className="border-t border-[var(--line)] pt-5 font-mono text-[0.8rem] text-[var(--txt-faint)]">
        scroll to descend · keys 0–4 jump to a layer · arrows step the trace
      </p>
    </article>
  )
}
