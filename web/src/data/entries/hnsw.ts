import type { Entry } from '../../types'

export const hnsw: Entry = {
  slug: 'hnsw',
  name: 'HNSW',
  org: 'Malkov & Yashunin',
  tagline:
    'Stack proximity graphs at exponentially thinning densities, then greedily descend them — turning nearest-neighbour search from a scan into a walk.',
  categories: ['rag', 'inference'],
  status: 'demo',
  publishedAt: '2026-08-14',
  updatedAt: '2026-08-14',
  reviewedBy: 'AI engineer',
  readingMinutes: 8,
  explainer: {
    beginner:
      'Search over embeddings means finding the items closest to your query in a space with hundreds of dimensions. The simple way is to measure the distance to every single item and keep the nearest — correct, but the work grows in direct proportion to how much data you have, so it stops being viable somewhere in the hundreds of thousands. HNSW instead builds a network of "who is near whom" in advance, arranged in layers: a sparse top layer for crossing large distances quickly, and a dense bottom layer holding everything. A search starts at the top, takes a few long hops toward the right region, then walks carefully at the bottom. In our worked example it finds the right answer after 757 distance measurements instead of a million.',
    practitioner:
      'A multi-layer proximity graph. Each element is assigned a maximum layer from an exponentially decaying distribution, so upper layers are sparse long-range maps and layer 0 contains everything. Search greedily descends from a fixed entry point, re-entering each layer at the previous layer\'s local minimum, then runs a beam search of width ef at the bottom. ef is a query-time recall/latency dial that needs no reindex; M (graph degree) and ef_construction are build-time and do not. The under-appreciated part is the neighbour-selection heuristic — keeping diverse rather than merely nearest neighbours is what stops the graph fragmenting, and is why naive reimplementations underperform.',
    expert:
      'Worth being precise about where it actually costs you, because the algorithm itself is settled. Memory is the binding constraint, not compute: the graph adds roughly M x 2 links per element on top of the vectors, all resident. Deletes are tombstones in most implementations, so a churned index degrades until rebuilt — there is no incremental graph repair in the reference implementation. And filtered search remains the genuine open problem: post-filtering under-returns, and filtering during traversal can disconnect the graph, which is why every vector database has its own partial answer here rather than a shared one. If you are evaluating vendors, that is the axis worth interrogating, not recall@10.',
  },
  prerequisites: [
    'What an embedding is — text or images turned into a list of numbers',
    'That "similar" means "close together" in that space',
  ],
  glossary: [
    { term: 'ANN', plain: 'Approximate nearest neighbour. Trades a guarantee of finding the true closest match for a very large speedup.' },
    { term: 'recall', plain: 'The fraction of the true nearest neighbours you actually got back. 0.95 means you found 95% of them.' },
    { term: 'ef', plain: 'How many candidates the search keeps in play at the bottom layer. Higher means better recall and slower queries.' },
    { term: 'M', plain: 'How many neighbours each item is connected to in the graph. Set when the index is built and fixed after.' },
    { term: 'greedy search', plain: 'Repeatedly move to whichever neighbour is closer to the target, and stop when none is closer.' },
    { term: 'flat index', plain: 'The brute-force approach: compare against every item. Exact, and linear in dataset size.' },
  ],
  changelog: [{ date: '2026-08-14', note: 'First published. Traced against the original paper and the reference implementation.' }],
  sources: [
    {
      kind: 'paper',
      label: 'Malkov & Yashunin — Efficient and robust ANN search using HNSW graphs',
      url: 'https://arxiv.org/abs/1603.09320',
    },
    { kind: 'repo', label: 'nmslib/hnswlib — reference implementation', url: 'https://github.com/nmslib/hnswlib' },
    { kind: 'benchmark', label: 'ANN-Benchmarks — independent, reproducible comparison', url: 'https://ann-benchmarks.com' },
    { kind: 'repo', label: 'facebookresearch/faiss', url: 'https://github.com/facebookresearch/faiss' },
  ],

  architecture: {
    caption:
      'This is the index inside your vector database. Whichever one you pay for, the odds are very high that this graph is what it is actually doing.',
    nodes: [
      {
        id: 'vec',
        label: 'Query vector',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'one embedding, d dims',
        detail:
          'HNSW is metric-agnostic — cosine, inner product, or L2. What it needs is a distance function, not a particular embedding model. Everything below is about how few of those distance computations it can get away with.',
      },
      {
        id: 'layers',
        label: 'Layer stack',
        kind: 'store',
        col: 1,
        row: 0,
        summary: 'each layer ~1/M the last',
        detail:
          'On insert, each element is assigned a maximum layer drawn from an exponentially decaying distribution. Almost everything lives only in layer 0; a handful of elements reach the top. The upper layers are therefore a sparse, long-range map of the space — the express lanes — and layer 0 holds every point.',
        code: {
          lang: 'python',
          file: 'layer assignment — Algorithm 1 of the paper',
          url: 'https://arxiv.org/abs/1603.09320',
          snippet: `# mL is the level-generation constant; the paper's rule of thumb is 1/ln(M)
level = floor(-log(uniform(0, 1)) * mL)

# With M=16, roughly 1 in 16 elements reaches layer 1,
# 1 in 256 reaches layer 2, and so on.`,
          focus: [2],
        },
      },
      {
        id: 'entry',
        label: 'Entry point',
        kind: 'control',
        col: 2,
        row: 0,
        summary: 'top layer, single node',
        detail:
          'Search always starts at the same element: the one occupying the highest layer. From there the walk is greedy and the beam is width 1 until it reaches the bottom — the upper layers exist purely to cover distance cheaply, not to be accurate.',
      },
      {
        id: 'greedy',
        label: 'Greedy descent',
        kind: 'compute',
        col: 3,
        row: 0,
        summary: 'move to closer neighbour, repeat',
        detail:
          'At each layer: look at the current node\'s neighbours, move to whichever is closest to the query, repeat until no neighbour is closer. That local minimum becomes the entry point for the layer below. Each layer costs a handful of distance computations and eliminates a large region of the space.',
        code: {
          lang: 'python',
          file: 'greedy search in one layer — SEARCH-LAYER with ef=1',
          url: 'https://arxiv.org/abs/1603.09320',
          snippet: `def search_layer_greedy(q, entry, layer):
    current = entry
    while True:
        closer = min(neighbours(current, layer), key=lambda n: dist(q, n))
        if dist(q, closer) >= dist(q, current):
            return current          # local minimum for this layer
        current = closer`,
          focus: [4, 5, 6],
        },
      },
      {
        id: 'beam',
        label: 'Layer 0 beam search',
        kind: 'compute',
        col: 4,
        row: 0,
        summary: 'ef candidates, not 1',
        detail:
          'The bottom layer is where accuracy is bought. Instead of a single greedy walk it keeps a dynamic candidate list of size ef, expanding the closest unvisited candidate and maintaining a result heap. ef is the recall dial: raise it and you visit more nodes for better recall, at a directly proportional latency cost. It is a query-time parameter — no reindex needed to change it.',
        code: {
          lang: 'python',
          file: 'the recall/latency dial, set per query',
          url: 'https://github.com/nmslib/hnswlib',
          snippet: `index.set_ef(64)              # ef must exceed k
labels, distances = index.knn_query(q, k=10)

# ef=16  -> fast, lower recall
# ef=200 -> slower, recall approaching exhaustive search`,
          focus: [1],
        },
      },
      {
        id: 'heur',
        label: 'Neighbour heuristic',
        kind: 'control',
        col: 3,
        row: 1,
        summary: 'diverse, not just nearest',
        detail:
          'On insert, the M neighbours kept are not simply the M closest. The paper\'s heuristic drops a candidate if it is closer to an already-selected neighbour than to the new element — deliberately preserving long-range links instead of letting dense clusters connect only inward. Without this the graph fragments and greedy search gets trapped. This is the least-appreciated part of the algorithm and the reason naive reimplementations underperform.',
      },
      {
        id: 'out',
        label: 'Top-k neighbours',
        kind: 'output',
        col: 5,
        row: 0,
        summary: 'approximate, not exact',
        detail:
          'The result is approximate: there is no guarantee the true nearest neighbour is returned. In practice, well-tuned parameters reach recall in the high 90s while touching a tiny fraction of the dataset — but "approximate" is a real property, and any system that must not miss a match needs an exact fallback.',
      },
    ],
    edges: [
      { from: 'vec', to: 'layers' },
      { from: 'layers', to: 'entry', label: 'top layer' },
      { from: 'entry', to: 'greedy' },
      { from: 'greedy', to: 'beam', label: 'descend' },
      { from: 'greedy', to: 'greedy', kind: 'dashed', label: 'next layer' },
      { from: 'heur', to: 'layers', kind: 'dashed', label: 'on insert' },
      { from: 'beam', to: 'out' },
    ],
    flow: ['vec', 'layers', 'entry', 'greedy', 'beam', 'out'],
  },

  trace: {
    caption:
      'One query against a one-million-vector index. Count the distance computations as you step — that number is the entire value proposition.',
    input: {
      type: 'ndarray (768,)',
      preview: 'q = [0.021, -0.113, 0.087, …]   # 768-dim query embedding',
    },
    steps: [
      {
        id: 'h1',
        nodeId: 'layers',
        label: 'The index, as built',
        note: 'One million vectors, M=16. The layer distribution is exponential, so the top layers are tiny. This shape is what makes the descent cheap — the first hops cross enormous distances while touching almost nothing.',
        input: { type: 'index', preview: '1,000,000 vectors · M=16 · ef_construction=200' },
        output: {
          type: 'layer occupancy',
          preview: `layer 3:          15 nodes
layer 2:         244 nodes
layer 1:      62,500 nodes
layer 0:   1,000,000 nodes   (every element)`,
        },
      },
      {
        id: 'h2',
        nodeId: 'greedy',
        label: 'Layer 3 — cross the space',
        note: 'Start at the single entry point and greedily walk to the closest neighbour. Only 15 nodes exist here, so each hop covers a huge distance for almost no compute.',
        input: { type: 'entry node', preview: 'node #778,412 (top-layer entry point)' },
        output: {
          type: 'local minimum',
          preview: `hops: 2      distance computations: 9
best so far: d = 0.612`,
        },
        cost: '9 distance ops',
      },
      {
        id: 'h3',
        nodeId: 'greedy',
        label: 'Layers 2 and 1 — narrow in',
        note: 'Each descent re-enters at the previous layer\'s local minimum. The graph is denser now, so hops are shorter and more numerous, but the search is already in the right region of the space.',
        input: { type: 'entry node', preview: 'layer 3 local minimum' },
        output: {
          type: 'local minimum',
          preview: `layer 2:  hops 4,  dist ops 41,  best d = 0.317
layer 1:  hops 7,  dist ops 96,  best d = 0.194`,
        },
        cost: '137 distance ops',
      },
      {
        id: 'h4',
        nodeId: 'beam',
        label: 'Layer 0 — beam search with ef=64',
        note: 'This is where recall is actually earned. Instead of one greedy path it maintains 64 candidates, expanding the nearest unvisited one and keeping a result heap. Everything above was just getting to the right neighbourhood cheaply.',
        input: { type: 'entry + ef', preview: 'entry = layer 1 minimum, ef = 64, k = 10' },
        output: {
          type: 'top-k',
          preview: `visited: 611 nodes
[ (id 40122, 0.081), (id 913, 0.089), (id 55019, 0.094), … ]`,
        },
        cost: '611 distance ops',
      },
      {
        id: 'h5',
        nodeId: 'out',
        label: 'Total cost, against the alternative',
        note: 'Brute force would compute one million distances. HNSW computed 757 — about 0.08% of the work — and in this configuration typically returns the true top-10 almost every time. "Almost" is the trade, and it is a real one.',
        output: {
          type: 'comparison',
          preview: `HNSW:        757 distance computations
Exhaustive: 1,000,000 distance computations

~1,300x fewer, for approximate results.`,
        },
      },
    ],
    result: {
      type: 'list[(id, distance)]',
      preview: `Top-10 neighbours from 1M vectors.

Cost scales roughly logarithmically with dataset size,
which is why the same index shape works at 10M and 100M.

Recall is a dial (ef), not a fixed property.`,
    },
  },

  displacement: {
    replaces: ['brute-force / flat vector scan', 'IVF-only indexes', 'LSH-based ANN'],
    doesNotReplace: [
      'the embedding model',
      'exact search when you cannot miss a match',
      'metadata filtering',
      'BM25 / lexical retrieval',
      'reranking',
    ],
    before: {
      label: 'Flat index — compare against everything',
      lang: 'python',
      file: 'exact search, and why it stops scaling',
      snippet: `import numpy as np

def search(q, vectors, k=10):
    d = vectors @ q                    # 1,000,000 dot products
    top = np.argpartition(-d, k)[:k]
    return top[np.argsort(-d[top])]

# Exact. Simple. Correct.
# Cost is linear in dataset size, every single query.`,
    },
    after: {
      label: 'HNSW — walk a graph instead',
      lang: 'python',
      file: 'hnswlib',
      url: 'https://github.com/nmslib/hnswlib',
      snippet: `import hnswlib

index = hnswlib.Index(space='cosine', dim=768)
index.init_index(max_elements=1_000_000, M=16, ef_construction=200)
index.add_items(vectors, ids)

index.set_ef(64)                       # recall/latency dial, per query
labels, distances = index.knn_query(q, k=10)

# ~757 distance computations instead of 1,000,000.`,
    },
    annotations: [
      {
        side: 'before',
        lines: [4],
        note: 'Every query touches every vector. At 1M x 768 dims this is the whole cost, and it grows linearly forever.',
      },
      {
        side: 'before',
        lines: [7, 8],
        note: 'Worth saying plainly: for under ~50k vectors this is often the right answer. Flat search is not a mistake at small scale.',
      },
      {
        side: 'after',
        lines: [4],
        note: 'M is the graph degree — fixed at build time. Raising it improves recall and costs memory on every element.',
      },
      {
        side: 'after',
        lines: [4],
        note: 'ef_construction controls build-time thoroughness. Too low here and no query-time ef can rescue the graph.',
      },
      {
        side: 'after',
        lines: [7],
        note: 'ef is the one knob you can move per query without rebuilding — the only free lever in the whole system.',
      },
    ],
    whatDisappears: [
      'Query latency that grows linearly with corpus size.',
      'The need to shard purely to keep scan times tolerable.',
      'Choosing between "search everything" and "search a sampled subset".',
    ],
    newCosts: [
      'The graph lives in RAM alongside the vectors — roughly M x 2 links per element on top of the raw data. Memory, not compute, is usually what limits you.',
      'Results are approximate. There is no guarantee the true nearest neighbour comes back, and no error bound telling you when it did not.',
      'Deletes are soft. Most implementations tombstone rather than repair the graph, so a heavily-churned index degrades until it is rebuilt.',
      'Build time is substantial and single-threaded insertion is slow; ef_construction is a build-time decision you cannot revisit cheaply.',
      'Metadata filtering fights the graph: filtering after search may return too few results, and filtering during traversal can disconnect it.',
    ],
  },

  verdict: {
    score: 94,
    headline:
      'Bedrock. A decade old, independently benchmarked in public for years, and running underneath essentially every vector database you might consider — the only real question is whether you need ANN at all.',
    factors: [
      {
        key: 'reproducibility',
        label: 'Can you run it today?',
        score: 0.98,
        weight: 0.25,
        reasoning:
          'The paper specifies the algorithms completely enough to implement from scratch, and the authors publish a reference implementation. It is also embedded in FAISS and every mainstream vector database, so "running it" is usually a pip install away.',
        evidence: [
          { claim: 'Full algorithm specification published, including the neighbour-selection heuristic.', url: 'https://arxiv.org/abs/1603.09320' },
          { claim: 'Reference implementation maintained by the authors.', url: 'https://github.com/nmslib/hnswlib' },
          { claim: 'Independently reimplemented inside FAISS.', url: 'https://github.com/facebookresearch/faiss' },
        ],
      },
      {
        key: 'benchmarks',
        label: 'Are the numbers real?',
        score: 0.9,
        weight: 0.25,
        reasoning:
          'ANN-Benchmarks is exactly what you want and rarely get: a public, independent, reproducible harness that plots recall against throughput across many datasets and competing algorithms. HNSW is consistently on or near the Pareto frontier — and, importantly, you can see where it is not.',
        evidence: [
          { claim: 'Independent public benchmark suite plotting recall/throughput across datasets and libraries.', url: 'https://ann-benchmarks.com' },
          { claim: 'The original paper reports comparisons against prior ANN methods with published parameters.', url: 'https://arxiv.org/abs/1603.09320' },
        ],
      },
      {
        key: 'adoption',
        label: 'Is anyone actually using it?',
        score: 0.95,
        weight: 0.2,
        reasoning:
          'It is the default index type across the vector database ecosystem and inside FAISS. If you have run a similarity search in the last few years, you have very likely run this algorithm without choosing it.',
        evidence: [
          { claim: 'Shipped as a core index type in FAISS.', url: 'https://github.com/facebookresearch/faiss' },
          { claim: 'The reference library is widely depended on directly by other systems.', url: 'https://github.com/nmslib/hnswlib' },
        ],
      },
      {
        key: 'independence',
        label: 'Has anyone outside verified it?',
        score: 0.95,
        weight: 0.15,
        reasoning:
          'Reimplemented many times over by parties with no connection to the authors, and continuously measured by a third-party benchmark that the authors do not control. This is about as independently verified as an algorithm gets.',
        evidence: [
          { claim: 'Multiple independent reimplementations exist across libraries and languages.', url: 'https://github.com/facebookresearch/faiss' },
          { claim: 'Continuously evaluated by a third-party benchmark suite.', url: 'https://ann-benchmarks.com' },
        ],
      },
      {
        key: 'maturity',
        label: 'Will it still look like this in a year?',
        score: 0.9,
        weight: 0.15,
        reasoning:
          'The algorithm has not meaningfully changed since publication and will not — it is a data structure, not a heuristic chasing a benchmark. What still moves is the engineering around it: on-disk variants, quantisation combinations, and filtered search, which remains the genuinely unsolved part.',
        evidence: [
          { claim: 'Core algorithm unchanged since the original publication; later work layers on top rather than replacing it.', url: 'https://arxiv.org/abs/1603.09320' },
        ],
      },
    ],
    useIf: [
      'You have more than a few hundred thousand vectors and query latency matters.',
      'Your working set fits in RAM, or you can shard until it does.',
      'Approximate results are acceptable — recall in the high 90s rather than a guarantee.',
    ],
    skipIf: [
      'You have under ~50k vectors. A flat scan is exact, simpler, and probably faster than you assume.',
      'You are memory-bound. Quantisation or a disk-based index will serve you better than a graph in RAM.',
      'Your queries are dominated by heavy metadata filters — that is HNSW\'s genuine weak spot, not a tuning problem.',
    ],
    wouldChangeMyMind: [
      'Nothing about whether it works — that has been settled in public for years.',
      'A disk-native index reaching comparable recall at comparable latency would erode the main reason to keep everything resident in RAM.',
      'A principled solution to filtered ANN search that HNSW cannot absorb would take real ground from it.',
    ],
  },
}
