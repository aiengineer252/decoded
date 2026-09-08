"""
The cheap filter that runs before the expensive one.

This is not a quality judgement — it is a triage-worthiness judgement. Its only
job is to keep the LLM stage from being spent on noise. It is deliberately
crude and deliberately transparent: every term is inspectable, and rejected
items stay in the database so the thresholds can be tuned against real misses
rather than intuition.
"""

import math

from .models import RawItem

# Terms that suggest the item is about a mechanism rather than a wrapper.
# Weak evidence individually; useful in aggregate against a firehose.
MECHANISM_TERMS = (
    "attention",
    "kv cache",
    "quantis",
    "quantiz",
    "decoding",
    "inference",
    "retrieval",
    "rag ",
    "agent",
    "tokenis",
    "tokeniz",
    "fine-tun",
    "distill",
    "protocol",
    "benchmark",
    "reinforcement",
    "throughput",
    "latency",
    "serving",
    "context window",
)

# Terms that reliably mark a repo we do not want to spend a triage call on.
NOISE_TERMS = (
    "awesome-",
    "curated list",
    "chatgpt prompts",
    "free api",
    "tutorial",
    "roadmap",
    "cheatsheet",
    "interview questions",
    "clone of",
    "wrapper for",
)


def signal_score(item: RawItem) -> float:
    """0..1. Above settings.signal_threshold, the item is worth triaging."""
    text = f"{item.title} {item.body}".lower()

    if any(term in text for term in NOISE_TERMS):
        return 0.0

    traction = _traction(item)
    mechanism = min(sum(term in text for term in MECHANISM_TERMS) / 4.0, 1.0)
    freshness = _freshness(item)

    # Traction dominates because it is the only term that is hard to fake and
    # cheap to measure. Mechanism keywords break ties; freshness is a mild
    # tilt, not a driver — a strong item from last week still deserves a look.
    return round(0.55 * traction + 0.30 * mechanism + 0.15 * freshness, 3)


def _traction(item: RawItem) -> float:
    m = item.metrics or {}

    if item.source == "github":
        if m.get("watched_org"):
            return 0.9  # a release from a lab we always cover
        # log-scaled: 5 stars/day is interesting, 500 is not 100x as interesting
        velocity = float(m.get("stars_per_day") or 0.0)
        return min(math.log10(velocity + 1) / 2.0, 1.0)

    if item.source == "huggingface":
        downloads = float(m.get("downloads") or 0.0)
        return min(math.log10(downloads + 1) / 6.0, 1.0)

    if item.source == "arxiv":
        # No traction data at submission time. Code availability is the only
        # early signal that correlates with the entry being writable at all.
        base = 0.45
        return min(base + (0.25 if m.get("has_code_link") else 0.0), 1.0)

    return 0.3


def _freshness(item: RawItem) -> float:
    if not item.published_at:
        return 0.5
    from datetime import datetime, timezone

    published = item.published_at
    if published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)
    age_days = (datetime.now(timezone.utc) - published).days
    if age_days <= 3:
        return 1.0
    if age_days >= 60:
        return 0.0
    return 1.0 - (age_days - 3) / 57.0
