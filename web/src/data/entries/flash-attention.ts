import type { Entry } from '../../types'

export const flashAttention: Entry = {
  slug: 'flash-attention',
  name: 'FlashAttention',
  org: 'Dao et al. (Stanford)',
  tagline:
    'Attention was never slow because of the maths. It was slow because of memory traffic — so stop moving the big matrix around.',
  categories: ['inference', 'training'],
  status: 'demo',
  publishedAt: '2026-08-14',
  updatedAt: '2026-09-10',
  reviewedBy: 'AI engineer',
  readingMinutes: 10,
  sources: [
    {
      kind: 'paper',
      label: 'Dao et al. — FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness',
      url: 'https://arxiv.org/abs/2205.14135',
    },
    { kind: 'paper', label: 'Dao — FlashAttention-2', url: 'https://arxiv.org/abs/2307.08691' },
    { kind: 'repo', label: 'Dao-AILab/flash-attention', url: 'https://github.com/Dao-AILab/flash-attention' },
    {
      kind: 'docs',
      label: 'PyTorch — scaled_dot_product_attention (dispatches to it)',
      url: 'https://pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html',
    },
  ],

  problem: {
    before:
      'You try to run a model on a long document and it runs out of memory, or crawls. The culprit is one step — attention — which builds a table comparing every word with every other word. Double the text and that table gets four times bigger. At a few thousand words it is tens of megabytes per layer, and the GPU spends most of its time carrying that table to memory and back instead of computing.',
    insight:
      'Never build the whole table. Work through it in small tiles that fit in the chip\'s fastest memory, and fix up the running totals as you go.',
    payoff:
      'The same exact output, several times faster, with memory that grows in a straight line instead of a curve. Long context stopped being a research problem and became a config setting — and you probably already get this for free through your framework.',
  },

  explainer: {
    beginner:
      'Here is the picture. A GPU has two kinds of memory: a huge, slowish main memory (HBM), and a tiny, very fast on-chip memory (SRAM) — think of a warehouse versus your desk. Ordinary attention writes an enormous table into the warehouse, walks over to read it back, writes it again, and reads it once more. All that walking is the cost. FlashAttention never makes the big table. It brings a small piece of the problem to the desk, finishes with it, keeps a couple of running numbers, brings the next piece, and so on. Because the answer only depends on those running numbers, the result is identical — no approximation, no lost accuracy. It just stops walking to the warehouse.',
    practitioner:
      'Attention is memory-bandwidth-bound, not compute-bound. A naive implementation writes the N x N score matrix to HBM, reads it back for the softmax, and reads it a third time for the value multiply — at N=4096 that is roughly 67 MB per head moved about four times. FlashAttention tiles Q, K and V so a working set fits in SRAM, and uses online softmax rescaling to keep the running max and sum correct as blocks stream through, so the score matrix is never materialised. Activation memory drops from O(N^2) to O(N), the output is exact rather than approximate, and on supported hardware you already get it through F.scaled_dot_product_attention without changing any code.',
    expert:
      'The contribution is the IO-complexity framing, not the kernel. Online softmax rescaling and backward recomputation were both known techniques; what was new is establishing that attention\'s bottleneck is HBM traffic and deriving the tiling that minimises it — which retroactively reframed a decade of approximate-attention work as having optimised the wrong quantity. The consequence worth tracking now is that peak performance is tied to per-architecture kernels: FA2 reworked warp-level work partitioning, and later versions target the newest GPUs first. "FlashAttention" names an algorithm whose implementation you should re-benchmark every hardware generation, and whose fast path you should verify you are actually on.',
  },
  prerequisites: [
    'Roughly what a transformer does with attention (it compares every token to every other one)',
    'That a GPU has a small fast memory and a large slow one',
  ],
  glossary: [
    { term: 'attention', plain: 'The step where a model works out how much each word should pay attention to every other word. It produces a big table of scores.' },
    { term: 'HBM', plain: 'High-bandwidth memory — the GPU\'s main memory. Gigabytes of it, and slow compared to the chip itself. The warehouse.' },
    { term: 'SRAM', plain: 'On-chip memory. Roughly ten times faster than HBM and thousands of times smaller. The desk.' },
    { term: 'softmax', plain: 'Turns a row of raw scores into percentages that add up to 100%. It needs the biggest score in the row first, which is why doing it in pieces is tricky.' },
    { term: 'tile / block', plain: 'A small rectangular piece of a big matrix — small enough to fit on the desk.' },
    { term: 'kernel', plain: 'One program that runs on the GPU. "Fused" means several steps were merged into one so nothing has to be written out between them.' },
    { term: 'exact vs approximate', plain: 'Exact means the output is unchanged. Approximate methods trade some accuracy for speed. This one is exact.' },
  ],
  changelog: [
    { date: '2026-09-10', note: 'Rewritten for progressive reading: problem-first opener, plain-language trace, whole-function code with guided walkthroughs.' },
    { date: '2026-08-14', note: 'First published. Mechanism traced against the original paper and FlashAttention-2.' },
  ],

  architecture: {
    caption:
      'The two memory boxes on the bottom row are the entire point. Everything else is bookkeeping to keep the work inside the fast one.',
    nodes: [
      {
        id: 'qkv',
        label: 'Q, K, V',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'three matrices, one per token: what am I, what do I offer, what do I carry',
        detail:
          'Standard inputs, unchanged. FlashAttention does not alter what attention computes — the output is bit-comparable to a naive implementation up to floating-point reassociation. It changes only where the intermediate values live.',
        plain:
          'Every word becomes three lists of numbers. Q is "what am I looking for", K is "what do I contain", V is "what I will pass along if chosen". Attention compares every Q with every K to decide how much of each V to blend. FlashAttention does not change any of this — same inputs, same answer.',
      },
      {
        id: 'hbm',
        label: 'HBM',
        kind: 'store',
        col: 0,
        row: 1,
        summary: 'main GPU memory: huge, and slow to reach',
        detail:
          'High-bandwidth memory: plenty of it, and by GPU standards slow. A naive attention implementation writes the full N x N score matrix here, reads it back for softmax, writes it again, and reads it once more for the value multiply. At N=4096 that is roughly 67 MB per head, moved four times, for a matrix nobody wants to keep.',
        plain:
          'The warehouse. Gigabytes of space, but every trip there costs time. The old way of doing attention makes four trips carrying a table nobody actually needs to keep. That walking is where the time goes.',
      },
      {
        id: 'sram',
        label: 'SRAM',
        kind: 'store',
        col: 1,
        row: 1,
        summary: 'on-chip memory: tiny, and ~10x faster',
        detail:
          'On-chip shared memory: roughly an order of magnitude faster than HBM and thousands of times smaller — on the order of a hundred kilobytes per streaming multiprocessor. The whole algorithm is an answer to one question: what is the largest useful piece of attention that fits in here?',
        plain:
          'The desk. Very fast, but only room for a small piece of the problem at a time. The whole trick is deciding how big a piece you can bring to the desk and still finish it there.',
      },
      {
        id: 'tiler',
        label: 'Tiling',
        kind: 'control',
        col: 1,
        row: 0,
        summary: 'cut Q, K, V into blocks small enough to fit on-chip',
        detail:
          'Q is split into row blocks and K/V into column blocks, sized so that a Q block, a K block, a V block and the working accumulators all fit in SRAM simultaneously. The kernel then loops over K/V blocks in the inner loop, keeping one Q block resident throughout.',
        plain:
          'Slice the big matrices into small rectangles. Bring one slice of Q to the desk and keep it there, then bring slices of K and V past it one at a time. When you are done with a Q slice, write out just its answer and bring the next one.',
        code: {
          lang: 'python',
          file: 'the forward pass, in the shape of Algorithm 1 from the paper (simplified, single head)',
          url: 'https://arxiv.org/abs/2205.14135',
          snippet: `def flash_attention_forward(Q, K, V, block_q=64, block_kv=64):
    N, d = Q.shape
    scale = 1.0 / math.sqrt(d)
    O = torch.empty_like(Q)                 # the only big thing we write back

    for i in range(0, N, block_q):          # OUTER: one block of queries
        Q_i = Q[i : i + block_q]            # lives in SRAM for the whole inner loop

        # running state for these query rows — three small tensors, not N x N
        m_i = torch.full((block_q,), float("-inf"))   # running row max
        l_i = torch.zeros(block_q)                    # running row sum of exp
        O_i = torch.zeros(block_q, d)                 # running weighted sum of V

        for j in range(0, N, block_kv):     # INNER: stream key/value blocks past
            K_j = K[j : j + block_kv]
            V_j = V[j : j + block_kv]

            S_ij = (Q_i @ K_j.T) * scale    # a small block of scores, never stored

            m_new = torch.maximum(m_i, S_ij.max(dim=1).values)
            correction = torch.exp(m_i - m_new)         # shrink what we already have
            P_ij = torch.exp(S_ij - m_new[:, None])     # this block, vs the NEW max

            l_i = l_i * correction + P_ij.sum(dim=1)
            O_i = O_i * correction[:, None] + P_ij @ V_j
            m_i = m_new

        O[i : i + block_q] = O_i / l_i[:, None]         # normalise once, at the end
    return O`,
          walkthrough: [
            {
              lines: [1, 2, 3, 4],
              title: 'What comes in and out',
              note: 'Q, K, V in; O out. Notice what is missing: there is no N x N tensor anywhere in this function. The output O is the same size as Q — that is the entire memory win, visible before the loop even starts.',
              plain: 'Three inputs, one output, and the output is the same size as the input. The old version needed a giant extra table. This version never creates one.',
            },
            {
              lines: [6, 7],
              title: 'Pin one query block on-chip',
              note: 'The outer loop picks a block of query rows and keeps them resident in SRAM for the whole inner loop. Everything below happens without Q_i leaving fast memory.',
              plain: 'Take one slice of Q and put it on the desk. It stays there until we have compared it against everything.',
            },
            {
              lines: [10, 11, 12],
              title: 'The three running numbers',
              note: 'This is the replacement for the big matrix: per row, a running maximum, a running sum of exponentials, and a running weighted sum of V. Three small tensors carry everything a full softmax would have needed.',
              plain: 'Instead of remembering every score, remember three things per row: the biggest score so far, the running total, and the running answer. That is enough to get the exact result.',
            },
            {
              lines: [18],
              title: 'A block of scores, never stored',
              note: 'The score block S_ij is computed and consumed inside this iteration. It is written to nowhere. In the naive version this is the line that allocates 67 MB per head; here it allocates a few kilobytes and forgets them.',
              plain: 'Compare this slice of Q with this slice of K. The result is small, used immediately, and thrown away — it never goes to the warehouse.',
            },
            {
              lines: [20, 21, 22],
              title: 'The trick: rescale, do not restart',
              note: 'A new block may contain a bigger score than any seen so far. Softmax needs the true row max, so everything accumulated against the old max is now wrong — but only by a factor of exp(m_old - m_new). Multiply the running totals by that correction and carry on. This is exact, and it is the single idea the whole method rests on.',
              plain: 'If a bigger score shows up than any before, the earlier totals were measured against the wrong reference. Rather than starting over, shrink them by exactly the right amount and continue. The maths guarantees the final answer is identical.',
            },
            {
              lines: [24, 25, 26],
              title: 'Accumulate, then move on',
              note: 'Update the sum and the output with the corrected old values plus this block\'s contribution. The division by the softmax denominator is deferred — l_i is just a running sum being rescaled alongside O_i.',
              plain: 'Add this block\'s contribution to the running totals. We do not divide yet — that happens once, at the very end.',
            },
            {
              lines: [28, 29],
              title: 'Write out only the answer',
              note: 'One normalisation per query block, then one write to HBM. Across the whole function the only HBM traffic is reading Q, K, V once and writing O once. That is why it is fast: not fewer FLOPs, fewer trips.',
              plain: 'Divide once, write the finished rows back to the warehouse, and move to the next slice. Total trips to the warehouse: read the inputs, write the output. Nothing else.',
            },
          ],
        },
      },
      {
        id: 'online',
        label: 'Online softmax',
        kind: 'compute',
        col: 2,
        row: 0,
        summary: 'keep the running max and sum correct as blocks arrive',
        detail:
          'The obstacle to tiling attention is that softmax needs a global maximum and a global sum over the whole row — which you do not have while streaming blocks. The fix is to carry a running max m and running sum l, and rescale the accumulated output by exp(m_old - m_new) whenever a new block raises the maximum. Mathematically this is exact, not an approximation.',
        plain:
          'Softmax wants to know the biggest score in the row before it can do anything. But we are seeing the row in pieces, so we do not know the biggest yet. The fix: keep track of the biggest so far, and whenever a bigger one appears, adjust everything we have already added by one multiplication. The result is exactly what you would get seeing the whole row at once.',
        code: {
          lang: 'python',
          file: 'the rescaling rule on its own, with numbers you can check by hand',
          url: 'https://arxiv.org/abs/2205.14135',
          snippet: `# Row of scores seen in two blocks: [2.0, 1.0, 3.0] then [5.0, 0.0]
# Goal: softmax weights identical to processing the whole row at once.

m = 3.0                                    # block 1 max
p1 = exp([2.0, 1.0, 3.0] - m)              # [0.3679, 0.1353, 1.0000]
l = p1.sum()                               # 1.5032

# block 2 arrives with a bigger score
m_new = max(m, 5.0)                        # 5.0
correction = exp(m - m_new)                # exp(-2) = 0.1353

l = l * correction + exp([5.0, 0.0] - m_new).sum()
#   1.5032 * 0.1353   +   (1.0000 + 0.0067)     = 1.2101

# Check against the one-shot answer:
exp([2.0, 1.0, 3.0, 5.0, 0.0] - 5.0).sum() # = 1.2101   (same)`,
          walkthrough: [
            {
              lines: [4, 5, 6],
              title: 'First block, against its own max',
              note: 'We only know the first three scores, so we exponentiate relative to their max (3.0) and sum. These numbers are provisional — they were computed against a reference that may turn out to be wrong.',
              plain: 'Start with the first three scores. Subtract the biggest (3.0) and take exp. Add them up. Fine so far — but we might have picked the wrong "biggest".',
            },
            {
              lines: [9, 10],
              title: 'A bigger score arrives',
              note: 'Block two contains 5.0, which beats 3.0. Every exponential in the first block was computed against 3.0 and is now too large by exactly exp(3.0 - 5.0). That factor is the correction.',
              plain: 'The next block has a 5.0. Our earlier work used 3.0 as the reference, so it is off — but off by one predictable factor, 0.1353.',
            },
            {
              lines: [12, 13],
              title: 'Shrink the old, add the new',
              note: 'Multiply the running sum by the correction, then add the new block\'s exponentials computed against the new max. No first-block scores were needed — only the running sum.',
              plain: 'Scale down what we had, add in the new block. We never needed to look at the first three scores again.',
            },
            {
              lines: [15, 16],
              title: 'Proof it is exact',
              note: 'Compute the softmax denominator the naive way, over all five scores at once, against the true max. Same number to four decimals. That equality is what makes FlashAttention exact rather than approximate.',
              plain: 'Now cheat: compute it the slow way with all five scores at once. Same answer. That is why this method loses nothing.',
            },
          ],
        },
      },
      {
        id: 'accum',
        label: 'Output accumulator',
        kind: 'store',
        col: 3,
        row: 0,
        summary: 'the running answer for the current query block',
        detail:
          'The running output for the current Q block, plus the two scalars per row (m and l) needed to keep the rescaling correct. This is the only state carried across the inner loop, and it is tiny — which is precisely why it can stay on-chip.',
        plain:
          'The answer-in-progress for the slice of Q on the desk, plus two numbers per row to keep the maths right. Small enough to stay on the desk the whole time.',
      },
      {
        id: 'recompute',
        label: 'Backward recompute',
        kind: 'control',
        col: 2,
        row: 1,
        summary: 'for training: recompute blocks rather than saving them',
        detail:
          'The backward pass needs the attention matrix. Rather than saving that N x N matrix from the forward pass, it saves only the output and the per-row statistics, then recomputes the blocks on the fly. This trades a modest amount of extra arithmetic for a large reduction in memory traffic — and because the kernel was memory-bound, the recomputation is close to free.',
        plain:
          'When training, the model has to go back through attention to learn. The old way saved the giant table for that. This way saves only the small running numbers and redoes the block maths when needed — a little more arithmetic, far less memory, and arithmetic was never the bottleneck.',
      },
      {
        id: 'out',
        label: 'Output',
        kind: 'output',
        col: 4,
        row: 0,
        summary: 'identical to naive attention, in O(N) memory',
        detail:
          'The same tensor a naive implementation produces. This is the property that separates FlashAttention from the long line of approximate-attention methods that preceded it: there is no accuracy column to trade away, so adopting it requires no evaluation.',
        plain:
          'Exactly the same answer the slow version gives. Nothing to check, nothing to lose — just faster and lighter.',
      },
    ],
    edges: [
      { from: 'qkv', to: 'tiler' },
      { from: 'hbm', to: 'tiler', kind: 'dashed', label: 'load blocks' },
      { from: 'tiler', to: 'online', label: 'S block' },
      { from: 'sram', to: 'online', kind: 'dashed' },
      { from: 'online', to: 'accum' },
      { from: 'accum', to: 'online', kind: 'dashed', label: 'next block' },
      { from: 'accum', to: 'out', label: 'write once' },
      { from: 'recompute', to: 'online', kind: 'dashed' },
    ],
    flow: ['qkv', 'tiler', 'online', 'accum', 'out'],
  },

  trace: {
    caption:
      'Two blocks of one attention row, with real arithmetic. Step 3 is the moment that makes tiling possible — the earlier result gets corrected retroactively, and the answer stays exact.',
    input: {
      type: 'tensors',
      preview: 'Q: (4096, 64)   K: (4096, 64)   V: (4096, 64)   fp32, one head',
    },
    steps: [
      {
        id: 'f1',
        nodeId: 'hbm',
        label: 'What the naive version would move',
        note: 'The N x N score matrix is written to HBM, read for softmax, written again, and read for the V multiply. It is never wanted as an output — it is pure traffic, and at long sequence lengths it dominates the runtime completely.',
        plain: 'First, the cost we are trying to avoid. With 4,096 words, the old way builds a table of 4,096 x 4,096 scores — 67 MB — and carries it to the warehouse and back about four times. That table is never part of the answer. It is pure overhead.',
        input: { type: 'shape', preview: 'S = Q @ K.T  ->  (4096, 4096)' },
        output: {
          type: 'HBM traffic',
          preview: `4096 x 4096 x 4 bytes = 67.1 MB   per head, per layer
moved ~4x  ->  ~268 MB of traffic

Memory scales O(N^2). This is the wall.`,
        },
      },
      {
        id: 'f2',
        nodeId: 'online',
        label: 'Block 1 — establish the running statistics',
        note: 'Only this block of scores exists on-chip. We take its max and exponentiate relative to it, holding two scalars for the row: the running max m and the running sum l.',
        plain: 'Now the new way. Look at just the first three scores in one row. Note the biggest (3.0), subtract it from each, and take exp. Keep two numbers: the max so far, and the sum so far. Throw the scores away.',
        input: { type: 'S block (row slice)', preview: 'S_1 = [2.0, 1.0, 3.0]' },
        output: {
          type: 'running state',
          preview: `m = 3.0
exp(S_1 - m) = [0.3679, 0.1353, 1.0000]
l = 1.5032
O = [0.3679, 0.1353, 1.0000] @ V_1`,
        },
      },
      {
        id: 'f3',
        nodeId: 'online',
        label: 'Block 2 — a bigger score arrives',
        note: 'A score of 5.0 beats the previous max of 3.0, so everything accumulated so far was exponentiated against the wrong reference. Instead of starting over, multiply the accumulated O and l by exp(3.0 - 5.0) = 0.1353 and carry on. The result is identical to a single global softmax.',
        plain: 'The next block has a 5.0 in it — bigger than our 3.0. Our earlier numbers were measured against the wrong "biggest". Fix: multiply them by exp(3 - 5) = 0.1353, which shrinks them by exactly the right amount. Then add the new block. No restart needed.',
        input: { type: 'S block', preview: 'S_2 = [5.0, 0.0]' },
        output: {
          type: 'rescaled state',
          preview: `m: 3.0 -> 5.0        correction = exp(3.0-5.0) = 0.1353

l = 1.5032*0.1353 + (1.0000 + 0.0067) = 1.2101
O = O*0.1353 + [1.0000, 0.0067] @ V_2

Exact. No approximation anywhere in this step.`,
        },
      },
      {
        id: 'f4',
        nodeId: 'accum',
        label: 'Normalise once, at the end',
        note: 'The division by the softmax denominator is deferred until every block has been seen. Until then l is just a running sum being rescaled alongside O.',
        plain: 'Only now — after every block — divide the running answer by the running total. Doing it once at the end instead of every step is part of what keeps this cheap.',
        input: { type: 'state', preview: 'O (unnormalised), l = 1.2101' },
        output: { type: 'row output', preview: 'O_final = O / l        # shape (64,)' },
      },
      {
        id: 'f5',
        nodeId: 'out',
        label: 'What actually crossed the memory bus',
        note: 'Only Q, K, V and O moved through HBM. The score matrix existed only as small blocks inside SRAM and was never written out. That is the whole speedup — no math was skipped and no approximation was made.',
        plain: 'Count the trips to the warehouse: read Q, K, V once; write the answer once. About 4 MB instead of 268 MB. Same answer. That is the entire speedup — we did the same maths and just stopped walking.',
        output: {
          type: 'HBM traffic',
          preview: `naive:          ~268 MB  (dominated by the N^2 matrix)
flash:           ~4 MB   (Q, K, V, O only)

Memory: O(N^2) -> O(N)
Output: bit-comparable, up to float reassociation`,
        },
        cost: 'fewer HBM round-trips; slightly more FLOPs',
      },
    ],
    result: {
      type: 'tensor (4096, 64)',
      preview: `The same output as naive attention.

Multi-fold wall-clock speedup and a memory footprint
that stops growing quadratically — which is what made
long context practical at all.

No accuracy trade. Nothing to re-evaluate.`,
    },
  },

  displacement: {
    replaces: [
      'naive materialised attention',
      'approximate attention (Linformer, Performer, sparse patterns)',
      'gradient checkpointing purely to survive attention memory',
    ],
    doesNotReplace: [
      'the attention mechanism itself',
      'KV cache paging',
      'quantisation',
      'the MLP blocks, which are still compute-bound',
    ],
    before: {
      label: 'Materialise the scores, then softmax',
      lang: 'python',
      file: 'textbook attention — correct, and memory-bound',
      snippet: `def attention(Q, K, V):
    S = Q @ K.transpose(-2, -1) / sqrt(d)   # (N, N) written to HBM
    P = S.softmax(dim=-1)                   # read N^2, write N^2
    return P @ V                            # read N^2 again

# At N=4096 the (N, N) matrix is 67 MB per head.
# The GPU spends most of its time waiting on memory, not computing.`,
    },
    after: {
      label: 'Tile it and never write the scores',
      lang: 'python',
      file: 'PyTorch dispatches to the fused kernel for you',
      url: 'https://pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html',
      snippet: `import torch.nn.functional as F

out = F.scaled_dot_product_attention(Q, K, V, is_causal=True)

# One fused kernel. The N x N matrix is never materialised.
# Same output. O(N) memory instead of O(N^2).`,
    },
    annotations: [
      { side: 'before', lines: [2], note: 'This single line allocates the quadratic tensor. Everything downstream then pays to read it back.' },
      { side: 'before', lines: [3], note: 'Softmax reads N^2 and writes N^2 — pure bandwidth, almost no arithmetic. This is the memory-bound part.' },
      { side: 'before', lines: [6, 7], note: 'The diagnosis the paper contributed: the bottleneck was never FLOPs. Every prior fix optimised the wrong quantity.' },
      { side: 'after', lines: [3], note: 'Tiling, online softmax, and backward recomputation all live behind this call. On supported hardware and dtypes it dispatches to the FlashAttention kernel.' },
      { side: 'after', lines: [5, 6], note: 'The property that matters: exact, not approximate. There is no quality regression to evaluate before adopting it.' },
    ],
    whatDisappears: [
      'The O(N^2) activation memory that set the practical ceiling on context length.',
      'The entire approximate-attention research line as a practical necessity — exact attention became fast enough that accuracy trades stopped being worth it.',
      'Checkpointing attention purely to fit in memory.',
      'Hand-written fused attention kernels in every framework — it moved into the standard library.',
    ],
    newCosts: [
      'Slightly more arithmetic: the backward pass recomputes blocks instead of reading them. Free only while you remain memory-bound.',
      'Hardware-specific kernels. Peak performance tracks the GPU generation, and the newest variants target the newest architectures first — portability is a real constraint.',
      'The kernel is opaque. Custom attention variants (unusual masks, novel biases) may fall off the fast path back to the naive implementation without telling you.',
      'Dtype and head-dimension constraints determine whether you get the fast kernel at all, and the fallback is silent.',
    ],
  },

  verdict: {
    score: 93,
    headline:
      'One of the few results where the honest verdict is "just use it" — exact output, no accuracy trade, and it is already the default path under your framework whether or not you asked for it.',
    factors: [
      {
        key: 'reproducibility',
        label: 'Can you run it today?',
        score: 0.95,
        weight: 0.25,
        reasoning:
          'The algorithm is fully specified in the paper and the CUDA implementation is open. In practice most people already run it without installing anything, because PyTorch dispatches to it from the standard attention call on supported hardware.',
        evidence: [
          { claim: 'Algorithms and IO-complexity analysis published in full.', url: 'https://arxiv.org/abs/2205.14135' },
          { claim: 'Reference CUDA implementation is open source and maintained.', url: 'https://github.com/Dao-AILab/flash-attention' },
          { claim: 'Reachable through the standard PyTorch attention API without user-side changes.', url: 'https://pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html' },
        ],
      },
      {
        key: 'benchmarks',
        label: 'Are the numbers real?',
        score: 0.95,
        weight: 0.25,
        reasoning:
          'Unusually strong, for a structural reason: because the output is exact, there is no accuracy column that could quietly regress. The claim reduces to wall-clock and memory, both of which are trivially measurable by anyone, and the paper grounds them in an IO-complexity argument rather than benchmark tuning.',
        evidence: [
          { claim: 'Reports multi-fold speedups and large memory reductions, with an IO-complexity analysis explaining why.', url: 'https://arxiv.org/abs/2205.14135' },
          { claim: 'FlashAttention-2 reports further gains from improved work partitioning across GPU warps.', url: 'https://arxiv.org/abs/2307.08691' },
          { claim: 'Exactness means users can verify equivalence against a naive implementation directly.', url: 'https://github.com/Dao-AILab/flash-attention' },
        ],
      },
      {
        key: 'adoption',
        label: 'Is anyone actually using it?',
        score: 0.98,
        weight: 0.2,
        reasoning:
          'Effectively universal. It is in PyTorch core, in every major serving stack, and in the training pipelines of most open models released since it landed. The strongest signal is that most people using it never made a decision to.',
        evidence: [
          { claim: 'Integrated into PyTorch as the backing implementation for scaled dot-product attention.', url: 'https://pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html' },
          { claim: 'Maintained as a standalone library depended on across the training and serving ecosystem.', url: 'https://github.com/Dao-AILab/flash-attention' },
        ],
      },
      {
        key: 'independence',
        label: 'Has anyone outside verified it?',
        score: 0.95,
        weight: 0.15,
        reasoning:
          'Reimplemented independently in multiple frameworks and hardware backends by parties unconnected to the authors. Exactness makes verification unusually cheap: any third party can assert equivalence against naive attention and measure the speedup themselves.',
        evidence: [
          { claim: 'Independently reimplemented in framework-native attention backends beyond the reference CUDA kernel.', url: 'https://pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html' },
          { claim: 'Online-softmax rescaling is a known, separately established technique rather than a novel unverified claim.', url: 'https://arxiv.org/abs/2205.14135' },
        ],
      },
      {
        key: 'maturity',
        label: 'Will it still look like this in a year?',
        score: 0.8,
        weight: 0.15,
        reasoning:
          'The algorithm is settled — tiling plus online softmax is not going to be revised. What churns is the implementation: kernels are rewritten per GPU generation, and each successive version targets the newest hardware first. If you call it through your framework you are insulated from that; if you pin the standalone library against specific hardware, less so.',
        evidence: [
          { claim: 'Successive versions rework GPU work partitioning and target newer architectures while keeping the same core algorithm.', url: 'https://arxiv.org/abs/2307.08691' },
        ],
      },
    ],
    useIf: [
      'You train or serve transformers on GPUs — which effectively means: yes.',
      'You need long context, where the quadratic activation memory is what actually stops you.',
      'You want a speedup you do not have to defend in an eval review, because the output is unchanged.',
    ],
    skipIf: [
      'You run on hardware or dtypes without a supported kernel — check you are on the fast path rather than assuming it.',
      'Your attention variant uses exotic masks or biases that fall back to the naive implementation silently.',
      'Your bottleneck is elsewhere: at short sequence lengths the MLP blocks, not attention, dominate.',
    ],
    wouldChangeMyMind: [
      'Nothing on correctness — exactness is verifiable by anyone in a few lines.',
      'Hardware where attention becomes compute-bound rather than memory-bound would undercut the core premise, though nothing on the horizon suggests that.',
      'An architecture that displaces softmax attention entirely would make the question moot rather than answer it.',
    ],
  },
}
