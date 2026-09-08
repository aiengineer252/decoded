import type { Entry } from '../../types'

export const grpo: Entry = {
  slug: 'grpo',
  name: 'GRPO',
  org: 'DeepSeek-AI',
  tagline: 'Delete the critic. Estimate the baseline by sampling the same prompt several times and normalising the rewards within the group.',
  categories: ['training', 'model'],
  status: 'demo',
  publishedAt: '2026-08-13',
  updatedAt: '2026-08-13',
  reviewedBy: 'AI engineer',
  readingMinutes: 8,
  explainer: {
    beginner:
      'To teach a model by reward rather than by copying examples, you need to know whether an answer was better or worse than average — otherwise "you scored 7" means nothing. The old approach trained a second network whose whole job was predicting that average. GRPO removes it with a simple idea: answer the same question several times, then compare those answers against each other. If you tried four times and two were right, the two right ones were above average and the two wrong ones below, and you know it from the four numbers you already have. No second network, no extra memory. You pay for it in generation instead — four answers per question, every step.',
    practitioner:
      'Drop the critic; estimate the baseline from the group. Sample G completions per prompt, score each, then standardise within the group: A = (r - mean(r)) / std(r). Every token of a completion inherits its completion\'s advantage. The surrogate is PPO-shaped — clipped importance ratio times advantage — with KL to a frozen reference applied in the loss rather than folded into the reward. You free the value network and its optimiser state, which is usually the largest memory line item, and you pay G rollouts per prompt per step. Watch for degenerate groups: if all G rewards are equal, the advantage is zero and the step is wasted.',
    expert:
      'The mechanism is real and simple; the attribution is where the discourse overreaches. Most of the celebrated reasoning results belong to verifiable rewards at scale, which GRPO enables rather than causes — and the ablation that would separate them is the one everyone wants and nobody has cleanly published. The honest open question is whether plain REINFORCE-with-a-baseline matches it at matched rollout budget; if so this is largely a naming exercise. Note also that maturity is the weakest factor deliberately: the KL term, the standard-deviation normalisation and length bias are all actively contested, and several successors change exactly those pieces. The group-baseline idea will survive; the specific formula you copy today probably will not.',
  },
  prerequisites: [
    'Roughly what reinforcement learning from human feedback does',
    'That PPO is the algorithm it usually used',
  ],
  glossary: [
    { term: 'GRPO', plain: 'Group Relative Policy Optimization. Estimates the baseline by comparing several answers to the same prompt.' },
    { term: 'policy', plain: 'The model being trained, viewed as something that chooses what to output.' },
    { term: 'critic / value model', plain: 'A second network that predicts how good a situation is on average. GRPO removes it.' },
    { term: 'advantage', plain: 'How much better than average an outcome was. Positive reinforces, negative discourages.' },
    { term: 'KL penalty', plain: 'A leash keeping the trained model from drifting too far from where it started.' },
    { term: 'verifiable reward', plain: 'A score computed by a program — does the code run, is the answer right — rather than by a learned model.' },
    { term: 'rollout', plain: 'One generated answer produced during training so it can be scored.' },
  ],
  changelog: [{ date: '2026-08-13', note: 'First published. Maturity scored 0.65 — normalisation and KL details are actively contested.' }],
  sources: [
    { kind: 'paper', label: 'DeepSeekMath — where GRPO is introduced (Sec. 4)', url: 'https://arxiv.org/abs/2402.03300' },
    { kind: 'paper', label: 'DeepSeek-R1 — GRPO at scale for reasoning', url: 'https://arxiv.org/abs/2501.12948' },
    { kind: 'repo', label: 'huggingface/trl — GRPOTrainer', url: 'https://github.com/huggingface/trl' },
  ],

  architecture: {
    caption:
      'PPO needs a learned value model to know whether a completion was better than average. GRPO answers the same question by sampling the same prompt G times and comparing them to each other.',
    nodes: [
      { id: 'prompt', label: 'Prompt', kind: 'input', col: 0, row: 0, summary: 'one question from the batch',
        detail: 'A single prompt is the unit of work. Unlike PPO, where each prompt yields one trajectory, here it yields a group — and the group is what makes the baseline possible.' },
      {
        id: 'sample', label: 'Policy samples G', kind: 'model', col: 1, row: 0, summary: 'G completions, same prompt',
        detail: 'The current policy generates G completions (commonly 4-16) for the same prompt at non-zero temperature. This is where GRPO spends the compute that PPO spent on training a critic — it is a trade, not a free lunch.',
        code: {
          lang: 'python', file: 'the group rollout', url: 'https://arxiv.org/abs/2402.03300',
          snippet: `completions = [policy.generate(prompt, temperature=1.0)
               for _ in range(G)]        # G samples, ONE prompt`,
          focus: [2],
        },
      },
      {
        id: 'reward', label: 'Reward function', kind: 'compute', col: 2, row: 0, summary: 'rule-based or learned',
        detail: 'Each completion is scored independently. The headline result is that for verifiable domains this can be a plain program — does the code run, does the answer match, is the format right — with no reward model to train or to be hacked.',
        code: {
          lang: 'python', file: 'a verifiable reward — no reward model in sight',
          snippet: `def reward(completion, answer):
    correct = extract_final(completion) == answer
    formatted = "<think>" in completion and "</think>" in completion
    return 1.0 * correct + 0.2 * formatted`,
          focus: [2, 3],
        },
      },
      {
        id: 'advantage', label: 'Group-relative advantage', kind: 'control', col: 3, row: 0, summary: 'A = (r - mean) / std',
        detail: 'This single line is the whole method. Standardising the rewards inside the group turns "was this good?" into "was this better than my other attempts at the same question?" — which is exactly what a value model was estimating, obtained for free from samples you already paid for.',
        code: {
          lang: 'python', file: 'the substitution for the critic', url: 'https://arxiv.org/abs/2402.03300',
          snippet: `r = torch.tensor(rewards)                 # (G,)
advantages = (r - r.mean()) / (r.std() + 1e-8)
# Every token in completion i gets advantage[i].
# No value head, no GAE, no bootstrapping.`,
          focus: [2],
        },
      },
      { id: 'kl', label: 'KL to reference', kind: 'store', col: 3, row: 1, summary: 'frozen ref policy',
        detail: 'A frozen copy of the starting policy anchors the update so the model cannot drift into reward-hacking gibberish. GRPO applies this as a term in the loss rather than folding it into the reward, which is a small but deliberate departure from the usual PPO-for-RLHF setup.' },
      {
        id: 'update', label: 'Policy update', kind: 'compute', col: 4, row: 0, summary: 'clipped ratio + KL',
        detail: 'The surrogate objective is PPO-shaped — a clipped importance ratio times the advantage — but the advantage came from the group instead of a critic.',
        code: {
          lang: 'python', file: 'the objective',
          snippet: `ratio = (logp_new - logp_old).exp()
loss = -torch.min(ratio * adv,
                  ratio.clamp(1 - eps, 1 + eps) * adv).mean()
loss = loss + beta * kl_to_reference        # KL in the loss, not the reward`,
          focus: [4],
        },
      },
      { id: 'loop', label: 'Next batch', kind: 'control', col: 2, row: 1, summary: 'policy has moved',
        detail: 'The updated policy generates the next group. Because the baseline is recomputed from fresh samples each step, there is no stale critic to go out of date — a class of PPO instability that simply does not exist here.' },
    ],
    edges: [
      { from: 'prompt', to: 'sample' },
      { from: 'sample', to: 'reward', label: 'G completions' },
      { from: 'reward', to: 'advantage', label: 'r (G,)' },
      { from: 'advantage', to: 'update' },
      { from: 'kl', to: 'update', kind: 'dashed' },
      { from: 'update', to: 'loop', kind: 'dashed' },
      { from: 'loop', to: 'sample' },
    ],
    flow: ['prompt', 'sample', 'reward', 'advantage', 'update'],
  },

  trace: {
    caption: 'One optimisation step with G=4. The interesting moment is step 3 — watch a baseline appear out of nothing but the spread of the rewards.',
    input: { type: 'prompt', preview: '"If 3x + 7 = 22, what is x?"   (answer: 5)' },
    steps: [
      {
        id: 'g1', nodeId: 'sample', label: 'Sample G=4 completions',
        note: 'Same prompt, four times, at temperature 1.0. The spread between these four is the entire signal the method runs on — if all four were identical, this step would produce nothing to learn from.',
        input: { type: 'str', preview: '"If 3x + 7 = 22, what is x?"' },
        output: {
          type: 'list[str], len 4',
          preview: `[0] "<think>3x = 15, x = 5</think> 5"
[1] "<think>3x = 22-7 = 15 so x = 5</think> 5"
[2] "x = 7"
[3] "<think>3x = 29</think> x = 9.67"`,
        },
        cost: '4 x generation',
      },
      {
        id: 'g2', nodeId: 'reward', label: 'Score each with a program',
        note: 'No reward model. A function checks the final answer and the format tags. This is why the method took off for maths and code first — those are the domains where such a function exists.',
        output: {
          type: 'list[float]',
          preview: `[0] correct + formatted -> 1.2
[1] correct + formatted -> 1.2
[2] wrong,  unformatted -> 0.0
[3] wrong,  formatted   -> 0.2`,
        },
      },
      {
        id: 'g3', nodeId: 'advantage', label: 'Standardise within the group',
        note: 'mean = 0.65, std = 0.567. Two completions land above the group average and two below. That is a baseline — the same quantity PPO trains an entire second network to predict — computed from four numbers.',
        input: { type: 'tensor (4,)', preview: 'r = [1.2, 1.2, 0.0, 0.2]' },
        output: {
          type: 'tensor (4,)',
          preview: `mean = 0.650   std = 0.567

A = [ +0.97, +0.97, -1.15, -0.79 ]

Every token of completions 0 and 1 is reinforced;
every token of 2 and 3 is pushed down.`,
        },
      },
      {
        id: 'g4', nodeId: 'update', label: 'Clipped surrogate + KL',
        note: 'From here it is PPO shaped. The advantage is broadcast across all tokens of its completion — GRPO assigns no per-token credit, which is both its simplicity and its main theoretical weakness.',
        input: { type: 'advantages, logprobs', preview: 'A (4,) broadcast to (4, seq_len)' },
        output: { type: 'scalar', preview: 'policy_loss = -0.412\nkl_penalty  =  0.008 * beta\ntotal       = -0.404' },
      },
      {
        id: 'g5', nodeId: 'loop', label: 'Step and resample',
        note: 'No critic to update, so the step is one backward pass over one network. The next group is drawn from the moved policy and the baseline is recomputed from scratch.',
        output: { type: 'state', preview: 'params updated (1 network)\nreference policy: frozen, untouched\nvalue model: does not exist' },
      },
    ],
    result: {
      type: 'training step',
      preview: `1 prompt -> 4 samples -> 1 update.

Memory held: policy + frozen reference.
PPO would additionally hold: a value model of comparable size,
plus its optimiser state.`,
    },
  },

  displacement: {
    replaces: ['the PPO value/critic network', 'GAE advantage estimation', 'reward models for verifiable tasks'],
    doesNotReplace: ['RLHF for taste and safety', 'SFT', 'preference data', 'the clipped surrogate objective itself'],
    before: {
      label: 'PPO — a second network to hold and train',
      lang: 'python',
      file: 'the standard RLHF setup',
      snippet: `policy   = AutoModelForCausalLM.from_pretrained(base)
ref      = AutoModelForCausalLM.from_pretrained(base)   # frozen
reward_m = AutoModelForSequenceClassification.from_pretrained(rm)
value_m  = AutoModelForSequenceClassification.from_pretrained(base)

trainer = PPOTrainer(
    model=policy, ref_model=ref,
    reward_model=reward_m, value_model=value_m,
)
# advantage <- GAE over the value model's predictions`,
    },
    after: {
      label: 'GRPO — the group is the baseline',
      lang: 'python',
      file: 'trl — GRPOTrainer',
      url: 'https://github.com/huggingface/trl',
      snippet: `policy = AutoModelForCausalLM.from_pretrained(base)

def reward_fn(completions, answer, **kwargs):
    return [1.0 if extract(c) == answer else 0.0 for c in completions]

trainer = GRPOTrainer(
    model=policy,
    reward_funcs=reward_fn,        # a function, not a network
    args=GRPOConfig(num_generations=8),
)
# advantage <- (r - mean(r)) / std(r), within the group`,
    },
    annotations: [
      { side: 'before', lines: [4], note: 'A value model roughly the size of the policy, plus its optimiser state — the single largest memory line item this method removes.' },
      { side: 'before', lines: [3], note: 'A reward model is itself trained on preference data, and is the usual thing that gets reward-hacked.' },
      { side: 'before', lines: [10], note: 'GAE needs value estimates that stay calibrated as the policy moves. When they lag, training destabilises.' },
      { side: 'after', lines: [3, 4], note: 'For verifiable domains the reward is a program you can read, unit-test, and cannot over-optimise into nonsense.' },
      { side: 'after', lines: [9], note: 'The cost moved rather than vanished: G generations per prompt per step is real compute.' },
    ],
    whatDisappears: [
      'The value network and its optimiser state — a large slice of training memory.',
      'GAE, and the instability that comes from a critic lagging behind the policy.',
      'For verifiable tasks: the reward model, and the preference dataset behind it.',
    ],
    newCosts: [
      'G generations per prompt per step — you pay in rollout compute what you saved in memory.',
      'A group whose rewards are all equal produces zero advantage and zero gradient; degenerate groups are wasted steps.',
      'One advantage per completion, broadcast to every token — no credit assignment within a completion.',
      'It needs a reward you can actually compute. Outside maths, code and other checkable domains, you are back to a reward model.',
    ],
  },

  verdict: {
    score: 78,
    headline:
      'The mechanism is real, simple, and reproduced widely — but the "it made reasoning emerge" story does more work in the discourse than the algorithm does. Most of that result belongs to verifiable rewards at scale, which GRPO enables rather than causes.',
    factors: [
      {
        key: 'reproducibility', label: 'Can you run it today?', score: 0.8, weight: 0.25,
        reasoning:
          'The objective is a handful of lines and fully specified in the paper, and a maintained trainer exists in TRL. Marked down because reproducing the *headline* result is a different matter from running the algorithm — that needs scale, data and rollout compute most teams do not have.',
        evidence: [
          { claim: 'Objective and advantage estimator given explicitly in the source paper.', url: 'https://arxiv.org/abs/2402.03300' },
          { claim: 'Maintained GRPOTrainer implementation in a mainstream library.', url: 'https://github.com/huggingface/trl' },
        ],
      },
      {
        key: 'benchmarks', label: 'Are the numbers real?', score: 0.8, weight: 0.25,
        reasoning:
          'Reported gains on maths and reasoning benchmarks are substantial and the models were released so the outputs can be checked. The deduction is for attribution: the ablation that isolates GRPO from verifiable rewards and from scale is the one everybody wants and nobody has cleanly published.',
        evidence: [
          { claim: 'Strong reported reasoning-benchmark results, with open weights released alongside.', url: 'https://arxiv.org/abs/2501.12948' },
          { claim: 'Original introduction reports maths gains over the SFT baseline.', url: 'https://arxiv.org/abs/2402.03300' },
        ],
      },
      {
        key: 'adoption', label: 'Is anyone actually using it?', score: 0.85, weight: 0.2,
        reasoning:
          'It became a default choice for reasoning post-training quickly, is implemented in the mainstream RLHF libraries, and has spawned a visible family of variants adjusting the normalisation and the KL term.',
        evidence: [
          { claim: 'Shipped as a first-class trainer in TRL rather than living only in research forks.', url: 'https://github.com/huggingface/trl' },
        ],
      },
      {
        key: 'independence', label: 'Has anyone outside verified it?', score: 0.75, weight: 0.15,
        reasoning:
          'Numerous independent open reproductions have trained reasoning models with GRPO and reported that it works. What remains thin is independent work isolating GRPO\'s contribution specifically, as opposed to confirming that the overall recipe trains.',
        evidence: [
          { claim: 'Independently reimplemented outside the originating lab and used in open training runs.', url: 'https://github.com/huggingface/trl' },
          { claim: 'Open weights allow third parties to evaluate the resulting models directly.', url: 'https://arxiv.org/abs/2501.12948' },
        ],
      },
      {
        key: 'maturity', label: 'Will it still look like this in a year?', score: 0.65, weight: 0.15,
        reasoning:
          'The lowest factor, deliberately. Details around the KL term, the standard-deviation normalisation and length bias are actively contested, and several successors change exactly those pieces. The group-baseline idea will survive; the specific formula you copy today probably will not.',
        evidence: [
          { claim: 'Follow-up work modifies the normalisation and KL handling rather than adopting them unchanged.', url: 'https://arxiv.org/abs/2402.03300' },
        ],
      },
    ],
    useIf: [
      'Your task has a reward you can write as a program — maths, code, structured extraction, format compliance.',
      'You are memory-bound in training and can spare rollout compute instead.',
      'You want to post-train for reasoning without building a reward model first.',
    ],
    skipIf: [
      'Your objective is taste, tone or safety — you need preference data and a reward model regardless.',
      'You cannot afford G generations per prompt per step.',
      'You need per-token credit assignment within long completions.',
    ],
    wouldChangeMyMind: [
      'A clean ablation showing the group baseline beats a critic at matched compute would push benchmarks and independence up sharply.',
      'Conversely, a result showing plain REINFORCE-with-a-baseline matches GRPO at the same rollout budget would make this mostly a naming exercise.',
      'Convergence of the community on one fixed formulation would lift maturity out of the 0.6s.',
    ],
  },
}
