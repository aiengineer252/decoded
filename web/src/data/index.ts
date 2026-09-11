import type { Entry } from '../types'
import { mcp } from './entries/mcp'
import { speculativeDecoding } from './entries/speculative-decoding'
import { grpo } from './entries/grpo'
import { contextualRetrieval } from './entries/contextual-retrieval'
import { hnsw } from './entries/hnsw'
import { zeroShotClassification } from './entries/zero-shot-classification'
import { flashAttention } from './entries/flash-attention'
import { gpt6Astra } from './entries/gpt-6-astra'
import generated from './generated-entries.json'

/**
 * Seed entries, hand-authored to pin down the format before the pipeline
 * writes into it. Every one is marked `status: 'demo'` and the site says so —
 * a truth engine that fakes its own first entries is dead on arrival.
 *
 * Once api/ is live this module is replaced by a fetch from /entries.
 */
/**
 * Hand-authored seed entries, written to pin down the format before the
 * pipeline wrote into it. Every one is marked `status: 'demo'` and the site
 * says so — a truth engine that fakes its own first entries is dead on arrival.
 */
const seeds: Entry[] = [
  gpt6Astra,
  flashAttention,
  hnsw,
  contextualRetrieval,
  zeroShotClassification,
  speculativeDecoding,
  mcp,
  grpo,
]

/**
 * Entries produced by the pipeline and approved by a human reviewer, written
 * here by `python -m app.cli export`. The file is committed, so the site stays
 * fully static and makes no model calls at read time.
 *
 * A generated entry wins over a seed with the same slug, so replacing a
 * hand-written entry with a pipeline one is just a matter of publishing it.
 */
const generatedEntries = generated as unknown as Entry[]

export const entries: Entry[] = [
  ...generatedEntries,
  ...seeds.filter((s) => !generatedEntries.some((g) => g.slug === s.slug)),
]

export function getEntry(slug: string): Entry | undefined {
  return entries.find((e) => e.slug === slug)
}

export function sortedEntries(): Entry[] {
  return [...entries].sort((a, b) => {
    const t = +new Date(b.publishedAt) - +new Date(a.publishedAt)
    return t !== 0 ? t : b.verdict.score - a.verdict.score
  })
}

export interface DisplacementLink {
  from: string // the thing being replaced
  to: string // the entry doing the replacing
  slug: string
  score: number
}

/** Flattens every entry's `replaces` into edges for the homepage map. */
export function displacementLinks(): DisplacementLink[] {
  return entries.flatMap((e) =>
    e.displacement.replaces.map((r) => ({
      from: r,
      to: e.name,
      slug: e.slug,
      score: e.verdict.score,
    })),
  )
}
