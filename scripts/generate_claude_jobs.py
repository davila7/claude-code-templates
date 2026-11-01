"""
Generate claude-jobs.json by scraping free job sources for Claude Code positions.

Sources (all free, no API keys required):
1. HN Firebase API - "Who is Hiring" thread comments (last 3 months)
2. RemoteOK API - JSON job feed
3. Anthropic Careers - Greenhouse API (jobs mentioning Claude Code)

A job is kept only if its text names Claude Code itself (see
is_claude_related); a passing mention of "Claude" the model is not enough.

Output: docs/claude-jobs.json
"""

import json
import re
import time
from datetime import datetime, timezone
from html import unescape
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from urllib.error import URLError

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def fetch_json(url, timeout=15):
    """Fetch JSON from a URL."""
    req = Request(url, headers={"User-Agent": "claude-code-templates/1.0"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  [warn] fetch_json failed for {url[:80]}: {e}")
        return None


# UTF-8 bytes that were decoded as cp1252/latin-1 ("â€™", "Â·"): a lead byte
# followed by one or two continuation characters as cp1252 renders them.
_CP1252_CONT = "\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122"
_MOJIBAKE_RE = re.compile(f"[\u00c2-\u00ef][{_CP1252_CONT}]{{1,2}}")


def _redecode(fragment):
    for enc in ("cp1252", "latin-1"):
        try:
            return fragment.encode(enc).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    return None


def fix_mojibake(text):
    """Repair UTF-8 text that was decoded with a single-byte codec.

    Each suspicious fragment is re-encoded and decoded as UTF-8; fragments
    that do not round-trip (real accented text such as "Zürich") are kept.
    """
    def repl(m):
        fixed = _redecode(m.group(0))
        if fixed is None and len(m.group(0)) == 3:
            # Two-byte sequence followed by an unrelated character
            head = _redecode(m.group(0)[:2])
            return head + m.group(0)[2] if head else m.group(0)
        return fixed if fixed is not None else m.group(0)
    text = _MOJIBAKE_RE.sub(repl, text)
    return text.replace("\u00a0", " ")


def strip_html(html_text):
    """Remove HTML tags, decode entities, and fix mojibake."""
    if not html_text:
        return ""
    text = re.sub(r"<[^>]+>", " ", html_text)
    text = unescape(text)
    text = fix_mojibake(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


CLAUDE_CODE_RE = re.compile(r"\bclaude[\s-]?code\b|\bclaude agent sdk\b", re.IGNORECASE)


def is_claude_related(text):
    """True when the text names Claude Code (or the Claude Agent SDK).

    "Claude" alone is not enough: it matched jobs that only use the Claude
    model or a chat product (designers, support roles, "chat with ChatGPT,
    Claude, and other AIs").
    """
    return bool(text) and bool(CLAUDE_CODE_RE.search(text))


def truncate(text, length=200):
    """Truncate text at word boundary."""
    if not text or len(text) <= length:
        return text or ""
    return text[:length].rsplit(" ", 1)[0] + "..."


def extract_salary(text):
    """Extract salary string from text.

    Only matches compensation-like amounts (≥$10k or with k/K suffix).
    Skips funding/revenue figures like '$37M raised' or '$300M+ revenue'.
    """
    if not text:
        return ""
    # First, remove sentences about funding/revenue to avoid false positives
    cleaned = re.sub(r"\$[\d,.]+\s*[MBmb](?:illion)?[^.]*(?:\.|$)", "", text)
    cleaned = re.sub(r"(?:raised|revenue|funding|valuation|ARR)[^.]*\$[\d,.]+[^.]*(?:\.|$)", "", cleaned, flags=re.IGNORECASE)
    patterns = [
        r"\$[\d,]+[kK]\s*[-\u2013]\s*\$?[\d,]+[kK]",     # $120k-$150k, $120k-150k
        r"\$[\d,]+[kK](?:\+|\s*\/\s*(?:yr|year))?",       # $150k+, $150k/yr
        r"\$[\d,]{3,}\s*[-\u2013]\s*\$?[\d,]{3,}",        # $120,000-$150,000
        r"\$[\d,]+[kK]?\s*\/\s*(?:yr|year)",               # $120,000/yr
        r"[\d,]+[kK]\s*[-\u2013]\s*[\d,]+[kK]",           # 120k-150k
        r"\u20ac[\d,]+[kK]?\s*[-\u2013]\s*\u20ac?[\d,]+[kK]?",  # EUR
    ]
    for pat in patterns:
        m = re.search(pat, cleaned)
        if m:
            val = m.group(0)
            # Validate: must represent a realistic salary
            nums = re.findall(r"[\d,]+", val)
            has_k = "k" in val.lower()
            if nums:
                first_num = int(nums[0].replace(",", ""))
                # With 'k' suffix: must be >= 30 (i.e. $30k+)
                if has_k and first_num < 30:
                    continue
                # Without 'k': must be >= 30,000 (raw dollar amounts)
                # Values like $100-140 or $150-300 are ambiguous/truncated
                if not has_k and first_num < 1000:
                    continue
            return val
    return ""


def extract_urls(text):
    """Extract URLs from text."""
    return re.findall(r"https?://[^\s<>\"']+", text or "")


def company_icon(name):
    """Best-effort favicon URL for a company."""
    known = {
        "anthropic": "https://www.anthropic.com/favicon.ico",
        "google": "https://www.google.com/favicon.ico",
        "microsoft": "https://www.microsoft.com/favicon.ico",
        "meta": "https://www.facebook.com/favicon.ico",
        "stripe": "https://stripe.com/favicon.ico",
        "github": "https://github.com/favicon.ico",
        "vercel": "https://vercel.com/favicon.ico",
        "supabase": "https://supabase.com/favicon.ico",
        "openai": "https://openai.com/favicon.ico",
        "shopify": "https://shopify.com/favicon.ico",
        "notion": "https://notion.so/favicon.ico",
        "figma": "https://figma.com/favicon.ico",
    }
    lower = name.lower().strip()
    for key, icon in known.items():
        if key in lower:
            return icon
    return ""


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

def split_locations(raw):
    """Split a multi-office location string into a de-duplicated list.

    Greenhouse joins offices with "; " and " | " and repeats cities, e.g.
    "New York City, NY; San Francisco, CA | New York City, NY".
    """
    seen = []
    for part in re.split(r"\s*[;|]\s*", raw or ""):
        part = part.strip()
        if part and part.lower() not in (p.lower() for p in seen):
            seen.append(part)
    return seen


def join_locations(locations):
    return " · ".join(locations)


EMPLOYMENT_RE = re.compile(
    r"^\s*(?:full[\s-]?time|part[\s-]?time|contract(?:or)?|freelance|permanent|"
    r"intern(?:ship)?|visa(?: sponsorship)?|equity|salary)\b[^|]*$",
    re.IGNORECASE,
)

# Header parts that are neither a place nor a role: pay, contact, work permits
NOT_A_PLACE_RE = re.compile(
    r"[$€£@]|\b(?:salary|bonus|equity|benefits?|citizen|green card|visa|sponsorship)\b|^\s*(?:FT|PT)\s*$",
    re.IGNORECASE,
)

# Words that make a header part a job title rather than a location
ROLE_RE = re.compile(
    r"\b(?:engineer|engineers|engineering|developer|developers|lead|manager|architect|"
    r"designer|scientist|analyst|head of|director|founder|cto|ceo|vp|senior|"
    r"staff|principal|junior|product|technologist|researcher|sre|devops|"
    r"programmer|consultant|specialist|roles?|positions?|hiring)\b",
    re.IGNORECASE,
)

REMOTE_HEADER_RE = re.compile(r"\b(?:remote|anywhere|distributed|worldwide|wfh)\b", re.IGNORECASE)
REMOTE_BODY_RE = re.compile(
    r"\b(?:fully remote|100% remote|remote[\s-](?:first|friendly|ok|only)|"
    r"work remotely|remote (?:role|position|team|work))\b",
    re.IGNORECASE,
)
ONSITE_RE = re.compile(r"\b(?:on[\s-]?site|in[\s-]office|hybrid)\b", re.IGNORECASE)


def normalize_key(text):
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def domain_company(url):
    """'https://www.flowstate.inc/jobs' -> 'flowstate.inc' (fallback company name)."""
    try:
        host = urlparse(url).hostname or ""
    except ValueError:
        return ""
    host = re.sub(r"^(?:www|jobs|careers|apply|boards)\.", "", host)
    return host


# ---------------------------------------------------------------------------
# HN Comment Parser
# ---------------------------------------------------------------------------

def parse_hn_comment(comment_data):
    """Parse a HN 'Who is Hiring' comment into a structured job dict.

    HN hiring comments typically follow:
      CompanyName | Role | Location | Remote | Salary | URL
      Description paragraph(s)...
    """
    text = comment_data.get("text", "")
    if not text:
        return None

    clean = strip_html(text)
    if not is_claude_related(clean):
        return None
    # Job seekers sometimes post the "Who wants to be hired?" template here
    if re.search(r"willing to relocate:|r[ée]sum[ée]\s*/\s*cv:", clean, re.IGNORECASE):
        return None

    comment_id = comment_data.get("id", "")
    posted_ts = comment_data.get("time", 0)
    posted_at = datetime.fromtimestamp(posted_ts, tz=timezone.utc).isoformat() if posted_ts else ""

    paragraphs = re.split(r"<p>", text)
    header = strip_html(paragraphs[0] if paragraphs else "")
    parts = [p.strip() for p in header.split("|") if p.strip()]
    urls = extract_urls(text)

    # --- Company ---
    company = parts[0] if parts else ""
    company = re.sub(r"https?://\S+", "", company)
    company = re.sub(r"\s*\(\s*\)", "", company).strip(" -–—:")
    if company.count("(") > company.count(")"):
        company += ")"
    if len(company) > 60:
        company = re.split(r"\s+[-–(]", company)[0].strip()
    # A header that starts with "Location: ..." or a role has no company in
    # front; fall back to the domain of the first link.
    if (not company or re.match(r"^(?:location|remote|hiring|we're|we are)\b", company, re.IGNORECASE)) and urls:
        company = domain_company(urls[0])
    company = company or "Unknown"

    # --- Role, location, remote from the header parts ---
    position = ""
    locations = []
    remote_header = False
    onsite_header = False
    for part in parts[1:]:
        lower = part.lower()
        if re.match(r"^\$|^[€£]|https?://", part.strip()) or extract_salary(part) == part.strip():
            continue
        if REMOTE_HEADER_RE.search(part):
            remote_header = True
        if ONSITE_RE.search(part):
            onsite_header = True
        if EMPLOYMENT_RE.match(part):
            continue
        if ROLE_RE.search(part):
            if not position and len(part) < 90:
                position = part
            continue
        if NOT_A_PLACE_RE.search(part):
            continue
        # Bare "REMOTE" carries no place; anything else short is a location
        if re.fullmatch(r"\s*(?:remote|onsite|on-site|hybrid)\s*", lower):
            continue
        if re.search(r"[A-Za-z]{2}", part) and len(part) < 60:
            locations.append(re.sub(r"^location:\s*", "", part, flags=re.IGNORECASE))

    remote = remote_header or (not onsite_header and bool(REMOTE_BODY_RE.search(clean)))
    locations = split_locations(" | ".join(locations))
    location = join_locations(locations) or ("Remote" if remote else "On-site")

    # --- Salary, links, description ---
    salary = extract_salary(header) or extract_salary(clean)
    apply_url = urls[0] if urls else f"https://news.ycombinator.com/item?id={comment_id}"
    description_html = " ".join(paragraphs[1:]) if len(paragraphs) > 1 else ""
    description = truncate(strip_html(description_html), 300) or truncate(clean, 300)

    return {
        "id": f"hn-{comment_id}",
        "company": company[:80],
        "position": (position or extract_position(clean, company))[:120],
        "location": location[:120],
        "locations": locations,
        "remote": remote,
        "salary": salary,
        "description": description,
        "applyUrl": apply_url,
        "source": "HackerNews",
        "sourceUrl": f"https://news.ycombinator.com/item?id={comment_id}",
        "postedAt": posted_at,
        "tags": extract_tech_tags(clean),
        "companyIcon": company_icon(company),
    }


def extract_position(text, company):
    """Try to extract a job title from the text."""
    patterns = [
        r"(?:hiring|looking for|seeking)\s+(?:an?\s+)?([A-Z][A-Za-z\s/\-&]+(?:Engineer|Developer|Architect|Designer|Manager|Lead|Scientist|Analyst|Programmer))",
        r"((?:Senior|Staff|Principal|Lead|Junior|Mid[- ]?Level|Head of)\s+[A-Za-z\s/\-&]+(?:Engineer|Developer|Architect|Designer|Manager|Scientist))",
        r"((?:Full[- ]?Stack|Front[- ]?end|Back[- ]?end|DevOps|ML|AI|Platform|Infrastructure|Software|Product|Founding)\s+(?:Engineer|Developer|Architect|Manager))",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            title = m.group(1).strip()
            if title.lower() != company.lower() and len(title) < 80:
                return title
    return "Software Engineer"


# (label, regex) pairs. Word boundaries keep "go" and "java" from matching
# "go to market" or "JavaScript".
TECH_PATTERNS = [
    ("Claude Code", r"\bclaude[\s-]?code\b"),
    ("React Native", r"\breact native\b"),
    ("React", r"\breact(?:\.js|js)?\b(?! native)"),
    ("Next.js", r"\bnext\.?js\b"),
    ("TypeScript", r"\btypescript\b"),
    ("JavaScript", r"\bjavascript\b"),
    ("Python", r"\bpython\b"),
    ("Rust", r"\brust\b"),
    ("Go", r"\bgolang\b|(?:[,/(|]\s*|\bin\s)go\b|\bgo\s*(?=[,/)|])"),
    ("Node.js", r"\bnode(?:\.js|js)\b"),
    ("PostgreSQL", r"\bpostgres(?:ql)?\b"),
    ("Supabase", r"\bsupabase\b"),
    ("Firebase", r"\bfirebase\b"),
    ("AWS", r"\baws\b"),
    ("GCP", r"\bgcp\b"),
    ("Azure", r"\bazure\b"),
    ("Docker", r"\bdocker\b"),
    ("Kubernetes", r"\bkubernetes\b|\bk8s\b"),
    ("Cursor", r"\bcursor\b"),
    ("Copilot", r"\bcopilot\b"),
    ("Swift", r"\bswift\b"),
    ("Kotlin", r"\bkotlin\b"),
    ("Java", r"\bjava\b"),
    ("Ruby", r"\bruby\b"),
    ("Rails", r"\brails\b"),
    ("Django", r"\bdjango\b"),
    ("Flask", r"\bflask\b"),
    ("Vue.js", r"\bvue(?:\.js)?\b"),
    ("Angular", r"\bangular\b"),
    ("Svelte", r"\bsvelte\b"),
    ("Tailwind", r"\btailwind\b"),
    ("GraphQL", r"\bgraphql\b"),
    ("Redis", r"\bredis\b"),
    ("MongoDB", r"\bmongo(?:db)?\b"),
    ("MySQL", r"\bmysql\b"),
    ("MCP", r"\bmcp\b|\bmodel context protocol\b"),
]
TECH_REGEXES = [(label, re.compile(rx, re.IGNORECASE)) for label, rx in TECH_PATTERNS]


def extract_tech_tags(text):
    """Extract technology tags from text; Claude Code first when present."""
    found = [label for label, rx in TECH_REGEXES if rx.search(text or "")]
    return found[:10]


# ---------------------------------------------------------------------------
# Source 1: HN Firebase API
# ---------------------------------------------------------------------------

def find_latest_hiring_threads():
    """The last three 'Who is hiring?' threads posted by the whoishiring account."""
    print("[1/3] Finding latest HN 'Who is Hiring' threads...")
    data = fetch_json(
        "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=12"
    )
    if not data:
        return []
    threads = []
    for hit in data.get("hits", []):
        title = (hit.get("title") or "").lower()
        if "who is hiring" in title:
            threads.append({
                "id": int(hit["objectID"]),
                "title": hit.get("title", ""),
                "date": hit.get("created_at", ""),
            })
    threads = threads[:3]
    print(f"  Using {len(threads)} threads: " + ", ".join(t["title"] for t in threads))
    return threads


def fetch_hn_thread_jobs(thread_id):
    """Fetch all top-level comments from a HN thread and filter for Claude Code jobs."""
    print(f"  Fetching thread {thread_id}...")
    thread_data = fetch_json(f"https://hacker-news.firebaseio.com/v0/item/{thread_id}.json")
    if not thread_data:
        return []

    kid_ids = thread_data.get("kids", [])
    print(f"  Thread has {len(kid_ids)} top-level comments, fetching...")

    jobs = []

    def fetch_comment(cid):
        return fetch_json(f"https://hacker-news.firebaseio.com/v0/item/{cid}.json", timeout=10)

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(fetch_comment, cid): cid for cid in kid_ids}
        for future in as_completed(futures):
            comment = future.result()
            if comment and not comment.get("deleted") and not comment.get("dead"):
                job = parse_hn_comment(comment)
                if job:
                    jobs.append(job)

    print(f"  Found {len(jobs)} Claude Code jobs in thread {thread_id}")
    return jobs


def collect_hn_firebase():
    """Collect jobs from HN Firebase API."""
    all_jobs = []
    for thread in find_latest_hiring_threads():
        jobs = fetch_hn_thread_jobs(thread["id"])
        for job in jobs:
            if not job.get("postedAt") and thread.get("date"):
                job["postedAt"] = thread["date"]
        all_jobs.extend(jobs)
        time.sleep(0.5)
    return all_jobs


# ---------------------------------------------------------------------------
# Source 2: RemoteOK API
# ---------------------------------------------------------------------------

def remoteok_salary(item):
    """Format RemoteOK's numeric salary_min/salary_max ('' when absent)."""
    try:
        lo = int(item.get("salary_min") or 0)
        hi = int(item.get("salary_max") or 0)
    except (TypeError, ValueError):
        return ""
    if lo >= 10000 and hi >= lo:
        return f"${lo // 1000}k–${hi // 1000}k" if hi > lo else f"${lo // 1000}k"
    return ""


def collect_remoteok():
    """Collect jobs from RemoteOK API."""
    print("[2/3] Searching RemoteOK API...")
    data = fetch_json("https://remoteok.com/api")
    if not data:
        return []

    jobs = []
    for item in data[1:]:  # First element is metadata
        desc = item.get("description", "")
        tags_list = item.get("tags", [])
        tags_str = " ".join(tags_list) if isinstance(tags_list, list) else str(tags_list)
        full_text = f"{item.get('position', '')} {strip_html(desc)} {tags_str}"

        if not is_claude_related(full_text):
            continue

        slug = item.get("slug", item.get("id", ""))
        place = strip_html(item.get("location") or "")
        locations = split_locations(place)
        jobs.append({
            "id": f"rok-{slug}",
            "company": item.get("company", "Unknown"),
            "position": item.get("position", "Software Engineer"),
            "location": f"Remote ({join_locations(locations)})" if locations else "Remote",
            "locations": locations,
            "remote": True,
            "salary": remoteok_salary(item) or extract_salary(strip_html(desc)),
            "description": truncate(strip_html(desc), 300),
            "applyUrl": item.get("apply_url", "") or f"https://remoteok.com/remote-jobs/{slug}",
            "source": "RemoteOK",
            "sourceUrl": f"https://remoteok.com/remote-jobs/{slug}",
            "postedAt": item.get("date", ""),
            "tags": extract_tech_tags(full_text),
            "companyIcon": item.get("company_logo", "") or company_icon(item.get("company", "")),
        })

    print(f"  Found {len(jobs)} jobs from RemoteOK")
    return jobs


# ---------------------------------------------------------------------------
# Source 3: Anthropic Careers (Greenhouse API)
# ---------------------------------------------------------------------------

# Technical and product titles. Sales and customer-success roles also mention
# Claude Code (it is the product they sell), but they are not roles that
# use it to build software.
ANTHROPIC_TITLE_KEYWORDS = [
    "claude", "engineer", "developer", "architect", "platform",
    "infrastructure", "product", "design", "research", "ml ",
    "machine learning", "ai ", "applied", "full stack", "fullstack",
    "front end", "frontend", "back end", "backend", "devops", "sre",
    "security", "data", "sdk", "api", "tools", "dx", "evangelist",
    "communications", "technical", "software",
]

ROLE_INTRO_MARKERS = [
    "The role", "The Role", "About the role", "About the Role",
    "What you'll do", "What You'll Do", "The position", "The Position",
    "We're looking", "We are looking", "This role", "In this role",
    "As a ", "As an ", "Join ", "You will ", "You'll ",
]


def collect_anthropic_careers():
    """Anthropic roles whose description names Claude Code.

    One request: the board's list endpoint returns every job with its
    content when called with content=true.
    """
    print("[3/3] Searching Anthropic Careers (Greenhouse API)...")
    data = fetch_json(
        "https://boards-api.greenhouse.io/v1/boards/anthropic/jobs?content=true", timeout=60
    )
    if not data or "jobs" not in data:
        print("  [warn] Could not fetch Anthropic job listings")
        return []

    listings = data["jobs"]
    print(f"  Total Anthropic listings: {len(listings)}")

    jobs = []
    for detail in listings:
        content_html = unescape(detail.get("content", ""))  # Greenhouse double-escapes HTML
        title = detail.get("title", "")
        if not any(kw in title.lower() for kw in ANTHROPIC_TITLE_KEYWORDS):
            continue
        clean_desc = strip_html(content_html)
        full_text = f"{title} {clean_desc}"
        # Every Anthropic job mentions Claude; require Claude Code specifically
        if not is_claude_related(full_text):
            continue

        loc = detail.get("location") or {}
        locations = split_locations(loc.get("name", "") if isinstance(loc, dict) else "")

        location_type = ""
        for meta in detail.get("metadata") or []:
            if (meta.get("name") or "").lower() in ("location type", "location_type"):
                location_type = str(meta.get("value") or "").lower()
        remote = "remote" in location_type or any("remote" in l.lower() for l in locations)

        location = join_locations(locations) or ("Remote" if remote else "San Francisco, CA")

        for marker in ROLE_INTRO_MARKERS:
            idx = clean_desc.find(marker)
            if 0 < idx < 800:
                clean_desc = clean_desc[idx:]
                break
        clean_desc = re.sub(r"^About the [Rr]ole:?\s*", "", clean_desc)

        tags = extract_tech_tags(full_text)
        if "Claude Code" not in tags:
            tags.insert(0, "Claude Code")
        if "Anthropic" not in tags:
            tags.append("Anthropic")

        url = detail.get("absolute_url") or "https://www.anthropic.com/careers/jobs"
        jobs.append({
            "id": f"anth-{detail.get('id')}",
            "company": "Anthropic",
            "position": title[:120],
            "location": location[:120],
            "locations": locations,
            "remote": remote,
            "salary": extract_salary(full_text),
            "description": truncate(clean_desc, 300),
            "applyUrl": url,
            "source": "Anthropic",
            "sourceUrl": url,
            # updated_at, not first_published: a role open since 2025 is
            # still current, and first_published made it look abandoned.
            "postedAt": detail.get("updated_at") or detail.get("first_published", ""),
            "tags": tags,
            "companyIcon": "https://www.anthropic.com/favicon.ico",
        })

    print(f"  Found {len(jobs)} Claude Code jobs at Anthropic")
    return jobs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def dedupe(jobs):
    """Drop repeats: same id, or the same company + title outside Anthropic
    (HN companies re-post every month; Anthropic opens one req per office
    under the same title, and those are separate roles). Keeps the most
    recent posting."""
    jobs = sorted(jobs, key=lambda j: j.get("postedAt", ""), reverse=True)
    seen_ids, seen_roles, unique = set(), set(), []
    for job in jobs:
        role = (normalize_key(job["company"]), normalize_key(job["position"]))
        if job["id"] in seen_ids or (job["source"] != "Anthropic" and role in seen_roles):
            continue
        seen_ids.add(job["id"])
        seen_roles.add(role)
        unique.append(job)
    return unique


def generate():
    print("=" * 60)
    print("Claude Code Jobs Scraper (free sources only)")
    print("=" * 60)

    all_jobs = []
    all_jobs.extend(collect_hn_firebase())
    all_jobs.extend(collect_remoteok())
    all_jobs.extend(collect_anthropic_careers())

    unique = dedupe(all_jobs)

    sources = sorted(set(j["source"] for j in unique))
    output = {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "totalJobs": len(unique),
        "sources": sources,
        "jobs": unique,
    }

    output_path = "docs/claude-jobs.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    import os
    dashboard_path = "dashboard/public/claude-jobs.json"
    if os.path.isdir("dashboard/public"):
        with open(dashboard_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"\nCopied to {dashboard_path}")

    print("\n" + "=" * 60)
    print(f"Total unique jobs: {len(unique)} (from {len(all_jobs)} before dedupe)")
    for src in sources:
        count = sum(1 for j in unique if j["source"] == src)
        print(f"  {src}: {count}")
    remote_count = sum(1 for j in unique if j.get("remote"))
    print(f"  Remote: {remote_count} / On-site or hybrid: {len(unique) - remote_count}")
    print(f"\nSaved to {output_path}")
    print("=" * 60)


if __name__ == "__main__":
    generate()
