import type { Entry } from '../../types'

export const hnsw: Entry = {
  slug: 'hnsw',
  name: 'HNSW',
  org: 'Malkov & Yashunin',
  tagline:
    'Turn "find the closest item among a million" from a scan into a walk: a few long hops across a sparse map, then careful steps in a dense one.',
  categories: ['rag', 'inference'],
  status: 'demo',
  publishedAt: '2026-08-14',
  updatedAt: '2026-09-10',
  reviewedBy: 'AI engineer',
  readingMinutes: 9,
  sources: [
    { kind: 'paper', label: 'Malkov & Yashunin — Efficient and robust ANN search using HNSW graphs', url: 'https://arxiv.org/abs/1603.09320' },
    { kind: 'repo', label: 'nmslib/hnswlib — reference implementation', url: 'https://github.com/nmslib/hnswlib' },
    { kind: 'benchmark', label: 'ANN-Benchmarks — independent, reproducible comparison', url: 'https://ann-benchmarks.com' },
    { kind: 'repo', label: 'facebookresearch/faiss', url: 'https://github.com/facebookresearch/faiss' },
  ],

  problem: {
    before:
      'You have a million embeddings and a query. "Which are the closest?" The honest way is to measure the distance to all million and keep the nearest — correct, but the cost grows in a straight line with your data, every single query. At a few hundred thousand items it is already too slow for a request path, and it never gets better.',
    insight:
      'Build a map in advance where every item knows its neighbours, stacked in layers from sparse to dense — then search by walking toward the query instead of scanning everything.',
    payoff:
      'In the worked example, the right answer after 757 distance measurements instead of a million — roughly 1,300x less work — with recall you can dial up or down per query. This is the index inside whichever vector database you pick.',
  },

  explainer: {
    beginner:
      'Think about how you would find a friend\'s house in a city you do not know. You would not check every house. You would look at a country map to get to the right city, a city map to get to the right neighbourhood, and only then walk street by street. HNSW builds exactly that: a stack of maps. The top map has only a few landmarks, so each hop crosses a huge distance. Each map below has more detail. The bottom map has every single item. A search starts at the top, takes a couple of long hops toward the query, drops down a level, hops again, and by the time it reaches the bottom it is already in the right neighbourhood and only needs to check a few hundred nearby items. The answer is "almost certainly" the true closest — you trade a small chance of missing it for an enormous speedup, and you can tune that trade per query.',
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
    { term: 'nearest neighbour', plain: 'The stored item whose numbers are closest to your query\'s numbers. "Closest" is a distance you choose — usually cosine or Euclidean.' },
    { term: 'ANN', plain: 'Approximate nearest neighbour. You give up a guarantee of finding the exact closest item in exchange for a very large speedup.' },
    { term: 'recall', plain: 'The fraction of the true nearest neighbours you actually got back. 0.95 means you found 95% of them.' },
    { term: 'ef', plain: 'How many candidates the search keeps in play at the bottom layer. Higher means better recall and slower queries. You can change it per query.' },
    { term: 'M', plain: 'How many neighbours each item is connected to in the graph. Set when the index is built and fixed afterwards.' },
    { term: 'greedy search', plain: 'Repeatedly move to whichever neighbour is closer to the target, and stop when none is closer.' },
    { term: 'flat index', plain: 'The brute-force approach: compare against every item. Exact, and linear in dataset size.' },
  ],
  changelog: [
    { date: '2026-09-10', note: 'Rewritten for progressive reading: problem-first opener, plain-language trace, whole-function code with guided walkthroughs.' },
    { date: '2026-08-14', note: 'First published. Traced against the original paper and the reference implementation.' },
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
        summary: 'the embedding you want neighbours for',
        detail:
          'HNSW is metric-agnostic — cosine, inner product, or L2. What it needs is a distance function, not a particular embedding model. Everything below is about how few of those distance computations it can get away with.',
        plain:
          'Your search term, already turned into a list of numbers. HNSW does not care which model made it — it only needs a way to measure distance between two lists. The whole game is doing as few of those measurements as possible.',
      },
      {
        id: 'layers',
        label: 'Layer stack',
        kind: 'store',
        col: 1,
        row: 0,
        summary: 'maps from sparse (top) to complete (bottom)',
        detail:
          'On insert, each element is assigned a maximum layer drawn from an exponentially decaying distribution. Almost everything lives only in layer 0; a handful of elements reach the top. The upper layers are therefore a sparse, long-range map of the space — the express lanes — and layer 0 holds every point.',
        plain:
          'A stack of maps. Every item is on the bottom map. About 1 in 16 also appears on the map above, 1 in 256 on the one above that, and so on. So the top maps have only a few widely-spaced landmarks — good for crossing big distances fast — and the bottom map has everything, for the careful final search.',
        code: {
          lang: 'python',
          file: 'inserting one element — layer assignment and linking (Algorithm 1, simplified)',
          url: 'https://arxiv.org/abs/1603.09320',
          snippet: `def insert(index, q, M=16, ef_construction=200):
    # 1. How high does this element go? Exponentially decaying: most stay at 0.
    mL = 1.0 / math.log(M)
    top = int(-math.log(random.random()) * mL)

    # 2. Greedy descent from the entry point, down to just above 'top'
    entry = index.entry_point
    for layer in range(index.max_layer, top, -1):
        entry = greedy_closest(index, q, entry, layer)

    # 3. From 'top' down to 0: find candidates, pick neighbours, link both ways
    for layer in range(min(top, index.max_layer), -1, -1):
        candidates = search_layer(index, q, entry, ef_construction, layer)
        neighbours = select_neighbours_heuristic(q, candidates, M, layer)
        for n in neighbours:
            index.link(q, n, layer)          # bidirectional edges
            if index.degree(n, layer) > M:   # keep the graph bounded
                index.prune(n, M, layer)
        entry = candidates[0]

    # 4. A new highest element becomes the global entry point
    if top > index.max_layer:
        index.entry_point, index.max_layer = q, top`,
          walkthrough: [
            {
              lines: [2, 3, 4],
              title: 'Roll for a layer',
              note: 'Each element\'s maximum layer comes from an exponential distribution with constant mL = 1/ln(M). With M=16 roughly 1 in 16 reach layer 1, 1 in 256 reach layer 2. This single line is what makes the upper layers sparse and the search logarithmic.',
              plain: 'Flip a weighted coin to decide how many maps this item appears on. Almost everything lands only on the bottom map. A few lucky items go higher and become the landmarks that make fast travel possible.',
            },
            {
              lines: [7, 8, 9],
              title: 'Descend to where it belongs',
              note: 'Before linking, walk greedily down from the top of the index to the layer just above this element\'s own top. This is the same descent a query does — a handful of distance computations per layer to arrive in the right region cheaply.',
              plain: 'Walk down the maps toward where this item should sit, using the same fast hopping a search uses. This finds the right neighbourhood without checking everything.',
            },
            {
              lines: [12, 13, 14],
              title: 'Pick neighbours — carefully',
              note: 'At each layer the element joins, run a wider search (ef_construction candidates) then choose M of them. The heuristic is the part people get wrong: it does not take the M nearest. It drops a candidate that is closer to an already-chosen neighbour than to the new element, preserving long-range links. Skip this and the graph fragments into clusters that greedy search cannot escape.',
              plain: 'Find a good pool of nearby items, then pick which ones to connect to. Crucially, not just the closest: if two candidates are basically in the same spot, keep one and pick something further away instead. This keeps "roads" between neighbourhoods so a search never gets trapped.',
            },
            {
              lines: [15, 16, 17, 18],
              title: 'Link both ways, keep degree bounded',
              note: 'Edges are bidirectional, so linking to a neighbour also adds this element to the neighbour\'s list. If that pushes the neighbour over M links, it prunes back down using the same heuristic — the graph\'s memory stays predictable at roughly M x 2 links per element.',
              plain: 'Connect in both directions. If a neighbour now has too many connections, it drops its least useful one. This keeps memory use predictable no matter how big the index grows.',
            },
            {
              lines: [22, 23],
              title: 'Occasionally, a new entry point',
              note: 'If the element rolled a layer higher than any existing one, it becomes the global entry point every future search starts from. This happens rarely — by construction, only when a new maximum layer appears.',
              plain: 'Once in a very long while an item lands higher than anything before it. It becomes the new starting point for every search.',
            },
          ],
        },
      },
      {
        id: 'entry',
        label: 'Entry point',
        kind: 'control',
        col: 2,
        row: 0,
        summary: 'every search starts at the same top-layer node',
        detail:
          'Search always starts at the same element: the one occupying the highest layer. From there the walk is greedy and the beam is width 1 until it reaches the bottom — the upper layers exist purely to cover distance cheaply, not to be accurate.',
        plain:
          'Every search begins at the same landmark on the top map. It does not matter that this landmark is far from your query — the top map is only for getting roughly close, fast.',
      },
      {
        id: 'greedy',
        label: 'Greedy descent',
        kind: 'compute',
        col: 3,
        row: 0,
        summary: 'hop to the closest neighbour; drop a layer when stuck',
        detail:
          'At each layer: look at the current node\'s neighbours, move to whichever is closest to the query, repeat until no neighbour is closer. That local minimum becomes the entry point for the layer below. Each layer costs a handful of distance computations and eliminates a large region of the space.',
        plain:
          'On each map: look at the current landmark\'s neighbours, move to whichever is closest to your query, repeat. When no neighbour is closer, you have gone as far as this map can take you — drop down to the more detailed map and continue from there.',
        code: {
          lang: 'python',
          file: 'the query path — descend the layers, then beam-search the bottom (Algorithm 5, simplified)',
          url: 'https://arxiv.org/abs/1603.09320',
          snippet: `def knn_search(index, q, k=10, ef=64):
    entry = index.entry_point

    # Upper layers: greedy, beam width 1. Cheap hops that cover distance.
    for layer in range(index.max_layer, 0, -1):
        while True:
            closer = min(index.neighbours(entry, layer),
                         key=lambda n: dist(q, n), default=None)
            if closer is None or dist(q, closer) >= dist(q, entry):
                break                      # local minimum for this layer
            entry = closer

    # Layer 0: beam search with ef candidates. This is where recall is earned.
    visited = {entry}
    candidates = [(dist(q, entry), entry)]           # min-heap: explore nearest first
    results = [(-dist(q, entry), entry)]             # max-heap: worst of the best on top

    while candidates:
        d_c, c = heapq.heappop(candidates)
        if d_c > -results[0][0] and len(results) >= ef:
            break                                    # nothing left can improve the set
        for n in index.neighbours(c, 0):
            if n in visited: continue
            visited.add(n)
            d_n = dist(q, n)
            if len(results) < ef or d_n < -results[0][0]:
                heapq.heappush(candidates, (d_n, n))
                heapq.heappush(results, (-d_n, n))
                if len(results) > ef:
                    heapq.heappop(results)           # drop the current worst

    return sorted((-d, n) for d, n in results)[:k]`,
          walkthrough: [
            {
              lines: [4, 5, 6, 7, 8, 9, 10, 11],
              title: 'Upper layers: hop, do not search',
              note: 'On every layer above 0 the beam is width 1: look at neighbours, move to the closest, stop when none is closer. Each layer costs a handful of distance computations. The local minimum becomes the entry for the layer below — accuracy is not the goal up here, coverage is.',
              plain: 'On the sparse top maps, just keep stepping to whichever neighbour is nearer your query. When you cannot get nearer, drop down a map. A few hops per map, and you are in the right region.',
            },
            {
              lines: [14, 15, 16],
              title: 'Two heaps for the bottom layer',
              note: 'Layer 0 switches to a beam search. `candidates` is a min-heap so we always expand the nearest unexplored node; `results` is a max-heap of the best ef found so far, with the worst on top so it can be evicted in O(log ef).',
              plain: 'On the bottom map we get careful. Keep two lists: "places I should still look at" (nearest first) and "best answers so far" (up to ef of them). The second list is what makes the final answer good.',
            },
            {
              lines: [18, 19, 20, 21],
              title: 'The stopping rule',
              note: 'Pop the nearest candidate. If it is further than the worst item already in the results set, and the set is full, stop — nothing reachable can improve the result. This is the line that keeps the search local instead of crawling the whole graph.',
              plain: 'Take the next-nearest place to look. If it is already further away than the worst of your current best answers, you are done — going further can only get worse.',
            },
            {
              lines: [22, 23, 24, 25, 26, 27, 28, 29, 30],
              title: 'Expand neighbours, keep the best ef',
              note: 'Check each unvisited neighbour. If it beats the current worst result (or the set is not full), push it onto both heaps and evict the worst. `ef` bounds the result set, so raising it explores more before the stopping rule fires: more distance computations, higher recall.',
              plain: 'Look at every neighbour of that place you have not seen. Anything better than your current worst answer joins the list and bumps the worst one off. A bigger ef means a longer list, so you explore more and find better answers, at the cost of more checks.',
            },
            {
              lines: [32],
              title: 'Return the top k',
              note: 'Sort the ef results and return k. Because ef >= k by construction, the extra candidates in the beam were only there to make the top k better — they are discarded now.',
              plain: 'Sort your best-answers list and hand back the top k. The extra ones were only kept to make those k more accurate.',
            },
          ],
        },
      },
      {
        id: 'beam',
        label: 'Layer 0 beam search',
        kind: 'compute',
        col: 4,
        row: 0,
        summary: 'keep ef candidates open, not just one',
        detail:
          'The bottom layer is where accuracy is bought. Instead of a single greedy walk it keeps a dynamic candidate list of size ef, expanding the closest unvisited candidate and maintaining a result heap. ef is the recall dial: raise it and you visit more nodes for better recall, at a directly proportional latency cost. It is a query-time parameter — no reindex needed to change it.',
        plain:
          'On the complete bottom map, stop being greedy. Keep several promising paths open at once (ef of them) instead of always taking the single best step, because the single best step can lead into a dead end. The more paths you keep open, the more likely you find the true closest — and the slower it gets. You can change this number per query.',
      },
      {
        id: 'heur',
        label: 'Neighbour heuristic',
        kind: 'control',
        col: 3,
        row: 1,
        summary: 'at insert: prefer diverse neighbours over merely near ones',
        detail:
          'On insert, the M neighbours kept are not simply the M closest. The paper\'s heuristic drops a candidate if it is closer to an already-selected neighbour than to the new element — deliberately preserving long-range links instead of letting dense clusters connect only inward. Without this the graph fragments and greedy search gets trapped. This is the least-appreciated part of the algorithm and the reason naive reimplementations underperform.',
        plain:
          'When an item is added, it does not just connect to its closest neighbours. If two of those are in the same tight cluster, it keeps one and connects to something further instead. This keeps roads between neighbourhoods, so a search can always find its way out of a cluster. Skip this rule and searches get stuck.',
      },
      {
        id: 'out',
        label: 'Top-k neighbours',
        kind: 'output',
        col: 5,
        row: 0,
        summary: 'very probably the true nearest — not guaranteed',
        detail:
          'The result is approximate: there is no guarantee the true nearest neighbour is returned. In practice, well-tuned parameters reach recall in the high 90s while touching a tiny fraction of the dataset — but "approximate" is a real property, and any system that must not miss a match needs an exact fallback.',
        plain:
          'Your k closest items — almost always the true closest, but not guaranteed. If your application cannot tolerate ever missing one, you need a different tool for that case.',
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
        plain: 'A million items. All of them are on the bottom map; only 15 made it to the top map. That lopsided shape is the whole point: the top is tiny so you can cross it in a couple of hops.',
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
        plain: 'Start at the fixed landmark on the top map. Step to whichever of its neighbours is nearer your query. Two hops, nine distance checks, and you have crossed most of the space.',
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
        plain: 'Drop to the next map and keep hopping from where you left off. The maps get more detailed, so the hops get shorter and there are more of them — but you are already in the right part of town.',
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
        plain: 'On the complete bottom map, switch to careful mode: keep 64 promising paths open at once and explore them nearest-first until nothing left can beat your current best. 611 checks later you have your answer.',
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
        plain: 'Add it up: 9 + 137 + 611 = 757 distance checks, versus one million for the brute-force approach. About 1,300 times less work — and the answer is right nearly every time. "Nearly" is the price, and you can raise ef if you need it closer to always.',
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
    doesNotReplace: ['the embedding model', 'exact search when you cannot miss a match', 'metadata filtering', 'BM25 / lexical retrieval', 'reranking'],
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
      { side: 'before', lines: [4], note: 'Every query touches every vector. At 1M x 768 dims this is the whole cost, and it grows linearly forever.' },
      { side: 'before', lines: [7, 8], note: 'Worth saying plainly: for under ~50k vectors this is often the right answer. Flat search is not a mistake at small scale.' },
      { side: 'after', lines: [4], note: 'M is the graph degree — fixed at build time. Raising it improves recall and costs memory on every element.' },
      { side: 'after', lines: [4], note: 'ef_construction controls build-time thoroughness. Too low here and no query-time ef can rescue the graph.' },
      { side: 'after', lines: [7], note: 'ef is the one knob you can move per query without rebuilding — the only free lever in the whole system.' },
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
