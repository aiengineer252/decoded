import type { Entry } from '../../types'

export const contextualRetrieval: Entry = {
  slug: 'contextual-retrieval',
  name: 'Contextual Retrieval',
  org: 'Anthropic',
  tagline:
    'Before storing each chunk of a document, have a cheap model write the one sentence of context the chunk lost when you cut it out — then index that too.',
  categories: ['rag'],
  status: 'demo',
  publishedAt: '2026-08-14',
  updatedAt: '2026-09-10',
  reviewedBy: 'AI engineer',
  readingMinutes: 9,
  sources: [
    { kind: 'blog', label: 'Anthropic — Introducing Contextual Retrieval', url: 'https://www.anthropic.com/news/contextual-retrieval' },
    { kind: 'docs', label: 'Anthropic — prompt caching (what makes this affordable)', url: 'https://platform.claude.com/docs/en/build-with-claude/prompt-caching' },
    { kind: 'paper', label: 'Cormack et al. — Reciprocal Rank Fusion', url: 'https://dl.acm.org/doi/10.1145/1571941.1572114' },
  ],

  problem: {
    before:
      'You built a system that answers questions from your documents. It works — until someone asks "what was ACME\'s revenue growth in Q2 2023?" and the system says it does not know. The answer is right there in the report: "The company\'s revenue grew by 3% over the previous quarter." But that sentence, cut out and stored on its own, never mentions ACME, Q2, or 2023. The search cannot find it, because the words that would match it were left behind in the paragraphs around it.',
    insight:
      'Before you store each chunk, ask a cheap model to write one sentence saying where in the document it sits — then store that sentence glued to the front of the chunk.',
    payoff:
      'Chunks that were correct but unfindable become findable, because they now carry the words a searcher would actually use. It drops into an existing pipeline in an afternoon, and the vendor reports failure rates falling by a third to two-thirds depending on what else you stack with it.',
  },

  explainer: {
    beginner:
      'Retrieval-based question answering works like this: you cut your documents into small pieces (chunks), store each piece so it can be found later, and when a question comes in you find the most relevant pieces and hand them to a model to answer from. The weak link is the cutting. A chunk like "revenue grew 3% over the previous quarter" is perfectly accurate and useless on its own — it does not say which company or which quarter, so no search for "ACME Q2 2023" will ever land on it. Contextual Retrieval fixes this by giving each chunk a one-line label before storing it: a cheap model reads the whole document plus the chunk and writes "This is from ACME\'s Q2 2023 filing; last quarter\'s revenue was $314M." Glue that to the front, store the combination, and now the chunk contains exactly the words someone would search for. The chunk did not change. It just got its context back.',
    practitioner:
      'An index-time preprocessing step. For each chunk, one cheap LLM call sees the whole document plus that chunk and returns a short situating string, which is prepended before both embedding and BM25 indexing. The document sits behind a prompt-cache breakpoint so you pay the full-document read once rather than once per chunk — without that the cost model collapses, and this is the detail most reimplementations get wrong. Retrieval then runs hybrid, merged with reciprocal rank fusion since cosine and BM25 scores are not comparable. It stacks with reranking rather than replacing it.',
    expert:
      'The mechanism is unobjectionable; the evidence is the interesting part. All the headline reductions are first-party, on a first-party eval set, with no independent reproduction on a public benchmark — and retrieval results are notoriously corpus-dependent. The ablation nobody has published is the one that matters: how much of the gain survives against a trivial baseline of prepending the document title and section heading? That is nearly free and captures a lot of the same signal. Also worth pricing honestly: generated context is model output living permanently in your index, so a hallucinated situating line is a silently poisoned chunk, and re-indexing is now model-dependent — a model change is an index migration.',
  },
  prerequisites: [
    'The basic RAG loop: chunk documents, embed them, retrieve the relevant ones, then answer',
    'That keyword search and embedding search find things in different ways',
  ],
  glossary: [
    { term: 'RAG', plain: 'Retrieval-augmented generation. Fetch relevant text first, then let the model answer using it.' },
    { term: 'chunk', plain: 'A slice of a document, small enough to store and retrieve on its own. Typically a few hundred words.' },
    { term: 'embedding', plain: 'A list of numbers representing meaning, so text with similar meaning lands close together.' },
    { term: 'BM25', plain: 'A classic keyword-matching ranking. Good at exact terms — names, dates, codes — that embeddings tend to blur.' },
    { term: 'hybrid retrieval', plain: 'Running embedding search and keyword search together and merging the two result lists.' },
    { term: 'RRF', plain: 'Reciprocal rank fusion. Merges ranked lists by position rather than score, so it does not matter that the scores are on different scales.' },
    { term: 'prompt caching', plain: 'Reusing an already-processed prompt prefix so you are not billed full price for re-sending the same document over and over.' },
    { term: 'reranker', plain: 'A second, slower model that re-scores the top results by reading query and chunk together.' },
  ],
  changelog: [
    { date: '2026-09-10', note: 'Rewritten for progressive reading: problem-first opener, plain-language trace, whole-function code with guided walkthroughs.' },
    { date: '2026-08-14', note: 'First published. Scored 74 — mechanism is sound, but all published numbers are single-source.' },
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
        summary: 'the whole file, before it is cut into pieces',
        detail:
          'The full document is the thing chunking destroys. A chunk that reads "revenue grew 3% over the previous quarter" is unretrievable for the query "ACME Q2 2023 revenue growth" because neither the company nor the quarter survives the split. Contextual Retrieval keeps the whole document around long enough to put that information back.',
        plain:
          'The original report, in full. Cutting it into chunks throws away the surrounding context — which company, which quarter — that makes each piece meaningful. This method keeps the whole document on hand just long enough to give each chunk that context back.',
      },
      {
        id: 'chunker',
        label: 'Chunker',
        kind: 'compute',
        col: 1,
        row: 0,
        summary: 'split into pieces — the same way you already do',
        detail:
          'Unchanged from your existing pipeline — same splitter, same chunk size, same overlap. This method does not ask you to chunk differently; it repairs the damage after the fact.',
        plain:
          'Cut the document into chunks exactly as before. Nothing changes here — the fix happens after the cutting, not instead of it.',
      },
      {
        id: 'contextualizer',
        label: 'Contextualizer',
        kind: 'model',
        col: 2,
        row: 0,
        summary: 'a cheap model writes 1-2 sentences of context per chunk',
        detail:
          'One cheap model call per chunk. It sees the whole document plus the one chunk, and returns a short situating sentence — which company, which period, which section. That string is prepended to the chunk before anything is indexed. The generated context is never shown to the user; it exists only to make the chunk findable.',
        plain:
          'For each chunk, a cheap model reads the whole document and that chunk, then writes one sentence: "This is from ACME\'s Q2 2023 report, about revenue." That sentence gets stuck to the front of the chunk before storing. Nobody ever reads it — it exists purely so the chunk can be found.',
        code: {
          lang: 'python',
          file: 'index_document — the whole change, with the cache placement that makes it affordable',
          url: 'https://www.anthropic.com/news/contextual-retrieval',
          snippet: `SITUATE = """<document>
{document}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{chunk}
</chunk>

Give a short succinct context to situate this chunk within the overall
document for the purposes of improving search retrieval of the chunk.
Answer only with the succinct context and nothing else."""


def index_document(document: str, doc_id: str) -> None:
    chunks = splitter.split_text(document)          # your existing splitter

    for i, chunk in enumerate(chunks):
        # ONE call per chunk. The document is the big part of the prompt and it
        # is identical every time, so it sits behind a cache breakpoint: the
        # first chunk pays to process it, the other N-1 read it at ~10% price.
        resp = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=200,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": f"<document>\\n{document}\\n</document>",
                 "cache_control": {"type": "ephemeral"}},          # <- stable prefix
                {"type": "text",
                 "text": SITUATE.split("</document>", 1)[1].format(document="", chunk=chunk)},
            ]}],
        )
        context = resp.content[0].text.strip()

        # Prepend, then index the SAME string both ways
        text = f"{context}\\n\\n{chunk}"
        vector_index.add(embed(text), payload={"doc": doc_id, "i": i, "text": text})
        bm25_index.add(doc_id=f"{doc_id}:{i}", text=text)`,
          walkthrough: [
            {
              lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
              title: 'The prompt, as published',
              note: 'Whole document, then the one chunk, then an instruction that is deliberately narrow: situate, do not summarise, do not answer. The "answer only with the context" line matters — anything else the model says ends up in your index.',
              plain: 'Show the model the whole document and one chunk, and ask a very specific question: "where does this chunk sit in the document?" Not "summarise it", not "explain it" — just situate it. Whatever it says back gets stored, so keep the ask tight.',
            },
            {
              lines: [16],
              title: 'Chunking is untouched',
              note: 'Same splitter, same sizes, same overlap as you already run. This method repairs what chunking loses rather than asking you to chunk differently — which is why it slots into an existing pipeline without a migration.',
              plain: 'Cut the document up exactly as you always did. You do not need to change your chunking to use this.',
            },
            {
              lines: [19, 20, 21],
              title: 'Why this is affordable',
              note: 'Read this comment before the code. Without caching you would re-send the entire document for every chunk — 200 chunks means 200 full-document prompts, which is absurd. With the document behind a cache breakpoint, one chunk pays the write and the rest read it at a fraction of the price. The economics of the whole technique rest on this.',
              plain: 'The trick that keeps this cheap: the document is the same for every chunk, so we tell the API to remember it after the first time. The first chunk pays full price to process the document; the other 199 reuse that work for about a tenth of the cost.',
            },
            {
              lines: [22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
              title: 'The cached prefix, then the varying part',
              note: 'The document block carries cache_control and comes first; only the chunk-specific instruction varies after it. This ordering is the whole point — caching is a prefix match, so anything that changes must come after the breakpoint. Swap the order and every call is a cache miss.',
              plain: 'The document goes first with a "remember this" flag. The part that changes per chunk comes after. Order matters: the reusable part has to be in front, or the reuse never happens.',
            },
            {
              lines: [35, 36, 37],
              title: 'Index the concatenation, both ways',
              note: 'The stored text is context + original chunk. The same string goes into the vector index and the BM25 index. That single decision is why the lexical side improves too: "ACME" and "Q2 2023" are now literal tokens in the chunk, and BM25 matches exact tokens.',
              plain: 'Glue the context sentence onto the front of the chunk and store that combined text — in both the embedding search and the keyword search. Now the keyword search can literally find "ACME" and "Q2 2023" in the chunk, because they are actually in it.',
            },
          ],
        },
      },
      {
        id: 'cache',
        label: 'Prompt cache',
        kind: 'store',
        col: 2,
        row: 1,
        summary: 'the document is processed once, reused per chunk',
        detail:
          'Without caching this design is absurd: you would re-send the entire document once per chunk, so a 200-chunk document means 200 full-document prompts. With the document behind a cache breakpoint, the first chunk pays the write and the other 199 read it at a fraction of the price. The economics of the whole technique rest on this one detail.',
        plain:
          'Sending a 50-page document 200 times would cost a fortune. The cache means the API processes it once and reuses that work for every chunk. This is the detail that turns "obviously right but too expensive" into "obviously right".',
      },
      {
        id: 'embed',
        label: 'Embedding index',
        kind: 'store',
        col: 3,
        row: 0,
        summary: 'stores the vector of context + chunk together',
        detail:
          'The vector is computed over the concatenation, not the original chunk. Same embedding model, same index, same dimensionality — the only change is that the text being embedded now carries its own coordinates.',
        plain:
          'The meaning-based search. It now embeds the combined text — context plus chunk — so "ACME Q2 revenue" lands close to it. Same model, same index as before; only the input text changed.',
      },
      {
        id: 'bm25',
        label: 'BM25 index',
        kind: 'store',
        col: 3,
        row: 1,
        summary: 'keyword index over the same combined text',
        detail:
          'The identical contextualized string is also indexed lexically. This matters more than it looks: the added context supplies exact tokens — company names, quarters, product codes — that BM25 can match and embeddings routinely blur together.',
        plain:
          'The keyword search, over the same combined text. This gets a big boost because the context sentence contains exact names and dates — the kind of thing keyword search is great at and meaning-based search tends to smudge.',
      },
      {
        id: 'fusion',
        label: 'Rank fusion',
        kind: 'control',
        col: 4,
        row: 0,
        summary: 'merge the two result lists by position, not score',
        detail:
          'The two result lists are merged by rank, not by score — the scores are not comparable across a cosine similarity and a BM25 weight. Reciprocal Rank Fusion sums 1/(k + rank) across lists, which needs no tuning and no score normalisation.',
        plain:
          'Two searches produce two ranked lists. Their scores are on completely different scales, so you cannot just add them. Instead, merge by position: something ranked 1st in both lists beats something ranked 1st in one and 50th in the other. Simple, and needs no tuning.',
        code: {
          lang: 'python',
          file: 'reciprocal rank fusion — the complete algorithm, plus the retrieve step that uses it',
          url: 'https://dl.acm.org/doi/10.1145/1571941.1572114',
          snippet: `from collections import defaultdict

def rrf(rankings: list[list[str]], k: int = 60) -> list[str]:
    """Merge several ranked lists by position. Scores are ignored on purpose."""
    scores = defaultdict(float)
    for ranking in rankings:                       # one list per retriever
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] += 1.0 / (k + rank)     # rank 1 -> 1/61, rank 2 -> 1/62 ...
    return sorted(scores, key=scores.get, reverse=True)


def retrieve(query: str, top_k: int = 20) -> list[str]:
    semantic = vector_index.search(embed(query), n=150)   # ids, best first
    lexical  = bm25_index.search(query, n=150)            # ids, best first

    fused = rrf([semantic, lexical])
    return fused[:top_k]`,
          walkthrough: [
            {
              lines: [3, 4, 5],
              title: 'Inputs are rankings, not scores',
              note: 'RRF takes ordered lists of ids. It deliberately never looks at the underlying scores, because a cosine similarity of 0.82 and a BM25 score of 14.3 mean nothing relative to each other.',
              plain: 'The function takes lists of results in order — first place, second place, and so on. It ignores the actual scores, because a score from keyword search and a score from meaning search are not comparable.',
            },
            {
              lines: [6, 7, 8],
              title: 'The formula',
              note: 'Each appearance adds 1/(k + rank). k=60 is the value from the original paper and is not sensitive — it just keeps a top-1 from dominating. A document ranked 1st in both lists gets 2/61; ranked 1st in one and 50th in the other gets 1/61 + 1/110.',
              plain: 'Each list gives a document points based on its position: first place is worth the most, and the points shrink smoothly down the list. Points from both lists are added up. Something high in both wins.',
            },
            {
              lines: [13, 14, 15],
              title: 'Run both searches wide',
              note: 'Fetch more than you need from each retriever (150 here for a final 20). The fusion works better with overlap to find, and the reranker downstream, if you have one, wants a wide shortlist.',
              plain: 'Ask both searches for a generous number of results — more than you will keep — so there is enough overlap for the merge to be meaningful.',
            },
            {
              lines: [17, 18],
              title: 'Fuse, then cut',
              note: 'Merge, then take the top k. This shortlist is what a reranker would score next; without a reranker it goes straight to the answering model.',
              plain: 'Merge the two lists and keep the top 20. Those are the chunks that get handed to the model to answer the question.',
            },
          ],
        },
      },
      {
        id: 'rerank',
        label: 'Reranker',
        kind: 'compute',
        col: 5,
        row: 0,
        summary: 'optional: re-score the shortlist by reading query + chunk together',
        detail:
          'A cross-encoder scores query and chunk together instead of comparing two independently-computed vectors, so it can catch relevance that no bi-encoder will. It is a separate technique that stacks with this one — the published numbers improve again when it is added, and it is listed separately here because it is not part of Contextual Retrieval itself.',
        plain:
          'An optional extra step: a slower model reads the question and each shortlisted chunk side by side and re-orders them. It is a separate technique that works well on top of this one — but it is not part of Contextual Retrieval, so we keep it separate when talking about what gained what.',
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
        plain: 'Here is the chunk that holds the answer. It is correct. But look at the words in it and the words in the question — they share nothing. "ACME", "Q2", "2023" are all missing. No search of any kind can connect them.',
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
        plain: 'A cheap model reads the whole 47-page document and this one chunk, and writes a single sentence saying where the chunk comes from. Notice what it produces: the company name, the quarter, the year — exactly the words the question uses.',
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
        plain: 'Glue the context sentence to the front of the chunk and store the combined text — in both the meaning-based index and the keyword index. The chunk now literally contains "ACME" and "Q2 2023".',
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
        plain: 'Now search. The meaning-based search puts chunk 41 at the top because the combined text is about ACME revenue. The keyword search puts it at the top because "ACME" and "Q2 2023" are literally there. Merge the two lists by position — chunk 41 wins comfortably.',
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
        plain: 'Optionally, a slower model reads the question next to each of the top chunks and re-orders them. This helps, but it is a separate technique — if you add it, be honest about which gain came from which.',
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
    doesNotReplace: ['your chunker', 'your embedding model', 'your vector database', 'reranking', 'the generation step'],
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
      { side: 'before', lines: [4, 5], note: 'The vector is computed over text that has already lost its subject. Nothing downstream can recover it.' },
      { side: 'before', lines: [7, 8, 9], note: 'This is the actual ceiling on most RAG systems — not the embedding model, not the top-k.' },
      { side: 'after', lines: [4], note: 'One extra model call per chunk, at index time. Users never wait on it; it happens once, offline.' },
      { side: 'after', lines: [5], note: 'The context is prepended to the stored text, so it is what gets embedded AND what BM25 sees.' },
      { side: 'after', lines: [7, 8], note: 'Indexing both ways off one string is why the lexical gain comes almost free.' },
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
          { claim: 'The situating prompt is published in full, along with a runnable cookbook.', url: 'https://www.anthropic.com/news/contextual-retrieval' },
          { claim: 'The prompt-caching mechanism the cost model depends on is documented separately.', url: 'https://platform.claude.com/docs/en/build-with-claude/prompt-caching' },
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
          { claim: 'No independent benchmark isolating this technique across diverse corpora appears in the source material.' },
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
          { claim: 'Published as a general pattern with a cookbook rather than a product, so adoption is by reimplementation.', url: 'https://www.anthropic.com/news/contextual-retrieval' },
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
          { claim: 'The headline figures originate from a single vendor evaluation; no independent reproduction is linked in the source material.', url: 'https://www.anthropic.com/news/contextual-retrieval' },
          { claim: 'The rank-fusion component it relies on is independently established and predates this technique by well over a decade.', url: 'https://dl.acm.org/doi/10.1145/1571941.1572114' },
        ],
      },
      {
        key: 'maturity',
        label: 'Will it still look like this in a year?',
        score: 0.85,
        weight: 0.15,
        reasoning:
          'There is almost no surface to break. It is a prompt, a concatenation, and an index write — no API to deprecate, no version to pin. The only real churn risk is that your context-generating model changes underneath you, which quietly makes old and new chunks inconsistent.',
        evidence: [{ claim: 'The technique introduces no new dependency or interface that could be versioned away.' }],
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
