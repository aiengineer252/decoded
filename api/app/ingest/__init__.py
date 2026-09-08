from sqlalchemy.orm import Session

from ..models import RawItem
from ..scoring import signal_score
from .arxiv import ArxivConnector
from .base import Connector, IngestedItem
from .github import GitHubConnector
from .huggingface import HuggingFaceConnector

CONNECTORS: list[Connector] = [
    ArxivConnector(),
    GitHubConnector(),
    HuggingFaceConnector(),
]


def run_ingest(db: Session) -> dict[str, int]:
    """
    Pull every connector, dedupe on (source, external_id), score, and persist.
    Returns per-source counts of genuinely new rows.
    """
    counts: dict[str, int] = {}

    for connector in CONNECTORS:
        try:
            items = connector.fetch()
        except Exception as exc:  # a dead source shouldn't stop the others
            counts[f"{connector.name}:error"] = 0
            print(f"[ingest] {connector.name} failed: {exc}")
            continue

        new = 0
        for item in items:
            if _exists(db, item):
                continue
            row = RawItem(
                source=item.source,
                external_id=item.external_id,
                title=item.title,
                url=item.url,
                body=item.body,
                published_at=item.published_at,
                metrics=item.metrics,
            )
            row.signal = signal_score(row)
            row.status = "pending" if row.signal >= _threshold() else "rejected"
            if row.status == "rejected":
                row.reject_reason = f"signal {row.signal:.2f} below threshold"
            db.add(row)
            new += 1

        counts[connector.name] = new

    db.commit()
    return counts


def _exists(db: Session, item: IngestedItem) -> bool:
    return (
        db.query(RawItem.id)
        .filter(RawItem.source == item.source, RawItem.external_id == item.external_id)
        .first()
        is not None
    )


def _threshold() -> float:
    from ..config import settings

    return settings.signal_threshold
