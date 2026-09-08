from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import get_session, init_db
from .ingest import run_ingest
from .models import Entry, RawItem, TriageRun
from .triage import run_triage

app = FastAPI(title="Decoded API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"ok": True}


# --- read side (what the site consumes) ----------------------------------


@app.get("/entries")
def list_entries(db: Session = Depends(get_session)) -> list[dict]:
    rows = db.query(Entry).order_by(Entry.created_at.desc()).all()
    return [r.payload for r in rows]


@app.get("/entries/{slug}")
def get_entry(slug: str, db: Session = Depends(get_session)) -> dict:
    row = db.query(Entry).filter(Entry.slug == slug).first()
    if not row:
        raise HTTPException(404, "no entry at this slug")
    return row.payload


# --- review side (the human-in-the-loop gate) ----------------------------


@app.get("/review/queue")
def review_queue(db: Session = Depends(get_session)) -> list[dict]:
    """Auto-triaged entries that no human has checked yet."""
    rows = db.query(Entry).filter(Entry.status == "auto").order_by(Entry.created_at.desc()).all()
    return [
        {"slug": r.slug, "name": r.name, "score": r.score, "created_at": r.created_at.isoformat()}
        for r in rows
    ]


@app.post("/review/{slug}/approve")
def approve(slug: str, reviewer: str, db: Session = Depends(get_session)) -> dict:
    row = db.query(Entry).filter(Entry.slug == slug).first()
    if not row:
        raise HTTPException(404, "no entry at this slug")
    row.status = "reviewed"
    row.reviewed_by = reviewer
    row.payload = {**row.payload, "status": "reviewed", "reviewedBy": reviewer}
    db.commit()
    return {"slug": slug, "status": "reviewed"}


@app.delete("/review/{slug}")
def reject(slug: str, db: Session = Depends(get_session)) -> dict:
    row = db.query(Entry).filter(Entry.slug == slug).first()
    if not row:
        raise HTTPException(404, "no entry at this slug")
    db.delete(row)
    db.commit()
    return {"slug": slug, "deleted": True}


# --- pipeline control ----------------------------------------------------


@app.post("/pipeline/ingest")
def pipeline_ingest(db: Session = Depends(get_session)) -> dict:
    return run_ingest(db)


@app.post("/pipeline/triage")
def pipeline_triage(limit: int | None = None, db: Session = Depends(get_session)) -> dict:
    return run_triage(db, limit=limit)


@app.get("/pipeline/stats")
def pipeline_stats(db: Session = Depends(get_session)) -> dict:
    runs = db.query(TriageRun).all()
    return {
        "raw_items": db.query(RawItem).count(),
        "pending": db.query(RawItem).filter(RawItem.status == "pending").count(),
        "rejected": db.query(RawItem).filter(RawItem.status == "rejected").count(),
        "entries": db.query(Entry).count(),
        "awaiting_review": db.query(Entry).filter(Entry.status == "auto").count(),
        "tokens": {
            "input": sum(r.input_tokens for r in runs),
            "output": sum(r.output_tokens for r in runs),
            "cache_read": sum(r.cache_read_tokens for r in runs),
            "cache_write": sum(r.cache_write_tokens for r in runs),
        },
    }
