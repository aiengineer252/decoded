import type { Entry } from '../../types'

export const speculativeDecoding: Entry = {
  slug: 'speculative-decoding',
  name: 'Speculative decoding',
  org: 'Google Research / DeepMind (independent, concurrent)',
  tagline: 'Trade a cheap model\'s guesses for the big model\'s parallelism — same output distribution, fewer sequential forward passes.',
  categories: ['inference', 'model'],
  status: 'demo',
  publishedAt: '2026-08-13',
  updatedAt: '2026-08-13',
  reviewedBy: 'AI engineer',
  readingMinutes: 8,
  explainer: {
    beginner:
      'A language model writes one token at a time, and each one needs a full pass through the model — so a hundred tokens means a hundred passes, one after another. The trick here: let a much smaller, faster model guess the next few tokens, then have the big model check all those guesses in a single pass. Checking is cheap because it can be done in parallel; generating is expensive because it cannot. If the guesses were good you accept several tokens for the price of one pass. If a guess was wrong you throw it and everything after it away. The remarkable part is that the output is mathematically identical to what the big model would have written alone — this is not a quality-for-speed trade.',
    practitioner:
      'A small draft model proposes K tokens autoregressively; the target model verifies all K in one forward pass, since causal masking means one pass yields the distribution at every draft position plus one free extra. Each token is accepted if r < p(t)/q(t) — so a token the target likes at least as much as the draft did is accepted unconditionally. On rejection you must resample from the normalised positive part of (p - q), not from p, or you bias the output; this is the step people skip when reimplementing. Both KV caches then rewind past the discarded tokens. The gain is real at batch size 1 and shrinks as batching saturates compute.',
    expert:
      'Correctness is proved, so the only open questions are economic. The acceptance rate is the whole ballgame and it is workload-dependent — a poorly matched drafter makes this slower than plain decoding, and the headline 2-3x figures are quoted at batch size 1 where the GPU is memory-bandwidth-bound and mostly idle. As continuous batching saturates compute, the benefit erodes; if you serve at high batch sizes, measure before adopting. Tokenizer compatibility is a hard constraint on drafter selection. The direction worth watching is self-speculation — extra prediction heads on the target — which removes the second-model VRAM cost that drives most of the "skip if" reasoning here.',
  },
  prerequisites: [
    'That a language model generates text one token at a time',
    'Roughly what a KV cache is for',
  ],
  glossary: [
    { term: 'autoregressive', plain: 'Generating one token at a time, where each new token depends on all the ones before it.' },
    { term: 'draft model', plain: 'A small fast model whose only job is to guess what the big model would probably say next.' },
    { term: 'KV cache', plain: 'Stored intermediate values so the model does not recompute the whole sequence for every new token.' },
    { term: 'forward pass', plain: 'One trip of the input through the model. The expensive unit of work.' },
    { term: 'rejection sampling', plain: 'Accepting or discarding a proposed sample by a rule that makes the final distribution come out exactly right.' },
    { term: 'lossless', plain: 'Here it means the output distribution is unchanged — you are not trading quality for speed.' },
  ],
  changelog: [{ date: '2026-08-13', note: 'First published. Two independent concurrent papers describe the same acceptance rule.' }],
  sources: [
    { kind: 'paper', label: 'Leviathan et al. — Fast Inference from Transformers via Speculative Decoding', url: 'https://arxiv.org/abs/2211.17192' },
    { kind: 'paper', label: 'Chen et al. — Accelerating LLM Decoding with Speculative Sampling', url: 'https://arxiv.org/abs/2302.01318' },
    { kind: 'blog', label: 'Hugging Face — Assisted Generation', url: 'https://huggingface.co/blog/assisted-generation' },
    { kind: 'repo', label: 'vllm-project/vllm', url: 'https://github.com/vllm-project/vllm' },
  ],

  architecture: {
    caption:
      'The whole trick rests on one asymmetry: generating K tokens costs K sequential passes, but *checking* K tokens costs one. Click the acceptance test — that is where the correctness proof lives.',
    nodes: [
      {
        id: 'prompt',
        label: 'Prompt + KV cache',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'shared prefix, two caches',
        detail:
          'Both models keep their own KV cache over the same token prefix. They must share a tokenizer — this is the practical constraint that decides which draft models you are allowed to pair with which target.',
      },
      {
        id: 'draft',
        label: 'Draft model',
        kind: 'model',
        col: 1,
        row: 0,
        summary: 'K sequential cheap passes',
        detail:
          'A small model (often 10-100x smaller, sometimes just an n-gram table or an extra head on the target) autoregressively proposes K tokens. It runs K sequential passes — but each one is cheap, so the wall-clock cost is small.',
        code: {
          lang: 'python',
          file: 'the draft loop — Algorithm 1, step 1 of arXiv:2211.17192',
          url: 'https://arxiv.org/abs/2211.17192',
          snippet: `draft_tokens, draft_probs = [], []
for _ in range(K):                      # K cheap sequential passes
    q = draft_model(prefix + draft_tokens).softmax(-1)
    t = sample(q)
    draft_tokens.append(t)
    draft_probs.append(q[t])            # keep q(t) for the ratio test`,
          focus: [2, 6],
        },
      },
      {
        id: 'target',
        label: 'Target model',
        kind: 'model',
        col: 2,
        row: 0,
        summary: 'ONE parallel pass, K+1 dists',
        detail:
          'The expensive model is fed prefix + all K draft tokens in a single forward pass. Because attention is causal, position i only sees tokens before it — so one pass yields the distribution the target *would have produced* at every one of those K positions, plus one extra for free.',
        code: {
          lang: 'python',
          file: 'the verification pass — why this is one call, not K',
          snippet: `# Causal masking means a single forward over the extended
# sequence gives us the target's distribution at every draft
# position, exactly as if we had generated them one at a time.
logits = target_model(prefix + draft_tokens)   # 1 forward pass
p = logits.softmax(-1)                         # shape: (K+1, vocab)`,
          focus: [4, 5],
        },
      },
      {
        id: 'accept',
        label: 'Acceptance test',
        kind: 'control',
        col: 3,
        row: 0,
        summary: 'accept while r < p(t)/q(t)',
        detail:
          'For each draft token in order: draw r ~ U(0,1) and accept if r < p(t)/q(t). If the target likes the token at least as much as the draft did, the ratio is >= 1 and it is accepted unconditionally. The first rejection stops the scan — everything after it is discarded, because it was conditioned on a token that did not survive.',
        code: {
          lang: 'python',
          file: 'modified rejection sampling — the correctness core',
          url: 'https://arxiv.org/abs/2211.17192',
          snippet: `n_accepted = 0
for i, t in enumerate(draft_tokens):
    r = uniform(0, 1)
    if r < min(1.0, p[i][t] / q[i][t]):   # target agrees enough
        n_accepted += 1
    else:
        break                             # discard this and everything after`,
          focus: [4, 7],
        },
      },
      {
        id: 'resample',
        label: 'Corrected resample',
        kind: 'compute',
        col: 3,
        row: 1,
        summary: 'sample from norm(p - q)+',
        detail:
          'On rejection you do not fall back to sampling from p — that would bias the output. You sample from the normalised positive part of (p - q), which exactly compensates for the probability mass the draft over-claimed. This is the step that makes the whole scheme distributionally lossless, and it is the step people skip when they reimplement it.',
        code: {
          lang: 'python',
          file: 'the correction that preserves the target distribution',
          snippet: `if n_accepted < K:
    residual = (p[n_accepted] - q[n_accepted]).clamp(min=0)
    next_token = sample(residual / residual.sum())
else:
    # all K accepted: the free (K+1)th distribution is already ours
    next_token = sample(p[K])`,
          focus: [2, 3, 6],
        },
      },
      {
        id: 'out',
        label: 'Emitted tokens',
        kind: 'output',
        col: 4,
        row: 0,
        summary: 'n_accepted + 1 per cycle',
        detail:
          'Every cycle emits at least one token and at most K+1 — so it can never be slower than plain decoding in pass count, only in overhead. The expected number is set by how often the draft agrees with the target, which is the single number that decides whether this pays off for you.',
      },
      {
        id: 'loop',
        label: 'Next cycle',
        kind: 'control',
        col: 2,
        row: 1,
        summary: 'rewind both KV caches',
        detail:
          'Rejected tokens must be evicted from both KV caches before the next cycle. Getting this rewind wrong is the most common source of subtle corruption in hand-rolled implementations — the output stays fluent, so it fails silently.',
      },
    ],
    edges: [
      { from: 'prompt', to: 'draft' },
      { from: 'draft', to: 'target', label: 'K tokens + q' },
      { from: 'target', to: 'accept', label: 'p (K+1, V)' },
      { from: 'accept', to: 'resample', kind: 'dashed', label: 'on reject' },
      { from: 'accept', to: 'out' },
      { from: 'resample', to: 'out' },
      { from: 'out', to: 'loop', kind: 'dashed' },
      { from: 'loop', to: 'draft' },
    ],
    flow: ['prompt', 'draft', 'target', 'accept', 'out'],
  },

  trace: {
    caption:
      'One cycle with K=4. Watch the ratio test at step 4 — three tokens survive, one is rejected, and the cycle still emits four tokens from a single expensive forward pass.',
    input: {
      type: 'str',
      preview: 'prefix = "The capital of France is"',
    },
    steps: [
      {
        id: 't1',
        nodeId: 'draft',
        label: 'Draft proposes K=4 tokens',
        note: 'Four sequential passes through the small model. Each is cheap; together they cost far less than one pass of the target.',
        input: { type: 'str', preview: '"The capital of France is"' },
        output: {
          type: 'tokens + q probs',
          preview: `[" Paris",  q=0.91]
[",",      q=0.62]
[" which", q=0.44]
[" is",    q=0.71]`,
        },
        cost: '4 x 3 ms = 12 ms',
      },
      {
        id: 't2',
        nodeId: 'target',
        label: 'Target verifies all four in ONE pass',
        note: 'The extended sequence goes through the big model once. Causal attention means position i cannot see position i+1, so the distributions returned are exactly what the target would have produced token by token.',
        input: { type: 'token ids, len = prefix + 4', preview: '[464, 3139, 286, 4881, 318, 6342, 11, 543, 318]' },
        output: {
          type: 'p, shape (5, vocab)',
          preview: `pos 0 -> p(" Paris") = 0.97
pos 1 -> p(",")      = 0.55
pos 2 -> p(" which") = 0.12
pos 3 -> p(" is")    = 0.68
pos 4 -> free extra distribution`,
        },
        cost: '1 x 48 ms',
      },
      {
        id: 't3',
        nodeId: 'accept',
        label: 'Ratio test, token 1 and 2',
        note: 'Token 1: p/q = 0.97/0.91 > 1, so it is accepted without even drawing. Token 2: p/q = 0.55/0.62 = 0.887, and the draw r = 0.31 comes in under it — accepted.',
        input: { type: 'p, q', preview: 'p = [0.97, 0.55], q = [0.91, 0.62]' },
        output: {
          type: 'accept decisions',
          preview: `t1 " Paris": ratio 1.066 -> ACCEPT (>= 1)
t2 ",":     ratio 0.887, r = 0.31 -> ACCEPT`,
        },
      },
      {
        id: 't4',
        nodeId: 'accept',
        label: 'Ratio test, token 3 — rejected',
        note: 'The target thinks " which" is much less likely than the draft did: 0.12 / 0.44 = 0.273. The draw r = 0.66 exceeds it, so the token is rejected — and token 4 dies with it, because it was generated conditioned on a token that no longer exists.',
        input: { type: 'p, q', preview: 'p = 0.12, q = 0.44' },
        output: {
          type: 'accept decisions',
          preview: `t3 " which": ratio 0.273, r = 0.66 -> REJECT
t4 " is":   discarded (conditioned on a rejected token)

n_accepted = 2`,
        },
      },
      {
        id: 't5',
        nodeId: 'resample',
        label: 'Resample from the residual, not from p',
        note: 'This is the step that keeps the output distribution exactly equal to the target model\'s. Sampling from p here would over-represent tokens the draft already got credit for; the (p - q)+ residual subtracts exactly that mass.',
        input: { type: 'p - q at position 2', preview: '(p - q).clamp(min=0), renormalised' },
        output: {
          type: 'token',
          preview: `residual mass:  " the" 0.41  " and" 0.22  " a" 0.14  …
sampled -> " the"`,
        },
      },
      {
        id: 't6',
        nodeId: 'loop',
        label: 'Rewind both KV caches',
        note: 'Positions for the two dead tokens are evicted from the draft and target caches. Skip this and the next cycle attends to tokens that were never emitted — the output stays grammatical, which is what makes the bug so hard to spot.',
        output: { type: 'cache state', preview: 'draft.kv.trim_to(len(prefix) + 3)\ntarget.kv.trim_to(len(prefix) + 3)' },
      },
    ],
    result: {
      type: 'emitted tokens',
      preview: `" Paris" "," " the"   ->  3 tokens
1 target pass instead of 3.

Plain decoding: 3 x 48 ms = 144 ms
Speculative:    12 ms draft + 48 ms verify = 60 ms
Same output distribution. Identical in expectation to sampling from the target directly.`,
    },
  },

  displacement: {
    replaces: ['naive autoregressive decode loops', 'distillation-for-latency', '"just use the small model"'],
    doesNotReplace: ['quantisation', 'batching / continuous batching', 'KV cache paging', 'better hardware'],
    before: {
      label: 'One sequential pass per token',
      lang: 'python',
      file: 'the standard decode loop',
      snippet: `tokens = tokenize(prompt)
for _ in range(max_new_tokens):
    logits = target_model(tokens)      # 48 ms, every single token
    next_tok = sample(logits[-1].softmax(-1))
    tokens.append(next_tok)
    if next_tok == EOS:
        break
# 100 tokens => 100 sequential passes through the big model.
# The GPU is memory-bandwidth bound and mostly idle on compute.`,
    },
    after: {
      label: 'One verification pass per accepted run',
      lang: 'python',
      file: 'HF transformers — assisted generation',
      url: 'https://huggingface.co/blog/assisted-generation',
      snippet: `draft = AutoModelForCausalLM.from_pretrained("small-1b")
target = AutoModelForCausalLM.from_pretrained("big-70b")

out = target.generate(
    **inputs,
    assistant_model=draft,     # <- the entire integration
    max_new_tokens=100,
)
# Output distribution is unchanged. Only the pass count moves.`,
    },
    annotations: [
      { side: 'before', lines: [3], note: 'Every token pays the full model. At batch size 1 the GPU spends most of this time waiting on weight loads, not computing.' },
      { side: 'before', lines: [8, 9], note: 'This is the actual waste: the hardware could verify many tokens per pass, and the loop structure forbids it.' },
      { side: 'after', lines: [6], note: 'One argument. The acceptance test, residual resampling and cache rewind are all inside the library.' },
      { side: 'after', lines: [9], note: 'The critical property, and the reason this is not a quality/speed trade: it is provably distribution-preserving, not an approximation.' },
    ],
    whatDisappears: [
      'The one-sequential-pass-per-token floor on latency at small batch sizes.',
      'The quality-versus-latency trade you used to make by shipping a smaller model.',
      'Distilling a fast student purely to cut time-to-first-token.',
    ],
    newCosts: [
      'A second model resident in VRAM, which at large batch sizes may buy you nothing — the gain shrinks as batching already saturates compute.',
      'Tokenizer compatibility between draft and target is a hard constraint on which pairs you can use.',
      'Acceptance rate is workload-dependent: a poorly matched draft can make the whole thing slower than plain decoding.',
      'Cache-rewind bugs corrupt output silently in hand-rolled implementations.',
    ],
  },

  verdict: {
    score: 90,
    headline:
      'As real as it gets — a proof-backed, distribution-preserving speedup that shipped in every major serving stack. The only open question is whether it pays off at your batch size, not whether it works.',
    factors: [
      {
        key: 'reproducibility',
        label: 'Can you run it today?',
        score: 0.95,
        weight: 0.25,
        reasoning:
          'The algorithm is about forty lines and fully specified in the papers, with a correctness proof rather than an empirical claim. It ships behind a single argument in Hugging Face transformers and as a config block in vLLM.',
        evidence: [
          { claim: 'Algorithm and proof of distribution-preservation given in full in the original paper.', url: 'https://arxiv.org/abs/2211.17192' },
          { claim: 'Available as `assistant_model=` in transformers, with a public walkthrough.', url: 'https://huggingface.co/blog/assisted-generation' },
          { claim: 'Implemented in vLLM as a first-class serving feature.', url: 'https://github.com/vllm-project/vllm' },
        ],
      },
      {
        key: 'benchmarks',
        label: 'Are the numbers real?',
        score: 0.85,
        weight: 0.25,
        reasoning:
          'Reported speedups are consistently in the 2-3x range and — unusually — come with a guarantee that output quality is unchanged, so there is no accuracy column to quietly lose. Marked down from full because the gain is strongly conditional on batch size and draft-target agreement, and headline numbers are usually quoted at batch size 1.',
        evidence: [
          { claim: 'Both original papers report multi-fold decoding speedups with unchanged sampling distribution.', url: 'https://arxiv.org/abs/2302.01318' },
          { claim: 'The benefit is known to shrink as batching saturates compute — the honest caveat on every headline figure.' },
        ],
      },
      {
        key: 'adoption',
        label: 'Is anyone actually using it?',
        score: 0.9,
        weight: 0.2,
        reasoning:
          'Present in the major open serving stacks and widely assumed to be running behind commercial inference endpoints. Its descendants (self-speculation, extra prediction heads, n-gram drafting) are now their own research line, which is a strong adoption signal in itself.',
        evidence: [
          { claim: 'Shipped in vLLM and Hugging Face transformers, not just research code.', url: 'https://github.com/vllm-project/vllm' },
          { claim: 'A family of follow-up methods builds directly on the acceptance test.', url: 'https://arxiv.org/abs/2211.17192' },
        ],
      },
      {
        key: 'independence',
        label: 'Has anyone outside verified it?',
        score: 0.95,
        weight: 0.15,
        reasoning:
          'The strongest form of independent verification available: two separate groups published the same core method concurrently, and it has since been reimplemented by open-source projects with no connection to either.',
        evidence: [
          { claim: 'Two independent, concurrent papers describe the same acceptance scheme.', url: 'https://arxiv.org/abs/2211.17192' },
          { claim: 'Second independent formulation published separately.', url: 'https://arxiv.org/abs/2302.01318' },
          { claim: 'Reimplemented from the papers by third-party serving projects.', url: 'https://github.com/vllm-project/vllm' },
        ],
      },
      {
        key: 'maturity',
        label: 'Will it still look like this in a year?',
        score: 0.85,
        weight: 0.15,
        reasoning:
          'The core acceptance rule has not changed since 2022 and will not — it is a proof, not a heuristic. What keeps moving is where the draft comes from: separate model, extra heads, n-gram lookup. Your integration is safe; your choice of drafter probably is not.',
        evidence: [
          { claim: 'The rejection-sampling rule is unchanged across every subsequent variant.', url: 'https://arxiv.org/abs/2211.17192' },
        ],
      },
    ],
    useIf: [
      'You serve at small batch sizes and time-to-token is the metric you are judged on.',
      'You have VRAM headroom for a second small model.',
      'You need the speedup without any quality regression you have to defend.',
    ],
    skipIf: [
      'You run large batches — continuous batching may already be saturating your compute.',
      'You cannot find a draft model sharing your target\'s tokenizer.',
      'You are memory-constrained, where quantisation buys more than a second resident model.',
    ],
    wouldChangeMyMind: [
      'Nothing about correctness — that part is proved. Only the economics can move.',
      'If self-speculation (extra heads on the target) fully dominates two-model setups, the "second model in VRAM" cost disappears and adoption goes higher still.',
      'Hardware or serving changes that make batch-1 decode compute-bound would erode the core speedup.',
    ],
  },
}
