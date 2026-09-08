import { useMemo, useState } from 'react'
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
  /** 1-indexed line -> note text, rendered in the right gutter. */
  annotations?: Record<number, string>
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
  diff = false,
  maxHeight,
  startLine = 1,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const lines = useMemo(() => code.replace(/\n$/, '').split('\n'), [code])
  const focusSet = useMemo(() => (focus?.length ? new Set(focus) : null), [focus])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diff ? lines.map((l) => l.slice(1)).join('\n') : code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked — the code is selectable anyway */
    }
  }

  return (
    <div className="overflow-hidden rounded border border-[var(--line)] bg-[var(--bg-raised)]">
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

      <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse font-mono text-[0.86rem] leading-[1.75]">
          <tbody>
            {lines.map((raw, idx) => {
              const lineNo = idx + startLine
              const isAdd = diff && raw.startsWith('+')
              const isDel = diff && raw.startsWith('-')
              const text = diff && (isAdd || isDel || raw.startsWith(' ')) ? raw.slice(1) : raw
              const dimmed = focusSet ? !focusSet.has(lineNo) : false
              const note = annotations?.[lineNo]

              return (
                <tr
                  key={idx}
                  style={{
                    background: isAdd ? 'var(--add)' : isDel ? 'var(--del)' : undefined,
                  }}
                  className={dimmed ? 'opacity-35 transition-opacity' : 'transition-opacity'}
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
                  {annotations && (
                    <td className="w-[38%] max-w-[300px] border-l border-[var(--line)] px-3.5 py-1 align-top">
                      {note && (
                        <span className="slide-in block font-sans text-[0.82rem] leading-snug font-medium text-[var(--amber-soft)]">
                          {note}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
