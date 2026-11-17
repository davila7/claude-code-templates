"""
Refresh dashboard/public/certifications.json from the sources listed in
scripts/certifications_sources.json.

Source types:
- microsoft-learn: the public Microsoft Learn Catalog API (no key). Picks the
  certifications listed in `uids`.
- firecrawl: Firecrawl scrape with JSON extraction of a catalog page (needs
  FIRECRAWL_API_KEY; the source is skipped without it). Only title, url and
  description come from the page; provider, kind, price and categories come
  from the source config, because LLM extraction guesses those badly. An item
  is kept only if its URL is on the source's own host and matches
  `urlPattern`, and its title appears in the page's markdown (extraction can
  invent entries that are not on the page).
- google-cloud: the public Google Cloud certification list
  (cloud.google.com/learn/certification, plain HTML, no key). Keeps the
  certifications whose name matches `match`; the level comes from the list's
  section (Foundational/Associate/Professional), and title, description,
  registration fee, exam guide and learning path from each certification's
  own page.

Merge rules:
- Entries with `source: "manual"` are never touched.
- A source that answers replaces its own entries (`source` = the source id),
  keeping each entry's `addedAt`. A source that fails keeps its previous
  entries, so an outage never empties the catalog.
- Every entry must pass the same contract as the dashboard's validateItem
  (vocabularies read from dashboard/src/lib/certifications.ts); entries that
  don't are dropped and logged.

  python scripts/generate_certifications.py                 # fetch + merge
  python scripts/generate_certifications.py --from-cache F  # merge entries cached in F (no network)

Every run writes the fetched entries to docs/certifications-pipeline.json, so
the workflow can re-merge them onto a newer main without fetching again.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "dashboard", "public", "certifications.json")
CACHE_PATH = os.path.join(ROOT, "docs", "certifications-pipeline.json")
SOURCES_PATH = os.path.join(ROOT, "scripts", "certifications_sources.json")
CONTRACT_PATH = os.path.join(ROOT, "dashboard", "src", "lib", "certifications.ts")

MS_CATALOG_URL = "https://learn.microsoft.com/api/catalog/?type=certifications&locale=en-us"
FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape"
USER_AGENT = "claude-code-templates/1.0 (+https://www.aitmpl.com)"

MS_LEVELS = {"beginner": "Entry", "intermediate": "Intermediate", "advanced": "Advanced"}
# First match wins, so the most specific audience comes first.
MS_ROLES = [
    ("developer", "Developer"),
    ("ai-engineer", "Developer"),
    ("solution-architect", "Architect"),
    ("devops-engineer", "DevOps"),
    ("security-engineer", "Security"),
    ("data-engineer", "Data"),
    ("business-user", "Business"),
    ("business-leader", "Business"),
    ("business-analyst", "Business"),
]

EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "url": {"type": "string"},
                    "description": {"type": "string"},
                    "topics": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["title", "url"],
            },
        }
    },
    "required": ["items"],
}


def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def http_text(url, timeout=60):
    with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def http_json(url, data=None, headers=None, timeout=60):
    h = {"User-Agent": USER_AGENT}
    h.update(headers or {})
    req = Request(url, data=json.dumps(data).encode() if data is not None else None, headers=h)
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Contract (mirrors validateItem in dashboard/src/lib/certifications.ts)
# ---------------------------------------------------------------------------

def read_vocabularies(path=CONTRACT_PATH):
    """CATEGORIES, ROLES and LEVELS from the TypeScript contract, so the two can't drift."""
    src = open(path, encoding="utf-8").read()
    vocab = {}
    for name in ("CATEGORIES", "ROLES", "LEVELS"):
        m = re.search(rf"export const {name} = \[(.*?)\] as const", src, re.S)
        if not m:
            raise SystemExit(f"{name} not found in {path}")
        vocab[name] = re.findall(r"'([^']+)'", m.group(1))
    return vocab


KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HTTPS = re.compile(r"^https://\S+$", re.I)


