/**
 * The Decoded entry schema.
 *
 * This file is the contract. The triage pipeline (api/app/triage) must emit
 * exactly this shape, and every view in the site renders from it and nothing
 * else. If a field can't be extracted from the real source, it is `null` and
 * the UI renders an honest gap instead of prose filler.
 *
 * Keep in sync with api/app/schemas.py.
 */

export type Category =
  | 'agents'
  | 'rag'
  | 'inference'
  | 'training'
  | 'protocol'
  | 'tooling'
  | 'model'
  | 'eval'

/** How much of this entry came from the pipeline vs. a human. */
export type EntryStatus =
  | 'demo'      // hand-authored seed entry, written to prove out the format
  | 'auto'      // pipeline output, not yet reviewed — shown with a warning
  | 'reviewed'  // pipeline output, checked line-by-line by a human reviewer

/* ------------------------------------------------------------------ */
/* Reading levels                                                      */
/*                                                                     */
/* The same mechanism explained three ways. This is not three levels of */
/* *detail* — it is three levels of assumed background. A beginner does */
/* not want a shorter explanation, they want one that does not assume   */
/* they already know what a KV cache is. An expert does not want more   */
/* words, they want the part that is actually novel.                    */
/* ------------------------------------------------------------------ */

export type ReadingLevel = 'beginner' | 'practitioner' | 'expert'

export interface Explainer {
  /** Assumes you can code, but not that you have shipped an AI system. */
  beginner: string
  /** Assumes you ship this stuff and want the mechanism, fast. */
  practitioner: string
  /** Assumes you know the field; says only what is non-obvious. */
  expert: string
}

/** A term a beginner would otherwise have to go look up mid-read. */
export interface GlossaryTerm {
  term: string
  plain: string
}

/** One dated change to this entry, so a returning reader sees what moved. */
export interface ChangeLogEntry {
  date: string
  note: string
  /** Set when the credibility score itself changed, and to what. */
  scoreFrom?: number
  scoreTo?: number
}

export interface Source {
  kind: 'paper' | 'repo' | 'docs' | 'blog' | 'model' | 'thread' | 'benchmark'
  label: string
  url: string
  /** Pulled at this time — evidence goes stale, say when it was true. */
  fetchedAt?: string
}

/* ------------------------------------------------------------------ */
/* View 1 — Architecture                                               */
/* ------------------------------------------------------------------ */

export type NodeKind =
  | 'input'
  | 'compute'
  | 'store'
  | 'model'
  | 'output'
  | 'control'

/**
 * One stop on a guided walk through a code snippet. The reader steps from stop
 * to stop; the lines light up and the note explains what they do and why it
 * matters. This replaces "here are five lines, good luck" with a tour.
 */
export interface WalkthroughStop {
  /** 1-indexed lines in `snippet` that this stop is about. */
  lines: number[]
  /** Three to six words. Shown as the stop's name. */
  title: string
  /** What these lines do, and the non-obvious thing about them. */
  note: string
  /** Simpler phrasing for the beginner level. Falls back to `note`. */
  plain?: string
}

export interface CodeRef {
  lang: 'python' | 'typescript' | 'json' | 'bash' | 'text'
  /** Where this came from, so a reader can go check it. */
  file?: string
  url?: string
  snippet: string
  /** 1-indexed lines to highlight inside `snippet`. */
  focus?: number[]
  /**
   * Guided tour through the snippet, in reading order. When present, the code
   * renders as a stepper rather than a static block. Prefer a snippet large
   * enough to have context — a whole function, not the interesting line alone.
   */
  walkthrough?: WalkthroughStop[]
}

export interface ArchNode {
  id: string
  label: string
  kind: NodeKind
  /** Grid position, 0-indexed. The layout engine spaces these out. */
  col: number
  row: number
  /** One line. What this box does, mechanically. */
  summary: string
  /** The long version, revealed when the node is expanded. */
  detail?: string
  /** Beginner-level version of `detail`: no jargon, an analogy is fine. */
  plain?: string
  code?: CodeRef
  /** Where the claim in `summary` can be verified. */
  sourceUrl?: string
}

export interface ArchEdge {
  from: string
  to: string
  label?: string
  /** Dashed = optional/conditional path. */
  kind?: 'solid' | 'dashed'
}

export interface Architecture {
  nodes: ArchNode[]
  edges: ArchEdge[]
  /** Ordered node ids the "pulse" animation follows — the happy path. */
  flow: string[]
  caption?: string
}

