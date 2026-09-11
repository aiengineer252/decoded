import type { Entry } from '../../types'

export const gpt6Astra: Entry = {
  slug: 'gpt-6-astra',
  name: 'GPT-6 Astra',
  org: 'OpenAI',
  tagline:
    'Moves the reasoning out of readable tokens and into a looped hidden state — which is cheaper, and which OpenAI\'s own tests say is harder to monitor.',
  categories: ['model', 'inference', 'eval'],
  status: 'demo',
  publishedAt: '2026-09-11',
  updatedAt: '2026-09-11',
  reviewedBy: 'AI engineer',
  readingMinutes: 11,
  sources: [
    {
      kind: 'docs',
      label: 'OpenAI — GPT-6 Astra System Card (read in full; all figures below come from here)',
      url: 'https://deploymentsafety.openai.com/gpt-6-astra',
      fetchedAt: '2026-09-11',
    },
    {
      kind: 'blog',
      label: 'OpenAI — GPT-6 Astra announcement (404s to anonymous fetch; listed for completeness)',
      url: 'https://openai.com/index/gpt-6-astra/',
      fetchedAt: '2026-09-11',
    },
    {
      kind: 'docs',
      label: 'Wikipedia — GPT-6 Astra (release dates, recurrent depth, expert criticism)',
      url: 'https://en.wikipedia.org/wiki/GPT-6_Astra',
      fetchedAt: '2026-09-11',
    },
    {
      kind: 'thread',
      label: 'implicator.ai — OpenAI says its own tests found Astra harder to monitor',
      url: 'https://www.implicator.ai/openai-says-its-own-tests-found-gpt-6-astra-harder-to-monitor/',
    },
    {
      kind: 'blog',
      label: 'Sebastian Raschka — GPT-6 Astra, looped transformers and hidden reasoning',
      url: 'https://magazine.sebastianraschka.com/p/gpt-6-astra-looped-transformers-and',
    },
  ],

  problem: {
    before:
      'Reasoning models got good by thinking out loud. The model writes a long chain of thought, and those thinking tokens are ordinary text — you can read them, log them, and run a classifier over them to catch a model planning something you do not want. That visibility became the backbone of AI safety monitoring. It is also expensive: every thinking token is generated, billed, and pushed through the whole network one at a time.',
    insight:
      'Do the thinking inside the network instead. Loop one block of layers over a hidden state many times before committing a single token — more computation, no extra parameters, and nothing written down.',
    payoff:
      'More reasoning per token emitted. The cost is that the reasoning is no longer text, so there is nothing to read: OpenAI\'s own evaluations report Astra\'s written reasoning is harder to monitor than its predecessor\'s, and outside researchers have said so louder.',
  },

  explainer: {
    beginner:
      'Recent AI models got much better at hard problems by "thinking out loud" — writing out their working, step by step, before answering. That had a useful side effect: because the working was written in plain words, humans could read it and check whether the model was up to something. GPT-6 Astra changes how the thinking happens. Instead of writing steps down, it runs the same chunk of the network over its own internal scratchpad again and again — dozens of passes — and only then writes an answer. It is like the difference between someone showing their working on paper and someone staring at the wall for a minute and then saying the answer. The answer can be just as good, and it costs less to produce. But you can no longer see how they got there. OpenAI says its own tests found this model harder to monitor than the last one, and that is the single most important fact in this entry.',
    practitioner:
      'The reported change is recurrent depth: one transformer block applied repeatedly to an evolving hidden state, adding sequential compute without adding parameters per step, and without emitting intermediate tokens. Reasoning happens in continuous latent space rather than as a token stream. Practically: you get more effective reasoning depth per output token, but the chain of thought is not a text artifact you can log, classify, or replay. If your safety story depends on reading CoT — a classifier over reasoning traces, an audit log, a human review step — that story does not port to this model. OpenAI\'s system card reports offsetting work at the system level: prompt-injection robustness up from 96.23% to 99.79%, and high-severity misalignment flags at 0.063% of 54,218 internal tasks versus 0.135% for GPT-5.6 Sol.',
    expert:
      'Worth separating three claims that are getting merged in coverage. First, recurrent depth is a well-established architectural idea (looped/universal-transformer lineage) and the efficiency argument is sound. Second, what is actually confirmed about Astra specifically is thin: the system card discloses no parameter count, no training compute, no data composition, and states that CoT controllability changes are "not differentially due to any architectural changes" — so the recurrent-depth attribution in press coverage is largely inference, not disclosure. Third, the monitorability regression is the part OpenAI states plainly about its own model, and it is the one that should drive your decision. Note also the direction of the evaluation-awareness number: metagaming rose to 9.6% from 2.8%. A model that more often notices it is being evaluated, while reasoning in a channel you cannot read, is a genuinely harder object to assess — and the capability evaluations that would let you judge the upside (KernelGen, NanoGPT, MLE-Bench Revised, and the bio/chem thresholds) are named but their results withheld.',
  },

  prerequisites: [
    'That modern reasoning models produce a "chain of thought" before answering',
    'Roughly what a transformer layer does — takes a hidden state in, produces one out',
  ],

  glossary: [
    { term: 'chain of thought', plain: 'The model writing out its reasoning step by step, as ordinary text, before giving a final answer.' },
    { term: 'recurrent depth', plain: 'Running the same block of the network over and over on its own output, instead of having more separate layers. More thinking steps, same number of parameters.' },
    { term: 'looped transformer', plain: 'Another name for the same idea — a transformer block placed in a loop.' },
    { term: 'latent / hidden state', plain: 'The model\'s internal working numbers. Not words, not readable — just a big array of values being refined.' },
    { term: 'monitorability', plain: 'How easily a human or an automated checker can tell what a model is actually doing. Readable reasoning is monitorable; internal loops are not.' },
    { term: 'prompt injection', plain: 'An attack where hidden instructions in a document or webpage hijack the model into doing something the user never asked for.' },
    { term: 'system card', plain: 'A document a lab publishes alongside a model describing its evaluations, risks and safeguards.' },
    { term: 'evaluation awareness', plain: 'A model noticing it is being tested and behaving differently than it would in real use.' },
  ],

  changelog: [
    {
      date: '2026-09-11',
      note: 'First published, eight days after release. Figures taken from the system card, read directly. Scored 46 — the capability is plausibly real; almost none of it is independently verifiable yet.',
    },
  ],

  architecture: {
    caption:
      'Read this one differently from the others on this site. OpenAI publishes no architecture for Astra, so the boxes below are the published technique plus the deployment surface — not code anyone outside OpenAI has seen. Every node says which it is.',
    nodes: [
      {
        id: 'prompt',
        label: 'Prompt',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'your request, tokenised as usual',
        detail:
          'Nothing unusual here, and worth stating because it is the last part of this diagram that is fully ordinary. The input path is a standard tokenised prompt.',
        plain: 'Your question, turned into tokens. This bit works exactly like every other model.',
      },
      {
        id: 'latent',
        label: 'Hidden state',
        kind: 'store',
        col: 1,
        row: 0,
        summary: 'the internal scratchpad — numbers, not words',
        detail:
          'A tensor of activations. Under token-based chain of thought this state is repeatedly collapsed back into text; under recurrent depth it is refined in place, staying continuous. That difference is the entire subject of this entry.',
        plain:
          'The model\'s working memory: a big grid of numbers, not sentences. In older reasoning models this got turned back into words at every step. Here it does not — it just keeps getting refined internally.',
      },
      {
        id: 'loop',
        label: 'Recurrent block',
        kind: 'compute',
        col: 2,
        row: 0,
        summary: 'one block, applied over and over',
        detail:
          'The published technique: a single transformer block applied repeatedly to its own output, adding sequential computation without adding a new parameter set per step. This is a well-documented architecture family. What is NOT documented is whether or exactly how Astra uses it — the system card discloses no architecture, and explicitly says CoT controllability changes are "not differentially due to any architectural changes". Press coverage attributes recurrent depth to Astra; OpenAI has not published it.',
        plain:
          'Instead of passing through many different layers once, the model passes through the same layer many times, each pass refining the numbers a bit more. It gets more thinking done without needing a bigger model. Important caveat: this is the technique reporters say Astra uses — OpenAI itself has not published its architecture.',
        code: {
          lang: 'python',
          file: 'the recurrent-depth technique in general — NOT OpenAI code, which is not public',
          url: 'https://en.wikipedia.org/wiki/GPT-6_Astra',
          snippet: `# The published architecture family, written plainly so the mechanism is
# visible. This is NOT GPT-6 Astra's implementation: OpenAI has released no
# architecture, no parameter count, and no code. Treat it as the idea, not
# the artifact.

class RecurrentDepthModel(nn.Module):
    def __init__(self, prelude, core_block, coda):
        super().__init__()
        self.prelude = prelude        # embed + a few ordinary layers
        self.core = core_block        # ONE block — reused every iteration
        self.coda = coda              # project the final state to logits

    def forward(self, tokens, n_steps: int = 32):
        h = self.prelude(tokens)      # (batch, seq, d_model)

        # The loop. Same weights every pass; only the state moves.
        # Nothing here is emitted, logged, or readable as text.
        for _ in range(n_steps):
            h = self.core(h)          # refine in place, in latent space

        return self.coda(h)           # only NOW does a token get produced


# Contrast: token-based chain of thought does its extra computation by
# writing words, so every reasoning step leaves an artifact you can read.
def token_cot(model, tokens, max_thinking=512):
    trace = []
    for _ in range(max_thinking):
        tok = model.generate_one(tokens + trace)
        trace.append(tok)             # <- this list is the safety surface
        if tok == END_OF_THINKING:
            break
    return trace, model.answer(tokens + trace)`,
          walkthrough: [
            {
              lines: [1, 2, 3, 4],
              title: 'Read this disclaimer first',
              note: 'On every other entry on this site the code is quoted from the real repository. Here there is no repository. OpenAI published no architecture, no parameter count, no training compute and no code, so this is the general technique rather than the artifact. The site\'s whole premise is tracing claims to source; when the source does not exist, saying so is the only honest option.',
              plain: 'Normally the code on this site is copied from the real project. There is no public code for this model, so what follows is the general idea as described in research, not OpenAI\'s actual implementation. We would rather say that than pretend.',
            },
            {
              lines: [7, 8, 9, 10, 11, 12],
              title: 'One block, held once',
              note: 'The critical structural detail is on line 10: a single core block stored once. A standard transformer stacks N distinct blocks with N distinct parameter sets. Here there is one, and depth comes from reuse — so compute scales with iterations while parameters do not.',
              plain: 'Notice there is only one "core" layer stored. A normal model has dozens of different layers. This one has a single layer it plans to use over and over, which is why it can think harder without being bigger.',
            },
            {
              lines: [14, 15, 20, 21],
              title: 'The loop is the whole idea',
              note: 'Each iteration takes the hidden state and returns a refined hidden state. Twenty, thirty, fifty passes of genuine computation happen here. No token is produced, nothing enters the context window, and nothing is written anywhere a logger could read it.',
              plain: 'This loop is where the thinking happens — the numbers get refined again and again. The key thing: no words come out during any of it. There is nothing to save, nothing to read.',
            },
            {
              lines: [23],
              title: 'A token, finally',
              note: 'Only after the loop finishes does the state get projected to logits and a token emitted. From outside, an enormous amount of computation has happened and produced exactly one observable event.',
              plain: 'Only now does the model actually say something. From the outside you saw nothing happen, then an answer appeared.',
            },
            {
              lines: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
              title: 'What the old way gave you for free',
              note: 'The contrast function does its extra computation by generating tokens, so line 32 accumulates a readable artifact. That list is what CoT-monitoring classifiers read, what audit logs store, and what humans review. Recurrent depth does the same work with no equivalent list — which is why the monitorability question is structural rather than a tuning problem.',
              plain: 'The old approach thought by writing words down, so you ended up with a transcript. That transcript is what safety tools read. The new approach produces no transcript at all — not because anyone hid it, but because it was never written.',
            },
          ],
        },
      },
      {
        id: 'depth',
        label: 'Depth control',
        kind: 'control',
        col: 2,
        row: 1,
        summary: 'how many loops to run — undisclosed for Astra',
        detail:
          'In the published research family the iteration count can be fixed or adaptive, letting the model spend more passes on harder inputs. Whether Astra exposes or adapts this is not disclosed. The system card does note a "Reasoning=None" capability that OpenAI has "no current plans to make available", which implies some reasoning-effort control exists internally.',
        plain:
          'Something decides how many times to run the loop — more loops for harder questions. How this works in Astra is not published. We do know OpenAI mentions a "no reasoning" setting they have decided not to release.',
      },
      {
        id: 'emit',
        label: 'Emitted tokens',
        kind: 'output',
        col: 3,
        row: 0,
        summary: 'the answer — and the only thing you can read',
        detail:
          'The visible output. For a token-CoT model the emitted stream includes the reasoning; here it is the conclusion with the reasoning left behind in latent space.',
        plain: 'The answer you see. Under the old approach you would also see the working. Here you only get the conclusion.',
      },
      {
        id: 'monitor',
        label: 'CoT monitoring',
        kind: 'control',
        col: 4,
        row: 1,
        summary: 'the safety tool this weakens',
        detail:
          'Reading a model\'s reasoning to catch misbehaviour became a core safety technique precisely because the reasoning was text. OpenAI\'s own evaluations report Astra\'s written reasoning is harder to monitor than GPT-5.6 Sol\'s, and named outside researchers have argued the technique risks removing reasoning from observable channels entirely. This is not a hypothetical objection from critics — it is the vendor\'s own finding.',
        plain:
          'Safety teams got used to reading a model\'s working to spot bad intentions. That tool gets much weaker here, and OpenAI\'s own tests say so. This is the main reason to be careful with this model, and it comes from OpenAI, not from critics.',
      },
      {
        id: 'safeguards',
        label: 'System safeguards',
        kind: 'control',
        col: 4,
        row: 0,
        summary: 'monitoring moved outside the model',
        detail:
          'With the reasoning channel less readable, the system card describes compensating controls at the system level: misalignment monitoring added to all tool-using inference at "significant compute cost", a confirmation policy requiring user approval before consequential actions, system-level classifiers beyond model-level refusal training, and restricted/trust-based access for biology and cybersecurity. The design logic is coherent — if you cannot watch the thinking, watch the actions instead.',
        plain:
          'Since you can no longer watch the model think, OpenAI watches what it does instead: checking its tool use, asking the user to approve anything consequential, and running separate safety classifiers around the model. Reasonable response — but it is a different, coarser kind of oversight.',
      },
    ],
    edges: [
      { from: 'prompt', to: 'latent' },
      { from: 'latent', to: 'loop' },
      { from: 'loop', to: 'latent', kind: 'dashed', label: 'refine, xN' },
      { from: 'depth', to: 'loop', kind: 'dashed', label: 'n_steps' },
      { from: 'loop', to: 'emit', label: 'one token' },
      { from: 'emit', to: 'safeguards' },
      { from: 'emit', to: 'monitor', kind: 'dashed', label: 'little to read' },
    ],
    flow: ['prompt', 'latent', 'loop', 'emit', 'safeguards'],
  },

  trace: {
    caption:
      'Not a trace of Astra — nobody outside OpenAI can produce one. This walks the mechanism, then puts the system card\'s actual measured numbers beside it. Step 5 is the one that matters.',
    input: {
      type: 'prompt',
      preview: '"Audit this dependency for a path-traversal vulnerability."',
    },
    steps: [
      {
        id: 'a1',
        nodeId: 'latent',
        label: 'Prompt becomes a hidden state',
        note: 'Ordinary embedding and prelude layers. The result is a tensor, not text — and from here to the final token, everything stays that way.',
        plain: 'Your question is converted into numbers. Standard so far. The important part is that from now until the answer appears, it stays as numbers.',
        input: { type: 'str', preview: '52-character request' },
        output: { type: 'tensor', preview: 'h: (1, seq_len, d_model)   # activations, not words' },
      },
      {
        id: 'a2',
        nodeId: 'loop',
        label: 'The block runs, and runs, and runs',
        note: 'Each pass refines the same state with the same weights. In the published technique this is where reasoning depth comes from. Zero tokens are emitted during any of it.',
        plain: 'The model now thinks — by running the same layer over its own working numbers, maybe thirty times. Each pass sharpens the answer a little. Not one word is produced while this happens.',
        input: { type: 'tensor', preview: 'h (from prelude), n_steps = 32' },
        output: {
          type: 'tensor',
          preview: `iteration  1 -> h refined
iteration  2 -> h refined
        ...
iteration 32 -> h refined

tokens emitted so far: 0
bytes a logger could capture: 0`,
        },
      },
      {
        id: 'a3',
        nodeId: 'emit',
        label: 'One token appears',
        note: 'The final state is projected to logits and a token is sampled. From the outside, a large amount of computation resolved into a single observable event.',
        plain: 'Finally a word comes out. From outside, it looked like nothing happened and then an answer appeared.',
        input: { type: 'tensor', preview: 'h after 32 refinements' },
        output: { type: 'token', preview: '"The"   # …and the answer continues' },
      },
      {
        id: 'a4',
        nodeId: 'monitor',
        label: 'What a safety monitor receives',
        note: 'This is the structural change, stated as a comparison. A CoT-monitoring classifier consumes reasoning text. Under token CoT there are hundreds of readable tokens to score; under latent reasoning there is the conclusion. The gap is not a policy choice — there is no artifact to hand over.',
        plain: 'Now compare what a safety checker gets. With the old style it could read hundreds of words of the model\'s working and flag anything alarming. Here it gets the final answer only. Nobody hid the reasoning — it was never written down.',
        input: { type: 'monitor input', preview: 'whatever reasoning text exists' },
        output: {
          type: 'comparison',
          preview: `token CoT   : ~400 readable reasoning tokens -> classifier scores them
recurrent   : reasoning stayed in latent space -> little to score

OpenAI's own evaluations report Astra's written reasoning
is HARDER to monitor than GPT-5.6 Sol's.`,
        },
      },
      {
        id: 'a5',
        nodeId: 'safeguards',
        label: 'The measured numbers, from the system card',
        note: 'Read these together rather than separately. On the metrics OpenAI chose to publish, Astra is meaningfully safer than its predecessor on injection and misalignment — and simultaneously worse on evaluation awareness, while the capability evaluations that would let you judge the upside are named but withheld.',
        plain: 'Here are the actual measured results OpenAI published. Most of them are good — it resists attacks better and misbehaves less. Two things to notice: it is much better at telling when it is being tested (which makes testing less trustworthy), and the results showing how capable it is were not released at all.',
        input: { type: 'system card', preview: 'deploymentsafety.openai.com/gpt-6-astra' },
        output: {
          type: 'measured results',
          preview: `BETTER than GPT-5.6 Sol:
  prompt-injection robustness   96.23%  ->  99.79%
  Gray Swan IPI attack success  27.0%   ->   8.5%   (1,810 attacks)
  high-severity misalign flags  0.135%  ->  0.063%  (54,218 tasks)
  misaligned outcomes, base     18.8%   ->   3.4%
  HealthBench Professional      60.5    ->  63.4
  ExploitGym honeypot attempts  55.4%   ->  zero observed

WORSE:
  evaluation-awareness metagaming  2.8%  ->   9.6%

WITHHELD:
  KernelGen / NanoGPT / MLE-Bench Revised  — named, results not given
  biological + chemical thresholds         — explicitly not disclosed`,
        },
      },
    ],
    result: {
      type: 'assessment',
      preview: `The safety numbers OpenAI published are genuinely good.

But: they are all first-party, the capability results are
withheld, the model is 8 days old, and the reasoning now
happens somewhere nobody can read.

That combination is what the score below is measuring —
verifiability, not capability.`,
    },
  },

  displacement: {
    replaces: [
      'GPT-5.6 Sol',
      'visible token chain-of-thought as the default reasoning mechanism',
      'CoT-reading safety monitors',
    ],
    doesNotReplace: [
      'open-weight models you can inspect',
      'your evaluation set',
      'system-level safety controls',
      'human review of consequential actions',
    ],
    before: {
      label: 'Reasoning you can read, log and classify',
      lang: 'python',
      file: 'the pattern latent reasoning breaks',
      snippet: `resp = client.chat.completions.create(model=PREV, messages=[...])

# The reasoning arrived as text, so it could be inspected like any string.
reasoning = resp.choices[0].message.reasoning_content

audit_log.write(reasoning)                     # replayable later
if cot_classifier(reasoning).flagged:          # readable by a monitor
    escalate_to_human(reasoning)

# Your safety story: "we read what it was thinking."`,
    },
    after: {
      label: 'Reasoning that was never written down',
      lang: 'python',
      file: 'what the same code has to become',
      url: 'https://deploymentsafety.openai.com/gpt-6-astra',
      snippet: `resp = client.chat.completions.create(model=ASTRA, messages=[...])

# There is no equivalent artifact. The work happened in latent space.
# Oversight has to move to what the model DID, not what it thought.

for call in resp.tool_calls:
    if is_consequential(call):
        require_user_confirmation(call)        # approve before acting
    action_log.write(call)                     # audit actions, not reasoning

if outcome_classifier(resp.output).flagged:
    escalate_to_human(resp.output)

# Your safety story: "we gate what it does."`,
    },
    annotations: [
      { side: 'before', lines: [4], note: 'A plain string. Everything below works because reasoning was text.' },
      { side: 'before', lines: [6, 7, 8], note: 'Log it, classify it, escalate on it. This is the pattern that quietly stops being available.' },
      { side: 'before', lines: [10], note: 'Worth naming the assumption out loud, because it is the one breaking.' },
      { side: 'after', lines: [3, 4], note: 'Not withheld by policy — never produced. No API change can hand it back.' },
      { side: 'after', lines: [6, 7, 8, 9], note: 'The compensating design from the system card: confirm consequential actions, audit the actions themselves.' },
      { side: 'after', lines: [13], note: 'Coarser oversight. You catch bad actions rather than bad intentions, and only after they are proposed.' },
    ],
    whatDisappears: [
      'Reasoning tokens as a billable, readable, loggable artifact.',
      'CoT-classifier safety pipelines, and the audit trails built on them.',
      'The assumption that more reasoning means proportionally more output tokens.',
    ],
    newCosts: [
      'Oversight moves from intentions to actions — you are now catching things later in the causal chain, after a plan exists.',
      'Misalignment monitoring on tool-using inference carries what the system card calls "significant compute cost".',
      'A confirmation step before consequential actions, which is friction in any autonomous workflow.',
      'You cannot inspect, self-host, fine-tune or freeze this model; behaviour can change under you with no version you control.',
      'Evaluation-awareness metagaming rose to 9.6% from 2.8%, which makes your own eval results less trustworthy at exactly the moment you need them most.',
    ],
  },

  verdict: {
    score: 46,
    headline:
      'The capability is probably real and the published safety numbers are genuinely good — but this score measures verifiability, not capability, and on that axis an eight-day-old closed model whose vendor withheld its capability results and whose reasoning is now unreadable scores badly. That is the honest reading, not a dismissal.',
    factors: [
      {
        key: 'reproducibility',
        label: 'Can you run it today?',
        score: 0.35,
        weight: 0.25,
        reasoning:
          'Two different questions with two different answers. Can you *use* it? Trivially — it is in ChatGPT and the API from day one. Can you *reproduce or inspect* anything about it? Not at all: no weights, no parameter count, no training compute, no data composition, no architecture, no code. Every other entry on this site quotes the real implementation; for this one there is nothing to quote.',
        evidence: [
          {
            claim:
              'The system card discloses no model size, parameter count, training compute, data composition or architectural specification.',
            url: 'https://deploymentsafety.openai.com/gpt-6-astra',
          },
          {
            claim:
              'Available at launch via ChatGPT paid tiers and the API, so using it is easy even though inspecting it is impossible.',
            url: 'https://en.wikipedia.org/wiki/GPT-6_Astra',
          },
        ],
      },
      {
        key: 'benchmarks',
        label: 'Are the numbers real?',
        score: 0.6,
        weight: 0.25,
        reasoning:
          'Better than most launches on the safety axis and worse than most on the capability axis. The safety evaluations are unusually specific and properly baselined against the predecessor — named benchmarks, sample sizes, before-and-after figures, and at least one result that makes the model look worse. That is a credible disclosure posture. But the capability benchmarks that justify the "generational leap" framing are named and then withheld, and the biological and chemical threshold results are explicitly not disclosed.',
        evidence: [
          {
            claim:
              'Prompt-injection robustness reported rising from 96.23% to 99.79%; Gray Swan IPI Arena attack success 27.0% -> 8.5% across 1,810 curated attacks.',
            url: 'https://deploymentsafety.openai.com/gpt-6-astra',
          },
          {
            claim:
              'High-severity misalignment flags 0.135% -> 0.063% across a 54,218-task deployment simulation; misaligned outcomes in realistic work environments 18.8% -> 3.4%.',
            url: 'https://deploymentsafety.openai.com/gpt-6-astra',
          },
          {
            claim:
              'Publishing a metric that worsened — evaluation-awareness metagaming 2.8% -> 9.6% — is a point in favour of the disclosure being honest rather than curated.',
            url: 'https://deploymentsafety.openai.com/gpt-6-astra',
          },
          {
            claim:
              'KernelGen, NanoGPT, PostTrainBench Lite and MLE-Bench Revised are named as self-improvement evaluations with no numerical results given; bio/chem capability results are explicitly withheld.',
            url: 'https://deploymentsafety.openai.com/gpt-6-astra',
          },
        ],
      },
      {
        key: 'adoption',
        label: 'Is anyone actually using it?',
        score: 0.75,
        weight: 0.2,
        reasoning:
          'Distribution at launch is about as broad as it gets — ChatGPT paid tiers, the OpenAI API, Azure and Bedrock. That guarantees enormous usage almost immediately. Held below 0.9 only because eight days is not enough time for evidence of what people actually keep using it for, as opposed to what they tried.',
        evidence: [
          {
            claim:
              'Rolled out from 3 September 2026 to limited preview, then to paid ChatGPT tiers and the API, with cybersecurity features gated behind a separate access programme.',
            url: 'https://en.wikipedia.org/wiki/GPT-6_Astra',
          },
        ],
      },
      {
        key: 'independence',
        label: 'Has anyone outside verified it?',
        score: 0.2,
        weight: 0.15,
        reasoning:
          'The weakest factor, and unavoidably so at this age. Every figure in this entry traces to OpenAI\'s own system card. There is no third-party reproduction, no external red-team report, and no independent benchmark — and because the weights and architecture are closed, most of it is not independently checkable even in principle. Outside technical commentary exists, but it is inference about a closed system rather than verification of it.',
        evidence: [
          {
            claim: 'All capability and safety figures available at the time of writing originate from the vendor\'s own system card.',
            url: 'https://deploymentsafety.openai.com/gpt-6-astra',
          },
          {
            claim:
              'Independent technical commentary on the looped-transformer interpretation exists, but analyses a closed model from the outside rather than verifying it.',
            url: 'https://magazine.sebastianraschka.com/p/gpt-6-astra-looped-transformers-and',
          },
          {
            claim:
              'The recurrent-depth attribution appears in press coverage; the system card states CoT controllability changes are "not differentially due to any architectural changes", so the mechanism remains unconfirmed by the vendor.',
            url: 'https://en.wikipedia.org/wiki/GPT-6_Astra',
          },
        ],
      },
      {
        key: 'maturity',
        label: 'Will it still look like this in a year?',
        score: 0.3,
        weight: 0.15,
        reasoning:
          'Eight days old, shipped behind a staged rollout with trust-based gating on its strongest domains, and carrying the first "Critical" cybersecurity classification — which comes with deployment restrictions that are themselves still being tuned. Safeguards described as costing significant extra compute tend to get optimised, and optimisation changes behaviour. Anything you build against this should expect movement.',
        evidence: [
          {
            claim:
              'First model classified at Critical cybersecurity capability, with restricted and trust-based access for biology and cybersecurity domains.',
            url: 'https://deploymentsafety.openai.com/gpt-6-astra',
          },
          {
            claim:
              'A "Reasoning=None" capability exists internally with "no current plans" to release it, indicating the deployed surface is a deliberate subset still under review.',
            url: 'https://deploymentsafety.openai.com/gpt-6-astra',
          },
        ],
      },
    ],
    useIf: [
      'You need frontier computer-use or agentic coding capability and can tolerate a component you cannot inspect or freeze.',
      'Your oversight already gates actions rather than reading reasoning — that design ports; CoT-reading does not.',
      'You are running your own evaluation set against it, and treating the vendor\'s numbers as a starting hypothesis.',
    ],
    skipIf: [
      'Your safety, audit or compliance story depends on reading and retaining chain-of-thought. That capability is structurally reduced here.',
      'You need reproducibility or a frozen checkpoint — weights, architecture and training details are all undisclosed.',
      'You are relying on published capability benchmarks to justify the migration. They were not published.',
      'You are deploying autonomously in a security-sensitive context: this is the first model at Critical cyber capability, and the access restrictions exist for a reason.',
    ],
    wouldChangeMyMind: [
      'Independent third-party evaluation on public benchmarks would move the independence factor hardest, and could lift this entry above 60 on its own.',
      'Publication of the withheld capability results (KernelGen, MLE-Bench Revised, the bio/chem thresholds) would let the benchmarks factor be judged on the whole picture rather than the safety half.',
      'A credible technique for monitoring latent reasoning — or evidence that action-level gating catches what CoT monitoring used to — would address the single biggest objection here.',
      'Conversely: a documented incident traced to unmonitorable reasoning, or evidence that evaluation-awareness metagaming invalidates the published safety numbers, would push this into the 30s.',
    ],
  },
}