def validate_item(item, vocab):
    errors = []
    if not KEBAB.match(item.get("id") or ""):
        errors.append("id must be kebab-case")
    if item.get("kind") not in ("certification", "course"):
        errors.append("kind must be certification or course")
    for f in ("title", "provider", "description", "source"):
        if not isinstance(item.get(f), str) or not item.get(f):
            errors.append(f"{f} is required")
    if not HTTPS.match(item.get("url") or ""):
        errors.append("url must be https")
    for f in ("prepUrl", "examGuideUrl"):
        if f in item and not HTTPS.match(item[f] or ""):
            errors.append(f"{f} must be https")
    cats = item.get("categories")
    if not isinstance(cats, list) or not cats or any(c not in vocab["CATEGORIES"] for c in cats):
        errors.append("categories must be a non-empty list of CATEGORIES")
    elif len(set(cats)) != len(cats):
        errors.append("categories must not repeat")
    if "role" in item and item["role"] not in vocab["ROLES"]:
        errors.append("role must be one of ROLES")
    if "level" in item and item["level"] not in vocab["LEVELS"]:
        errors.append("level must be one of LEVELS")
    if item.get("eligibility") not in ("public", "partners"):
        errors.append("eligibility must be public or partners")
    topics = item.get("topics")
    if not isinstance(topics, list) or any(not isinstance(t, str) or not t for t in topics):
        errors.append("topics must be an array of strings")
    if "price" in item and item["price"] is not None:
        price = item["price"]
        if not isinstance(price, dict) or not isinstance(price.get("amount"), (int, float)) or not price.get("currency"):
            errors.append("price must be null or have amount and currency")
    for f in ("addedAt", "verifiedAt"):
        if not DATE.match(item.get(f) or ""):
            errors.append(f"{f} must be YYYY-MM-DD")
    return errors


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def item_id(provider, name):
    """provider-name, without repeating the provider ("github-github-copilot")."""
    p, n = slugify(provider), slugify(name)
    return n if n == p or n.startswith(p + "-") else f"{p}-{n}"


def strip_html(html):
    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", unescape(text)).strip()


def first_sentences(text, limit=280):
    """Cut at a sentence end before `limit` characters."""
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    return cut[: end + 1] if end > 80 else cut.rsplit(" ", 1)[0] + "…"


def url_slug(url, page_url):
    """Last path segment of an entry's link, so its id survives a title change.
    None when the entry is the catalog page itself (single-course sources)."""
    if url.rstrip("/") == page_url.rstrip("/"):
        return None
    return urlparse(url).path.rstrip("/").rsplit("/", 1)[-1] or None


def clean_url(url):
    """Drop tracking query strings (Microsoft adds ?WT.mc_id=api_CatalogApi)."""
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}{p.path}"


RULE_FIELDS = ("categories", "level", "role")


def title_rules(source, title):
    """Fields set by the source's `rules`: for each field, the first rule whose
    `match` regex hits the title and that sets it wins."""
    out = {}
    for rule in source.get("rules", []):
        if re.search(rule["match"], title, re.I):
            for f in RULE_FIELDS:
                if f in rule and f not in out:
                    out[f] = rule[f]
    return out


def base_item(source, **fields):
    item = {
        "provider": source["provider"],
        "categories": list(source["categories"]),
        "eligibility": source.get("eligibility", "public"),
        "topics": [],
        "source": source["id"],
    }
    for key in ("platform", "role", "level"):
        if key in source:
            item[key] = source[key]
    if "price" in source:  # null = free; absent = not published
        item["price"] = source["price"]
    item.update({k: list(v) if isinstance(v, list) else v for k, v in fields.items() if v is not None})
    return item


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------

def fetch_microsoft_learn(source, catalog_cache={}):
    if "certs" not in catalog_cache:
        catalog_cache["certs"] = {c["uid"]: c for c in http_json(MS_CATALOG_URL)["certifications"]}
    certs = catalog_cache["certs"]
    items = []
    for uid in source["uids"]:
        c = certs.get(uid)
        if not c:
            print(f"  [warn] {source['id']}: {uid} is no longer in the Microsoft Learn catalog")
            continue
        roles = c.get("roles") or []
        role = next((r for key, r in MS_ROLES if key in roles), None)
        level = MS_LEVELS.get((c.get("levels") or [""])[0])
        title = c["title"]
        items.append(
            base_item(
                source,
                id=item_id(source["provider"], uid.split(".", 1)[-1]),
                kind="certification",
                title=title,
                description=first_sentences(strip_html(c.get("subtitle") or c.get("summary") or title)),
                url=clean_url(c["url"]),
                level=level,
                role=role,
                platform="Microsoft Learn",
                topics=[t for t in (c.get("products") or [])][:6],
            )
        )
    return items


