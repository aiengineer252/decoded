from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class RawItem(Base):
    """
    Anything a connector saw, before triage. Kept even when rejected — the
    rejections are how we tune the signal scorer, and 'what did the pipeline
    decline to cover' is itself an answerable question.
    """

    __tablename__ = "raw_items"
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_source_external"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(32))  # arxiv | github | huggingface
    external_id: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text, default="")
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    # Whatever the connector could tell us about traction: stars, stars/day,
    # downloads, author count. Shape varies by source; scoring.py normalises it.
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)

    signal: Mapped[float] = mapped_column(Float, default=0.0)
    # pending | rejected | triaged | failed
    status: Mapped[str] = mapped_column(String(16), default="pending")
    reject_reason: Mapped[str] = mapped_column(Text, default="")

    entry: Mapped["Entry | None"] = relationship(back_populates="raw_item", uselist=False)


class Entry(Base):
    """
    A triaged item. `payload` holds the full entry document in exactly the
    shape web/src/types.ts declares — the frontend is the schema's only
    consumer, so there is no second representation to keep in sync.
    """

    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    score: Mapped[int] = mapped_column(Integer, default=0)
    # demo | auto | reviewed
    status: Mapped[str] = mapped_column(String(16), default="auto")
    reviewed_by: Mapped[str] = mapped_column(String(120), default="")

    payload: Mapped[dict] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    raw_item_id: Mapped[int | None] = mapped_column(ForeignKey("raw_items.id"), nullable=True)
    raw_item: Mapped[RawItem | None] = relationship(back_populates="entry")


class TriageRun(Base):
    """One triage attempt, kept for cost accounting and failure forensics."""

    __tablename__ = "triage_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    raw_item_id: Mapped[int] = mapped_column(ForeignKey("raw_items.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ok: Mapped[bool] = mapped_column(default=False)
    error: Mapped[str] = mapped_column(Text, default="")

    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(Integer, default=0)
