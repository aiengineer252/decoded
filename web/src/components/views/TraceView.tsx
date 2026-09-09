import { useCallback, useEffect, useState } from 'react'
import type { Architecture, ExecutionTrace, TraceValue } from '../../types'
import { useReadingLevel } from '../../lib/readingLevel'
import CodeWalkthrough from '../CodeWalkthrough'

interface Props {
  trace: ExecutionTrace
  architecture: Architecture
}

/**
 * The step debugger. This is the view that does the real work of the site:
 * instead of asserting what a system does, it walks a concrete input through
 * it and shows the intermediate value at every stage.
 */
export default function TraceView({ trace, architecture }: Props) {
  const { level } = useReadingLevel()
  const [step, setStep] = useState(0)
  const [running, setRunning] = useState(false)
  const last = trace.steps.length - 1

  const next = useCallback(() => setStep((s) => Math.min(s + 1, last)), [last])
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), [])

  useEffect(() => {
    if (!running) return
    if (step >= last) {
      setRunning(false)
      return
    }
    const t = setTimeout(next, 2000)
    return () => clearTimeout(t)
  }, [running, step, last, next])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'j') next()
      if (e.key === 'ArrowLeft' || e.key === 'k') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  const current = trace.steps[step]
  const node = architecture.nodes.find((n) => n.id === current.nodeId)
  const done = step >= last

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-[1rem] leading-relaxed text-[var(--txt-dim)]">
          {trace.caption ?? 'One real input, stepped through the system stage by stage.'}
          {level === 'beginner' && (
            <span className="mt-1.5 block text-[0.92rem] text-[var(--txt-faint)]">
              Think of it as a debugger: press &ldquo;run&rdquo; and watch one example travel
              through each part. The <span className="font-mono">in</span> and{' '}
              <span className="font-mono">out</span> boxes show the actual data before and after
              each step.
            </span>
          )}
        </p>

        <div className="flex items-center gap-2">
          <button onClick={prev} disabled={step === 0} className="ctl">
            &larr; step
          </button>
          <button
            onClick={() => {
              if (done) setStep(0)
              setRunning((r) => !r)
            }}
            className="ctl ctl-primary"
          >
            {running ? '|| pause' : done ? '<< replay' : '|> run trace'}
          </button>
          <button onClick={next} disabled={done} className="ctl">
            step &rarr;
          </button>
        </div>
      </div>

      {/* scrubber — clickable, labelled, and wide enough to hit */}
      <div className="flex items-center gap-4">
        <span className="shrink-0 font-mono text-[0.86rem] font-bold text-[var(--amber)]">
          {String(step + 1).padStart(2, '0')}
          <span className="text-[var(--txt-faint)]">/{String(trace.steps.length).padStart(2, '0')}</span>
        </span>
        <div className="flex h-2.5 flex-1 gap-1.5">
          {trace.steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setStep(i)
                setRunning(false)
              }}
              title={s.label}
              aria-label={`Step ${i + 1}: ${s.label}`}
              className="h-full flex-1 rounded-full transition-all duration-500 hover:opacity-80"
              style={{
                background:
                  i < step ? 'var(--amber-dim)' : i === step ? 'var(--amber)' : 'var(--line-hi)',
                transform: i === step ? 'scaleY(1.5)' : undefined,
                boxShadow: i === step ? '0 0 12px var(--amber)' : undefined,
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[270px_1fr] [&>*]:min-w-0">
        {/* step list */}
        <ol className="panel h-fit overflow-hidden rounded-lg">
          <li className="border-b border-[var(--line)] px-4 py-3">
            <span className="label">input</span>
            <div className="mt-1 truncate font-mono text-[0.82rem] text-[var(--txt-dim)]">
              {trace.input.type}
            </div>
          </li>

          {trace.steps.map((s, i) => {
            const active = i === step
            const complete = i < step
            return (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setStep(i)
                    setRunning(false)
                  }}
                  className="flex w-full items-start gap-3 border-b border-[var(--line)] px-4 py-3 text-left transition-colors hover:bg-[var(--panel-hi)]"
                  style={{
                    background: active ? 'var(--panel-hi)' : undefined,
                    borderLeft: `3px solid ${active ? 'var(--amber)' : 'transparent'}`,
                  }}
                >
                  <span
                    className="mt-0.5 font-mono text-[0.8rem] font-bold transition-colors"
                    style={{
                      color: active
                        ? 'var(--amber)'
                        : complete
                          ? 'var(--sig-real)'
                          : 'var(--txt-faint)',
                    }}
                  >
                    {active ? '>' : complete ? 'x' : String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="text-[0.9rem] leading-snug"
                    style={{
                      color: active ? 'var(--txt)' : 'var(--txt-dim)',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {s.label}
                  </span>
                </button>
              </li>
            )
          })}

          <li className="px-4 py-3">
            <span className="label">result</span>
            <div
              className="mt-1 truncate font-mono text-[0.82rem] transition-opacity"
              style={{
                color: done ? 'var(--sig-real)' : 'var(--txt-dim)',
                opacity: done ? 1 : 0.45,
              }}
            >
              {trace.result.type}
            </div>
          </li>
        </ol>

        {/* current step — remounts on change so the whole panel animates in */}
        <div key={current.id} className="rise space-y-4">
          <div className="panel rounded-lg p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-[0.84rem] font-bold tracking-widest text-[var(--amber)] uppercase">
                step {String(step + 1).padStart(2, '0')}
              </span>
              {node && (
                <span className="font-mono text-[0.82rem] text-[var(--txt-faint)]">
                  @ {node.label}
                </span>
              )}
              {current.cost && (
                <span className="ml-auto rounded bg-[var(--bg-raised)] px-2 py-1 font-mono text-[0.78rem] text-[var(--txt-dim)]">
                  {current.cost}
                </span>
              )}
            </div>
            <h4 className="mt-2 text-[1.5rem] leading-tight font-semibold">{current.label}</h4>
            <p key={level} className="rise mt-2.5 text-[1.02rem] leading-relaxed text-[var(--txt-dim)]">
              {level === 'beginner' && current.plain ? current.plain : current.note}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
            <ValuePanel title="in" value={current.input ?? trace.input} />
            <ValuePanel title="out" value={current.output} accent />
          </div>

          {current.code && <CodeWalkthrough code={current.code} maxHeight={400} />}
        </div>
      </div>

      {/* the payoff, revealed once the reader reaches the end */}
      {done && (
        <div className="rise rounded-lg border border-[var(--sig-real)]/40 bg-[var(--sig-real)]/5 p-5">
          <span className="label" style={{ color: 'var(--sig-real)' }}>
            result
          </span>
          <div className="mt-1.5 font-mono text-[0.82rem] text-[var(--txt-faint)]">
            {trace.result.type}
          </div>
          <pre className="mt-2.5 overflow-auto font-mono text-[0.9rem] leading-relaxed whitespace-pre-wrap text-[var(--txt)]">
            {trace.result.preview}
          </pre>
        </div>
      )}

      <style>{`
        .ctl {
          font-family: var(--font-mono);
          font-size: .78rem; font-weight: 600;
          letter-spacing: .12em; text-transform: uppercase;
          color: var(--txt-dim);
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: .45rem .75rem;
          transition: all .2s ease;
        }
        .ctl:hover:not(:disabled) {
          color: var(--amber); border-color: var(--amber);
          transform: translateY(-1px);
        }
        .ctl:disabled { opacity: .3; cursor: default; }
        .ctl-primary { color: var(--amber); border-color: var(--amber); background: rgb(255 176 32 / .08); }
        .ctl-primary:hover { background: rgb(255 176 32 / .16); }
      `}</style>
    </div>
  )
}

function ValuePanel({
  title,
  value,
  accent,
}: {
  title: string
  value?: TraceValue
  accent?: boolean
}) {
  return (
    <div
      className="panel overflow-hidden rounded-lg"
      style={accent ? { borderColor: 'rgb(255 176 32 / .35)' } : undefined}
    >
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3.5 py-2">
        <span className="label" style={accent ? { color: 'var(--amber)' } : undefined}>
          {title}
        </span>
        <span className="truncate pl-3 font-mono text-[0.78rem] text-[var(--txt-faint)]">
          {value?.type ?? '—'}
        </span>
      </div>
      <pre className="max-h-64 overflow-auto px-3.5 py-3 font-mono text-[0.86rem] leading-relaxed whitespace-pre-wrap text-[var(--code-plain)]">
        {value?.preview ?? '—'}
        {value?.truncated && <span className="text-[var(--txt-faint)]">{'\n… truncated'}</span>}
      </pre>
    </div>
  )
}