def fetch_firecrawl(source, api_key):
    body = {
        "url": source["url"],
        "formats": ["markdown", {"type": "json", "schema": EXTRACT_SCHEMA, "prompt": source["prompt"]}],
        "onlyMainContent": True,
    }
    data = http_json(
        FIRECRAWL_SCRAPE_URL, data=body, timeout=180,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    ).get("data") or {}
    markdown = (data.get("markdown") or "").lower()
    found = (data.get("json") or {}).get("items") or []
    host = urlparse(source["url"]).netloc
    pattern = re.compile(source["urlPattern"])
    items, seen = [], set()
    for raw in found:
        title = (raw.get("title") or "").strip()
        url = (raw.get("url") or "").strip().rstrip("/") or source["url"]
        if urlparse(url).netloc != host or not pattern.match(url):
            print(f"  [skip] {source['id']}: {url} does not match the source's URL pattern")
            continue
        # Either the title or the link must be on the page: catalogs often show a
        # short name ("Agentic AI") for an entry whose full title is longer.
        if not title or (title.lower() not in markdown and url.lower() not in markdown):
            print(f"  [skip] {source['id']}: '{title}' is not on the page (extraction guess)")
            continue
        if url in seen:
            continue
        seen.add(url)
        items.append(
            base_item(
                source,
                **title_rules(source, title),
                id=item_id(source["provider"], url_slug(url, source["url"]) or title),
                kind=source["kind"],
                title=title,
                description=first_sentences((raw.get("description") or title).strip()),
                url=url,
                topics=[t.strip() for t in raw.get("topics") or [] if isinstance(t, str) and t.strip()][:6],
            )
        )
    return items


GOOGLE_LEVELS = {"foundational": "Entry", "associate": "Intermediate", "professional": "Advanced"}
GOOGLE_ORIGIN = "https://cloud.google.com"
# A section heading ("Professional certification") or a certification link in the list.
GOOGLE_LIST_RE = re.compile(
    r"<h[23][^>]*>\s*(Foundational|Associate|Professional) certification\s*</h[23]>"
    r"|<a href=\"((?:https://cloud\.google\.com)?/(?:learn/)?certification/[a-z0-9-]+/?)\"[^>]*>([^<]+)</a>",
    re.I,
)


def google_meta(html, attr, name):
    m = re.search(rf'<meta {attr}="{name}" content="([^"]*)"', html)
    return re.sub(r"\s+", " ", unescape(unescape(m.group(1)))).strip() if m else ""


def google_link(html, pattern):
    m = re.search(rf'href="({pattern}[^"]*)"', html)
    return clean_url(unescape(m.group(1))) if m else None


def parse_google_page(html):
    """Title, description, price and links from one certification page."""
    title = google_meta(html, "property", "og:title").split("|")[0].strip()
    title = re.sub(r"\s+Certification$", "", title)
    desc = re.sub(r"\s*Find out how to prepare for the exam\.?$", "", google_meta(html, "name", "description"))
    text = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", html)))
    fee = re.search(r"Registration fee:\s*\$(\d+(?:\.\d+)?)", text)
    return {
        "title": title,
        "description": desc,
        "price": {"amount": float(fee.group(1)) if "." in fee.group(1) else int(fee.group(1)), "currency": "USD"} if fee else None,
        "examGuideUrl": google_link(html, r"https://services\.google\.com/fh/files/misc/[a-z0-9_]*exam_guide"),
        "prepUrl": google_link(html, r"https://www\.(?:skills\.google|cloudskillsboost\.google)/paths/\d+"),
    }


def fetch_google_cloud(source, fetch=http_text):
    listing = fetch(source["url"])
    wanted = re.compile(source["match"], re.I)
    level, picks, seen = None, [], set()
    for m in GOOGLE_LIST_RE.finditer(listing):
        if m.group(1):
            level = GOOGLE_LEVELS[m.group(1).lower()]
            continue
        href, name = m.group(2), unescape(m.group(3)).strip()
        slug = href.rstrip("/").rsplit("/", 1)[-1]
        if level and wanted.search(name) and slug not in seen:
            seen.add(slug)
            picks.append((slug, level))
    if not picks:
        raise RuntimeError("no matching certification in the list (page layout changed?)")
    items = []
    for slug, lvl in picks:
        url = f"{GOOGLE_ORIGIN}/learn/certification/{slug}"
        page = parse_google_page(fetch(url))
        if not page["title"] or not page["description"]:
            print(f"  [warn] {source['id']}: {url} has no title or description")
            continue
        fields = {k: v for k, v in page.items() if k in ("examGuideUrl", "prepUrl") and v}
        if page["price"]:  # absent = "See price" rather than a guess
            fields["price"] = page["price"]
        items.append(
            base_item(
                source,
                **{"level": lvl, **title_rules(source, page["title"])},
                id=item_id(source["provider"], slug),
                kind="certification",
                title=page["title"],
                description=first_sentences(page["description"]),
                url=url,
                **fields,
            )
        )
    return items


