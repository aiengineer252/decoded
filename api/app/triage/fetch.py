"""
Source gathering for the triage stage.

The rule this module exists to enforce: the model only ever sees material we
actually fetched. Nothing is summarised, paraphrased, or filled in from prior
knowledge on the way in — if a repo has no readable source, the bundle says so
and triage declines the item rather than inventing a mechanism for it.
"""

from dataclasses import dataclass, field

import httpx

from ..config import settings
from ..models import RawItem

GH_API = "https://api.github.com"

# Files most likely to contain the actual mechanism, in the order we want them.
INTERESTING = (
    "README.md",
    "readme.md",
    "src/main.py",
    "main.py",
    "server.py",
    "engine.py",
    "model.py",
    "attention.py",
    "trainer.py",
    "pyproject.toml",
)

MAX_DOC_CHARS = 24_000
MAX_DOCS = 8


@dataclass
class SourceDoc:
    label: str
    url: str
    content: str


@dataclass
class SourceBundle:
    item_title: str
    item_url: str
    docs: list[SourceDoc] = field(default_factory=list)

    @property
    def has_code(self) -> bool:
        return any(d.label.endswith((".py", ".ts", ".toml")) for d in self.docs)

    def as_prompt_text(self) -> str:
        parts = [f"# Source material for: {self.item_title}\n# Origin: {self.item_url}\n"]
        for d in self.docs:
            parts.append(f"\n<document label=\"{d.label}\" url=\"{d.url}\">\n{d.content}\n</document>")
        return "\n".join(parts)


def _gh_headers() -> dict[str, str]:
    h = {"Accept": "application/vnd.github+json"}
    if settings.github_token:
        h["Authorization"] = f"Bearer {settings.github_token}"
    return h


def gather(item: RawItem) -> SourceBundle:
    bundle = SourceBundle(item_title=item.title, item_url=item.url)

    if item.source == "github":
        _gather_github(item.external_id, bundle)
    elif item.source == "arxiv":
        _gather_arxiv(item, bundle)
    elif item.source == "huggingface":
        _gather_hf(item, bundle)

    return bundle


def _gather_github(full_name: str, bundle: SourceBundle) -> None:
    try:
        repo = httpx.get(f"{GH_API}/repos/{full_name}", headers=_gh_headers(), timeout=30.0)
        repo.raise_for_status()
        branch = repo.json().get("default_branch", "main")
    except httpx.HTTPError:
        return

    for path in INTERESTING:
        if len(bundle.docs) >= MAX_DOCS:
            break
        raw_url = f"https://raw.githubusercontent.com/{full_name}/{branch}/{path}"
        try:
            resp = httpx.get(raw_url, timeout=20.0, follow_redirects=True)
        except httpx.HTTPError:
            continue
        if resp.status_code != 200 or not resp.text.strip():
            continue
        bundle.docs.append(
            SourceDoc(label=path, url=f"https://github.com/{full_name}/blob/{branch}/{path}",
                      content=resp.text[:MAX_DOC_CHARS])
        )


def _gather_arxiv(item: RawItem, bundle: SourceBundle) -> None:
    # The abstract always; the HTML rendering when arXiv has one (it does not
    # for older papers, and we do not pretend otherwise).
    bundle.docs.append(SourceDoc(label="abstract", url=item.url, content=item.body))

    arxiv_id = item.external_id.split("v")[0]
    html_url = f"https://arxiv.org/abs/{arxiv_id}"
    try:
        resp = httpx.get(html_url, timeout=25.0, follow_redirects=True)
        if resp.status_code == 200:
            bundle.docs.append(
                SourceDoc(label="abs page", url=html_url, content=_strip_html(resp.text)[:MAX_DOC_CHARS])
            )
    except httpx.HTTPError:
        pass


def _gather_hf(item: RawItem, bundle: SourceBundle) -> None:
    card_url = f"https://huggingface.co/{item.external_id}/raw/main/README.md"
    try:
        resp = httpx.get(card_url, timeout=25.0, follow_redirects=True)
        if resp.status_code == 200:
            bundle.docs.append(
                SourceDoc(label="model card", url=card_url, content=resp.text[:MAX_DOC_CHARS])
            )
    except httpx.HTTPError:
        pass

    config_url = f"https://huggingface.co/{item.external_id}/raw/main/config.json"
    try:
        resp = httpx.get(config_url, timeout=20.0, follow_redirects=True)
        if resp.status_code == 200:
            bundle.docs.append(
                SourceDoc(label="config.json", url=config_url, content=resp.text[:8000])
            )
    except httpx.HTTPError:
        pass


def _strip_html(html: str) -> str:
    import re

    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()
