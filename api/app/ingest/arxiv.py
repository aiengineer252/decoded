from datetime import datetime, timezone

import feedparser
import httpx

from ..config import settings
from .base import Connector, IngestedItem

API = "http://export.arxiv.org/api/query"
CATEGORIES = ["cs.AI", "cs.CL", "cs.LG"]


class ArxivConnector(Connector):
    """
    Recent submissions in the three categories where AI systems work actually
    lands. arXiv has no traction signal of its own, so scoring.py leans on
    abstract content and later cross-source corroboration instead.
    """

    name = "arxiv"

    def fetch(self) -> list[IngestedItem]:
        query = "+OR+".join(f"cat:{c}" for c in CATEGORIES)
        url = (
            f"{API}?search_query={query}"
            f"&sortBy=submittedDate&sortOrder=descending"
            f"&max_results={settings.max_ingest_per_source}"
        )
        resp = httpx.get(url, timeout=30.0, follow_redirects=True)
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)

        items: list[IngestedItem] = []
        for e in feed.entries:
            published = None
            if getattr(e, "published_parsed", None):
                published = datetime(*e.published_parsed[:6], tzinfo=timezone.utc)

            abstract = getattr(e, "summary", "").strip()
            items.append(
                IngestedItem(
                    source=self.name,
                    external_id=e.id.rsplit("/", 1)[-1],
                    title=e.title.replace("\n", " ").strip(),
                    url=e.id,
                    body=abstract,
                    published_at=published,
                    metrics={
                        "authors": len(getattr(e, "authors", []) or []),
                        # A paper that links code is far likelier to survive
                        # the reproducibility factor later.
                        "has_code_link": "github.com" in abstract.lower(),
                    },
                )
            )
        return items
