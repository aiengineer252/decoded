import type { CredibilityFactor, Verdict } from '../types'

/**
 * The score is a weighted mean of the factors, nothing else. It is computed
 * here — in the client, from data the reader can see — precisely so that
 * nobody has to trust us about it. If the number looks wrong, every input to
 * it is one click away in the Verdict view.
 */
export function computeScore(factors: CredibilityFactor[]): number {
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  if (totalWeight === 0) return 0
  const weighted = factors.reduce((s, f) => s + f.score * f.weight, 0)
  return Math.round((weighted / totalWeight) * 100)
}

/** Does the stored score match the factors? Surfaced in dev to catch drift. */
export function verifyScore(verdict: Verdict): boolean {
  return Math.abs(computeScore(verdict.factors) - verdict.score) <= 1
}

export type Band = 'real' | 'promising' | 'unproven' | 'hype'

export function band(score: number): Band {
  if (score >= 75) return 'real'
  if (score >= 55) return 'promising'
  if (score >= 35) return 'unproven'
  return 'hype'
}

export const BAND_LABEL: Record<Band, string> = {
  real: 'REAL',
  promising: 'PROMISING',
  unproven: 'UNPROVEN',
  hype: 'HYPE',
}

export const BAND_COLOR: Record<Band, string> = {
  real: 'var(--sig-real)',
  promising: 'var(--sig-promising)',
  unproven: 'var(--sig-unproven)',
  hype: 'var(--sig-hype)',
}

/** Tailwind text colour class per band, for places a CSS var is awkward. */
export const BAND_TEXT: Record<Band, string> = {
  real: 'text-[var(--sig-real)]',
  promising: 'text-[var(--sig-promising)]',
  unproven: 'text-[var(--sig-unproven)]',
  hype: 'text-[var(--sig-hype)]',
}
