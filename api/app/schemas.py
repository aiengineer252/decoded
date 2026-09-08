"""
Pydantic mirror of web/src/types.ts.

These models do double duty: they validate what the triage pipeline produces,
and their JSON Schemas are handed to the Messages API as structured-output
formats so the model cannot return a shape the frontend can't render.

Keep in sync with web/src/types.ts.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

Lang = Literal["python", "typescript", "json", "bash", "text"]
NodeKind = Literal["input", "compute", "store", "model", "output", "control"]


class CodeRef(BaseModel):
    lang: Lang
    file: str | None = None
    url: str | None = None
    snippet: str
    focus: list[int] | None = None


class ArchNode(BaseModel):
    id: str
    label: str
    kind: NodeKind
    col: int
    row: int
    summary: str = Field(description="One line. What this component does, mechanically.")
    detail: str | None = None
    code: CodeRef | None = None
    sourceUrl: str | None = None


class ArchEdge(BaseModel):
    from_: str = Field(alias="from")
    to: str
    label: str | None = None
    kind: Literal["solid", "dashed"] | None = None

    model_config = {"populate_by_name": True}


class Architecture(BaseModel):
    nodes: list[ArchNode]
    edges: list[ArchEdge]
    flow: list[str] = Field(description="Ordered node ids along the happy path.")
    caption: str | None = None


class TraceValue(BaseModel):
    type: str
    preview: str
    truncated: bool | None = None


class TraceStep(BaseModel):
    id: str
    nodeId: str
    label: str
    note: str
    input: TraceValue | None = None
    output: TraceValue | None = None
    code: CodeRef | None = None
    cost: str | None = None


class ExecutionTrace(BaseModel):
    input: TraceValue
    steps: list[TraceStep]
    result: TraceValue
    caption: str | None = None


class DisplacementAnnotation(BaseModel):
    side: Literal["before", "after"]
    lines: list[int]
    note: str


class LabelledCode(CodeRef):
    label: str


class Displacement(BaseModel):
    replaces: list[str]
    doesNotReplace: list[str]
    before: LabelledCode
    after: LabelledCode
    annotations: list[DisplacementAnnotation]
    whatDisappears: list[str]
    newCosts: list[str]


class Evidence(BaseModel):
    claim: str
    url: str | None = None
    quote: str | None = None


FactorKey = Literal["reproducibility", "benchmarks", "adoption", "independence", "maturity"]


class CredibilityFactor(BaseModel):
    key: FactorKey
    label: str
    score: float = Field(ge=0, le=1)
    weight: float = Field(ge=0, le=1)
    reasoning: str
    evidence: list[Evidence]


class Verdict(BaseModel):
    score: int = Field(ge=0, le=100)
    headline: str
    factors: list[CredibilityFactor]
    useIf: list[str]
    skipIf: list[str]
    wouldChangeMyMind: list[str]


class Source(BaseModel):
    kind: Literal["paper", "repo", "docs", "blog", "model", "thread", "benchmark"]
    label: str
    url: str
    fetchedAt: str | None = None


class Entry(BaseModel):
    slug: str
    name: str
    org: str
    tagline: str
    categories: list[str]
    status: Literal["demo", "auto", "reviewed"]
    publishedAt: str
    reviewedBy: str | None = None
    sources: list[Source]
    architecture: Architecture
    trace: ExecutionTrace
    displacement: Displacement
    verdict: Verdict


# --- structured-output plumbing ------------------------------------------

# The Messages API's structured outputs accept a useful subset of JSON Schema:
# objects must set additionalProperties:false, and numeric/string constraints
# (minimum, maxLength, …) are not supported. Pydantic emits both, so the schema
# is normalised on the way out rather than hand-written twice.
_UNSUPPORTED_KEYS = {
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "minLength",
    "maxLength",
    "pattern",
    "minItems",
    "maxItems",
    "uniqueItems",
    "default",
}


def _normalise(node: Any) -> Any:
    if isinstance(node, list):
        return [_normalise(n) for n in node]
    if not isinstance(node, dict):
        return node

    out = {k: _normalise(v) for k, v in node.items() if k not in _UNSUPPORTED_KEYS}
    if out.get("type") == "object" and "properties" in out:
        out["additionalProperties"] = False
        # Every property must be required; optionality is expressed by allowing
        # null in the property's own type union, which pydantic already does
        # for `X | None` fields.
        out["required"] = sorted(out["properties"].keys())
    return out


def output_format(model: type[BaseModel]) -> dict:
    """Build the `output_config.format` value for a pydantic model."""
    return {"type": "json_schema", "schema": _normalise(model.model_json_schema())}
