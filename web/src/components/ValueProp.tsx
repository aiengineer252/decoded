/**
 * The "why should I care" block on the feed.
 *
 * Written as concrete guarantees rather than adjectives, because the whole
 * product claim is that we do not do marketing copy — a vague pitch here would
 * undercut every entry underneath it.
 */

const PROMISES: { k: string; title: string; body: string }[] = [
  {
    k: '01',
    title: 'Mechanism, not the press release',
    body: 'Every entry is traced down to the actual code that implements it, quoted from the real repository with a link to the line. If we could not find the mechanism in the source, we say so instead of paraphrasing the announcement.',
  },
  {
    k: '02',
    title: 'You step through it, you do not read about it',
    body: 'One concrete input is walked through the system stage by stage with the real intermediate values — tensor shapes, JSON frames, actual probabilities. Clicking through a working example beats three paragraphs describing one.',
  },
  {
    k: '03',
    title: 'The score is arithmetic you can redo',
    body: 'Credibility is a weighted mean of five factors, computed in your browser from numbers shown on the page. Open any factor for its evidence, or drag the weights and score it your way. If our stored number ever disagrees with its own factors, the page prints a warning instead of hiding it.',
  },
  {
    k: '04',
    title: 'What it replaces — and what it does not',
    body: 'Every entry names the specific things you would stop using, then names the adjacent things people wrongly assume it replaces. The second list is usually the more useful one, and it is the one nobody else writes.',
  },
  {
    k: '05',
    title: 'Explained at your level, not ours',
    body: 'The same mechanism written three ways: for someone who codes but has not shipped AI, for someone who ships it daily, and for someone who wants only the part that is genuinely non-obvious. Switch at any time.',
  },
  {
    k: '06',
    title: 'Nothing is generated while you read',
    body: 'No model runs when you open a page. Every word was written and checked before publication, so there is no hallucination risk at read time, no waiting, and no cost passed to you. What you read is fixed, dated, and reviewable.',
  },
]

export default function ValueProp() {
  return (
    <section className="space-y-6">
      <div className="max-w-3xl">
        <span className="label">what you get here</span>
        <h2 className="mt-2 text-[1.9rem] leading-tight font-bold tracking-tight">
          Every AI launch gets fifty &ldquo;top 10 features&rdquo; posts within a day.
          <span className="text-[var(--amber)]"> None of them open the code.</span>
        </h2>
        <p className="mt-3 text-[1.05rem] leading-relaxed text-[var(--txt-dim)]">
          This is the diff between what a thing claims and what it does. Six commitments, and every
          entry on this site is held to all of them.
        </p>
      </div>

      <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {PROMISES.map((p, i) => (
          <div
            key={p.k}
            style={{ '--i': i } as React.CSSProperties}
            className="lift panel group rounded-lg p-5 hover:border-[var(--line-hi)]"
          >
            <span className="font-mono text-[0.78rem] font-bold tracking-widest text-[var(--amber)]">
              {p.k}
            </span>
            <h3 className="mt-2 text-[1.08rem] leading-snug font-semibold">{p.title}</h3>
            <p className="mt-2 text-[0.94rem] leading-relaxed text-[var(--txt-dim)]">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
