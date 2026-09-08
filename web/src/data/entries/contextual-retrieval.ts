import type { Entry } from '../../types'

export const contextualRetrieval: Entry = {
  slug: 'contextual-retrieval',
  name: 'Contextual Retrieval',
  org: 'Anthropic',
  tagline:
    'Before embedding a chunk, have an LLM write the two sentences of context the chunk lost when you split the document.',
  categories: ['rag'],
  status: 'demo',
  publishedAt: '2026-08-14',
  updatedAt: '2026-08-14',
  reviewedBy: 'AI engineer',
  readingMinutes: 7,
  explainer: {
    beginner:
      'To let a model answer questions about your documents, you cut them into chunks and store each one so it can be found later. The problem: a chunk pulled out of a report might read "revenue grew by 3% over the previous quarter" — perfectly accurate, and impossible to find, because it never says which company or which quarter. Someone searching for "ACME Q2 2023 revenue" will never match it. Contextual Retrieval fixes this by asking a cheap model, before storing each chunk, to write one sentence saying where in the document this fragment sits. That sentence gets glued to the front of the chunk. The chunk did not change — it just now carries the words a searcher would actually use.',
    practitioner:
      'An index-time preprocessing step. For each chunk, one cheap LLM call sees the whole document plus that chunk and returns a short situating string, which is prepended before both embedding and BM25 indexing. The document sits behind a prompt-cache breakpoint so you pay the full-document read once rather than once per chunk — without that the cost model collapses, and this is the detail most reimplementations get wrong. Retrieval then runs hybrid, merged with reciprocal rank fusion since cosine and BM25 scores are not comparable. It stacks with reranking rather than replacing it.',
    expert:
      'The mechanism is unobjectionable; the evidence is the interesting part. All the headline reductions are first-party, on a first-party eval set, with no independent reproduction on a public benchmark — and retrieval results are notoriously corpus-dependent. The ablation nobody has published is the one that matters: how much of the gain survives against a trivial baseline of prepending the document title and section heading? That is nearly free and captures a lot of the same signal. Also worth pricing honestly: generated context is model output living permanently in your index, so a hallucinated situating line is a silently poisoned chunk, and re-indexing is now model-dependent — a model change is an index migration.',
  },
  prerequisites: [
    'The basic RAG loop: chunk documents, embed them, retrieve, then answer',
    'Roughly what a keyword index like BM25 does',
  ],
  glossary: [
    { term: 'RAG', plain: 'Retrieval-augmented generation. Fetch relevant text first, then let the model answer using it.' },
    { term: 'chunk', plain: 'A slice of a document, small enough to embed and retrieve on its own.' },
    { term: 'embedding', plain: 'A list of numbers representing meaning, so similar text lands close together.' },
    { term: 'BM25', plain: 'A classic keyword-matching ranking function. Good at exact terms that embeddings blur together.' },
    { term: 'hybrid retrieval', plain: 'Running semantic and keyword search together and merging the two result lists.' },
    { term: 'RRF', plain: 'Reciprocal rank fusion. Merges ranked lists by position rather than score, so incomparable scores stop mattering.' },
    { term: 'prompt caching', plain: 'Reusing an already-processed prompt prefix so you are not billed full price for re-sending it.' },
  ],
  changelog: [{ date: '2026-08-14', note: 'First published. Scored 74 — mechanism is sound, but all published numbers are single-source.' }],
  sources: [
    {
      kind: 'blog',
      label: 'Anthropic — Introducing Contextual Retrieval',
      url: 'https://www.anthropic.com/news/contextual-retrieval',
    },
    {
      kind: 'docs',
      label: 'Anthropic — prompt caching (what makes this affordable)',
      url: 'https://platform.claude.com/docs/en/build-with-claude/prompt-caching',
    },
    {
      kind: 'paper',
      label: 'Cormack et al. — Reciprocal Rank Fusion',
      url: 'https://dl.acm.org/doi/10.1145/1571941.1572114',
    },
  ],

  architecture: {
    caption:
      'Everything here is ordinary RAG except one box. Click the contextualizer — that is the entire idea, and the prompt cache next to it is what stops it from costing a fortune.',
    nodes: [
      {
        id: 'doc',
        label: 'Source document',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'the whole file, pre-split',
        detail:
          'The full document is the thing chunking destroys. A chunk that reads "revenue grew 3% over the previous quarter" is unretrievable for the query "ACME Q2 2023 revenue growth" because neither the company nor the quarter survives the split. Contextual Retrieval keeps the whole document around long enough to put that information back.',
      },
      {
        id: 'chunker',
        label: 'Chunker',
        kind: 'compute',
        col: 1,
        row: 0,
        summary: 'split as you already do',
        detail:
          'Unchanged from your existing pipeline — same splitter, same chunk size, same overlap. This method does not ask you to chunk differently; it repairs the damage after the fact.',
        code: {
          lang: 'python',
          file: 'ordinary chunking — nothing new here',
          snippet: `chunks = splitter.split_text(document)   # your existing splitter
# chunks[41] == "The company's revenue grew by 3% over the previous quarter."
# Correct, and useless on its own.`,
          focus: [3],
        },
      },
      {
        id: 'contextualizer',
        label: 'Contextualizer',
        kind: 'model',
        col: 2,
        row: 0,
        summary: 'LLM writes 1-2 lines of context',
        detail:
          'One cheap model call per chunk. It sees the whole document plus the one chunk, and returns a short situating sentence — which company, which period, which section. That string is prepended to the chunk before anything is indexed. The generated context is never shown to the user; it exists only to make the chunk findable.',
        code: {
          lang: 'text',
          file: 'the contextualizer prompt (structure as published in the Anthropic write-up)',
          url: 'https://www.anthropic.com/news/contextual-retrieval',
          snippet: `<document>
{{WHOLE_DOCUMENT}}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{{CHUNK_CONTENT}}
</chunk>

Give a short succinct context to situate this chunk within the overall
document for the purposes of improving search retrieval of the chunk.
Answer only with the succinct context and nothing else.`,
          focus: [9, 10, 11],
        },
      },
      {
        id: 'cache',
        label: 'Prompt cache',
        kind: 'store',
        col: 2,
        row: 1,
        summary: 'document written once, read N times',
        detail:
          'Without caching this design is absurd: you would re-send the entire document once per chunk, so a 200-chunk document means 200 full-document prompts. With the document behind a cache breakpoint, the first chunk pays the write and the other 199 read it at a fraction of the price. The economics of the whole technique rest on this one detail.',
        code: {
          lang: 'python',
          file: 'the document sits behind the breakpoint; only the chunk varies',
          url: 'https://platform.claude.com/docs/en/build-with-claude/prompt-caching',
          snippet: `messages=[{"role": "user", "content": [
    {"type": "text",
     "text": whole_document,
     "cache_control": {"type": "ephemeral"}},   # <- stable prefix
    {"type": "text", "text": chunk_prompt},     # <- varies per chunk
]}]`,
          focus: [4, 5],
        },
      },
      {
        id: 'embed',
        label: 'Embedding index',
        kind: 'store',
        col: 3,
        row: 0,
        summary: 'embeds context + chunk',
        detail:
          'The vector is computed over the concatenation, not the original chunk. Same embedding model, same index, same dimensionality — the only change is that the text being embedded now carries its own coordinates.',
      },
      {
        id: 'bm25',
        label: 'BM25 index',
        kind: 'store',
        col: 3,
        row: 1,
        summary: 'same contextualized text',
        detail:
          'The identical contextualized string is also indexed lexically. This matters more than it looks: the added context supplies exact tokens — company names, quarters, product codes — that BM25 can match and embeddings routinely blur together.',
      },
      {
        id: 'fusion',
        label: 'Rank fusion',
        kind: 'control',
        col: 4,
        row: 0,
        summary: 'merge both rankings',
        detail:
          'The two result lists are merged by rank, not by score — the scores are not comparable across a cosine similarity and a BM25 weight. Reciprocal Rank Fusion sums 1/(k + rank) across lists, which needs no tuning and no score normalisation.',
        code: {
          lang: 'python',
          file: 'reciprocal rank fusion — the whole algorithm',
          url: 'https://dl.acm.org/doi/10.1145/1571941.1572114',
          snippet: `def rrf(rankings, k=60):
    scores = defaultdict(float)
    for ranking in rankings:              # one per retriever
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] += 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)`,
          focus: [5],
        },
      },
      {
        id: 'rerank',
        label: 'Reranker',
        kind: 'compute',
        col: 5,
        row: 0,
        summary: 'optional cross-encoder pass',
        detail:
          'A cross-encoder scores query and chunk together instead of comparing two independently-computed vectors, so it can catch relevance that no bi-encoder will. It is a separate technique that stacks with this one — the published numbers improve again when it is added, and it is listed separately here because it is not part of Contextual Retrieval itself.',
      },
    ],
    edges: [
      { from: 'doc', to: 'chunker' },
      { from: 'chunker', to: 'contextualizer', label: 'chunk' },
      { from: 'cache', to: 'contextualizer', kind: 'dashed', label: 'full doc' },
      { from: 'contextualizer', to: 'embed', label: 'context + chunk' },
      { from: 'contextualizer', to: 'bm25' },
      { from: 'embed', to: 'fusion' },
      { from: 'bm25', to: 'fusion' },
      { from: 'fusion', to: 'rerank', kind: 'dashed' },
    ],
    flow: ['doc', 'chunker', 'contextualizer', 'embed', 'fusion'],
  },

  trace: {
    caption:
      'The canonical failure case, start to finish. Watch step 1 — the chunk is factually correct and completely unfindable.',
    input: {
      type: 'query',
      preview: '"What was ACME Corp\'s revenue growth in Q2 2023?"',
    },
    steps: [
      {
        id: 'c1',
        nodeId: 'chunker',
        label: 'The chunk, as your splitter leaves it',
        note: 'Nothing is wrong with this chunk. It is accurate, well-formed, and the correct answer to the query. It is also missing every single term the query is made of — no "ACME", no "Q2", no "2023". No embedding model and no keyword index can bridge that.',
        input: { type: 'str', preview: 'document.txt — 47 pages, split into 213 chunks' },
        output: {
          type: 'str (chunk 41)',
          preview: '"The company\'s revenue grew by 3% over the previous quarter."',
        },
      },
      {
        id: 'c2',
        nodeId: 'contextualizer',
        label: 'Ask a cheap model to situate it',
        note: 'The model gets the whole document and this one chunk. It is not summarising and not answering — it is only stating where in the document this fragment sits.',
        input: {
          type: 'prompt',
          preview: '<document> …47 pages… </document>\n<chunk>The company\'s revenue grew by 3%…</chunk>\nGive a short succinct context to situate this chunk…',
          truncated: true,
        },
        output: {
          type: 'str',
          preview:
            '"This chunk is from an SEC filing on ACME Corp\'s performance in Q2 2023; the previous quarter\'s revenue was $314 million."',
        },
        cost: '~1 cheap call, document read from cache',
      },
      {
        id: 'c3',
        nodeId: 'embed',
        label: 'Index the concatenation, not the chunk',
        note: 'The stored text is context + original chunk. Both indexes get the same string, which is why the lexical side improves too — "ACME" and "Q2 2023" are now literal tokens present in the document.',
        input: { type: 'str', preview: 'context + "\\n\\n" + chunk' },
        output: {
          type: 'indexed text',
          preview:
            '"This chunk is from an SEC filing on ACME Corp\'s performance\nin Q2 2023; the previous quarter\'s revenue was $314 million.\n\nThe company\'s revenue grew by 3% over the previous quarter."',
        },
      },
      {
        id: 'c4',
        nodeId: 'fusion',
        label: 'Retrieve on both sides, merge by rank',
        note: 'Embeddings now place the chunk near the query; BM25 matches "ACME" and "Q2 2023" outright. RRF merges the two orderings without needing the two score scales to agree.',
        input: { type: 'query', preview: '"ACME Corp revenue growth Q2 2023"' },
        output: {
          type: 'ranked chunk ids',
          preview: `semantic:  [41, 88, 12, …]
lexical:   [41, 12, 205, …]

rrf(41) = 1/(60+1) + 1/(60+1) = 0.0328   -> rank 1`,
        },
      },
      {
        id: 'c5',
        nodeId: 'rerank',
        label: 'Optional: cross-encode the shortlist',
        note: 'A reranker scores the query and each candidate jointly rather than comparing two vectors computed in isolation. It stacks with this technique rather than being part of it — worth separating when you attribute a gain.',
        input: { type: 'candidates', preview: 'top 150 chunks from fusion' },
        output: { type: 'ranked', preview: 'top 20 by cross-encoder relevance score' },
        cost: 'one extra model pass over the shortlist',
      },
    ],
    result: {
      type: 'retrieved chunk',
      preview: `Chunk 41 is now rank 1 instead of absent.

The chunk did not change. What changed is that it now
carries the words a searcher would actually use.

Index size grows by the length of the added context.`,
    },
  },

  displacement: {
    replaces: ['naive fixed-size chunk embedding', 'embedding-only retrieval'],
    doesNotReplace: [
      'your chunker',
      'your embedding model',
      'your vector database',
      'reranking',
      'the generation step',
    ],
    before: {
      label: 'Embed the chunk exactly as it was split',
      lang: 'python',
      file: 'the shape of almost every RAG pipeline',
      snippet: `chunks = splitter.split_text(document)

for chunk in chunks:
    vector = embed(chunk)
    index.add(vector, payload=chunk)

# Retrieval quality is now bounded by how much meaning
# survived the split. For chunks that reference "the company"
# or "the previous quarter", that is close to none.`,
    },
    after: {
      label: 'Situate each chunk first, then index',
      lang: 'python',
      file: 'contextual retrieval — the whole change',
      url: 'https://www.anthropic.com/news/contextual-retrieval',
      snippet: `chunks = splitter.split_text(document)

for chunk in chunks:
    context = llm(SITUATE_PROMPT, document=document, chunk=chunk)
    text = f"{context}\\n\\n{chunk}"

    index.add(embed(text), payload=text)
    bm25.add(text)

# Retrieve from both, merge with RRF.`,
    },
    annotations: [
      {
        side: 'before',
        lines: [4, 5],
        note: 'The vector is computed over text that has already lost its subject. Nothing downstream can recover it.',
      },
      {
        side: 'before',
        lines: [7, 8, 9],
        note: 'This is the actual ceiling on most RAG systems — not the embedding model, not the top-k.',
      },
      {
        side: 'after',
        lines: [4],
        note: 'One extra model call per chunk, at index time. Users never wait on it; it happens once, offline.',
      },
      {
        side: 'after',
        lines: [5],
        note: 'The context is prepended to the stored text, so it is what gets embedded AND what BM25 sees.',
      },
      {
        side: 'after',
        lines: [7, 8],
        note: 'Indexing both ways off one string is why the lexical gain comes almost free.',
      },
    ],
    whatDisappears: [
      'Chunks that are correct but permanently unretrievable because the subject was in a different chunk.',
      'The tuning treadmill of chunk size and overlap, chasing a problem that was never about size.',
      'Reflexively swapping embedding models to fix recall that chunking broke.',
    ],
    newCosts: [
      'One LLM call per chunk at index time — cheap per call, real at corpus scale, and it must be re-run for every document you re-ingest.',
      'Without prompt caching the document is re-sent per chunk, and the cost becomes indefensible.',
      'Index size grows by the context on every chunk; so does the text a reranker has to read.',
      'The generated context is model output sitting permanently in your index — a wrong one is a silently poisoned chunk, and nothing in the pipeline checks it.',
      'Re-indexing is now a model-dependent step, so a model change is an index migration.',
    ],
  },

  verdict: {
    score: 74,
    headline:
      'The mechanism is obviously right and costs almost nothing to try — but every number attached to it comes from the vendor who proposed it, on their own eval set, and that gap is the whole reason this is not scored higher.',
    factors: [
      {
        key: 'reproducibility',
        label: 'Can you run it today?',
        score: 0.9,
        weight: 0.25,
        reasoning:
          'It is a prompt and a string concatenation. There is nothing to install, no new dependency, and it drops into an existing pipeline in an afternoon. The published write-up includes the prompt and a cookbook.',
        evidence: [
          {
            claim: 'The situating prompt is published in full, along with a runnable cookbook.',
            url: 'https://www.anthropic.com/news/contextual-retrieval',
          },
          {
            claim: 'The prompt-caching mechanism the cost model depends on is documented separately.',
            url: 'https://platform.claude.com/docs/en/build-with-claude/prompt-caching',
          },
        ],
      },
      {
        key: 'benchmarks',
        label: 'Are the numbers real?',
        score: 0.6,
        weight: 0.25,
        reasoning:
          'Substantial reductions in retrieval failure rate are reported, with a clear ablation separating contextual embeddings, contextual BM25, and reranking. The deduction is not about honesty — it is that these are first-party numbers on a first-party evaluation, and retrieval results are notoriously corpus-dependent. Your corpus may not behave like theirs.',
        evidence: [
          {
            claim:
              'Top-20-chunk retrieval failure rate falls 35% with contextual embeddings alone (5.7% -> 3.7%), 49% adding contextual BM25 (-> 2.9%), and 67% adding reranking (-> 1.9%). Cleanly ablated, which is more than most write-ups manage.',
            url: 'https://www.anthropic.com/news/contextual-retrieval',
          },
          {
            claim:
              'No independent benchmark isolating this technique across diverse corpora appears in the source material.',
          },
        ],
      },
      {
        key: 'adoption',
        label: 'Is anyone actually using it?',
        score: 0.75,
        weight: 0.2,
        reasoning:
          'The pattern spread quickly through RAG stacks because it is cheap to adopt and requires no infrastructure change. It is far more often implemented by hand from the blog post than pulled in as a library feature, which makes usage real but hard to count.',
        evidence: [
          {
            claim: 'Published as a general pattern with a cookbook rather than a product, so adoption is by reimplementation.',
            url: 'https://www.anthropic.com/news/contextual-retrieval',
          },
        ],
      },
      {
        key: 'independence',
        label: 'Has anyone outside verified it?',
        score: 0.55,
        weight: 0.15,
        reasoning:
          'The lowest factor, and deliberately so. Plenty of practitioners report it helping, but "it helped on my corpus" is not replication. The specific published gains have not, in the source material here, been independently reproduced on a public benchmark.',
        evidence: [
          {
            claim:
              'The headline figures originate from a single vendor evaluation; no independent reproduction is linked in the source material.',
            url: 'https://www.anthropic.com/news/contextual-retrieval',
          },
          {
            claim:
              'The rank-fusion component it relies on is independently established and predates this technique by well over a decade.',
            url: 'https://dl.acm.org/doi/10.1145/1571941.1572114',
          },
        ],
      },
      {
        key: 'maturity',
        label: 'Will it still look like this in a year?',
        score: 0.85,
        weight: 0.15,
        reasoning:
          'There is almost no surface to break. It is a prompt, a concatenation, and an index write — no API to deprecate, no version to pin. The only real churn risk is that your context-generating model changes underneath you, which quietly makes old and new chunks inconsistent.',
        evidence: [
          {
            claim: 'The technique introduces no new dependency or interface that could be versioned away.',
          },
        ],
      },
    ],
    useIf: [
      'Your chunks routinely say "the company", "this release", or "the previous quarter" without naming them.',
      'You are already running hybrid retrieval, or willing to — most of the reported gain comes from both indexes together.',
      'Your corpus is re-indexed rarely enough that a per-chunk model call is a one-off cost.',
    ],
    skipIf: [
      'Your chunks are already self-contained — API reference pages, product records, per-row documents.',
      'You re-index continuously and cannot absorb an LLM call per chunk each time.',
      'You have not measured your retrieval failure rate yet. Fix that first, or you will not know whether this did anything.',
    ],
    wouldChangeMyMind: [
      'An independent evaluation on a public benchmark reproducing the reported reductions would move benchmarks and independence together, and push this well into the 80s.',
      'Evidence that a plain "prepend the document title and section heading" baseline captures most of the gain would cut it sharply — that ablation is the one nobody has published.',
      'A documented case of hallucinated context poisoning retrieval at scale would expose a real operational risk the current write-ups do not address.',
    ],
  },
}
