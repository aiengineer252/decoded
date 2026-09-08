"""
Pipeline CLI. Run stages by hand while the format is still being tuned:

    python -m app.cli ingest
    python -m app.cli triage --limit 2
    python -m app.cli stats
    python -m app.cli queue
"""

import argparse
import json
import sys
from pathlib import Path

from .db import SessionLocal, init_db
from .ingest import run_ingest
from .models import Entry, RawItem
from .triage import run_triage


def main() -> int:
    parser = argparse.ArgumentParser(prog="decoded")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("ingest", help="pull every connector and score what comes back")

    p_triage = sub.add_parser("triage", help="run the LLM stage on the highest-signal pending items")
    p_triage.add_argument("--limit", type=int, default=None)

    sub.add_parser("stats", help="counts and token spend")
    sub.add_parser("queue", help="items waiting for triage, highest signal first")

    p_export = sub.add_parser(
        "export", help="write reviewed entries to the JSON file the site reads"
    )
    p_export.add_argument(
        "--out", default="../web/src/data/generated-entries.json",
        help="destination path, relative to api/",
    )
    p_export.add_argument(
        "--include-auto", action="store_true",
        help="also export entries that no human has reviewed (not recommended)",
    )

    args = parser.parse_args()
    init_db()
    db = SessionLocal()

    try:
        if args.cmd == "ingest":
            print(json.dumps(run_ingest(db), indent=2))

        elif args.cmd == "triage":
            print(json.dumps(run_triage(db, limit=args.limit), indent=2))

        elif args.cmd == "stats":
            print(
                json.dumps(
                    {
                        "raw_items": db.query(RawItem).count(),
                        "pending": db.query(RawItem).filter(RawItem.status == "pending").count(),
                        "rejected": db.query(RawItem).filter(RawItem.status == "rejected").count(),
                        "entries": db.query(Entry).count(),
                    },
                    indent=2,
                )
            )

        elif args.cmd == "export":
            # Only reviewed entries ship by default. The whole trust claim rests
            # on a human having read the thing before it is published, so the
            # automated path must not be able to publish on its own.
            statuses = ["reviewed"] + (["auto"] if args.include_auto else [])
            rows = (
                db.query(Entry)
                .filter(Entry.status.in_(statuses))
                .order_by(Entry.created_at.desc())
                .all()
            )
            out = Path(args.out).resolve()
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(
                json.dumps([r.payload for r in rows], indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            print(f"wrote {len(rows)} entries ({'+'.join(statuses)}) -> {out}")
            if not rows:
                # plain ASCII: Windows consoles default to cp1252 and mangle
                # anything else, which makes CI logs unreadable
                print(
                    "  (nothing triaged yet)"
                    if args.include_auto
                    else "  (nothing reviewed yet - approve entries first)"
                )

        elif args.cmd == "queue":
            rows = (
                db.query(RawItem)
                .filter(RawItem.status == "pending")
                .order_by(RawItem.signal.desc())
                .limit(25)
                .all()
            )
            for r in rows:
                print(f"{r.signal:.2f}  [{r.source}]  {r.title}")
            if not rows:
                print("nothing pending — run `ingest` first")
    finally:
        db.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
