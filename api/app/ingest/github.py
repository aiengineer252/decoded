from datetime import datetime, timedelta, timezone

import httpx

from ..config import settings
from .base import Connector, IngestedItem

SEARCH = "https://api.github.com/search/repositories"

# Orgs whose releases are worth looking at regardless of star velocity.
WATCHED_ORGS = [
    "anthropics",
    "openai",
    "google-deepmind",
    "huggingface",
    "vllm-project",
    "meta-llama",
    "mistralai",
    "modelcontextprotocol",
]


def _headers() -> dict[str, str]:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if settings.github_token:
        h["Authorization"] = f"Bearer {settings.github_token}"
    return h


class GitHubConnector(Connector):
    """
    Two passes: repos that gained stars fast recently (the discovery path),
    and fresh releases from orgs we always want to see (the coverage path).
    Star *velocity* matters, not star count — a five-year-old 40k-star repo
    is not news.
    """

    name = "github"

    def fetch(self) -> list[IngestedItem]:
        return self._trending() + self._watched_releases()

    def _trending(self) -> list[IngestedItem]:
        since = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
        params = {
            "q": f"created:>{since} stars:>150 topic:llm",
            "sort": "stars",
            "order": "desc",
            "per_page": min(settings.max_ingest_per_source, 50),
        }
        resp = httpx.get(SEARCH, params=params, headers=_headers(), timeout=30.0)
        resp.raise_for_status()

        items = []
        for repo in resp.json().get("items", []):
            created = datetime.fromisoformat(repo["created_at"].replace("Z", "+00:00"))
            age_days = max((datetime.now(timezone.utc) - created).days, 1)
            items.append(
                IngestedItem(
                    source=self.name,
                    external_id=repo["full_name"],
                    title=repo["full_name"],
                    url=repo["html_url"],
                    body=repo.get("description") or "",
                    published_at=created,
                    metrics={
                        "stars": repo["stargazers_count"],
                        "stars_per_day": repo["stargazers_count"] / age_days,
                        "forks": repo["forks_count"],
                        "age_days": age_days,
                        "language": repo.get("language"),
                    },
                )
            )
        return items

    def _watched_releases(self) -> list[IngestedItem]:
        items: list[IngestedItem] = []
        for org in WATCHED_ORGS:
            try:
                resp = httpx.get(
                    SEARCH,
                    params={"q": f"org:{org} pushed:>{_recent()}", "sort": "updated", "per_page": 5},
                    headers=_headers(),
                    timeout=30.0,
                )
                resp.raise_for_status()
            except httpx.HTTPError:
                # One org being unreachable must not sink the whole run.
                continue

            for repo in resp.json().get("items", []):
                items.append(
                    IngestedItem(
                        source=self.name,
                        external_id=repo["full_name"],
                        title=repo["full_name"],
                        url=repo["html_url"],
                        body=repo.get("description") or "",
                        metrics={
                            "stars": repo["stargazers_count"],
                            "watched_org": True,
                        },
                    )
                )
        return items


def _recent() -> str:
    return (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
