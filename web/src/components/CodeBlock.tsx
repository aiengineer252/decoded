import { useEffect, useMemo, useRef, useState } from 'react'
import { TOKEN_CLASS, tokenizeLine, type Lang } from '../lib/highlight'

export interface CodeBlockProps {
  code: string
  lang: Lang
  /** Shown in the header strip. */
  file?: string
  /** Makes the header filename a link back to the real source. */
  url?: string
  /** 1-indexed lines to keep bright; everything else dims. */
  focus?: number[]
  /** 1-indexed line -> note text, rendered in the right gutter (diff views). */
  annotations?: Record<number, string>
  /**
   * 1-indexed line -> note, rendered inline directly beneath that line in the
   * style of a comment. Used by the walkthrough: the explanation sits where
   * the eye already is, instead of in a panel somewhere else.
   */
  callouts?: Record<number, string>
  /**
   * Stronger treatment for `focus` lines: an amber bar slides in on the left
   * and everything else dims harder. For "look at exactly this" moments.
   */
  spotlight?: boolean
  /** Scroll the first focus line into view whenever focus changes. */
  scrollToFocus?: boolean
  /** Render leading +/- as diff shading and strip them from the code text. */
  diff?: boolean
  /** Caps height and scrolls instead of growing the page. */
  maxHeight?: number
  startLine?: number
}

export default function CodeBlock({
  code,
  lang,
  file,
  url,
  focus,
  annotations,
  callouts,
  spotlight = false,
  scrollToFocus = false,
  diff = false,
  maxHeight,
  startLine = 1,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lines = useMemo(() => code.replace(/\n$/, '').split('\n'), [code])
  const focusSet = useMemo(() => (focus?.length ? new Set(focus) : null), [focus])
  const focusKey = focus?.join(',') ?? ''

  // Keep the spotlighted lines visible as a walkthrough advances. `nearest`
  // rather than `center` so the reader's scroll position is disturbed as
  // little as possible when the next stop is already on screen.
  useEffect(() => {
    if (!scrollToFocus || !focus?.length || !scrollRef.current) return
    const first = Math.min(...focus)
    const row = scrollRef.current.querySelector<HTMLElement>(`[data-line="${first}"]`)
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, scrollToFocus])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diff ? lines.map((l) => l.slice(1)).join('\n') : code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked — the code is selectable anyway */
    }
  }

  const hasGutterNotes = !!annotations

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-raised)]">
      {(file || url) && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-3.5 py-2">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="underline-grow truncate font-mono text-[0.82rem] text-[var(--txt-dim)] transition-colors hover:text-[var(--amber)]"
            >
              {file ?? url}
            </a>
          ) : (
            <span className="truncate font-mono text-[0.82rem] text-[var(--txt-dim)]">{file}</span>
          )}
          <button
            onClick={copy}
            className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.72rem] font-semibold tracking-widest uppercase transition-all"
            style={{
              color: copied ? 'var(--sig-real)' : 'var(--txt-faint)',
              background: copied ? 'rgb(74 222 128 / 0.12)' : 'transparent',
            }}
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      )}

      <div ref={scrollRef} className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse font-mono text-[0.92rem] leading-[1.8]">
          <tbody>
            {lines.map((raw, idx) => {
              const lineNo = idx + startLine
              const isAdd = diff && raw.startsWith('+')
              const isDel = diff && raw.startsWith('-')
              const text = diff && (isAdd || isDel || raw.startsWith(' ')) ? raw.slice(1) : raw
              const lit = focusSet ? focusSet.has(lineNo) : true
              const note = annotations?.[lineNo]
              const callout = callouts?.[lineNo]
              const cols = 2 + (hasGutterNotes ? 1 : 0)

              return (
                <FragmentRow key={idx}>
                  <tr
                    data-line={lineNo}
                    style={{
                      background: isAdd
                        ? 'var(--add)'
                        : isDel
                          ? 'var(--del)'
                          : spotlight && lit && focusSet
                            ? 'rgb(255 176 32 / 0.07)'
                            : undefined,
                      boxShadow: spotlight && lit && focusSet ? 'inset 3px 0 0 var(--amber)' : undefined,
                      opacity: lit ? 1 : spotlight ? 0.28 : 0.4,
                      transition: 'opacity .35s ease, background-color .35s ease, box-shadow .35s ease',
                    }}
                  >
                    <td className="w-11 shrink-0 border-r border-[var(--line)] px-2.5 text-right align-top text-[var(--txt-faint)] select-none">
                      {diff ? (isAdd ? '+' : isDel ? '-' : '') || lineNo : lineNo}
                    </td>
                    <td className="w-full px-3.5 align-top whitespace-pre">
                      {tokenizeLine(text, lang).map((t, i) => (
                        <span key={i} className={TOKEN_CLASS[t.type]}>
                          {t.value}
                        </span>
                      ))}
                    </td>
                    {hasGutterNotes && (
                      <td className="w-[38%] max-w-[300px] border-l border-[var(--line)] px-3.5 py-1 align-top">
                        {note && (
                          <span className="slide-in block font-sans text-[0.82rem] leading-snug font-medium text-[var(--amber-soft)]">
                            {note}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* Inline callout: reads as a comment the author left for you
                      on exactly this line, and animates in so the eye lands on
                      it after the line, not before. */}
                  {callout && (
                    <tr>
                      <td className="border-r border-[var(--line)] select-none" />
                      <td colSpan={cols - 1} className="px-3.5 pt-0.5 pb-2.5">
                        <div className="callout-in flex gap-2.5 rounded-md border border-[var(--amber)]/35 bg-[var(--amber)]/8 px-3 py-2">
                          <span className="mt-0.5 shrink-0 font-mono text-[0.78rem] font-bold text-[var(--amber)]">
                            //
                          </span>
                          <span className="font-sans text-[0.9rem] leading-relaxed whitespace-normal text-[var(--txt)]">
                            {callout}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** A keyed fragment; tbody children must be <tr>, so this cannot be a div. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