FETCHERS = {
    "microsoft-learn": lambda source, _key: fetch_microsoft_learn(source),
    "firecrawl": fetch_firecrawl,
    "google-cloud": lambda source, _key: fetch_google_cloud(source),
}
# A source that answers with fewer than this share of its previous entries is
# treated as a failed read. A real removal of that size needs a manual edit.
MIN_KEPT_SHARE = 0.6


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------

def is_valid_fetched(item, vocab):
    """Contract check before the shrink guard counts an entry (dates are set at merge)."""
    errors = validate_item({**item, "addedAt": today(), "verifiedAt": today()}, vocab)
    if errors:
        print(f"  [drop] {item.get('id')}: {', '.join(errors)}")
    return not errors


def merge(data, fetched, ok_sources, vocab, labels, providers):
    """fetched: {source_id: [items]} for the sources that answered (ok_sources)."""
    previous = {i["id"]: i for i in data["items"]}
    manual = [i for i in data["items"] if i.get("source") == "manual"]
    manual_urls = {i["url"].rstrip("/") for i in manual}
    kept = [i for i in data["items"] if i.get("source") != "manual" and i.get("source") not in ok_sources]
    stamp = today()
    fresh, taken = [], {i["id"] for i in manual + kept}
    for sid in ok_sources:
        for item in fetched.get(sid, []):
            if item["url"].rstrip("/") in manual_urls or item["id"] in taken:
                continue  # a hand-written entry or another source already lists it
            prev = previous.get(item["id"])
            item["addedAt"] = prev["addedAt"] if prev and prev.get("addedAt") else stamp
            item["verifiedAt"] = stamp
            errors = validate_item(item, vocab)
            if errors:
                print(f"  [drop] {item['id']}: {', '.join(errors)}")
                continue
            taken.add(item["id"])
            fresh.append(item)
    data["items"] = manual + kept + fresh
    for name, info in providers.items():
        data["providers"].setdefault(name, info)
    used = {i["source"] for i in data["items"]}
    data["sources"] = sorted(set(data.get("sources", [])) | {labels[s] for s in used if s in labels})
    return data


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main(argv=None, sources_path=SOURCES_PATH, data_path=DATA_PATH, cache_path=CACHE_PATH):
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-cache", help="merge the entries in this cache file instead of fetching")
    args = ap.parse_args(argv)

    config = read_json(sources_path)
    vocab = read_vocabularies()
    labels = {s["id"]: s["label"] for s in config["sources"]}
    data = read_json(data_path)
    before = json.dumps(data["items"], sort_keys=True)

    if args.from_cache:
        cache = read_json(args.from_cache)
        # Only sources still configured on this checkout: one removed from main
        # while the fetch ran must not come back from the cache.
        configured = {src["id"] for src in config["sources"]}
        ok = [sid for sid in cache["ok"] if sid in configured]
        fetched = {sid: cache["items"].get(sid, []) for sid in ok}
    else:
        api_key = os.environ.get("FIRECRAWL_API_KEY")
        fetched, ok = {}, []
        for source in config["sources"]:
            if source["type"] == "firecrawl" and not api_key:
                print(f"  [skip] {source['id']}: FIRECRAWL_API_KEY is not set")
                continue
            if source["type"] not in FETCHERS:
                print(f"  [warn] {source['id']}: unknown type {source['type']}")
                continue
            had = sum(1 for i in data["items"] if i.get("source") == source["id"])
            items = None
            # LLM extraction sometimes returns a fraction of the page: retry once,
            # then keep the previous entries rather than drop most of a catalog.
            for attempt in (1, 2):
                try:
                    items = [i for i in FETCHERS[source["type"]](source, api_key) if is_valid_fetched(i, vocab)]
                except Exception as e:  # network, HTTP 402 (no credits), bad JSON
                    print(f"  [warn] {source['id']} failed: {getattr(e, 'code', e)}")
                    items = None
                if items and len(items) >= had * MIN_KEPT_SHARE:
                    break
                if items:
                    print(f"  [warn] {source['id']}: {len(items)} entries, it had {had} (attempt {attempt})")
            if not items or len(items) < had * MIN_KEPT_SHARE:
                print(f"  [warn] {source['id']}: keeping its {had} previous entries")
                continue
            print(f"  {source['id']}: {len(items)} entries")
            fetched[source["id"]], ok = items, ok + [source["id"]]
        write_json(cache_path, {"ok": ok, "items": fetched})

    data = merge(data, fetched, ok, vocab, labels, config.get("providers", {}))
    if json.dumps(data["items"], sort_keys=True) != before:
        data["lastUpdated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    write_json(data_path, data)
    print(f"certifications.json: {len(data['items'])} entries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
