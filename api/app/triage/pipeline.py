"""
The triage pipeline: source bundle -> three structured calls -> one Entry.

Design notes worth knowing before editing this file:

* The source bundle is the same for all three calls and is by far the largest
  part of the prompt, so it sits at the front behind a cache breakpoint. Calls
  two and three read it from cache instead of re-paying for it.
* Structured outputs are used rather than "return JSON" prompting, so a
  malformed shape is impossible by construction and the frontend never has to
  defend against one.
* Each stage is validated separately. A verdict stage that fails leaves the
  mechanism work intact and recoverable rather than discarding the run.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from anthropic import Anthropic
from pydantic import BaseModel, ValidationError

from ..config import settings
from ..models import RawItem
from ..schemas import (
    Architecture,
    Displacement,
    Entry,
    ExecutionTrace,
    Source,
    Verdict,
    output_format,
)
from . import prompts
from .fetch import SourceBundle, gather


class MechanismOut(BaseModel):
    architecture: Architecture
    trace: ExecutionTrace


class TriageError(RuntimeError):
    pass


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read: int = 0
    cache_write: int = 0

    def add(self, u) -> None:
        self.input_tokens += getattr(u, "input_tokens", 0) or 0
        self.output_tokens += getattr(u, "output_tokens", 0) or 0
        self.cache_read += getattr(u, "cache_read_input_tokens", 0) or 0
        self.cache_write += getattr(u, "cache_creation_input_tokens", 0) or 0


@dataclass
class TriageResult:
    entry: Entry
    usage: Usage


def triage(item: RawItem, client: Anthropic | None = None) -> TriageResult:
    client = client or Anthropic(api_key=settings.anthropic_api_key or None)
    bundle = gather(item)

    if not bundle.docs:
        raise TriageError("no source documents could be fetched")

    usage = Usage()
    source_block = _cached_source_block(bundle)

    mechanism = _stage(client, source_block, prompts.MECHANISM, MechanismOut, usage, max_tokens=32000)
    if not mechanism.trace.steps:
        raise TriageError("triage abstained: source material insufficient to show the mechanism")

    displacement = _stage(client, source_block, prompts.DISPLACEMENT, Displacement, usage, max_tokens=16000)
    verdict = _stage(client, source_block, prompts.VERDICT, Verdict, usage, max_tokens=16000)

    verdict.score = _recompute(verdict)

    entry = Entry(
        slug=_slug(item.title),
        name=_display_name(item.title),
        org=_org(item),
        tagline=verdict.headline,
        categories=_categories(bundle),
        status="auto",
        publishedAt=date.today().isoformat(),
        sources=[
            Source(kind=_source_kind(item.source), label=d.label, url=d.url)
            for d in bundle.docs
        ],
        architecture=mechanism.architecture,
        trace=mechanism.trace,
        displacement=displacement,
        verdict=verdict,
    )
    return TriageResult(entry=entry, usage=usage)


def _cached_source_block(bundle: SourceBundle) -> dict:
    # One breakpoint, at the end of the source material. Everything after it —
    # the per-stage instruction — is the only part that varies between calls,
    # which is exactly the prefix-stability property caching needs.
    return {
        "type": "text",
        "text": bundle.as_prompt_text(),
        "cache_control": {"type": "ephemeral"},
    }


def _stage(
    client: Anthropic,
    source_block: dict,
    instruction: str,
    model_cls: type[BaseModel],
    usage: Usage,
    *,
    max_tokens: int,
):
    # Streaming because max_tokens is large enough that a non-streaming request
    # risks an SDK HTTP timeout on a slow generation.
    with client.messages.stream(
        model=settings.triage_model,
        max_tokens=max_tokens,
        system=prompts.SYSTEM,
        output_config={
            "format": output_format(model_cls),
            "effort": "high",
        },
        messages=[{"role": "user", "content": [source_block, {"type": "text", "text": instruction}]}],
    ) as stream:
        message = stream.get_final_message()

    usage.add(message.usage)

    if message.stop_reason == "refusal":
        raise TriageError(f"model declined this item: {getattr(message, 'stop_details', None)}")
    if message.stop_reason == "max_tokens":
        raise TriageError(f"{model_cls.__name__} stage truncated at max_tokens={max_tokens}")

    text = "".join(b.text for b in message.content if b.type == "text")
    try:
        return model_cls.model_validate_json(text)
    except ValidationError as exc:
        raise TriageError(f"{model_cls.__name__} failed validation: {exc}") from exc


def _recompute(verdict: Verdict) -> int:
    """
    The model is asked to compute the score, and then we compute it again here.
    The stored number must be the one the published factors produce — the site
    recomputes it in the browser and prints a drift warning otherwise.
    """
    total_weight = sum(f.weight for f in verdict.factors)
    if total_weight <= 0:
        return 0
    weighted = sum(f.score * f.weight for f in verdict.factors)
    return round((weighted / total_weight) * 100)


def _slug(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:80] or "untitled"


def _display_name(title: str) -> str:
    # GitHub items arrive as "org/repo"; the repo half is the name people use.
    return title.split("/")[-1] if "/" in title else title


def _org(item: RawItem) -> str:
    if item.source in {"github", "huggingface"} and "/" in item.external_id:
        return item.external_id.split("/")[0]
    return item.source


def _source_kind(source: str) -> str:
    return {"github": "repo", "arxiv": "paper", "huggingface": "model"}.get(source, "docs")


CATEGORY_HINTS = {
    "rag": ("retriev", "rag", "vector", "embedding"),
    "agents": ("agent", "tool call", "tool-use", "orchestrat"),
    "inference": ("inference", "serving", "throughput", "latency", "decoding", "kv cache"),
    "training": ("training", "fine-tun", "rlhf", "reinforcement", "distill", "gradient"),
    "protocol": ("protocol", "json-rpc", "spec", "wire format"),
    "eval": ("benchmark", "eval", "leaderboard"),
    "model": ("weights", "checkpoint", "parameters", "pretrain"),
}


def _categories(bundle: SourceBundle) -> list[str]:
    text = bundle.as_prompt_text().lower()
    hits = [cat for cat, terms in CATEGORY_HINTS.items() if any(t in text for t in terms)]
    return hits[:3] or ["tooling"]