/* ------------------------------------------------------------------ */
/* View 2 — Execution trace                                            */
/* ------------------------------------------------------------------ */

export interface TraceValue {
  /** e.g. "list[float] (1536,)" or "JSON-RPC frame" */
  type: string
  /** Rendered verbatim in a mono block. Real values, truncated, never invented. */
  preview: string
  /** Set when the real value is too big and this is a truncation. */
  truncated?: boolean
}

export interface TraceStep {
  id: string
  /** Which architecture node this step is executing — links the two views. */
  nodeId: string
  label: string
  /** What actually happens in this step, in one or two sentences. */
  note: string
  /** Beginner-level version of `note`. Falls back to `note` when absent. */
  plain?: string
  input?: TraceValue
  output?: TraceValue
  code?: CodeRef
  /** Wall-clock or token cost, when the source reports it. */
  cost?: string
}

export interface ExecutionTrace {
  /** The concrete input being pushed through the system. */
  input: TraceValue
  steps: TraceStep[]
  result: TraceValue
  caption?: string
}

/* ------------------------------------------------------------------ */
/* View 3 — Displacement                                               */
/* ------------------------------------------------------------------ */

export interface DisplacementAnnotation {
  /** Which pane the note hangs off. */
  side: 'before' | 'after'
  /** 1-indexed lines in that pane's snippet. */
  lines: number[]
  note: string
}

export interface Displacement {
  /** "If you were using X…" — the things this competes with. */
  replaces: string[]
  /** …and the things it explicitly does not, which is where hype dies. */
  doesNotReplace: string[]
  before: CodeRef & { label: string }
  after: CodeRef & { label: string }
  annotations: DisplacementAnnotation[]
  /** Bullet summary of what structurally went away. */
  whatDisappears: string[]
  /** New costs you take on. There is always a bill. */
  newCosts: string[]
}

/* ------------------------------------------------------------------ */
/* View 4 — Verdict                                                    */
/* ------------------------------------------------------------------ */

export interface Evidence {
  claim: string
  url?: string
  /** Short verbatim quote from the source, if any. */
  quote?: string
}

export type FactorKey =
  | 'reproducibility'
  | 'benchmarks'
  | 'adoption'
  | 'independence'
  | 'maturity'

export interface CredibilityFactor {
  key: FactorKey
  label: string
  /** 0..1 */
  score: number
  /** Relative weight in the composite, 0..1, sums to 1 across factors. */
  weight: number
  /** Why this score and not a different one. */
  reasoning: string
  evidence: Evidence[]
}

export interface Verdict {
  /** 0..100, computed from factors — never hand-set. See lib/credibility.ts */
  score: number
  /** The one-sentence take. */
  headline: string
  factors: CredibilityFactor[]
  useIf: string[]
  skipIf: string[]
  /** Things that would change this score, stated up front. */
  wouldChangeMyMind: string[]
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */

export interface Entry {
  slug: string
  name: string
  org: string
  /** One line, plain. No marketing verbs. */
  tagline: string
  categories: Category[]
  status: EntryStatus
  publishedAt: string
  /** Last substantive change. Verdicts decay; the reader deserves the date. */
  updatedAt: string
  reviewedBy?: string
  sources: Source[]

  /**
   * The opener everyone reads regardless of level. Learning starts from a
   * felt problem, not from a mechanism — nobody cares how the fix works until
   * they recognise the thing it fixes.
   */
  problem: {
    /** The situation before this existed, concrete enough to recognise. */
    before: string
    /** The one-sentence idea. If it needs two sentences it is not the idea yet. */
    insight: string
    /** What you can do afterwards that you could not do before. */
    payoff: string
  }
  /** The same thing explained at three levels of assumed background. */
  explainer: Explainer
  /** What you should already understand to get value from this entry. */
  prerequisites?: string[]
  /** Terms defined inline so a beginner never has to leave the page. */
  glossary?: GlossaryTerm[]
  /** Dated history of what changed, newest first. */
  changelog?: ChangeLogEntry[]
  /** Honest reading time for the full entry, in minutes. */
  readingMinutes?: number
  architecture: Architecture
  trace: ExecutionTrace
  displacement: Displacement
  verdict: Verdict
}

export type EntryView = 'architecture' | 'trace' | 'displacement' | 'verdict'
