import type { Entry } from '../../types'

export const zeroShotClassification: Entry = {
  slug: 'zero-shot-llm-classification',
  name: 'Zero-shot LLM classification',
  org: 'industry pattern',
  tagline:
    'Describe your categories in a prompt instead of collecting labelled data and training a model. Faster to build, and you give up the confidence score you used to route on.',
  categories: ['eval', 'model', 'tooling'],
  status: 'demo',
  publishedAt: '2026-08-14',
  updatedAt: '2026-09-10',
  reviewedBy: 'AI engineer',
  readingMinutes: 9,
  sources: [
    { kind: 'paper', label: 'Sanh et al. — DistilBERT (the encoder this displaced)', url: 'https://arxiv.org/abs/1910.01108' },
    { kind: 'paper', label: 'Wang et al. — GLUE, where SST-2 sentiment lives', url: 'https://arxiv.org/abs/1804.07461' },
    { kind: 'docs', label: 'Anthropic — structured outputs / constrained generation', url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs' },
    { kind: 'repo', label: 'huggingface/transformers — the fine-tuning path', url: 'https://github.com/huggingface/transformers' },
  ],

  problem: {
    before:
      'You want to sort incoming reviews into positive, negative or neutral. The established way: collect a few thousand examples, have people label them by hand, train a small model on them, evaluate it, host it. Weeks of work — which is why most teams built exactly one classifier and never touched it again. And the moment someone wanted a fourth category, you were back to labelling.',
    insight:
      'Describe the categories in a prompt and constrain the model so it can only answer with one of them. No training set, no training run, no model to host.',
    payoff:
      'A working classifier in an afternoon, and changing the categories is an edit rather than a retrain. What you give up: the calibrated confidence score the old model gave you, cheap per-item cost at volume, and a model you could freeze.',
  },

  explainer: {
    beginner:
      'Sorting text into buckets — is this review happy or angry, is this ticket a bug or a question — used to mean teaching a small model by example: gather thousands of labelled samples, train, test, deploy. Now you can just tell a large general model what the buckets are, and it sorts. No examples needed, because it learned language in general and sarcasm and negation come with that. There is a real catch that the demos leave out. The old trained model handed you a genuine confidence — "71% positive" — that you could use to say "if under 90%, send it to a human". The new approach does not give you that. If you ask the model how confident it is, you get a number it made up about itself. It is often a reasonable hint. It is not something you should build a threshold on.',
    practitioner:
      'Structured outputs constrain decoding to a schema, so the model can only emit one of your enum values — no parsing, no retry loop, well-formed by construction. The real win is not accuracy, it is that changing your taxonomy is an edit rather than a retrain, which changes how fast you can iterate. The real loss is the calibrated softmax: if you routed low-confidence cases to a human on a threshold, that mechanism has no honest input any more. Cost inverts at volume — a self-hosted DistilBERT is effectively free per item where an API call is not — and latency goes from single-digit milliseconds to hundreds.',
    expert:
      'The comparison that would settle this is almost never run: zero-shot against a properly fine-tuned small encoder, on the same in-domain data, with accuracy, cost-per-item and p99 latency in one table. Published zero-shot results usually beat a from-scratch or naive baseline, which is not the alternative anyone actually had. Two second-order issues deserve more attention than they get. First, you have replaced a checkpoint you own and can freeze with a vendor-hosted model that changes underneath you — without a pinned version and a labelled holdout running against it, you have shipped a component that can silently change behaviour overnight. Second, "no labelled data needed" is true for training and false for evaluation; teams that skip the holdout have not removed the labelling cost, they have removed their ability to detect regressions.',
  },
  prerequisites: [
    'What text classification is — assigning one label from a fixed set to a piece of text',
    'Roughly what it means to train a model on examples',
  ],
  glossary: [
    { term: 'zero-shot', plain: 'Doing a task with no training examples for it — the model works from the instruction alone.' },
    { term: 'fine-tuning', plain: 'Taking a pretrained model and training it further on your own labelled examples so it gets good at your specific task.' },
    { term: 'encoder', plain: 'A smaller model like BERT that reads text and produces a compact representation, rather than writing text.' },
    { term: 'labelled data', plain: 'Examples where a human has already written down the correct answer. The expensive part of the old approach.' },
    { term: 'calibrated probability', plain: 'A confidence number that actually matches how often the model is right. "0.8" should mean right about 80% of the time.' },
    { term: 'softmax', plain: 'Turns the model\'s raw scores for each class into probabilities that add up to 1.' },
    { term: 'constrained decoding', plain: 'Restricting what the model is allowed to output next, so the answer always fits your schema — one of your labels, nothing else.' },
    { term: 'holdout set', plain: 'Labelled examples you keep aside purely to measure accuracy. Never used for training. You still need this.' },
  ],
  changelog: [
    { date: '2026-09-10', note: 'Rewritten for progressive reading: problem-first opener, plain-language trace, whole-function code with guided walkthroughs.' },
    { date: '2026-08-14', note: 'First published. Scored 72 — real for the no-labels case, worse economics at volume.' },
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
        summary: 'the review, as-is — no preprocessing',
        detail:
          'No tokenizer to match, no max-length truncation tuned to a specific encoder, no vocabulary to keep in sync with a checkpoint. The text goes in as it is — which genuinely removes a category of subtle bugs that used to bite at deploy time.',
        plain:
          'The text you want to classify, exactly as it came in. With the old approach you had to prepare it to match how the model was trained; here it goes in raw.',
      },
      {
        id: 'schema',
        label: 'Label schema',
        kind: 'compute',
        col: 1,
        row: 0,
        summary: 'your categories, declared as a list the model must pick from',
        detail:
          'The label set is declared as a JSON Schema enum rather than being baked into a classification head. Changing your taxonomy is now a one-line edit instead of retraining — this, not accuracy, is the honest headline benefit.',
        plain:
          'You write down the allowed answers — "positive", "negative", "neutral" — in a small schema. Want a fourth category? Add a word to the list. With the old approach, that meant relabelling and retraining.',
        code: {
          lang: 'python',
          file: 'classify.py — the whole zero-shot classifier, plus the holdout check people skip',
          url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs',
          snippet: `import json
from anthropic import Anthropic

client = Anthropic()

# The label space. Declared, not trained. Change it by editing this list.
SCHEMA = {
    "type": "object",
    "properties": {
        "sentiment": {"type": "string", "enum": ["positive", "negative", "neutral"]},
        "rationale": {"type": "string"},
    },
    "required": ["sentiment", "rationale"],
    "additionalProperties": False,
}

def classify(text: str) -> dict:
    resp = client.messages.create(
        model="claude-opus-5",
        max_tokens=256,
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content":
            f"Classify the sentiment of this customer review.\\n\\nReview: {text}"}],
    )
    return json.loads(resp.content[0].text)   # guaranteed to match SCHEMA


# --- the part the demos leave out ------------------------------------------
def evaluate(holdout: list[tuple[str, str]]) -> float:
    """holdout: (text, true_label). You still need a few hundred of these."""
    correct = sum(classify(t)["sentiment"] == y for t, y in holdout)
    return correct / len(holdout)

# accuracy = evaluate(load_holdout())   # run this again every time the model changes`,
          walkthrough: [
            {
              lines: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
              title: 'The classifier is a list of strings',
              note: 'The enum on line 10 is the entire label space. Compare with a fine-tuned encoder, where the number of classes is baked into the shape of the final layer. Here, adding "mixed" is adding a word. additionalProperties: False and the required list are what let the API enforce the shape at decode time rather than hoping.',
              plain: 'This little block is the whole "model" for your categories. The three words on line 10 are the only answers allowed. To add a category, add a word. Nothing to retrain.',
            },
            {
              lines: [17, 18, 19, 20, 21],
              title: 'Constrained, not parsed',
              note: 'output_config.format hands the schema to the API, which restricts each decoding step to tokens that can still produce a schema-valid string. The model cannot hedge, cannot return prose, cannot invent a label. There is no regex, no retry-on-parse-failure loop — the shape is guaranteed by construction.',
              plain: 'Line 21 tells the API "only let the model produce something that fits this schema". So the model physically cannot answer "mostly positive?" or write a paragraph. It has to pick one of your labels. No cleanup code needed.',
            },
            {
              lines: [22, 23, 24],
              title: 'The prompt is the training set',
              note: 'One sentence of instruction and the text. No examples. The model\'s sense of sarcasm, negation and domain terms comes from pretraining, which is precisely why no labelled data was required — and also why you have no control over it.',
              plain: 'Here is everything the model is told: one instruction and the review. No examples of what positive or negative look like. It already knows — that is the whole point, and also the reason you cannot tune it.',
            },
            {
              lines: [28, 29, 30, 31, 32, 34],
              title: 'You removed the training set, not the test set',
              note: 'Without a labelled holdout you cannot tell whether this is better than the encoder it replaced, and you cannot detect the day the vendor updates the model and accuracy quietly moves. A few hundred labelled examples is not optional. Run this on every model change.',
              plain: 'This is the step everyone skips. You still need a few hundred hand-labelled examples — not to train, but to check. Without them, you have no idea if it works, and no way to notice when it stops working.',
            },
          ],
        },
      },
      {
        id: 'llm',
        label: 'LLM forward pass',
        kind: 'model',
        col: 2,
        row: 0,
        summary: 'a large general model reads the whole sentence in context',
        detail:
          'A general model that was never trained on your task reads the text with full sentence-level semantics — negation, sarcasm, contrast, domain jargon it happened to see in pretraining. This is where it genuinely beats a small encoder trained on a narrow corpus: the hard cases, not the easy ones.',
        plain:
          'The big model reads the review the way a person would — it understands "Great, another update that breaks things" is sarcastic because it has read a lot of sarcasm. The small trained model mostly counted happy and angry words, and got fooled.',
      },
      {
        id: 'constrain',
        label: 'Constrained decoding',
        kind: 'control',
        col: 3,
        row: 0,
        summary: 'only tokens that fit the schema are allowed out',
        detail:
          'At each step the sampler is restricted to tokens that can still produce a schema-valid string. Because "positive" / "negative" / "neutral" are the only legal completions at that position, the model cannot return "mostly positive?" or a paragraph of hedging. This is what makes the output parseable by construction rather than by regex-and-hope.',
        plain:
          'As the model writes its answer, anything that would not fit your schema is blocked. So the output is always exactly one of your labels, formatted correctly, every time. No cleanup, no "what if it rambles".',
      },
      {
        id: 'conf',
        label: 'Calibrated confidence',
        kind: 'store',
        col: 3,
        row: 1,
        summary: 'the real probability you used to get — now missing',
        detail:
          'The encoder handed you a softmax over your classes — a real distribution you could threshold, tune for precision/recall, and route on. You do not get that here. Asking the model to self-report a confidence gives you a number, but a self-reported number is not a calibrated probability and should not be thresholded as if it were. If your system routed low-confidence cases to a human, that routing logic has no honest input any more.',
        plain:
          'This box is empty on purpose. The old model gave you a real percentage — "71% positive" — that you could use to say "if below 90%, send to a human". The new approach gives you the label, but not a trustworthy confidence. Asking the model "how sure are you?" gets a number it invented about itself. Useful as a hint; not something to build rules on.',
      },
      {
        id: 'out',
        label: 'Label',
        kind: 'output',
        col: 4,
        row: 0,
        summary: 'always one of your labels — correct or not',
        detail:
          'Guaranteed to be one of your enum values. Worth noticing what this guarantee is and is not: the output is always well-formed, which says nothing about whether it is correct.',
        plain:
          'One of your labels, guaranteed to be formatted right. Note what is guaranteed: the format, not the correctness. It will always be a valid label; it will not always be the right one.',
      },
      {
        id: 'eval',
        label: 'Labelled holdout',
        kind: 'control',
        col: 1,
        row: 1,
        summary: 'a few hundred labelled examples — you still need these',
        detail:
          'The pitch is "no labelled data needed", and that is true for training but false for knowing whether it works. You still need a few hundred labelled examples to measure accuracy, and you need them again every time the underlying model changes. Teams that skip this step have not removed the labelling cost — they have removed their ability to detect regressions.',
        plain:
          '"No labelled data needed" is half true. You do not need labels to build it. You absolutely need a few hundred to check it works — and to notice when the vendor updates the model and it quietly gets worse. Teams that skip this have not saved the labelling work; they have just lost the ability to see problems.',
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
        plain: 'Read this review. The words are cheerful — "Great", "Love it" — but the meaning is clearly angry. That gap between the words and the meaning is what makes this hard for any approach that scores words individually.',
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
        plain: 'Tell the API the only three allowed answers. This list is the whole definition of your categories. Adding a fourth later is just adding a word here.',
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
        plain: 'The big model reads the entire sentence at once, so it sees "Great" right next to "breaks the export button" and recognises the tone. It was never taught this for your task — it learned sarcasm from reading the internet. That is why you did not need examples.',
        input: { type: 'tokens', preview: 'prompt + 61 chars of review' },
        output: { type: 'logits over vocab', preview: 'shape: (vocab_size,) at the constrained position' },
        cost: '~1 API call, ~120 tokens',
      },
      {
        id: 'z4',
        nodeId: 'constrain',
        label: 'Mask to legal completions',
        note: 'Only tokens that can continue into a schema-valid value survive the mask. The model cannot hedge, cannot return prose, and cannot invent a label outside the enum — the output is parseable by construction.',
        plain: 'At the moment of answering, the model is only allowed to pick from your three labels. It picks "negative" — correct. For comparison, a small model trained on a standard sentiment dataset scores this 71% positive, because it is mostly counting happy words.',
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
        plain: 'Now ask "how confident are you?" You get 0.95. But that number is the model\'s opinion of itself, not a measured probability. The old model\'s 71% was a real measurement you could set a threshold on. This one is a guess. Using it as if it were a real probability is the most common mistake teams make here.',
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
        plain: 'Finally, the honest comparison — which needs 500 hand-labelled examples you cannot skip. On this illustrative run the LLM is slightly less accurate, costs money per item where the small model is free, and is about 75x slower. Whether that trade is worth it depends entirely on your volume and whether you have labels. There is no universal answer.',
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
    replaces: ['task-specific fine-tuning for classification', 'labelled training sets', 'per-task model hosting'],
    doesNotReplace: ['a labelled evaluation set', 'high-volume batch classification', 'latency-critical inline classification', 'calibrated probabilities', 'on-prem-only workloads'],
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
      { side: 'before', lines: [4], note: 'The labelled dataset. Weeks of annotation, and the real reason most teams never shipped a second classifier.' },
      { side: 'before', lines: [7, 8], note: 'A training run, a checkpoint to version, and a GPU to serve it on — the operational weight that actually disappears.' },
      { side: 'before', lines: [10], note: 'A genuine probability distribution over your classes. Thresholdable, tunable, routable. This is the thing worth mourning.' },
      { side: 'after', lines: [4], note: 'The schema constrains decoding, so the output is always one of your labels — no parsing, no retry loop.' },
      { side: 'after', lines: [9, 10], note: 'Both halves are true. The second half is the one that gets left out of the pitch.' },
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
