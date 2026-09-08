import { useMemo, useState } from 'react'
import type { Displacement } from '../../types'
import CodeBlock from '../CodeBlock'

interface Props {
  displacement: Displacement
}

type Mode = 'split' | 'wipe'

export default function DisplacementView({ displacement: d }: Props) {
  const [mode, setMode] = useState<Mode>('split')
  const [wipe, setWipe] = useState(50)

  const beforeNotes = useMemo(() => annotationMap(d, 'before'), [d])
  const afterNotes = useMemo(() => annotationMap(d, 'after'), [d])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div>
            <span className="label">replaces</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {d.replaces.map((r) => (
                <span
                  key={r}
                  className="rounded border border-[var(--sig-hype)]/50 bg-[var(--sig-hype)]/10 px-2.5 py-1 font-mono text-[0.84rem] font-medium text-[var(--sig-hype)]"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="label">does not replace</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {d.doesNotReplace.map((r) => (
                <span
                  key={r}
                  className="rounded border border-[var(--line-hi)] px-2.5 py-1 font-mono text-[0.84rem] text-[var(--txt-dim)]"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-1 rounded-lg border border-[var(--line)] p-1">
          {(['split', 'wipe'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="rounded px-3 py-1.5 font-mono text-[0.78rem] font-semibold tracking-widest uppercase transition-all"
              style={{
                background: mode === m ? 'var(--panel-hi)' : 'transparent',
                color: mode === m ? 'var(--amber)' : 'var(--txt-faint)',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === 'split' ? (
        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <Pane label={d.before.label} tone="before">
            <CodeBlock
              code={d.before.snippet}
              lang={d.before.lang}
              file={d.before.file}
              url={d.before.url}
              annotations={beforeNotes}
              maxHeight={420}
            />
          </Pane>
          <Pane label={d.after.label} tone="after">
            <CodeBlock
              code={d.after.snippet}
              lang={d.after.lang}
              file={d.after.file}
              url={d.after.url}
              annotations={afterNotes}
              maxHeight={420}
            />
          </Pane>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded border border-[var(--line)]">
            <div>
              <PaneHeader label={d.before.label} tone="before" />
              <CodeBlock code={d.before.snippet} lang={d.before.lang} maxHeight={420} />
            </div>
            <div
              className="absolute inset-0 bg-[var(--bg)]"
              style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}
            >
              <PaneHeader label={d.after.label} tone="after" />
              <CodeBlock code={d.after.snippet} lang={d.after.lang} maxHeight={420} />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-[var(--amber)]"
              style={{ left: `${wipe}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={wipe}
            onChange={(e) => setWipe(Number(e.target.value))}
            aria-label="Wipe between the old approach and the new one"
            className="h-2 w-full cursor-ew-resize accent-[var(--amber)]"
          />
          <div className="flex justify-between font-mono text-[0.8rem] text-[var(--txt-dim)]">
            <span>&larr; {d.before.label}</span>
            <span>{d.after.label} &rarr;</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ListPanel
          title="what disappears"
          tone="var(--sig-real)"
          glyph="-"
          items={d.whatDisappears}
        />
        <ListPanel
          title="what you now pay for"
          tone="var(--sig-unproven)"
          glyph="+"
          items={d.newCosts}
        />
      </div>
    </div>
  )
}

function annotationMap(d: Displacement, side: 'before' | 'after') {
  const out: Record<number, string> = {}
  for (const a of d.annotations) {
    if (a.side !== side) continue
    for (const line of a.lines) out[line] = a.note
  }
  return Object.keys(out).length ? out : undefined!
}

function PaneHeader({ label, tone }: { label: string; tone: 'before' | 'after' }) {
  const color = tone === 'before' ? 'var(--sig-hype)' : 'var(--sig-real)'
  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span
        className="font-mono text-[0.78rem] font-bold tracking-widest uppercase"
        style={{ color }}
      >
        {tone}
      </span>
      <span className="truncate text-[0.92rem] text-[var(--txt-dim)]">{label}</span>
    </div>
  )
}

function Pane({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'before' | 'after'
  children: React.ReactNode
}) {
  // min-w-0: as a grid child this would otherwise refuse to shrink below the
  // code table's intrinsic width and push the whole page sideways on mobile.
  return (
    <div className="min-w-0 space-y-2">
      <div className="overflow-hidden rounded border border-[var(--line)]">
        <PaneHeader label={label} tone={tone} />
        {children}
      </div>
    </div>
  )
}

function ListPanel({
  title,
  tone,
  glyph,
  items,
}: {
  title: string
  tone: string
  glyph: string
  items: string[]
}) {
  return (
    <div className="panel rounded-lg p-5">
      <span className="label" style={{ color: tone }}>
        {title}
      </span>
      <ul className="mt-3 space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex gap-3 text-[0.98rem] leading-relaxed text-[var(--txt-dim)]">
            <span className="mt-0.5 font-mono font-bold" style={{ color: tone }}>
              {glyph}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
