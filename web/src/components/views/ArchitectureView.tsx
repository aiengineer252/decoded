import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArchNode, Architecture, NodeKind } from '../../types'
import CodeBlock from '../CodeBlock'

const W = 212
const H = 88
const GAP_X = 92
const GAP_Y = 40
const PAD = 20

const KIND_COLOR: Record<NodeKind, string> = {
  input: '#8fd2ff',
  compute: '#ffb020',
  store: '#c58cff',
  model: '#4ade80',
  output: '#ff9a4d',
  control: '#9aa8b8',
}

const KIND_GLYPH: Record<NodeKind, string> = {
  input: '>',
  compute: '*',
  store: '=',
  model: '@',
  output: '<',
  control: '?',
}

interface Props {
  architecture: Architecture
}

export default function ArchitectureView({ architecture }: Props) {
  const { nodes, edges, flow, caption } = architecture
  const [selected, setSelected] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [pulseIdx, setPulseIdx] = useState(0)
  const detailRef = useRef<HTMLDivElement>(null)

  // The pulse walks the happy path so the diagram reads as a system in motion,
  // not a static picture. Pausing is one click away for readers who find
  // movement distracting.
  useEffect(() => {
    if (!playing || flow.length === 0) return
    const t = setInterval(() => setPulseIdx((i) => (i + 1) % flow.length), 1000)
    return () => clearInterval(t)
  }, [playing, flow.length])

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const cols = Math.max(...nodes.map((n) => n.col)) + 1
  const rows = Math.max(...nodes.map((n) => n.row)) + 1
  const width = cols * W + (cols - 1) * GAP_X + PAD * 2
  const height = rows * H + (rows - 1) * GAP_Y + PAD * 2

  const pos = (n: ArchNode) => ({
    x: PAD + n.col * (W + GAP_X),
    y: PAD + n.row * (H + GAP_Y),
  })

  const activeId = flow[pulseIdx]
  const prevId = flow[(pulseIdx - 1 + flow.length) % flow.length]
  const selectedNode = selected ? byId.get(selected) : null

  const path = (from: ArchNode, to: ArchNode) => {
    const a = pos(from)
    const b = pos(to)
    const x0 = a.x + W
    const y0 = a.y + H / 2
    const x1 = b.x
    const y1 = b.y + H / 2

    // Backwards edge (a feedback loop): route it under the row.
    if (x1 < x0) {
      const dip = Math.max(a.y, b.y) + H + GAP_Y * 0.6
      return `M ${a.x + W / 2} ${a.y + H} C ${a.x + W / 2} ${dip}, ${b.x + W / 2} ${dip}, ${b.x + W / 2} ${b.y + H}`
    }
    const mid = (x0 + x1) / 2
    return `M ${x0} ${y0} C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}`
  }

  const flowIndex = (id: string) => flow.indexOf(id)
  const isFlowEdge = (fromId: string, toId: string) =>
    flowIndex(fromId) >= 0 && flowIndex(toId) === flowIndex(fromId) + 1

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-[1rem] leading-relaxed text-[var(--txt-dim)]">
          {caption ?? 'Click any box to see the code that implements it.'}
        </p>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="shrink-0 rounded border border-[var(--line)] px-3 py-1.5 font-mono text-[0.78rem] font-semibold tracking-widest text-[var(--txt-dim)] uppercase transition-colors hover:border-[var(--amber)] hover:text-[var(--amber)]"
        >
          {playing ? '|| pause flow' : '|> play flow'}
        </button>
      </div>

      <div className="panel relative overflow-x-auto rounded-lg p-1">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block min-w-full"
          style={{ maxWidth: '100%' }}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line-hi)" />
            </marker>
            <marker
              id="arrow-hot"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amber)" />
            </marker>
          </defs>

          {/* edges */}
          {edges.map((e, i) => {
            const from = byId.get(e.from)
            const to = byId.get(e.to)
            if (!from || !to) return null
            const onFlow = isFlowEdge(e.from, e.to)
            const hot = playing && e.from === prevId && e.to === activeId
            const d = path(from, to)
            return (
              <g key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke={hot ? 'var(--amber)' : 'var(--line-hi)'}
                  strokeWidth={hot ? 2.2 : 1.5}
                  strokeDasharray={e.kind === 'dashed' ? '6 6' : undefined}
                  markerEnd={hot ? 'url(#arrow-hot)' : 'url(#arrow)'}
                  className={hot ? 'edge-flowing' : undefined}
                  opacity={hot ? 1 : 0.8}
                />

                {/* A packet travelling the happy path. This is the single cue
                    that says "data moves through here, in this direction" —
                    it answers the reader's first question before they ask. */}
                {playing && onFlow && (
                  <circle r={4.5} fill="var(--amber)" opacity={0.95}>
                    <animateMotion
                      dur="2.4s"
                      repeatCount="indefinite"
                      path={d}
                      begin={`${flowIndex(e.from) * 0.35}s`}
                    />
                  </circle>
                )}

                {e.label && (
                  <text
                    className="font-mono"
                    fontSize={11}
                    fontWeight={600}
                    fill={hot ? 'var(--amber)' : 'var(--txt-faint)'}
                    textAnchor="middle"
                    x={(pos(from).x + W + pos(to).x) / 2}
                    y={(pos(from).y + pos(to).y) / 2 + H / 2 - 9}
                  >
                    {e.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* nodes */}
          {nodes.map((n) => {
            const p = pos(n)
            const color = KIND_COLOR[n.kind]
            const isActive = playing && n.id === activeId
            const isSelected = n.id === selected
            return (
              <g
                key={n.id}
                transform={`translate(${p.x} ${p.y})`}
                onClick={() => {
                  setSelected((s) => (s === n.id ? null : n.id))
                  setPlaying(false)
                  setTimeout(
                    () => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                    60,
                  )
                }}
                style={{ cursor: 'pointer' }}
                className="transition-opacity"
              >
                <rect
                  width={W}
                  height={H}
                  rx={7}
                  fill={isSelected ? 'var(--panel-hi)' : 'var(--bg-raised)'}
                  stroke={isSelected || isActive ? color : 'var(--line-hi)'}
                  strokeWidth={isSelected ? 2.2 : 1.3}
                  style={{
                    filter:
                      isActive || isSelected ? `drop-shadow(0 0 14px ${color}55)` : undefined,
                    transition: 'stroke .25s ease, filter .25s ease',
                  }}
                />
                <rect width={4} height={H} rx={2} fill={color} opacity={isSelected ? 1 : 0.8} />

                <text
                  x={15}
                  y={23}
                  className="font-mono"
                  fontSize={10.5}
                  fontWeight={700}
                  letterSpacing="0.14em"
                  fill={color}
                >
                  {KIND_GLYPH[n.kind]} {n.kind.toUpperCase()}
                </text>
                <text x={15} y={47} fontSize={15.5} fill="var(--txt)" fontWeight={600}>
                  {truncate(n.label, 21)}
                </text>
                <text x={15} y={68} fontSize={12.5} fill="var(--txt-dim)">
                  {truncate(n.summary, 27)}
                </text>

                {n.code && (
                  <text
                    x={W - 13}
                    y={23}
                    textAnchor="end"
                    className="font-mono"
                    fontSize={11}
                    fontWeight={700}
                    fill={isSelected ? color : 'var(--txt-faint)'}
                  >
                    {'{ }'}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(Object.keys(KIND_COLOR) as NodeKind[])
          .filter((k) => nodes.some((n) => n.kind === k))
          .map((k) => (
            <span
              key={k}
              className="flex items-center gap-2 font-mono text-[0.78rem] text-[var(--txt-dim)]"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[k] }} />
              {k}
            </span>
          ))}
        <span className="ml-auto font-mono text-[0.78rem] text-[var(--txt-faint)]">
          <span className="text-[var(--amber)]">{'{ }'}</span> = code available
        </span>
      </div>

      {/* expanded node */}
      <div ref={detailRef}>
        {selectedNode ? (
          <div className="rise space-y-4 rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="label mb-1.5" style={{ color: KIND_COLOR[selectedNode.kind] }}>
                  {selectedNode.kind}
                </div>
                <h4 className="text-[1.5rem] leading-tight font-semibold">{selectedNode.label}</h4>
                <p className="mt-2 max-w-3xl text-[1rem] leading-relaxed text-[var(--txt-dim)]">
                  {selectedNode.detail ?? selectedNode.summary}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded border border-[var(--line)] px-2.5 py-1 font-mono text-[0.74rem] font-semibold tracking-widest text-[var(--txt-faint)] uppercase transition-colors hover:border-[var(--amber)] hover:text-[var(--amber)]"
              >
                close
              </button>
            </div>

            {selectedNode.code ? (
              <CodeBlock
                code={selectedNode.code.snippet}
                lang={selectedNode.code.lang}
                file={selectedNode.code.file}
                url={selectedNode.code.url}
                focus={selectedNode.code.focus}
                maxHeight={380}
              />
            ) : (
              <p className="rounded border border-dashed border-[var(--line)] px-4 py-3 font-mono text-[0.86rem] text-[var(--txt-faint)]">
                No code extracted for this component — it is described in prose in the source only.
              </p>
            )}

            {selectedNode.sourceUrl && (
              <a
                href={selectedNode.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline-grow inline-block font-mono text-[0.86rem] font-semibold text-[var(--amber)]"
              >
                verify this claim &rarr;
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--line-hi)] px-4 py-8 text-center">
            <p className="font-mono text-[0.9rem] text-[var(--txt-dim)]">
              <span className="text-[var(--amber)]">&uarr;</span> select any node above to expand its
              implementation
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
