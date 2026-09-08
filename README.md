# Decoded

**Is it real, or is it hype?** Every AI launch, traced down to what it actually does under the hood and what it makes obsolete.

Not a news aggregator. Not a blog. Each entry is an interactive artifact you step through:

| View | What it answers |
|---|---|
| **Architecture** | What it's made of — a node graph where every box opens to the real code that implements it |
| **Trace** | What it does to one concrete input, stepped through stage by stage with the actual intermediate values |
| **Displacement** | What it replaces — a line-annotated before/after diff, plus what it explicitly *doesn't* replace |
| **Verdict** | Is it real — five factors, each opening to its evidence, with weights you can drag to score it yourself |

```
D:\ML Projects\decoded
├── web/          Vite + React + TS + Tailwind v4   — the entry format
└── api/          FastAPI + SQLAlchemy + Anthropic  — ingest -> triage -> publish
```

---

## Running it

**The site** (works standalone — the seed entries are checked in):

```bash
cd web && npm install && npm run dev
```

Opens on <http://localhost:5174>. Keys: `1`–`4` switch views, arrow keys step the trace.

**The pipeline:**

```bash
cd api && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` (and `GITHUB_TOKEN` if you want more than 60 GitHub requests/hour). Then:

```bash
python -m app.cli ingest
```

```bash
python -m app.cli queue
```

```bash
python -m app.cli triage --limit 2
```

Or serve it: `uvicorn app.main:app --reload --port 8000`.

---

## How the pipeline works

**Stage 1 — Ingest** (`api/app/ingest/`). arXiv cs.AI/cs.CL/cs.LG, GitHub (star *velocity* on recent repos, plus watched-org activity), HuggingFace new models. Deduped on `(source, external_id)`.

**Stage 2 — Signal scoring** (`api/app/scoring.py`). A deliberately crude, fully inspectable filter: `0.55·traction + 0.30·mechanism-keywords + 0.15·freshness`, with a hard-zero noise list (`awesome-`, `curated list`, `chatgpt prompts`…). Traction is log-scaled, because 500 stars/day is not 100× more interesting than 5.

Its only job is keeping the expensive stage off the firehose. **Rejected items stay in the database** — the misses are how the thresholds get tuned against reality rather than intuition.

**Stage 3 — Triage** (`api/app/triage/`). The actual product. For each surviving item:

1. `fetch.py` pulls the real source — README, key source files, model card, config, abstract. Nothing is summarised on the way in.
2. Three staged Claude calls, all sharing one **prompt-cached** source bundle (it's the largest and most stable part of the prompt, so calls 2 and 3 read it at ~0.1× instead of re-paying): *mechanism → displacement → verdict*.
3. Each stage uses **structured outputs** against a Pydantic schema, so a shape the frontend can't render is impossible by construction.
4. The credibility score is **recomputed server-side** from the returned factors, and again in the reader's browser. If the stored number ever disagrees with its own factors, the entry page prints a drift warning instead of hiding it.

Splitting into three calls isn't only a context decision — a stage that fails fails alone, and abstention is a valid output. If the source material can't show the mechanism, triage raises rather than inventing one.

**Stage 4 — Review.** Everything lands as `status: "auto"` and shows a warning until a human approves it (`POST /review/{slug}/approve`), which flips it to `reviewed`. This gate is what makes the "expert-verified" claim true, and it doubles as the reel-scripting pass.

---

## The entry schema is the contract

[`web/src/types.ts`](web/src/types.ts) and [`api/app/schemas.py`](api/app/schemas.py) are the same document in two languages. The pipeline must fill exactly that shape; every view renders from it and nothing else. Fields that can't be extracted from real source are `null`, and the UI renders an honest gap rather than prose filler.

Change one, change the other.

---

## Current state

**Done and working:**

- All four interactive views, keyboard-driven, responsive, reduced-motion aware
- Three hand-authored seed entries (speculative decoding, MCP, GRPO) with real mechanisms, real traces, real source links
- Feed with category filtering, displacement map, credibility ticker
- Full ingest → score → triage → review → serve pipeline, with token accounting per run

**The seed entries are marked `demo` and say so on the page.** They describe real systems and every source is linked, but their credibility factors are a human judgement, not pipeline output. A truth engine that fakes its own first entries is dead on arrival — so the site labels them rather than quietly passing them off as verified.

**Not wired yet:** the site reads seed entries from `web/src/data/index.ts`, not from the API. That's deliberate — the format is still being tuned, and seeds iterate faster than triage runs. Swapping it is one file: replace the `entries` export with a fetch of `GET /entries` and make `Home`/`EntryPage` await it. Do that once ~10 reviewed entries exist.

**Next:**

1. Hand-build 5–10 more entries before trusting the pipeline — nail the format, see what actually gets shared
2. Wire the site to the API; move `data/index.ts` to a fetch
3. Watchlist + alerts ("something in your stack got displaced") — the paid hook
4. Auto-generate the 30-second reel script from the review pass
