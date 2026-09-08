from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..config import settings
from ..models import Entry as EntryRow
from ..models import RawItem, TriageRun
from .pipeline import TriageError, triage


def run_triage(db: Session, limit: int | None = None) -> dict:
    """
    Triage the highest-signal pending items. Bounded per run — this is the
    only stage that costs money, so it never runs unbounded.
    """
    limit = limit or settings.max_triage_per_run
    items = (
        db.query(RawItem)
        .filter(RawItem.status == "pending")
        .order_by(RawItem.signal.desc())
        .limit(limit)
        .all()
    )

    published, failed = [], []

    for item in items:
        run = TriageRun(raw_item_id=item.id)
        db.add(run)
        db.flush()

        try:
            result = triage(item)
        except TriageError as exc:
            item.status = "failed"
            item.reject_reason = str(exc)
            run.ok = False
            run.error = str(exc)
            failed.append({"item": item.title, "error": str(exc)})
        except Exception as exc:  # unexpected: record it, keep the loop alive
            item.status = "failed"
            item.reject_reason = f"unexpected: {exc}"
            run.ok = False
            run.error = str(exc)
            failed.append({"item": item.title, "error": str(exc)})
        else:
            payload = result.entry.model_dump(by_alias=True, exclude_none=True)
            row = EntryRow(
                slug=result.entry.slug,
                name=result.entry.name,
                score=result.entry.verdict.score,
                status="auto",
                payload=payload,
                raw_item_id=item.id,
            )
            db.merge(row) if _slug_taken(db, result.entry.slug) else db.add(row)
            item.status = "triaged"
            run.ok = True
            run.input_tokens = result.usage.input_tokens
            run.output_tokens = result.usage.output_tokens
            run.cache_read_tokens = result.usage.cache_read
            run.cache_write_tokens = result.usage.cache_write
            published.append({"slug": result.entry.slug, "score": result.entry.verdict.score})
        finally:
            run.finished_at = datetime.now(timezone.utc)

    db.commit()
    return {"published": published, "failed": failed, "considered": len(items)}


def _slug_taken(db: Session, slug: str) -> bool:
    return db.query(EntryRow.id).filter(EntryRow.slug == slug).first() is not None
