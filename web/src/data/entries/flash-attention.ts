import type { Entry } from '../../types'

export const flashAttention: Entry = {
  slug: 'flash-attention',
  name: 'FlashAttention',
  org: 'Dao et al. (Stanford)',
  tagline:
    'Attention was never compute-bound — it was memory-bound. Tile it so the N x N score matrix never touches HBM, and the same exact math runs several times faster.',
  categories: ['inference', 'training'],
  status: 'demo',
  publishedAt: '2026-08-14',
  updatedAt: '2026-08-14',
  reviewedBy: 'AI engineer',
  readingMinutes: 8,
  explainer: {
    beginner:
      'When a model reads text, it compares every word against every other word — that comparison is called attention. The obvious way to do it builds one giant grid of all those comparisons and stores it in memory. For long text that grid becomes enormous, and moving it in and out of memory ends up costing more than the actual arithmetic. FlashAttention produces the exact same answer without ever building the whole grid: it works through it in small tiles that fit inside the chip\'s fastest memory. Nothing is approximated and nothing is skipped — it just stops wasting time shuffling data. That waste turned out to be most of the cost.',
    practitioner:
      'Attention is memory-bandwidth-bound, not compute-bound. A naive implementation writes the N x N score matrix to HBM, reads it back for the softmax, and reads it a third time for the value multiply — at N=4096 that is roughly 67 MB per head moved about four times. FlashAttention tiles Q, K and V so a working set fits in SRAM, and uses online softmax rescaling to keep the running max and sum correct as blocks stream through, so the score matrix is never materialised. Activation memory drops from O(N^2) to O(N), the output is exact rather than approximate, and on supported hardware you already get it through F.scaled_dot_product_attention without changing any code.',
    expert:
      'The contribution is the IO-complexity framing, not the kernel. Online softmax rescaling and backward recomputation were both known techniques; what was new is establishing that attention\'s bottleneck is HBM traffic and deriving the tiling that minimises it — which retroactively reframed a decade of approximate-attention work as having optimised the wrong quantity. The consequence worth tracking now is that peak performance is tied to per-architecture kernels: FA2 reworked warp-level work partitioning, and later versions target the newest GPUs first. "FlashAttention" names an algorithm whose implementation you should re-benchmark every hardware generation, and whose fast path you should verify you are actually on.',
  },
  prerequisites: [
    'Roughly what a transformer does with attention',
    'That a GPU has a small fast memory and a large slow one',
  ],
  glossary: [
    { term: 'attention', plain: 'The step where a model weighs how much each token should influence every other token.' },
    { term: 'HBM', plain: 'High-bandwidth memory — the GPU\'s main memory. Gigabytes of it, and slow relative to the chip.' },
    { term: 'SRAM', plain: 'On-chip memory. Roughly ten times faster than HBM and thousands of times smaller.' },
    { term: 'softmax', plain: 'Turns a row of raw scores into weights that sum to 1. Needs the row maximum, which is what makes tiling hard.' },
    { term: 'kernel', plain: 'A single program that runs on the GPU. "Fused" means several steps were merged into one to avoid round-trips to memory.' },
    { term: 'exact vs approximate', plain: 'Exact means the output is unchanged. Approximate methods trade accuracy for speed; this one does not.' },
  ],
  changelog: [{ date: '2026-08-14', note: 'First published. Mechanism traced against the original paper and FlashAttention-2.' }],
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

  architecture: {
    caption:
      'The two memory boxes on the bottom row are the entire point. Everything else is bookkeeping to keep work inside the fast one.',
    nodes: [
      {
        id: 'qkv',
        label: 'Q, K, V',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'sequence x head_dim',
        detail:
          'Standard inputs, unchanged. FlashAttention does not alter what attention computes — the output is bit-comparable to a naive implementation up to floating-point reassociation. It changes only where the intermediate values live.',
      },
      {
        id: 'hbm',
        label: 'HBM',
        kind: 'store',
        col: 0,
        row: 1,
        summary: 'GBs, ~1.5-3 TB/s',
        detail:
          'High-bandwidth memory: plenty of it, and by GPU standards slow. A naive attention implementation writes the full N x N score matrix here, reads it back for softmax, writes it again, and reads it once more for the value multiply. At N=4096 that is roughly 67 MB per head, moved four times, for a matrix nobody wants to keep.',
      },
      {
        id: 'sram',
        label: 'SRAM',
        kind: 'store',
        col: 1,
        row: 1,
        summary: 'KBs, ~19 TB/s',
        detail:
          'On-chip shared memory: roughly an order of magnitude faster than HBM and thousands of times smaller — on the order of a hundred kilobytes per streaming multiprocessor. The whole algorithm is an answer to one question: what is the largest useful piece of attention that fits in here?',
      },
      {
        id: 'tiler',
        label: 'Tiling',
        kind: 'control',
        col: 1,
        row: 0,
        summary: 'split Q, K, V into blocks',
        detail:
          'Q is split into row blocks and K/V into column blocks, sized so that a Q block, a K block, a V block and the working accumulators all fit in SRAM simultaneously. The kernel then loops over K/V blocks in the inner loop, keeping one Q block resident throughout.',
        code: {
          lang: 'python',
          file: 'the loop structure — Algorithm 1 of arXiv:2205.14135',
          url: 'https://arxiv.org/abs/2205.14135',
          snippet: `for i in range(num_q_blocks):          # outer: Q block stays in SRAM
    O_i, l_i, m_i = 0, 0, -inf
    for j in range(num_kv_blocks):     # inner: stream K, V through
        S_ij = Q_i @ K_j.T             # small block, lives in SRAM
        O_i, l_i, m_i = online_softmax_update(S_ij, V_j, O_i, l_i, m_i)
    write_to_hbm(O_i)                  # only the output is written back`,
          focus: [4, 6],
        },
      },
      {
        id: 'online',
        label: 'Online softmax',
        kind: 'compute',
        col: 2,
        row: 0,
        summary: 'rescale as blocks arrive',
        detail:
          'The obstacle to tiling attention is that softmax needs a global maximum and a global sum over the whole row — which you do not have while streaming blocks. The fix is to carry a running max m and running sum l, and rescale the accumulated output by exp(m_old - m_new) whenever a new block raises the maximum. Mathematically this is exact, not an approximation. It is the single idea the entire method rests on.',
        code: {
          lang: 'python',
          file: 'the rescaling rule — this is the whole trick',
          url: 'https://arxiv.org/abs/2205.14135',
          snippet: `m_new = max(m_old, S_block.max())
correction = exp(m_old - m_new)          # shrink what we already have

l_new = l_old * correction + exp(S_block - m_new).sum()
O_new = O_old * correction + exp(S_block - m_new) @ V_block
# Identical result to computing softmax over the full row at once.`,
          focus: [2, 4, 5],
        },
      },
      {
        id: 'accum',
        label: 'Output accumulator',
        kind: 'store',
        col: 3,
        row: 0,
        summary: 'lives in registers/SRAM',
        detail:
          'The running output for the current Q block, plus the two scalars per row (m and l) needed to keep the rescaling correct. This is the only state carried across the inner loop, and it is tiny — which is precisely why it can stay on-chip.',
      },
      {
        id: 'recompute',
        label: 'Backward recompute',
        kind: 'control',
        col: 2,
        row: 1,
        summary: 'recompute, do not store',
        detail:
          'The backward pass needs the attention matrix. Rather than saving that N x N matrix from the forward pass, it saves only the output and the per-row statistics, then recomputes the blocks on the fly. This trades a modest amount of extra arithmetic for a large reduction in memory traffic — and because the kernel was memory-bound, the recomputation is close to free.',
      },
      {
        id: 'out',
        label: 'Output',
        kind: 'output',
        col: 4,
        row: 0,
        summary: 'exact, O(N) memory',
        detail:
          'The same tensor a naive implementation produces. This is the property that separates FlashAttention from the long line of approximate-attention methods that preceded it: there is no accuracy column to trade away, so adopting it requires no evaluation.',
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
      'Two blocks of one attention row, with real arithmetic. Watch step 3 — the accumulated result gets shrunk retroactively, and the answer stays exact.',
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
        note: 'This is the moment that makes tiling possible. A score of 5.0 beats the previous max of 3.0, so everything accumulated so far was exponentiated against the wrong reference. Instead of starting over, multiply the accumulated O and l by exp(3.0 - 5.0) = 0.1353 and carry on. The result is identical to a single global softmax.',
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
        input: { type: 'state', preview: 'O (unnormalised), l = 1.2101' },
        output: { type: 'row output', preview: 'O_final = O / l        # shape (64,)' },
      },
      {
        id: 'f5',
        nodeId: 'out',
        label: 'What actually crossed the memory bus',
        note: 'Only Q, K, V and O moved through HBM. The score matrix existed only as small blocks inside SRAM and was never written out. That is the whole speedup — no math was skipped and no approximation was made.',
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
      {
        side: 'before',
        lines: [2],
        note: 'This single line allocates the quadratic tensor. Everything downstream then pays to read it back.',
      },
      {
        side: 'before',
        lines: [3],
        note: 'Softmax reads N^2 and writes N^2 — pure bandwidth, almost no arithmetic. This is the memory-bound part.',
      },
      {
        side: 'before',
        lines: [6, 7],
        note: 'The diagnosis the paper contributed: the bottleneck was never FLOPs. Every prior fix optimised the wrong quantity.',
      },
      {
        side: 'after',
        lines: [3],
        note: 'Tiling, online softmax, and backward recomputation all live behind this call. On supported hardware and dtypes it dispatches to the FlashAttention kernel.',
      },
      {
        side: 'after',
        lines: [5, 6],
        note: 'The property that matters: exact, not approximate. There is no quality regression to evaluate before adopting it.',
      },
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
