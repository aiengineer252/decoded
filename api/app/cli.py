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
