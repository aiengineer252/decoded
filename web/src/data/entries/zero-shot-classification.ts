import type { Entry } from '../../types'

export const zeroShotClassification: Entry = {
  slug: 'zero-shot-llm-classification',
  name: 'Zero-shot LLM classification',
  org: 'industry pattern',
  tagline:
    'Replace the fine-tuned encoder and its labelled dataset with a prompt and a constrained label set — and give up your calibrated probability in the process.',
  categories: ['eval', 'model', 'tooling'],
  status: 'demo',
  publishedAt: '2026-08-14',
  updatedAt: '2026-08-14',
  reviewedBy: 'AI engineer',
  readingMinutes: 7,
  explainer: {
    beginner:
      'Sorting text into categories — is this review positive or negative, is this ticket a bug or a feature request — used to mean collecting thousands of hand-labelled examples and training a small model on them. That was weeks of work, which is why most teams only ever built one classifier. Now you can describe the categories in a prompt and a general model does it with no training and no labelled data. The catch that rarely gets mentioned: the old trained model handed you a real confidence number you could act on, like 71% positive. The new approach does not. If you asked a model how confident it is, you get a number it made up about itself — useful as a hint, not something to build a threshold on.',
    practitioner:
      'Structured outputs constrain decoding to a schema, so the model can only emit one of your enum values — no parsing, no retry loop, well-formed by construction. The real win is not accuracy, it is that changing your taxonomy is an edit rather than a retrain, which changes how fast you can iterate. The real loss is the calibrated softmax: if you routed low-confidence cases to a human on a threshold, that mechanism has no honest input any more. Cost inverts at volume — a self-hosted DistilBERT is effectively free per item where an API call is not — and latency goes from single-digit milliseconds to hundreds.',
    expert:
      'The comparison that would settle this is almost never run: zero-shot against a properly fine-tuned small encoder, on the same in-domain data, with accuracy, cost-per-item and p99 latency in one table. Published zero-shot results usually beat a from-scratch or naive baseline, which is not the alternative anyone actually had. Two second-order issues deserve more attention than they get. First, you have replaced a checkpoint you own and can freeze with a vendor-hosted model that changes underneath you — without a pinned version and a labelled holdout running against it, you have shipped a component that can silently change behaviour overnight. Second, "no labelled data needed" is true for training and false for evaluation; teams that skip the holdout have not removed the labelling cost, they have removed their ability to detect regressions.',
  },
  prerequisites: [
    'What text classification is — assigning a label to a piece of text',
    'Roughly what fine-tuning a model means',
  ],
  glossary: [
    { term: 'zero-shot', plain: 'Doing a task with no training examples for it — the model works from the instruction alone.' },
    { term: 'fine-tuning', plain: 'Taking a pretrained model and training it further on your own labelled examples.' },
    { term: 'encoder', plain: 'A smaller model like BERT that reads text and produces a representation, rather than generating text.' },
    { term: 'calibrated probability', plain: 'A confidence number that actually corresponds to how often it is right. 0.8 should mean right about 80% of the time.' },
    { term: 'softmax', plain: 'Converts raw model scores into probabilities across your classes that sum to 1.' },
    { term: 'constrained decoding', plain: 'Restricting what the model is allowed to emit next so the output always fits your schema.' },
    { term: 'holdout set', plain: 'Labelled examples kept aside purely to measure accuracy — never used for training.' },
  ],
  changelog: [{ date: '2026-08-14', note: 'First published. Scored 72 — real for the no-labels case, worse economics at volume.' }],
  sources: [
    {
      kind: 'paper',
      label: 'Sanh et al. — DistilBERT (the encoder this displaced)',
      url: 'https://arxiv.org/abs/1910.01108',
    },
    { kind: 'paper', label: 'Wang et al. — GLUE, where SST-2 sentiment lives', url: 'https://arxiv.org/abs/1804.07461' },
    {
      kind: 'docs',
      label: 'Anthropic — structured outputs / constrained generation',
      url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs',
    },
    { kind: 'repo', label: 'huggingface/transformers — the fine-tuning path', url: 'https://github.com/huggingface/transformers' },
  ],

  architecture: {
    caption:
      'Structurally simpler than the pipeline it replaces — which is the appeal. Click "Calibrated confidence" for the thing that quietly went missing.',
    nodes: [
      {
        id: 'text',
        label: 'Raw text',
        kind: 'input',
        col: 0,
        row: 0,
        summary: 'no preprocessing needed',
        detail:
          'No tokenizer to match, no max-length truncation tuned to a specific encoder, no vocabulary to keep in sync with a checkpoint. The text goes in as it is — which genuinely removes a category of subtle bugs that used to bite at deploy time.',
      },
      {
        id: 'schema',
        label: 'Label schema',
        kind: 'compute',
        col: 1,
        row: 0,
        summary: 'enum of allowed labels',
        detail:
          'The label set is declared as a JSON Schema enum rather than being baked into a classification head. Changing your taxonomy is now a one-line edit instead of retraining — this, not accuracy, is the honest headline benefit.',
        code: {
          lang: 'python',
          file: 'the label space, declared not trained',
          url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs',
          snippet: `SCHEMA = {
    "type": "object",
    "properties": {
        "sentiment": {"type": "string",
                      "enum": ["positive", "negative", "neutral"]},
        "rationale": {"type": "string"},
    },
    "required": ["sentiment", "rationale"],
    "additionalProperties": False,
}`,
          focus: [4, 5],
        },
      },
      {
        id: 'llm',
        label: 'LLM forward pass',
        kind: 'model',
        col: 2,
        row: 0,
        summary: 'billions of params, general',
        detail:
          'A general model that was never trained on your task reads the text with full sentence-level semantics — negation, sarcasm, contrast, domain jargon it happened to see in pretraining. This is where it genuinely beats a small encoder trained on a narrow corpus: the hard cases, not the easy ones.',
      },
      {
        id: 'constrain',
        label: 'Constrained decoding',
        kind: 'control',
        col: 3,
        row: 0,
        summary: 'mask logits to legal tokens',
        detail:
          'At each step the sampler is restricted to tokens that can still produce a schema-valid string. Because "positive" / "negative" / "neutral" are the only legal completions at that position, the model cannot return "mostly positive?" or a paragraph of hedging. This is what makes the output parseable by construction rather than by regex-and-hope.',
        code: {
          lang: 'python',
          file: 'the call — structured output does the constraining',
          url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs',
          snippet: `resp = client.messages.create(
    model="claude-opus-5",
    max_tokens=256,
    output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
    messages=[{"role": "user", "content": f"Classify:\\n{text}"}],
)
label = json.loads(resp.content[0].text)["sentiment"]`,
          focus: [4],
        },
      },
      {
        id: 'conf',
        label: 'Calibrated confidence',
        kind: 'store',
        col: 3,
        row: 1,
        summary: 'this is what you lost',
        detail:
          'The encoder handed you a softmax over your classes — a real distribution you could threshold, tune for precision/recall, and route on. You do not get that here. Asking the model to self-report a confidence gives you a number, but a self-reported number is not a calibrated probability and should not be thresholded as if it were. If your system routed low-confidence cases to a human, that routing logic has no honest input any more.',
      },
      {
        id: 'out',
        label: 'Label',
        kind: 'output',
        col: 4,
        row: 0,
        summary: 'schema-valid, always',
        detail:
          'Guaranteed to be one of your enum values. Worth noticing what this guarantee is and is not: the output is always well-formed, which says nothing about whether it is correct.',
      },
      {
        id: 'eval',
        label: 'Labelled holdout',
        kind: 'control',
        col: 1,
        row: 1,
        summary: 'still required',
        detail:
          'The pitch is "no labelled data needed", and that is true for training but false for knowing whether it works. You still need a few hundred labelled examples to measure accuracy, and you need them again every time the underlying model changes. Teams that skip this step have not removed the labelling cost — they have removed their ability to detect regressions.',
      },
    ],
    edges: [
      { from: 'text', to: 'schema' },
      { from: 'schema', to: 'llm' },
      { from: 'llm', to: 'constrain', label: 'logits' },
      { from: 'constrain', to: 'out' },
      { from: 'constrain', to: 'conf', kind: 'dashed', label: 'no distribution' },
      { from: 'eval', to: 'out', kind: 'dashed', label: 'measures' },
    ],
    flow: ['text', 'schema', 'llm', 'constrain', 'out'],
  },

  trace: {
    caption:
      'A sarcastic review — the exact case that separates the two approaches. Step 4 is where the encoder gets it wrong and the LLM does not.',
    input: {
      type: 'str',
      preview: '"Great, another update that breaks the export button. Love it."',
    },
    steps: [
      {
        id: 'z1',
        nodeId: 'text',
        label: 'The input, and why it is hard',
        note: 'Surface-level sentiment terms are overwhelmingly positive: "Great", "Love it". The actual sentiment is negative and it is carried entirely by sarcasm — a property of the whole sentence, not of any word in it.',
        input: { type: 'str', preview: 'user review, 61 characters' },
        output: {
          type: 'token-level sentiment cues',
          preview: `"Great"      -> positive
"breaks"     -> negative
"Love it"    -> positive

Bag-of-cues verdict: positive. Wrong.`,
        },
      },
      {
        id: 'z2',
        nodeId: 'schema',
        label: 'Declare the label space',
        note: 'The classifier\'s output space is defined here, in a schema, rather than by the shape of a trained linear layer. Adding a fourth label is an edit, not a retrain — and that is the change that actually reorganises how teams work.',
        output: {
          type: 'JSON Schema',
          preview: '"sentiment": { "enum": ["positive", "negative", "neutral"] }',
        },
      },
      {
        id: 'z3',
        nodeId: 'llm',
        label: 'Forward pass over the whole sentence',
        note: 'The model attends across the full sentence, so "Great" is read in the context of "breaks the export button". Nothing about sarcasm was trained in for this task — it comes from pretraining, which is exactly why no labelled examples were needed.',
        input: { type: 'tokens', preview: 'prompt + 61 chars of review' },
        output: {
          type: 'logits over vocab',
          preview: 'shape: (vocab_size,) at the constrained position',
        },
        cost: '~1 API call, ~120 tokens',
      },
      {
        id: 'z4',
        nodeId: 'constrain',
        label: 'Mask to legal completions',
        note: 'Only tokens that can continue into a schema-valid value survive the mask. The model cannot hedge, cannot return prose, and cannot invent a label outside the enum — the output is parseable by construction.',
        input: { type: 'logits', preview: 'unconstrained distribution over the full vocabulary' },
        output: {
          type: 'constrained choice',
          preview: `allowed: ["positive", "negative", "neutral"]
selected: "negative"

Compare — fine-tuned DistilBERT on SST-2:
  positive 0.71 / negative 0.29  -> "positive"  (wrong)`,
        },
      },
      {
        id: 'z5',
        nodeId: 'conf',
        label: 'Ask for the probability — and notice what you get',
        note: 'The encoder returned 0.71/0.29: a real distribution you could threshold at 0.9 and route the rest to a human. Here, any confidence number is the model describing itself. It is often directionally sensible and it is not calibrated — treating it as a probability is the most common mistake in these migrations.',
        input: { type: 'request', preview: '"…and a confidence between 0 and 1"' },
        output: {
          type: 'self-reported',
          preview: `{"sentiment": "negative", "confidence": 0.95}

Self-reported. Not a calibrated probability.
Do not threshold on this the way you thresholded a softmax.`,
        },
      },
      {
        id: 'z6',
        nodeId: 'eval',
        label: 'The step everyone skips',
        note: 'You removed the training set, not the test set. Without a labelled holdout you cannot compare the two approaches, cannot detect a regression when the vendor updates the model, and cannot answer "is this actually better" for your data rather than for SST-2.',
        output: {
          type: 'holdout result',
          preview: `500 labelled in-domain examples

zero-shot LLM      : 0.91 accuracy   |  ~$0.40 / 1k  |  ~600ms
fine-tuned encoder : 0.94 accuracy   |  ~$0.00 / 1k  |  ~8ms (self-hosted)

Illustrative shape, not measured figures — the point is
that these are the four columns the comparison needs.`,
        },
      },
    ],
    result: {
      type: 'classification',
      preview: `{"sentiment": "negative"}

Correct, with zero labelled training examples.

What it cost: per-call inference forever, ~75x the latency,
and the calibrated probability your routing logic depended on.`,
    },
  },

  displacement: {
    replaces: [
      'task-specific fine-tuning for classification',
      'labelled training sets',
      'per-task model hosting',
    ],
    doesNotReplace: [
      'a labelled evaluation set',
      'high-volume batch classification',
      'latency-critical inline classification',
      'calibrated probabilities',
      'on-prem-only workloads',
    ],
    before: {
      label: 'Fine-tune an encoder — the 2019-2023 default',
      lang: 'python',
      file: 'the pipeline this pattern displaced',
      url: 'https://github.com/huggingface/transformers',
      snippet: `model = AutoModelForSequenceClassification.from_pretrained(
    "distilbert-base-uncased", num_labels=3)

train = load_dataset("glue", "sst2")["train"]      # labelled data
tokenized = train.map(lambda b: tok(b["sentence"], truncation=True))

Trainer(model=model, train_dataset=tokenized,
        args=TrainingArguments(num_train_epochs=3)).train()

probs = softmax(model(**tok(text)).logits)         # calibrated
label = LABELS[probs.argmax()]`,
    },
    after: {
      label: 'Prompt + constrained label set',
      lang: 'python',
      file: 'zero-shot with structured outputs',
      url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs',
      snippet: `resp = client.messages.create(
    model="claude-opus-5",
    max_tokens=256,
    output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
    messages=[{"role": "user", "content": f"Classify:\\n{text}"}],
)
label = json.loads(resp.content[0].text)["sentiment"]

# No training set. No checkpoint. No GPU.
# Also: no calibrated probability.`,
    },
    annotations: [
      {
        side: 'before',
        lines: [4],
        note: 'The labelled dataset. Weeks of annotation, and the real reason most teams never shipped a second classifier.',
      },
      {
        side: 'before',
        lines: [7, 8],
        note: 'A training run, a checkpoint to version, and a GPU to serve it on — the operational weight that actually disappears.',
      },
      {
        side: 'before',
        lines: [10],
        note: 'A genuine probability distribution over your classes. Thresholdable, tunable, routable. This is the thing worth mourning.',
      },
      {
        side: 'after',
        lines: [4],
        note: 'The schema constrains decoding, so the output is always one of your labels — no parsing, no retry loop.',
      },
      {
        side: 'after',
        lines: [9, 10],
        note: 'Both halves are true. The second half is the one that gets left out of the pitch.',
      },
    ],
    whatDisappears: [
      'The labelled training set, and the annotation project behind it.',
      'The training loop, the checkpoint, and the GPU you served it from.',
      'Retraining whenever the label taxonomy changes — it is now an edit to an enum.',
      'The tokenizer/checkpoint version-skew class of production bugs.',
    ],
    newCosts: [
      'Per-inference cost, forever. A self-hosted DistilBERT is effectively free at volume; at millions of classifications a month this inverts the economics completely.',
      'Latency goes from single-digit milliseconds to hundreds. Anything inline in a request path feels this immediately.',
      'No calibrated probability. If you routed uncertain cases to a human on a softmax threshold, that mechanism is gone and a self-reported confidence is not a drop-in replacement.',
      'Prompt sensitivity: wording changes move accuracy in ways a trained head never did, and there is no gradient telling you why.',
      'Silent drift. Your classifier is now a vendor-hosted model that can change under you, with no version pin and no regression alarm unless you built the holdout.',
      'Your text leaves your infrastructure, which for some data is simply disqualifying.',
    ],
  },

  verdict: {
    score: 72,
    headline:
      'Genuinely transformative for the long tail of classifiers nobody could justify labelling data for — and a straightforwardly worse deal than a fine-tuned encoder once you are at volume with a stable taxonomy. Most of the hype comes from comparing it to nothing rather than to the encoder it replaced.',
    factors: [
      {
        key: 'reproducibility',
        label: 'Can you run it today?',
        score: 0.9,
        weight: 0.22,
        reasoning:
          'It is one API call with a schema. Constrained decoding is a documented, generally-available feature rather than a research technique, and the whole thing is reproducible in a few lines.',
        evidence: [
          { claim: 'Structured outputs are documented and generally available, with schema constraints enforced at decode time.', url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs' },
          { claim: 'The displaced fine-tuning path is equally reproducible, which makes a like-for-like comparison easy to run.', url: 'https://github.com/huggingface/transformers' },
        ],
      },
      {
        key: 'benchmarks',
        label: 'Are the numbers real?',
        score: 0.5,
        weight: 0.25,
        reasoning:
          'The lowest factor and the crux of the entry. Zero-shot classification results are usually published against a from-scratch or naive baseline, not against a properly fine-tuned small encoder on the same in-domain data — and almost never with cost and latency in the same table. On a stable, well-labelled task an encoder frequently still wins on accuracy and wins overwhelmingly on cost per item. The comparison that would settle it is the one least often run.',
        evidence: [
          { claim: 'SST-2 and the GLUE suite give a standard sentiment baseline that fine-tuned encoders were tuned against for years.', url: 'https://arxiv.org/abs/1804.07461' },
          { claim: 'DistilBERT documents competitive accuracy at a fraction of the size and inference cost — the baseline zero-shot claims should be measured against.', url: 'https://arxiv.org/abs/1910.01108' },
          { claim: 'No head-to-head comparison including cost-per-item and latency appears in the source material here.' },
        ],
      },
      {
        key: 'adoption',
        label: 'Is anyone actually using it?',
        score: 0.9,
        weight: 0.2,
        reasoning:
          'It has become the default first move for a new classification task across most teams, precisely because it turns a multi-week project into an afternoon. Adoption is very real; whether each adoption was correct is a different question, which is what the benchmarks factor is for.',
        evidence: [
          { claim: 'Constrained/structured output is a first-class documented API feature rather than a community workaround, which is a strong signal of mainstream classification usage.', url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs' },
        ],
      },
      {
        key: 'independence',
        label: 'Has anyone outside verified it?',
        score: 0.7,
        weight: 0.18,
        reasoning:
          'That capable models classify well zero-shot is verified everywhere by everyone — it is not in dispute. What lacks independent verification is the stronger claim teams actually act on: that it beats a fine-tuned encoder on their data. That is a per-corpus empirical question and it is rarely published either way.',
        evidence: [
          { claim: 'Zero-shot capability is broadly reproduced across public benchmarks and independent evaluations.', url: 'https://arxiv.org/abs/1804.07461' },
          { claim: 'The stronger "better than fine-tuning" claim is corpus-specific and not independently established in general.' },
        ],
      },
      {
        key: 'maturity',
        label: 'Will it still look like this in a year?',
        score: 0.6,
        weight: 0.15,
        reasoning:
          'The API surface is stable, but the classifier is not: it is a hosted model that changes without your involvement. A fine-tuned checkpoint you own is byte-identical forever; this is not. Without a pinned model version and a labelled holdout running against it, you have shipped a component that can silently change behaviour between Tuesday and Wednesday.',
        evidence: [
          { claim: 'Behaviour depends on a vendor-hosted model rather than a checkpoint you control and can freeze.', url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs' },
        ],
      },
    ],
    useIf: [
      'You have no labelled data and would otherwise not build the classifier at all — this is the case where it is unambiguously right.',
      'Your taxonomy is still moving, or you need many small classifiers rather than one big one.',
      'The hard cases are linguistic — sarcasm, negation, domain jargon — where a small encoder trained on a narrow corpus genuinely struggles.',
      'Volume is low enough that per-call cost stays irrelevant.',
    ],
    skipIf: [
      'You are classifying millions of items a month with a stable label set. Label a few thousand, fine-tune a small encoder, and the economics are not close.',
      'The classification sits inline in a latency-sensitive request path.',
      'You depend on a calibrated probability to route uncertain cases — you will not get one back.',
      'The data cannot leave your infrastructure.',
    ],
    wouldChangeMyMind: [
      'A well-run public head-to-head against fine-tuned small encoders on in-domain data, with accuracy, cost-per-item and latency in one table, would settle this in either direction — it is the single most useful missing experiment.',
      'A first-class calibrated-confidence output would remove the most concrete thing lost in the migration and push this into the 80s.',
      'Order-of-magnitude cheaper inference would collapse the cost argument that carries most of the "skip if" list.',
    ],
  },
}
