from datetime import datetime

import httpx

from ..config import settings
from .base import Connector, IngestedItem

API = "https://huggingface.co/api/models"


class HuggingFaceConnector(Connector):
    """
    Recently-created models sorted by downloads. Downloads are the closest
    thing the Hub has to an adoption signal that is hard to fake cheaply.
    """

    name = "huggingface"

    def fetch(self) -> list[IngestedItem]:
        params = {
            "sort": "downloads",
            "direction": -1,
            "limit": settings.max_ingest_per_source,
            "full": "true",
        }
        resp = httpx.get(API, params=params, timeout=30.0)
        resp.raise_for_status()

        items = []
        for m in resp.json():
            created = m.get("createdAt")
            published = (
                datetime.fromisoformat(created.replace("Z", "+00:00")) if created else None
            )
            items.append(
                IngestedItem(
                    source=self.name,
                    external_id=m["id"],
                    title=m["id"],
                    url=f"https://huggingface.co/{m['id']}",
                    body=" ".join(m.get("tags", [])),
                    published_at=published,
                    metrics={
                        "downloads": m.get("downloads", 0),
                        "likes": m.get("likes", 0),
                        "pipeline_tag": m.get("pipeline_tag"),
                    },
                )
            )
        return items
