import type { Entry } from '../types'

/**
 * The opener. Three beats, in the order a person actually learns:
 *
 *   1. the pain     — "you have felt this"
 *   2. the idea     — one sentence
 *   3. the payoff   — "and now you can…"
 *
 * Everything technical waits until after this. A reader who does not recognise
 * the problem will not care about the mechanism, at any reading level.
 */
export default function StartHere({ entry }: { entry: Entry }) {
  const { before, insight, payoff } = entry.problem

  return (
    <section className="stagger grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch [&>*]:min-w-0">
      <Beat n="1" k="the problem" tone="var(--sig-hype)" style={{ '--i': 0 } as React.CSSProperties}>
        {before}
      </Beat>

      {/* the idea sits between problem and payoff, visually the hinge */}
      <div
        style={{ '--i': 1 } as React.CSSProperties}
        className="relative flex flex-col justify-center rounded-lg border border-[var(--amber)]/50 bg-[var(--amber)]/6 px-5 py-5 md:max-w-[340px]"
      >
        <span className="label" style={{ color: 'var(--amber)' }}>
          2 · the idea
        </span>
        <p className="mt-2 text-[1.2rem] leading-snug font-semibold text-[var(--txt)]">{insight}</p>
        <span className="pointer-events-none absolute top-1/2 -right-3 hidden h-6 w-6 -translate-y-1/2 rotate-45 border-t border-r border-[var(--amber)]/50 bg-[var(--bg)] md:block" />
        <span className="pointer-events-none absolute top-1/2 -left-3 hidden h-6 w-6 -translate-y-1/2 rotate-45 border-b border-l border-[var(--amber)]/50 bg-[var(--bg)] md:block" />
      </div>

      <Beat n="3" k="what you get" tone="var(--sig-real)" style={{ '--i': 2 } as React.CSSProperties}>
        {payoff}
      </Beat>
    </section>
  )
}

function Beat({
  n,
  k,
  tone,
  style,
  children,
}: {
  n: string
  k: string
  tone: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div style={style} className="panel rounded-lg px-5 py-5">
      <span className="label" style={{ color: tone }}>
        {n} · {k}
      </span>
      <p className="mt-2 text-[1rem] leading-relaxed text-[var(--txt-dim)]">{children}</p>
    </div>
  )
}
