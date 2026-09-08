import CodeBlock from '../components/CodeBlock'

export default function About() {
  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-[2.6rem] leading-tight font-bold tracking-tight">Method</h1>
        <p className="mt-4 text-[1.15rem] leading-relaxed text-[var(--txt-dim)]">
          Decoded exists because the gap between what a launch claims and what its code does is
          where all the useful information lives. Everything here is built so that you never have
          to take our word for anything — the claims link to sources, the code is quoted from the
          real repository, and the score is arithmetic you can redo.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-mono text-[1rem] font-bold tracking-[0.16em] text-[var(--amber)] uppercase">
          the three questions
        </h2>
        <ol className="space-y-3">
          {[
            [
              'What does it actually do, mechanically?',
              'Architecture and a stepped execution trace over a concrete input — not a feature list. If we cannot show the mechanism, we do not publish the entry.',
            ],
            [
              'What does it replace?',
              'A line-by-line diff against the thing you are using today, plus an explicit list of what it does not replace. The second list is usually the more useful one.',
            ],
            [
              'Is it real, or is it hype?',
              'Five factors, each with its evidence attached, combined into one number. The weights are visible and adjustable.',
            ],
          ].map(([q, a], i) => (
            <li key={q} className="lift panel rounded-lg p-5 hover:border-[var(--line-hi)]">
              <div className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line-hi)] font-mono text-[0.76rem] font-bold text-[var(--amber)]">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[1.15rem] font-semibold">{q}</h3>
                  <p className="mt-1.5 text-[0.98rem] leading-relaxed text-[var(--txt-dim)]">{a}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[1rem] font-bold tracking-[0.16em] text-[var(--amber)] uppercase">
          how the score is computed
        </h2>
        <p className="text-[1rem] leading-relaxed text-[var(--txt-dim)]">
          There is no model deciding this and no secret adjustment. It is a weighted mean of five
          factors, run in your browser from data displayed on the page:
        </p>
        <CodeBlock
          lang="typescript"
          file="web/src/lib/credibility.ts"
          code={`export function computeScore(factors: CredibilityFactor[]): number {
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const weighted = factors.reduce((s, f) => s + f.score * f.weight, 0)
  return Math.round((weighted / totalWeight) * 100)
}`}
        />
        <p className="text-[1rem] leading-relaxed text-[var(--txt-dim)]">
          If the stored score ever disagrees with what its own factors produce, the entry page
          prints a red drift warning instead of quietly showing the stored number.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ['reproducibility', 'Can a competent engineer run it today from public artefacts?'],
            ['benchmarks', 'Do the reported numbers cite baselines, and are they checkable? Scored neutral and weighted down where the thing has no numbers to make.'],
            ['adoption', 'Real usage outside demos — shipped integrations, not stars.'],
            ['independence', 'Has anyone unconnected to the authors reproduced or reimplemented it?'],
            ['maturity', 'Will what you build against it still work in a year?'],
          ].map(([k, v]) => (
            <div key={k} className="lift panel rounded-lg p-4 hover:border-[var(--line-hi)]">
              <span className="label">{k}</span>
              <p className="mt-1.5 text-[0.92rem] leading-snug text-[var(--txt-dim)]">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[1rem] font-bold tracking-[0.16em] text-[var(--amber)] uppercase">
          bands
        </h2>
        <div className="panel divide-y divide-[var(--line)] rounded">
          {[
            ['75-100', 'REAL', 'var(--sig-real)', 'Works, reproducible, used outside its own demos.'],
            ['55-74', 'PROMISING', 'var(--sig-promising)', 'Mechanism is sound; evidence or adoption is still thin.'],
            ['35-54', 'UNPROVEN', 'var(--sig-unproven)', 'Plausible, but nothing independent stands behind it yet.'],
            ['0-34', 'HYPE', 'var(--sig-hype)', 'Claims outrun the artefacts by a wide margin.'],
          ].map(([range, label, color, desc]) => (
            <div
              key={label}
              className="flex items-baseline gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--panel-hi)]"
            >
              <span className="w-20 font-mono text-[0.84rem] text-[var(--txt-faint)]">{range}</span>
              <span
                className="w-28 font-mono text-[0.84rem] font-bold tracking-widest"
                style={{ color }}
              >
                {label}
              </span>
              <span className="flex-1 text-[0.94rem] text-[var(--txt-dim)]">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[1rem] font-bold tracking-[0.16em] text-[var(--amber)] uppercase">
          what we will not do
        </h2>
        <ul className="space-y-2">
          {[
            'Publish an entry whose mechanism we could not read in the source.',
            'Quote a benchmark without linking where it came from.',
            'Present a hand-written entry as pipeline output, or an unreviewed pipeline entry as verified. Every entry carries its status.',
            'Score something highly because it is popular. Adoption is one factor of five.',
          ].map((x) => (
            <li key={x} className="flex gap-3 text-[1rem] leading-relaxed text-[var(--txt-dim)]">
              <span className="mt-0.5 font-mono font-bold text-[var(--sig-hype)]">x</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
