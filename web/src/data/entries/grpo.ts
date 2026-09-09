import type { Entry } from '../../types'

export const grpo: Entry = {
  slug: 'grpo',
  name: 'GRPO',
  org: 'DeepSeek-AI',
  tagline:
    'Stop training a second network to judge how good an answer is. Answer the same question several times and let the answers judge each other.',
  categories: ['training', 'model'],
  status: 'demo',
  publishedAt: '2026-08-13',
  updatedAt: '2026-09-10',
  reviewedBy: 'AI engineer',
  readingMinutes: 9,
  sources: [
    { kind: 'paper', label: 'DeepSeekMath — where GRPO is introduced (Sec. 4)', url: 'https://arxiv.org/abs/2402.03300' },
    { kind: 'paper', label: 'DeepSeek-R1 — GRPO at scale for reasoning', url: 'https://arxiv.org/abs/2501.12948' },
    { kind: 'repo', label: 'huggingface/trl — GRPOTrainer', url: 'https://github.com/huggingface/trl' },
  ],

  problem: {
    before:
      'To train a model by reward instead of by example, you need to know whether each answer was better or worse than expected — a raw score like "7 out of 10" means nothing without a baseline. The standard fix (PPO) trains an entire second network just to predict that baseline. It is as big as the model, needs its own optimiser state, and goes stale as the model it is judging improves. For a large model, it is often the biggest single memory cost of training.',
    insight:
      'Answer the same question several times and compare the answers to each other. Above-average answers get reinforced, below-average get discouraged. The group is the baseline — no second network.',
    payoff:
      'The value network and its memory disappear, and with it a whole class of training instability. What you pay instead is generating several answers per question each step — a trade of memory for rollout compute that works especially well when the reward is a program (does the code run, is the answer right).',
  },

  explainer: {
    beginner:
      'Suppose you are teaching someone to solve maths problems, and all you can tell them is a score for each attempt. If they score 7, is that good? It depends what they usually score. The old approach hired a separate assessor whose entire job was to estimate what "usual" is — expensive, and the assessor falls behind as the student improves. GRPO drops the assessor: give the student the same problem four times, score all four attempts, and compare them to each other. The above-average attempts get a "more like this"; the below-average get a "less like that". Four numbers you already have give you the baseline for free. The catch is that you now pay for four attempts per problem instead of one. That is a fair trade when checking an answer is cheap — and for maths and code, it often is.',
    practitioner:
      'Drop the critic; estimate the baseline from the group. Sample G completions per prompt, score each, then standardise within the group: A = (r - mean(r)) / std(r). Every token of a completion inherits its completion\'s advantage. The surrogate is PPO-shaped — clipped importance ratio times advantage — with KL to a frozen reference applied in the loss rather than folded into the reward. You free the value network and its optimiser state, which is usually the largest memory line item, and you pay G rollouts per prompt per step. Watch for degenerate groups: if all G rewards are equal, the advantage is zero and the step is wasted.',
    expert:
      'The mechanism is real and simple; the attribution is where the discourse overreaches. Most of the celebrated reasoning results belong to verifiable rewards at scale, which GRPO enables rather than causes — and the ablation that would separate them is the one everyone wants and nobody has cleanly published. The honest open question is whether plain REINFORCE-with-a-baseline matches it at matched rollout budget; if so this is largely a naming exercise. Note also that maturity is the weakest factor deliberately: the KL term, the standard-deviation normalisation and length bias are all actively contested, and several successors change exactly those pieces. The group-baseline idea will survive; the specific formula you copy today probably will not.',
  },
  prerequisites: [
    'Roughly what reinforcement learning is — improving by reward rather than by copying examples',
    'That "fine-tuning by reward" is how models are taught to reason and follow instructions',
  ],
  glossary: [
    { term: 'GRPO', plain: 'Group Relative Policy Optimization. Estimates the baseline by comparing several answers to the same prompt.' },
    { term: 'policy', plain: 'The model being trained, seen as something that chooses what to output.' },
    { term: 'reward', plain: 'A score for one answer. Can come from a program (is the answer right?) or a learned model (does a human prefer this?).' },
    { term: 'baseline', plain: 'What score is "normal" for this question. Without it, a raw score cannot tell you whether to reinforce or discourage.' },
    { term: 'critic / value model', plain: 'A second network trained to predict the baseline. GRPO removes it.' },
    { term: 'advantage', plain: 'How much better than the baseline an answer was. Positive reinforces, negative discourages.' },
    { term: 'KL penalty', plain: 'A leash keeping the trained model from drifting too far from where it started, so it cannot game the reward with nonsense.' },
    { term: 'rollout', plain: 'One generated answer produced during training so it can be scored.' },
  ],
  changelog: [
    { date: '2026-09-10', note: 'Rewritten for progressive reading: problem-first opener, plain-language trace, whole-function code with guided walkthroughs.' },
    { date: '2026-08-13', note: 'First published. Maturity scored 0.65 — normalisation and KL details are actively contested.' },
  ],

  architecture: {
    caption:
      'PPO needs a learned value model to know whether a completion was better than average. GRPO answers the same question by sampling the same prompt G times and comparing them to each other.',
    nodes: [
      {
        id: 'prompt',
        label: 'Prompt',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'one question; it will be answered G times',
        detail: 'A single prompt is the unit of work. Unlike PPO, where each prompt yields one trajectory, here it yields a group — and the group is what makes the baseline possible.',
        plain: 'One question from the training set. The model will attempt it several times, not once — that is the key difference from the older method.',
      },
      {
        id: 'sample',
        label: 'Policy samples G',
        kind: 'model',
        col: 1,
        row: 0,
        summary: 'generate G different answers to the same prompt',
        detail: 'The current policy generates G completions (commonly 4-16) for the same prompt at non-zero temperature. This is where GRPO spends the compute that PPO spent on training a critic — it is a trade, not a free lunch.',
        plain: 'The model answers the same question G times (say 4 or 8), with some randomness so the answers differ. This is where the cost went: instead of paying for a second network, you pay for several attempts.',
        code: {
          lang: 'python',
          file: 'one GRPO training step, end to end (simplified from the paper and TRL)',
          url: 'https://arxiv.org/abs/2402.03300',
          snippet: `def grpo_step(policy, ref_policy, reward_fn, prompt, answer,
              G=8, eps=0.2, beta=0.04):
    # 1. ROLLOUT: G answers to the SAME prompt, with sampling noise
    completions = [policy.generate(prompt, temperature=1.0) for _ in range(G)]

    # 2. REWARD: a plain function — no reward model needed for verifiable tasks
    rewards = torch.tensor([reward_fn(c, answer) for c in completions])

    # 3. GROUP-RELATIVE ADVANTAGE: the baseline is the group itself
    advantages = (rewards - rewards.mean()) / (rewards.std() + 1e-8)
    #   every token of completion i gets advantages[i]  (no per-token credit)

    # 4. CLIPPED SURROGATE, PPO-shaped, plus a KL leash to the frozen reference
    loss = 0.0
    for c, adv in zip(completions, advantages):
        logp_new = policy.log_prob(c, prompt)          # current model
        logp_old = logp_new.detach()                   # snapshot for the ratio
        logp_ref = ref_policy.log_prob(c, prompt)      # frozen starting point

        ratio = torch.exp(logp_new - logp_old)
        clipped = torch.clamp(ratio, 1 - eps, 1 + eps)
        policy_loss = -torch.min(ratio * adv, clipped * adv).mean()

        kl = (torch.exp(logp_ref - logp_new) - (logp_ref - logp_new) - 1).mean()
        loss = loss + policy_loss + beta * kl

    (loss / G).backward()
    optimizer.step()                                   # ONE network updated
    return rewards.mean().item()`,
          walkthrough: [
            {
              lines: [3, 4],
              title: 'G answers, one question',
              note: 'Same prompt, G samples at temperature 1.0 so they differ. The spread between these is the entire learning signal — if all G were identical there would be nothing to compare and the step would be wasted.',
              plain: 'Ask the same question G times with a little randomness so the attempts vary. Those differences are what we learn from — identical answers would teach nothing.',
            },
            {
              lines: [6, 7],
              title: 'Score with a program, not a model',
              note: 'For verifiable domains the reward is a function you can read: extract the final answer, compare to the known one, check formatting. No reward model to train, no preference dataset behind it, nothing to reward-hack. This is why GRPO took off for maths and code first.',
              plain: 'Grade each attempt with plain code: is the final answer correct? Is it formatted properly? For maths and code you can write that check in a few lines — no second AI needed to do the judging.',
            },
            {
              lines: [9, 10, 11],
              title: 'The whole method, in one line',
              note: 'Standardise rewards within the group: subtract the mean, divide by the standard deviation. Positive means better than this group\'s average; negative means worse. This is exactly what a value network was trained to estimate, obtained for free from samples you already paid for. Note the broadcast: the advantage applies to every token in that completion — GRPO does no per-token credit assignment.',
              plain: 'Compare each score to the group average: above average becomes positive, below becomes negative. That is the baseline — no separate assessor required. One thing to know: the whole answer gets one score, so every word in a good answer is treated as good, even the wobbly ones.',
            },
            {
              lines: [15, 16, 17, 18],
              title: 'Three log-probabilities per completion',
              note: 'logp_new is the current model; logp_old is a detached snapshot used only for the importance ratio; logp_ref is the frozen reference the model started from. The reference is what stops the policy drifting into reward-hacking gibberish.',
              plain: 'For each attempt, ask three questions: how likely does the current model think this answer is, how likely did it think so a moment ago, and how likely did the original untrained model think so. The last one is the leash.',
            },
            {
              lines: [20, 21, 22],
              title: 'PPO-shaped update',
              note: 'The surrogate is standard: importance ratio times advantage, clipped to keep any single step small. The only thing GRPO changed is where the advantage came from. Everything on these lines is inherited from PPO unchanged.',
              plain: 'Push the model toward above-average answers and away from below-average ones — but only a little each step, so no single update can wreck it. This part is the same as the older method; only the score it uses is new.',
            },
            {
              lines: [24, 25],
              title: 'The leash, in the loss',
              note: 'A KL penalty to the frozen reference, applied as a loss term rather than folded into the reward as PPO-for-RLHF usually does. Small, deliberate departure — and one of the details successors keep changing.',
              plain: 'Add a penalty for straying too far from where the model started. This prevents it from finding weird ways to score well that are not actually good answers.',
            },
            {
              lines: [27, 28],
              title: 'One backward pass, one network',
              note: 'There is no critic to update, so the step is a single backward pass over the policy. The memory that would have held a value model and its optimiser state is simply not allocated.',
              plain: 'Update the model. Just the one model — there is no second network to train, so there is no second network to store either.',
            },
          ],
        },
      },
      {
        id: 'reward',
        label: 'Reward function',
        kind: 'compute',
        col: 2,
        row: 0,
        summary: 'score each answer; for maths and code, plain code',
        detail: 'Each completion is scored independently. The headline result is that for verifiable domains this can be a plain program — does the code run, does the answer match, is the format right — with no reward model to train or to be hacked.',
        plain: 'Give each attempt a score. For problems with checkable answers — maths, code, formatting — the scorer is just ordinary code, which cannot be fooled the way a learned judge can.',
        code: {
          lang: 'python',
          file: 'a verifiable reward — readable, testable, un-hackable',
          snippet: `import re

def reward(completion: str, answer: str) -> float:
    # 1. Extract the final answer the model committed to
    m = re.search(r"<answer>(.*?)</answer>", completion, re.S)
    final = m.group(1).strip() if m else ""

    # 2. Correctness: the thing we actually care about
    correct = 1.0 if final == answer else 0.0

    # 3. Format: did it show its reasoning, and close the tags?
    formatted = 0.2 if ("<think>" in completion and "</think>" in completion) else 0.0

    # 4. Mild length penalty so it cannot pad its way to a higher score
    too_long = -0.1 if len(completion) > 4000 else 0.0

    return correct + formatted + too_long`,
          walkthrough: [
            {
              lines: [4, 5, 6],
              title: 'Pin down what it actually answered',
              note: 'Force the model to commit to one final answer inside tags, then parse only that. Without this, "the answer is probably 5 or maybe 7" scores ambiguously and the reward becomes gameable.',
              plain: 'Make the model state one final answer in a clear place, and read only that. Otherwise hedging could be scored as half-right.',
            },
            {
              lines: [8, 9],
              title: 'Correctness is binary',
              note: 'Exact match against the known answer. Crude but honest — and because it is a program, the model cannot learn to flatter it the way it can learn to flatter a learned reward model.',
              plain: 'Right or wrong, one point or zero. Simple, and impossible to sweet-talk.',
            },
            {
              lines: [11, 12, 13, 14, 15, 16],
              title: 'Small shaping terms',
              note: 'A bonus for showing reasoning in the expected tags, a penalty for excessive length. These shape behaviour without dominating correctness. Every term here is one you can unit-test.',
              plain: 'A little extra for showing its work, a little less for rambling. Tune these like any other code — they are just numbers in a function you can test.',
            },
          ],
        },
      },
      {
        id: 'advantage',
        label: 'Group-relative advantage',
        kind: 'control',
        col: 3,
        row: 0,
        summary: 'A = (r - mean) / std, within the group',
        detail: 'This single line is the whole method. Standardising the rewards inside the group turns "was this good?" into "was this better than my other attempts at the same question?" — which is exactly what a value model was estimating, obtained for free from samples you already paid for.',
        plain: 'Compare each attempt\'s score to the average of the group. Better than average: positive, reinforce. Worse: negative, discourage. This replaces the entire second network.',
      },
      {
        id: 'kl',
        label: 'KL to reference',
        kind: 'store',
        col: 3,
        row: 1,
        summary: 'a frozen copy of the starting model, as a leash',
        detail: 'A frozen copy of the starting policy anchors the update so the model cannot drift into reward-hacking gibberish. GRPO applies this as a term in the loss rather than folding it into the reward, which is a small but deliberate departure from the usual PPO-for-RLHF setup.',
        plain: 'A frozen snapshot of the model before training. If the model drifts too far from it, there is a penalty. This stops it finding bizarre outputs that score well but are not real answers.',
      },
      {
        id: 'update',
        label: 'Policy update',
        kind: 'compute',
        col: 4,
        row: 0,
        summary: 'PPO-style clipped step, using the group advantage',
        detail: 'The surrogate objective is PPO-shaped — a clipped importance ratio times the advantage — but the advantage came from the group instead of a critic.',
        plain: 'Nudge the model toward the good attempts and away from the bad ones, a small amount per step. Same recipe as before — only the "good/bad" score is computed differently.',
      },
      {
        id: 'loop',
        label: 'Next batch',
        kind: 'control',
        col: 2,
        row: 1,
        summary: 'the improved model answers the next question G times',
        detail: 'The updated policy generates the next group. Because the baseline is recomputed from fresh samples each step, there is no stale critic to go out of date — a class of PPO instability that simply does not exist here.',
        plain: 'Repeat with the next question. Because the baseline is recomputed fresh from each group, it never goes stale — a problem the old assessor network constantly had.',
      },
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
        id: 'g1',
        nodeId: 'sample',
        label: 'Sample G=4 completions',
        note: 'Same prompt, four times, at temperature 1.0. The spread between these four is the entire signal the method runs on — if all four were identical, this step would produce nothing to learn from.',
        plain: 'The model answers the same equation four times. Two get it right, one is wrong, one is a mess. Those differences are what we are about to learn from.',
        input: { type: 'str', preview: '"If 3x + 7 = 22, what is x?"' },
        output: {
          type: 'list[str], len 4',
          preview: `[0] "<think>3x = 15, x = 5</think> <answer>5</answer>"
[1] "<think>3x = 22-7 = 15 so x = 5</think> <answer>5</answer>"
[2] "<answer>7</answer>"
[3] "<think>3x = 29</think> <answer>9.67</answer>"`,
        },
        cost: '4 x generation',
      },
      {
        id: 'g2',
        nodeId: 'reward',
        label: 'Score each with a program',
        note: 'No reward model. A function checks the final answer and the format tags. This is why the method took off for maths and code first — those are the domains where such a function exists.',
        plain: 'A small piece of code grades each attempt: +1 for the right answer, +0.2 for showing its reasoning in the right tags. No AI judge involved.',
        output: {
          type: 'list[float]',
          preview: `[0] correct + formatted -> 1.2
[1] correct + formatted -> 1.2
[2] wrong,  unformatted -> 0.0
[3] wrong,  formatted   -> 0.2`,
        },
      },
      {
        id: 'g3',
        nodeId: 'advantage',
        label: 'Standardise within the group',
        note: 'mean = 0.65, std = 0.567. Two completions land above the group average and two below. That is a baseline — the same quantity PPO trains an entire second network to predict — computed from four numbers.',
        plain: 'Average score is 0.65. Attempts 0 and 1 scored above that — they get a positive push. Attempts 2 and 3 scored below — negative. The "average" came from these four numbers alone. The old method needed an entire second network to guess it.',
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
        id: 'g4',
        nodeId: 'update',
        label: 'Clipped surrogate + KL',
        note: 'From here it is PPO shaped. The advantage is broadcast across all tokens of its completion — GRPO assigns no per-token credit, which is both its simplicity and its main theoretical weakness.',
        plain: 'Nudge the model toward attempts 0 and 1 and away from 2 and 3, gently, with a penalty for drifting too far from the original model. Every word in a good attempt is reinforced equally — the method does not try to figure out which specific words were the good ones.',
        input: { type: 'advantages, logprobs', preview: 'A (4,) broadcast to (4, seq_len)' },
        output: { type: 'scalar', preview: 'policy_loss = -0.412\nkl_penalty  =  0.008 * beta\ntotal       = -0.404' },
      },
      {
        id: 'g5',
        nodeId: 'loop',
        label: 'Step and resample',
        note: 'No critic to update, so the step is one backward pass over one network. The next group is drawn from the moved policy and the baseline is recomputed from scratch.',
        plain: 'Update the model — just the one — and move to the next question. The baseline for the next question will be computed fresh from its own four attempts.',
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
