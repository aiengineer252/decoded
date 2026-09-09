import type { Entry } from '../../types'

export const speculativeDecoding: Entry = {
  slug: 'speculative-decoding',
  name: 'Speculative decoding',
  org: 'Google Research / DeepMind (independent, concurrent)',
  tagline:
    'Let a small model guess several words ahead, then have the big model check all the guesses in one go. Same output, fewer expensive passes.',
  categories: ['inference', 'model'],
  status: 'demo',
  publishedAt: '2026-08-13',
  updatedAt: '2026-09-10',
  reviewedBy: 'AI engineer',
  readingMinutes: 10,
  sources: [
    { kind: 'paper', label: 'Leviathan et al. — Fast Inference from Transformers via Speculative Decoding', url: 'https://arxiv.org/abs/2211.17192' },
    { kind: 'paper', label: 'Chen et al. — Accelerating LLM Decoding with Speculative Sampling', url: 'https://arxiv.org/abs/2302.01318' },
    { kind: 'blog', label: 'Hugging Face — Assisted Generation', url: 'https://huggingface.co/blog/assisted-generation' },
    { kind: 'repo', label: 'vllm-project/vllm', url: 'https://github.com/vllm-project/vllm' },
  ],

  problem: {
    before:
      'A language model produces text one token at a time, and each token needs a full pass through the whole model before the next one can start. A hundred tokens is a hundred passes, strictly one after another. The GPU is mostly idle during each pass — it is waiting on memory, not computing — but you cannot use that idle time because the next token is not known yet.',
    insight:
      'Checking several tokens is as cheap as generating one. So have a tiny model guess ahead, and spend the big model\'s pass verifying the guesses instead of producing one token.',
    payoff:
      'Two to three times faster generation with output that is mathematically identical to what the big model would have produced alone — not an approximation, and nothing to re-evaluate. Available as a single argument in your serving stack.',
  },

  explainer: {
    beginner:
      'Imagine a slow, brilliant editor and a fast, decent assistant. Normally the editor writes every word personally, one at a time. Instead: the assistant drafts the next few words quickly, and the editor reads all of them at once and says "yes, yes, yes, no — stop there". Reading four words takes the editor about the same time as writing one, so if the assistant is usually right you get several words per editor-turn. When the editor says no, you throw away that word and everything after it, and the editor writes the correct word themselves. The surprising part: with the right rule for saying yes or no, the final text is exactly what the editor would have written alone. This is not a quality trade — it is the same output, produced with fewer slow steps.',
    practitioner:
      'A small draft model proposes K tokens autoregressively; the target model verifies all K in one forward pass, since causal masking means one pass yields the distribution at every draft position plus one free extra. Each token is accepted if r < p(t)/q(t) — so a token the target likes at least as much as the draft did is accepted unconditionally. On rejection you must resample from the normalised positive part of (p - q), not from p, or you bias the output; this is the step people skip when reimplementing. Both KV caches then rewind past the discarded tokens. The gain is real at batch size 1 and shrinks as batching saturates compute.',
    expert:
      'Correctness is proved, so the only open questions are economic. The acceptance rate is the whole ballgame and it is workload-dependent — a poorly matched drafter makes this slower than plain decoding, and the headline 2-3x figures are quoted at batch size 1 where the GPU is memory-bandwidth-bound and mostly idle. As continuous batching saturates compute, the benefit erodes; if you serve at high batch sizes, measure before adopting. Tokenizer compatibility is a hard constraint on drafter selection. The direction worth watching is self-speculation — extra prediction heads on the target — which removes the second-model VRAM cost that drives most of the "skip if" reasoning here.',
  },
  prerequisites: [
    'That a language model generates text one token at a time, each depending on the ones before',
    'Roughly what a probability distribution over the next token is',
  ],
  glossary: [
    { term: 'token', plain: 'A word or piece of a word. Models read and write in tokens, not characters.' },
    { term: 'autoregressive', plain: 'Generating one token at a time, where each new token depends on all the ones before it. Strictly sequential.' },
    { term: 'draft model', plain: 'A small fast model whose only job is to guess what the big model would probably say next.' },
    { term: 'target model', plain: 'The big, slow, good model — the one whose output you actually want.' },
    { term: 'forward pass', plain: 'One trip of the input through the model. The expensive unit of work.' },
    { term: 'KV cache', plain: 'Stored intermediate results so the model does not recompute the whole sentence for every new token. Both models keep one.' },
    { term: 'rejection sampling', plain: 'Accepting or discarding a proposed guess by a rule that makes the final result come out exactly right on average.' },
  ],
  changelog: [
    { date: '2026-09-10', note: 'Rewritten for progressive reading: problem-first opener, plain-language trace, whole-function code with guided walkthroughs.' },
    { date: '2026-08-13', note: 'First published. Two independent concurrent papers describe the same acceptance rule.' },
  ],

  architecture: {
    caption:
      'The whole trick rests on one asymmetry: generating K tokens costs K sequential passes, but checking K tokens costs one. Click the acceptance test — that is where the correctness proof lives.',
    nodes: [
      {
        id: 'prompt',
        label: 'Prompt + KV cache',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'the text so far, plus each model\'s saved work',
        detail:
          'Both models keep their own KV cache over the same token prefix. They must share a tokenizer — this is the practical constraint that decides which draft models you are allowed to pair with which target.',
        plain:
          'The conversation so far. Both the small model and the big model have read it and saved their notes (the KV cache) so they do not have to re-read it every time. One rule: they must split text into tokens the same way, or they cannot compare notes.',
      },
      {
        id: 'draft',
        label: 'Draft model',
        kind: 'model',
        col: 1,
        row: 0,
        summary: 'small and fast: guesses K tokens, one after another',
        detail:
          'A small model (often 10-100x smaller, sometimes just an n-gram table or an extra head on the target) autoregressively proposes K tokens. It runs K sequential passes — but each one is cheap, so the wall-clock cost is small.',
        plain:
          'The assistant. It writes the next few tokens the ordinary way, one at a time — but it is so small that four of its passes cost less than one pass of the big model. It also records how confident it was about each guess; we need that later.',
        code: {
          lang: 'python',
          file: 'one full speculative step — draft, verify, accept, resample, rewind (simplified)',
          url: 'https://arxiv.org/abs/2211.17192',
          snippet: `def speculative_step(prefix, draft, target, K=4):
    # 1. DRAFT: K cheap sequential passes through the small model
    draft_tokens, q = [], []
    for _ in range(K):
        probs = draft(prefix + draft_tokens).softmax(-1)   # cheap
        t = sample(probs)
        draft_tokens.append(t)
        q.append(probs[t])                                 # how sure the draft was

    # 2. VERIFY: ONE pass through the big model over prefix + all K guesses.
    #    Causal masking means position i only sees tokens before it, so this
    #    single pass yields the target's distribution at every draft position.
    p_all = target(prefix + draft_tokens).softmax(-1)      # shape (K+1, vocab)

    # 3. ACCEPT: walk the guesses in order; stop at the first rejection
    accepted = []
    for i, t in enumerate(draft_tokens):
        p_t = p_all[i][t]
        if random.random() < min(1.0, p_t / q[i]):         # the acceptance rule
            accepted.append(t)
        else:
            break

    # 4. RESAMPLE from the corrected distribution — NOT from p_all directly
    i = len(accepted)
    if i < K:
        residual = (p_all[i] - draft(prefix + accepted).softmax(-1)).clamp(min=0)
        accepted.append(sample(residual / residual.sum()))
    else:
        accepted.append(sample(p_all[K]))                  # all K survived: free extra

    # 5. REWIND both KV caches past the discarded tokens
    draft.kv.trim_to(len(prefix) + len(accepted))
    target.kv.trim_to(len(prefix) + len(accepted))
    return accepted`,
          walkthrough: [
            {
              lines: [2, 3, 4, 5, 6, 7, 8],
              title: 'The draft guesses ahead',
              note: 'K sequential passes through the small model, exactly like ordinary generation — but each pass is cheap. Crucially we save q[i], the draft\'s own probability for each token it chose. The acceptance rule needs it.',
              plain: 'The assistant writes four tokens the normal way, one at a time. For each one it also writes down how confident it was. Keep that number — it matters in a moment.',
            },
            {
              lines: [10, 11, 12, 13],
              title: 'One big-model pass checks all K',
              note: 'Feed the prefix plus all K draft tokens through the target at once. Because attention is causal, the output at position i is exactly what the target would have produced had it generated tokens one at a time up to there. So one pass returns K+1 distributions — the K we need for checking, plus one free extra at the end.',
              plain: 'Hand the editor the draft with all four guesses appended. Because each position can only see what came before it, one read-through tells us what the editor would have said at every one of those four spots — plus a bonus fifth.',
            },
            {
              lines: [16, 17, 18, 19, 20, 21, 22],
              title: 'Accept while the target agrees enough',
              note: 'For each guess in order: accept with probability min(1, p/q). If the target likes the token at least as much as the draft did (p >= q), it is accepted for certain. If the target likes it less, accept it only some of the time — proportionally. The first rejection ends the scan, because every later guess was conditioned on a token that no longer exists.',
              plain: 'Go through the guesses in order. If the editor likes a word at least as much as the assistant did, keep it. If the editor likes it less, keep it only sometimes — the less the editor likes it, the less often. The first time you drop one, stop: everything after it was based on a word that is now gone.',
            },
            {
              lines: [25, 26, 27, 28],
              title: 'The correction people skip',
              note: 'On rejection you do NOT simply sample from the target\'s distribution p. That would double-count probability mass the draft already got credit for and bias the output. You sample from the positive part of (p - q), renormalised. This is what makes the method exact rather than approximate — and it is the line most reimplementations get wrong.',
              plain: 'When a guess is rejected, the editor picks the replacement — but not from their usual choices. They pick from "words I like more than the assistant did". That adjustment is what makes the final text exactly match what the editor would have written alone. Skip it and the output quietly drifts.',
            },
            {
              lines: [29, 30],
              title: 'All K accepted: a free token',
              note: 'If every guess survived, the target\'s pass produced one more distribution than we checked — position K, right after the last draft token. Sample it directly. This is why a cycle can emit up to K+1 tokens from a single target pass.',
              plain: 'If all four guesses were kept, the editor\'s read-through already gave us a fifth word for free. Take it.',
            },
            {
              lines: [33, 34],
              title: 'Rewind, or corrupt silently',
              note: 'Rejected tokens must be evicted from both KV caches before the next cycle. Get this wrong and the next cycle attends to tokens that were never emitted. The output stays fluent, which is what makes the bug so hard to spot.',
              plain: 'Both models had saved notes about the rejected guesses. Erase those notes. If you forget, the next round is influenced by words that were never actually written — and the text still reads fine, so you would not notice.',
            },
          ],
        },
      },
      {
        id: 'target',
        label: 'Target model',
        kind: 'model',
        col: 2,
        row: 0,
        summary: 'big and slow: checks all K guesses in ONE pass',
        detail:
          'The expensive model is fed prefix + all K draft tokens in a single forward pass. Because attention is causal, position i only sees tokens before it — so one pass yields the distribution the target would have produced at every one of those K positions, plus one extra for free.',
        plain:
          'The editor. Instead of writing one word, it reads the assistant\'s four guesses in a single pass and reports, for each position, what it would have written there. One pass, four verdicts — plus a bonus fifth.',
      },
      {
        id: 'accept',
        label: 'Acceptance test',
        kind: 'control',
        col: 3,
        row: 0,
        summary: 'keep a guess with probability min(1, p/q)',
        detail:
          'For each draft token in order: draw r ~ U(0,1) and accept if r < p(t)/q(t). If the target likes the token at least as much as the draft did, the ratio is >= 1 and it is accepted unconditionally. The first rejection stops the scan — everything after it is discarded, because it was conditioned on a token that did not survive.',
        plain:
          'The yes/no rule. Compare how much the editor likes the guess (p) with how much the assistant liked it (q). If the editor likes it as much or more: keep. If less: keep it only sometimes, in proportion. Stop at the first "no".',
      },
      {
        id: 'resample',
        label: 'Corrected resample',
        kind: 'compute',
        col: 3,
        row: 1,
        summary: 'on rejection: sample from (p - q)+, not from p',
        detail:
          'On rejection you do not fall back to sampling from p — that would bias the output. You sample from the normalised positive part of (p - q), which exactly compensates for the probability mass the draft over-claimed. This is the step that makes the whole scheme distributionally lossless, and it is the step people skip when they reimplement it.',
        plain:
          'When a guess is rejected, the editor chooses the replacement from "words I like more than the assistant did". This exact correction is why the final text matches what the editor would have written on their own.',
      },
      {
        id: 'out',
        label: 'Emitted tokens',
        kind: 'output',
        col: 4,
        row: 0,
        summary: 'between 1 and K+1 tokens per big-model pass',
        detail:
          'Every cycle emits at least one token and at most K+1 — so it can never be slower than plain decoding in pass count, only in overhead. The expected number is set by how often the draft agrees with the target, which is the single number that decides whether this pays off for you.',
        plain:
          'Each round produces at least one word (worst case) and up to five (best case) for one expensive pass. How many you get on average depends entirely on how often the assistant guesses right.',
      },
      {
        id: 'loop',
        label: 'Next cycle',
        kind: 'control',
        col: 2,
        row: 1,
        summary: 'erase rejected tokens from both caches, go again',
        detail:
          'Rejected tokens must be evicted from both KV caches before the next cycle. Getting this rewind wrong is the most common source of subtle corruption in hand-rolled implementations — the output stays fluent, so it fails silently.',
        plain:
          'Clean up: both models forget the rejected guesses, then the assistant starts guessing again from the accepted text.',
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
        plain: 'The small model writes four tokens the normal way, one at a time, and notes how confident it was about each. All four passes together take 12 ms — a quarter of one big-model pass.',
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
        plain: 'Now the big model reads the sentence plus all four guesses in a single pass. Because each position can only see what came before it, this one pass tells us what the big model would have chosen at each of the four spots — same as if it had written them one by one.',
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
        plain: '"Paris": the big model likes it even more than the small one did (0.97 vs 0.91), so it is kept automatically. ",": the big model likes it a bit less (0.55 vs 0.62), so we keep it with probability 0.887. We roll 0.31 — under 0.887 — kept.',
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
        plain: '"which": the big model thinks this is a poor choice (0.12) where the small model was fairly confident (0.44). Keep-probability is only 0.273. We roll 0.66 — rejected. And "is" goes too, automatically: the small model wrote it assuming "which" came first, and it did not.',
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
        plain: 'We need a replacement for "which". The big model picks it — but from "words I like more than the small model did", not from its usual full menu. That adjustment cancels out the bias from the guessing game, so the final text is exactly what the big model would have written alone.',
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
        plain: 'Both models had taken notes about "which" and "is". Erase those notes so the next round starts clean. Forget this step and the models keep being influenced by words that were never written — and you would never notice, because the text still reads fine.',
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
