import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CodeRef } from '../types'
import { useReadingLevel } from '../lib/readingLevel'
import CodeBlock from './CodeBlock'

interface Props {
  code: CodeRef
  maxHeight?: number
  /** Start auto-advancing immediately. Off by default — motion the reader did not ask for is noise. */
  autoplay?: boolean
}

const STOP_MS = 4200

/**
 * A guided tour through a snippet. The full code is always visible for
 * context; each stop spotlights its lines, drops a comment-style note under
 * them, and the reader steps forward when ready.
 *
 * Falls back to a plain CodeBlock when the CodeRef has no walkthrough, so call
 * sites never need to branch.
 */
export default function CodeWalkthrough({ code, maxHeight = 460, autoplay = false }: Props) {
  const stops = code.walkthrough ?? []
  const { level } = useReadingLevel()
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const last = stops.length - 1

  const next = useCallback(() => setI((n) => Math.min(n + 1, last)), [last])
  const prev = useCallback(() => setI((n) => Math.max(n - 1, 0)), [])

  useEffect(() => {
    if (!playing) return
    if (i >= last) {
      setPlaying(false)
      return
    }
    const t = setTimeout(next, STOP_MS)
    return () => clearTimeout(t)
  }, [playing, i, last, next])

  const stop = stops[i]
  const callouts = useMemo(() => {
    if (!stop) return undefined
    const text = level === 'beginner' && stop.plain ? stop.plain : stop.note
    // Hang the note under the last spotlighted line: the reader has just
    // finished reading the lines when they reach it.
    return { [Math.max(...stop.lines)]: text }
  }, [stop, level])

  if (stops.length === 0) {
    return (
      <CodeBlock
        code={code.snippet}
        lang={code.lang}
        file={code.file}
        url={code.url}
        focus={code.focus}
        maxHeight={maxHeight}
      />
    )
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      // Do not let the trace view's window-level stepper hear this too.
      e.stopPropagation()
      e.preventDefault()
      setPlaying(false)
      if (e.key === 'ArrowRight') next()
      else prev()
    }
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={onKey}
      className="space-y-2.5 outline-none focus-visible:ring-1 focus-visible:ring-[var(--amber)]/50 rounded-lg"
      aria-label="Guided code walkthrough"
    >
      {/* control strip */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[0.78rem] font-bold tracking-widest text-[var(--amber)] uppercase">
          walkthrough
        </span>
        <span className="font-mono text-[0.8rem] text-[var(--txt-faint)]">
          {String(i + 1).padStart(2, '0')}/{String(stops.length).padStart(2, '0')}
        </span>
        <span key={i} className="rise text-[0.95rem] font-semibold text-[var(--txt)]">
          {stop.title}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <WalkBtn onClick={() => { setPlaying(false); prev() }} disabled={i === 0}>
            &larr;
          </WalkBtn>
          <WalkBtn
            primary
            onClick={() => {
              if (i >= last) setI(0)
              setPlaying((p) => !p)
            }}
          >
            {playing ? '|| pause' : i >= last ? '<< again' : '|> play'}
          </WalkBtn>
          <WalkBtn onClick={() => { setPlaying(false); next() }} disabled={i === last}>
            &rarr;
          </WalkBtn>
        </div>
      </div>

      {/* progress rail — one segment per stop, the active one fills over the
          autoplay interval so the reader can see when it will move on */}
      <div className="flex h-1.5 gap-1">
        {stops.map((s, k) => (
          <button
            key={k}
            title={s.title}
            aria-label={`Stop ${k + 1}: ${s.title}`}
            onClick={() => { setPlaying(false); setI(k) }}
            className="relative h-full flex-1 overflow-hidden rounded-full bg-[var(--line-hi)]"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--amber)]"
              style={{
                width: k < i ? '100%' : k === i ? (playing ? '100%' : '100%') : '0%',
                opacity: k < i ? 0.55 : 1,
                transition:
                  k === i && playing
                    ? `width ${STOP_MS}ms linear`
                    : 'width .25s ease, opacity .25s ease',
                ...(k === i && playing ? { animation: `fill-rail ${STOP_MS}ms linear` } : {}),
              }}
            />
          </button>
        ))}
      </div>

      <CodeBlock
        code={code.snippet}
        lang={code.lang}
        file={code.file}
        url={code.url}
        focus={stop.lines}
        callouts={callouts}
        spotlight
        scrollToFocus
        maxHeight={maxHeight}
      />

      <p className="font-mono text-[0.74rem] text-[var(--txt-faint)]">
        click the code, then &larr; &rarr; to step
      </p>
    </div>
  )
}

function WalkBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border px-2.5 py-1 font-mono text-[0.76rem] font-semibold tracking-wider uppercase transition-all hover:-translate-y-px disabled:cursor-default disabled:opacity-30"
      style={{
        borderColor: primary ? 'var(--amber)' : 'var(--line)',
        color: primary ? 'var(--amber)' : 'var(--txt-dim)',
        background: primary ? 'rgb(255 176 32 / .08)' : 'transparent',
      }}
    >
      {children}
    </button>
  )
}
