import { useMemo, useState } from 'react'
import type { CredibilityFactor, Verdict } from '../../types'
import { BAND_COLOR, band, computeScore } from '../../lib/credibility'
import Gauge from '../Gauge'

interface Props {
  verdict: Verdict
}

/**
 * The point of this view is that the number is not an opinion you have to
 * accept. Every factor opens to its evidence, and the weights are editable —
 * if you think reproducibility matters more than adoption, drag it and watch
 * the score move. A score nobody can interrogate is just vibes with a decimal
 * point.
 */
export default function VerdictView({ verdict }: Props) {
  const [open, setOpen] = useState<string | null>(verdict.factors[0]?.key ?? null)
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(verdict.factors.map((f) => [f.key, f.weight])),
  )

  const tuned: CredibilityFactor[] = useMemo(
    () => verdict.factors.map((f) => ({ ...f, weight: weights[f.key] ?? f.weight })),
    [verdict.factors, weights],
  )
  const liveScore = computeScore(tuned)
  const dirty = liveScore !== verdict.score

  return (
    <div className="space-y-6">
      <div className="panel grid gap-6 rounded-lg p-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex flex-col items-center gap-2">
          <Gauge score={liveScore} size={172} />
          {dirty && (
            <button
              onClick={() =>
                setWeights(Object.fromEntries(verdict.factors.map((f) => [f.key, f.weight])))
              }
              className="rise rounded border border-[var(--line)] px-2.5 py-1 font-mono text-[0.74rem] font-semibold tracking-widest text-[var(--txt-dim)] uppercase transition-colors hover:border-[var(--amber)] hover:text-[var(--amber)]"
            >
              reset to ours ({verdict.score})
            </button>
          )}
        </div>

        <div>
          <span className="label">verdict</span>
          <p className="mt-2 text-[1.35rem] leading-snug font-medium text-[var(--txt)]">
            {verdict.headline}
          </p>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-[var(--txt-dim)]">
            The score is a weighted mean of the five factors below — computed in your browser, from
            the numbers you can see. Open any factor for the evidence behind it, or{' '}
            <span className="font-semibold text-[var(--amber)]">drag its weight</span> to score it
            your way.
          </p>
        </div>
      </div>

      <div className="stagger space-y-3">
        {tuned.map((f, i) => {
          const isOpen = open === f.key
          const color = BAND_COLOR[band(f.score * 100)]
          return (
            <div
              key={f.key}
              className="panel overflow-hidden rounded-lg transition-colors hover:border-[var(--line-hi)]"
              style={{ '--i': i } as React.CSSProperties}
            >
              <button
                onClick={() => setOpen(isOpen ? null : f.key)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--panel-hi)]"
              >
                <span
                  className="font-mono text-[0.9rem] font-bold text-[var(--txt-faint)] transition-transform duration-300"
                  style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                >
                  &rsaquo;
                </span>
                <span className="w-48 shrink-0 text-[1rem] font-semibold">{f.label}</span>
                <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                  <span
                    className="absolute inset-y-0 left-0 origin-left rounded-full"
                    style={{
                      width: `${f.score * 100}%`,
                      background: color,
                      boxShadow: `0 0 10px ${color}80`,
                      animation: 'bar-grow .8s cubic-bezier(.22,1,.36,1) both',
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                </span>
                <span
                  className="w-12 shrink-0 text-right font-mono text-[1rem] font-bold"
                  style={{ color }}
                >
                  {Math.round(f.score * 100)}
                </span>
              </button>

              {isOpen && (
                <div className="rise space-y-5 border-t border-[var(--line)] px-5 py-5">
                  <p className="text-[1rem] leading-relaxed text-[var(--txt-dim)]">{f.reasoning}</p>

                  <div>
                    <span className="label">evidence</span>
                    <ul className="mt-2.5 space-y-3">
                      {f.evidence.map((e, j) => (
                        <li
                          key={j}
                          className="border-l-2 border-[var(--line-hi)] pl-4 transition-colors hover:border-[var(--amber)]"
                        >
                          <p className="text-[0.96rem] leading-relaxed text-[var(--txt)]">
                            {e.claim}
                          </p>
                          {e.quote && (
                            <p className="mt-1.5 font-mono text-[0.86rem] text-[var(--txt-dim)] italic">
                              "{e.quote}"
                            </p>
                          )}
                          {e.url && (
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline-grow mt-1 inline-block font-mono text-[0.8rem] break-all text-[var(--amber)]"
                            >
                              {shortUrl(e.url)}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center gap-4 rounded-lg bg-[var(--bg-raised)] px-4 py-3">
                    <span className="label shrink-0">weight</span>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={Math.round(f.weight * 100)}
                      onChange={(e) =>
                        setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) / 100 }))
                      }
                      className="h-2 flex-1 cursor-pointer accent-[var(--amber)]"
                      aria-label={`Weight for ${f.label}`}
                    />
                    <span className="w-14 text-right font-mono text-[0.94rem] font-bold text-[var(--amber)]">
                      {Math.round(f.weight * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid gap-5 md:grid-cols-2 [&>*]:min-w-0">
        <RecPanel title="use it if" tone="var(--sig-real)" items={verdict.useIf} />
        <RecPanel title="skip it if" tone="var(--sig-hype)" items={verdict.skipIf} />
      </div>

      <div className="panel rounded-lg p-5">
        <span className="label">what would change this score</span>
        <ul className="mt-3 space-y-2.5">
          {verdict.wouldChangeMyMind.map((w) => (
            <li key={w} className="flex gap-3 text-[0.98rem] leading-relaxed text-[var(--txt-dim)]">
              <span className="mt-0.5 font-mono font-bold text-[var(--amber)]">?</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function RecPanel({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  return (
    <div className="panel rounded-lg p-5">
      <span className="label" style={{ color: tone }}>
        {title}
      </span>
      <ul className="mt-3 space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex gap-3 text-[0.98rem] leading-relaxed text-[var(--txt-dim)]">
            <span className="mt-0.5 font-mono font-bold" style={{ color: tone }}>
              &rsaquo;
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function shortUrl(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
