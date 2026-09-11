import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArchNode, Architecture, NodeKind } from '../../types'
import { useReadingLevel } from '../../lib/readingLevel'
import CodeWalkthrough from '../CodeWalkthrough'

const W = 226
const H = 108
const GAP_X = 92
const GAP_Y = 44
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

const KIND_PLAIN: Record<NodeKind, string> = {
  input: 'where data comes in',
  compute: 'does work on the data',
  store: 'holds data',
  model: 'a neural network',
  output: 'what comes out',
  control: 'makes a decision',
}

interface Props {
  architecture: Architecture
}

export default function ArchitectureView({ architecture }: Props) {
  const { nodes, edges, flow, caption } = architecture
  const { level } = useReadingLevel()
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [pulseIdx, setPulseIdx] = useState(0)
  const detailRef = useRef<HTMLDivElement>(null)

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
  const flowIndex = (id: string) => flow.indexOf(id)

  /**
   * Everything one hop from the focused node, in either direction. Used to
   * recede the rest of the graph so a reader can answer "what does this talk
   * to" by looking instead of tracing lines by eye.
   */
  const focus = useMemo(() => {
    const id = hovered ?? selected
    if (!id) return null
    const keepNodes = new Set<string>([id])
    const keepEdges = new Set<number>()
    edges.forEach((e, i) => {
      if (e.from === id || e.to === id) {
        keepEdges.add(i)
        keepNodes.add(e.from)
        keepNodes.add(e.to)
      }
    })
    return { id, keepNodes, keepEdges }
  }, [hovered, selected, edges])

  const path = (from: ArchNode, to: ArchNode) => {
    const a = pos(from)
    const b = pos(to)
    const x0 = a.x + W
    const y0 = a.y + H / 2
    const x1 = b.x
    const y1 = b.y + H / 2

    if (x1 < x0) {
      const dip = Math.max(a.y, b.y) + H + GAP_Y * 0.6
      return `M ${a.x + W / 2} ${a.y + H} C ${a.x + W / 2} ${dip}, ${b.x + W / 2} ${dip}, ${b.x + W / 2} ${b.y + H}`
    }
    const mid = (x0 + x1) / 2
    return `M ${x0} ${y0} C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}`
  }

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

      {level === 'beginner' && (
        <p className="rise rounded-lg border border-[var(--line)] bg-[var(--bg-raised)] px-4 py-3 text-[0.94rem] leading-relaxed text-[var(--txt-dim)]">
          <span className="font-semibold text-[var(--txt)]">How to read this: </span>
          the diagram draws itself in the order data actually moves. Each box is one part of the
          system; the moving dots follow the main path. Hover a box to see only what it connects to,
          and click it for a plain explanation and the real code.
        </p>
      )}

      <div
        data-reveal="graph"
        className="panel relative overflow-x-auto rounded-lg p-1"
        onMouseLeave={() => setHovered(null)}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block min-w-full"
          style={{ maxWidth: '100%' }}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line-hi)" />
            </marker>
            <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amber)" />
            </marker>
          </defs>

          {edges.map((e, i) => {
            const from = byId.get(e.from)
            const to = byId.get(e.to)
            if (!from || !to) return null
            const onFlow = isFlowEdge(e.from, e.to)
            const hot = playing && e.from === prevId && e.to === activeId
            const d = path(from, to)
            const dimmed = focus ? !focus.keepEdges.has(i) : false

            // Edges draw in the order the data travels: an edge that is the
            // nth hop of the happy path waits for the n-1 hops before it.
            const order = Math.max(flowIndex(e.from), 0)
            const delay = 260 + order * 180

            return (
              <g key={i} className={dimmed ? 'arch-dim' : undefined}>
                <path
                  d={d}
                  className="arch-edge"
                  pathLength={1}
                  strokeDasharray={1}
                  style={{ transitionDelay: `${delay}ms` }}
                  fill="none"
                  stroke={hot ? 'var(--amber)' : 'var(--line-hi)'}
                  strokeWidth={hot ? 2.2 : 1.5}
                  markerEnd={hot ? 'url(#arrow-hot)' : 'url(#arrow)'}
                  opacity={hot ? 1 : 0.8}
                />

                {/* Dashes ride on a second copy so the draw-on transition is
                    not fighting a dasharray animation on the same element. */}
                {(hot || e.kind === 'dashed') && (
                  <path
                    d={d}
                    fill="none"
                    stroke={hot ? 'var(--amber)' : 'var(--line-hi)'}
                    strokeWidth={hot ? 2.2 : 1.5}
                    strokeDasharray={e.kind === 'dashed' ? '6 6' : undefined}
                    className={hot ? 'edge-flowing' : undefined}
                    opacity={hot ? 1 : 0.55}
                  />
                )}

                {playing && onFlow && !dimmed && (
                  <circle r={4.5} fill="var(--amber)" opacity={0.95}>
                    <animateMotion dur="2.4s" repeatCount="indefinite" path={d} begin={`${order * 0.35}s`} />
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

          {nodes.map((n) => {
            const p = pos(n)
            const color = KIND_COLOR[n.kind]
            const isActive = playing && n.id === activeId
            const isSelected = n.id === selected
            const isHovered = n.id === hovered
            const dimmed = focus ? !focus.keepNodes.has(n.id) : false
            const [s1, s2] = wrap2(n.summary, 30)
            const order = flowIndex(n.id)
            const delay = 180 + Math.max(order, 0) * 180

            return (
              <g
                key={n.id}
                transform={`translate(${p.x} ${p.y})`}
                className={`arch-node${dimmed ? ' arch-dim' : ''}`}
                style={{ transitionDelay: `${delay}ms` }}
                onMouseEnter={() => setHovered(n.id)}
                onClick={() => {
                  setSelected((s) => (s === n.id ? null : n.id))
                  setPlaying(false)
                  setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
                }}
              >
                <rect
                  width={W}
                  height={H}
                  rx={8}
                  fill={isSelected ? 'var(--panel-hi)' : 'var(--bg-raised)'}
                  stroke={isSelected || isActive || isHovered ? color : 'var(--line-hi)'}
                  strokeWidth={isSelected ? 2.2 : isHovered ? 1.9 : 1.3}
                  style={{
                    filter:
                      isActive || isSelected || isHovered ? `drop-shadow(0 0 14px ${color}55)` : undefined,
                    transition: 'stroke .25s ease, filter .25s ease, stroke-width .25s ease',
                    cursor: 'pointer',
                  }}
                />
                <rect width={4} height={H} rx={2} fill={color} opacity={isSelected ? 1 : 0.8} />

                <text x={15} y={22} className="font-mono" fontSize={10.5} fontWeight={700} letterSpacing="0.14em" fill={color}>
                  {KIND_GLYPH[n.kind]} {n.kind.toUpperCase()}
                </text>

                {order >= 0 && (
                  <g transform={`translate(${W - 26} 9)`}>
                    <rect width={18} height={18} rx={9} fill={isActive ? 'var(--amber)' : 'var(--panel-hi)'} stroke={isActive ? 'var(--amber)' : 'var(--line-hi)'} />
                    <text x={9} y={13} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={700} fill={isActive ? '#07090c' : 'var(--txt-dim)'}>
                      {order + 1}
                    </text>
                  </g>
                )}

                <text x={15} y={47} fontSize={15.5} fill="var(--txt)" fontWeight={600} style={{ pointerEvents: 'none' }}>
                  {truncate(n.label, 22)}
                </text>
                <text x={15} y={69} fontSize={12.5} fill="var(--txt-dim)" style={{ pointerEvents: 'none' }}>{s1}</text>
                {s2 && <text x={15} y={87} fontSize={12.5} fill="var(--txt-dim)" style={{ pointerEvents: 'none' }}>{s2}</text>}

                {n.code && (
                  <text x={W - 34} y={H - 12} textAnchor="end" className="font-mono" fontSize={11} fontWeight={700} fill={isSelected ? color : 'var(--txt-faint)'} style={{ pointerEvents: 'none' }}>
                    {'{ }'}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(Object.keys(KIND_COLOR) as NodeKind[])
          .filter((k) => nodes.some((n) => n.kind === k))
          .map((k) => (
            <span key={k} className="flex items-center gap-2 font-mono text-[0.78rem] text-[var(--txt-dim)]">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[k] }} />
              {k}
              {level === 'beginner' && <span className="text-[var(--txt-faint)]">— {KIND_PLAIN[k]}</span>}
            </span>
          ))}
        <span className="ml-auto font-mono text-[0.78rem] text-[var(--txt-faint)]">
          {focus ? (
            <span className="text-[var(--amber)]">showing connections only</span>
          ) : (
            <>
              <span className="text-[var(--amber)]">{'{ }'}</span> = real code inside
            </>
          )}
        </span>
      </div>

      <div ref={detailRef}>
        {selectedNode ? (
          <div className="rise space-y-4 rounded-lg border border-[var(--line-hi)] bg-[var(--panel)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="label mb-1.5" style={{ color: KIND_COLOR[selectedNode.kind] }}>
                  {selectedNode.kind}
                  {level === 'beginner' && <span className="text-[var(--txt-faint)]"> · {KIND_PLAIN[selectedNode.kind]}</span>}
                </div>
                <h4 className="text-[1.5rem] leading-tight font-semibold">{selectedNode.label}</h4>
                <p key={level} className="rise mt-2 max-w-3xl text-[1.02rem] leading-relaxed text-[var(--txt-dim)]">
                  {level === 'beginner' && selectedNode.plain
                    ? selectedNode.plain
                    : (selectedNode.detail ?? selectedNode.summary)}
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
              <CodeWalkthrough code={selectedNode.code} maxHeight={440} />
            ) : (
              <p className="rounded border border-dashed border-[var(--line)] px-4 py-3 font-mono text-[0.86rem] text-[var(--txt-faint)]">
                No code extracted for this component — it is described in prose in the source only.
              </p>
            )}

            {selectedNode.sourceUrl && (
              <a href={selectedNode.sourceUrl} target="_blank" rel="noreferrer" className="underline-grow inline-block font-mono text-[0.86rem] font-semibold text-[var(--amber)]">
                verify this claim &rarr;
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--line-hi)] px-4 py-8 text-center">
            <p className="font-mono text-[0.9rem] text-[var(--txt-dim)]">
              <span className="text-[var(--amber)]">&uarr;</span> hover a box to isolate it, or open{' '}
              <button
                onClick={() => { setSelected(flow[0]); setPlaying(false) }}
                className="underline-grow font-semibold text-[var(--amber)]"
              >
                {byId.get(flow[0])?.label ?? 'the first one'}
              </button>
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

function wrap2(s: string, n: number): [string, string | null] {
  if (s.length <= n) return [s, null]
  const cut = s.lastIndexOf(' ', n)
  const at = cut > n * 0.5 ? cut : n
  const first = s.slice(0, at).trim()
  const rest = s.slice(at).trim()
  return [first, rest.length > n ? rest.slice(0, n - 1) + '…' : rest]
}
