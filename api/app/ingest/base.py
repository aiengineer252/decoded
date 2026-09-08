from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class IngestedItem:
    """What every connector returns. Normalised in scoring.py, not here."""

    source: str
    external_id: str
    title: str
    url: str
    body: str = ""
    published_at: datetime | None = None
    metrics: dict = field(default_factory=dict)


class Connector:
    name: str = "base"

    def fetch(self) -> list[IngestedItem]:  # pragma: no cover - interface
        raise NotImplementedError
