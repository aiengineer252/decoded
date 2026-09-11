import { useMemo, useState } from 'react'
import FeedCard from '../components/FeedCard'
import DisplacementMap from '../components/DisplacementMap'
import ValueProp from '../components/ValueProp'
import ReadingLevelPicker from '../components/ReadingLevelPicker'
import DecodeText from '../components/DecodeText'
import Scene from '../components/Scene'
import DepthHud from '../components/DepthHud'
import { sortedEntries } from '../data'
import type { Category } from '../types'
import { gotoScene, useScenes } from '../lib/useScenes'

type Sort = 'recent' | 'score'

const LAYERS = [
  { key: 'problem', index: '00', label: 'problem' },
  { key: 'index', index: '01', label: 'index' },
  { key: 'protocol', index: '02', label: 'protocol' },
] as const

const sceneId = (k: string) => `layer-${k}`

export default function Home() {
  const all = useMemo(() => sortedEntries(), [])
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [sort, setSort] = useState<Sort>('recent')

  const ids = useMemo(() => LAYERS.map((l) => sceneId(l.key)), [])
  const { active, armed, stateOf } = useScenes(ids)

  const cats = useMemo(() => [...new Set(all.flatMap((e) => e.categories))].sort(), [all])

  const shown = useMemo(() => {
    const filtered = cat === 'all' ? all : all.filter((e) => e.categories.includes(cat))
    return sort === 'score'
      ? [...filtered].sort((a, b) => b.verdict.score - a.verdict.score)
      : filtered
  }, [all, cat, sort])

  return (
    <div>
      <DepthHud
        scenes={LAYERS.map((l) => ({ id: sceneId(l.key), index: l.index, label: l.label }))}
        active={active}
        context="decoded"
      />

      {/* ---- 00 · the problem this site exists to solve ---------------- */}
      <Scene
        id={sceneId('problem')}
        index="00"
        label="problem"
        state={stateOf(0)}
        armed={armed}
      >
        <div className="max-w-4xl space-y-6">
          <p className="label flex items-center gap-2.5">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />
            {all.length} entries traced to source · nothing generated while you read
          </p>

          <h1 className="text-[2.6rem] leading-[1.12] font-bold tracking-tight sm:text-[3.3rem]">
            Every AI launch gets fifty &ldquo;top 10 features&rdquo; posts in a day.
            <br />
            <DecodeText
              as="span"
              text="None of them open the code."
              duration={1200}
              className="text-[var(--amber)]"
            />
          </h1>

          <p className="text-[1.15rem] leading-relaxed text-[var(--txt-dim)]">
            So you are left guessing whether the thing that just shipped actually changes your
            stack, or whether it is a wrapper with a launch video. This site answers that one
            question per release, by opening the source and tracing what the thing genuinely does.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['what it does', 'traced to the real code, not the announcement'],
              ['what it replaces', 'and, more usefully, what it does not'],
              ['is it real', 'a score you can recompute and re-weight yourself'],
            ].map(([t, d], i) => (
              <div
                key={t}
                className="rounded-lg border border-[var(--line)] bg-[var(--bg-raised)] px-4 py-3"
              >
                <span className="font-mono text-[0.72rem] font-bold tracking-[0.2em] text-[var(--amber)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="mt-1 text-[0.98rem] font-semibold text-[var(--txt)]">{t}</p>
                <p className="mt-0.5 text-[0.88rem] leading-snug text-[var(--txt-dim)]">{d}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => gotoScene(sceneId('index'))}
            className="lift group flex w-full items-center justify-between rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] px-6 py-5 text-left hover:border-[var(--amber)]"
          >
            <span>
              <span className="label">descend · layer 01</span>
              <span className="mt-1 block text-[1.1rem] font-semibold text-[var(--txt)]">
                Open the index — {all.length} entries, newest first
              </span>
            </span>
            <span className="flex items-center gap-3 font-mono text-[0.94rem] font-bold tracking-wider text-[var(--amber)] uppercase">
              index
              <span className="inline-block transition-transform duration-300 group-hover:translate-y-1">
                &darr;
              </span>
            </span>
          </button>
        </div>
      </Scene>

      {/* ---- 01 · the feed -------------------------------------------- */}
      <Scene
        id={sceneId('index')}
        index="01"
        label="index"
        state={stateOf(1)}
        armed={armed}
        brief="Every entry, scored. Open one to descend through its architecture, execution trace, displacement diff and verdict."
      >
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

            <div className="space-y-4">
              {shown.map((e) => (
                <FeedCard key={e.slug} entry={e} />
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
              <span className="label">how an entry works</span>
              <ol className="mt-3 space-y-3.5">
                {[
                  ['architecture', 'the system as modules — open one for its real code'],
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

        <button
          onClick={() => gotoScene(sceneId('protocol'))}
          className="lift group mt-10 flex w-full items-center justify-between rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] px-6 py-5 text-left hover:border-[var(--amber)]"
        >
          <span>
            <span className="label">descend · layer 02</span>
            <span className="mt-1 block text-[1.1rem] font-semibold text-[var(--txt)]">
              What this site holds itself to
            </span>
          </span>
          <span className="flex items-center gap-3 font-mono text-[0.94rem] font-bold tracking-wider text-[var(--amber)] uppercase">
            protocol
            <span className="inline-block transition-transform duration-300 group-hover:translate-y-1">
              &darr;
            </span>
          </span>
        </button>
      </Scene>

      {/* ---- 02 · the commitments ------------------------------------- */}
      <Scene
        id={sceneId('protocol')}
        index="02"
        label="protocol"
        state={stateOf(2)}
        armed={armed}
        fill={false}
      >
        <ValueProp />
      </Scene>
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
