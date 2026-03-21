"""
Generate claude-jobs.json by scraping free job sources for Claude Code positions.

Sources (all free, no API keys required):
1. HN Firebase API - "Who is Hiring" thread comments
2. HN Algolia API - Search across multiple months
3. RemoteOK API - JSON job feed
4. WeWorkRemotely RSS - Programming jobs feed

Output: docs/claude-jobs.json
"""

import json
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.parse import quote_plus
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


def fetch_text(url, timeout=15):
    """Fetch raw text/XML from a URL."""
    req = Request(url, headers={"User-Agent": "claude-code-templates/1.0"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8")
    except Exception as e:
        print(f"  [warn] fetch_text failed for {url[:80]}: {e}")
        return None


def strip_html(html_text):
    """Remove HTML tags and decode entities."""
    if not html_text:
        return ""
    text = re.sub(r"<[^>]+>", " ", html_text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def is_claude_related(text):
    """Check if text mentions Claude Code or related tools."""
    if not text:
        return False
    t = text.lower()
    keywords = [
        "claude code", "claude-code", "anthropic claude", "claude ai",
        "claude coder", "using claude", "claude experience",
    ]
    if any(kw in t for kw in keywords):
        return True
    # "claude" alone needs job context to avoid false positives
    if "claude" in t:
        job_words = ["hiring", "position", "engineer", "developer", "role",
                     "stack", "workflow", "tool", "cursor"]
        return any(w in t for w in job_words)
    return False


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
        r"[\d,]+[kK]\s*[-\u2013]\s*[\d,]+[kK]",           # 120k-150k
        r"\u20ac[\d,]+[kK]?\s*[-\u2013]\s*\u20ac?[\d,]+[kK]?",  # EUR
    ]
    for pat in patterns:
        m = re.search(pat, cleaned)
        if m:
            return m.group(0)
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
# HN Comment Parser
# ---------------------------------------------------------------------------

def parse_hn_comment(comment_data):
    """Parse a HN 'Who is Hiring' comment into a structured job dict.

    HN hiring comments typically follow:
      CompanyName | Location | Remote | Salary | URL
      Description paragraph(s)...
    """
    text = comment_data.get("text", "")
    if not text:
        return None

    clean = strip_html(text)
    if not is_claude_related(clean):
        return None

    comment_id = comment_data.get("id", "")
    posted_ts = comment_data.get("time", 0)
    posted_at = datetime.fromtimestamp(posted_ts, tz=timezone.utc).isoformat() if posted_ts else ""

    # --- Parse first line (pipe-delimited header) ---
    # Split on <p> to get paragraphs
    paragraphs = re.split(r"<p>", text)
    header_html = paragraphs[0] if paragraphs else ""
    header = strip_html(header_html)

    # Try pipe-delimited: "Company | Location | Remote | ..."
    parts = [p.strip() for p in header.split("|")]

    company = parts[0] if parts else "Unknown"
    # Clean company name (remove trailing URLs, etc.)
    company = re.sub(r"https?://\S+", "", company).strip()
    company = re.sub(r"\s*[-\u2013(].*", "", company).strip() if len(company) > 60 else company

    # Location
    location = ""
    remote = False
    # Words that indicate a part is a role title, not a location
    role_words = {"engineer", "developer", "lead", "manager", "architect",
                  "designer", "scientist", "analyst", "operations", "head",
                  "director", "founder", "cto", "ceo", "vp ", "senior",
                  "staff", "principal", "junior", "intern", "product",
                  "technical", "native"}
    for part in parts[1:]:
        lower = part.lower().strip()
        # Skip parts that look like role titles
        if any(w in lower for w in role_words):
            continue
        if any(w in lower for w in ["remote", "anywhere", "distributed"]):
            remote = True
            if "only" in lower or "(" in lower or len(lower) > 6:
                location = part.strip()
        elif re.search(r"[A-Z][a-z]+", part) and not re.match(r"^\$", part.strip()):
            if not location and any(w in lower for w in [",", "city", "francisco", "york", "london",
                                                          "berlin", "seattle", "austin", "chicago",
                                                          "boston", "denver", "miami", "toronto",
                                                          "europe", "us ", "u.s.", "worldwide"]):
                location = part.strip()
            elif not location and len(part.strip()) < 40:
                location = part.strip()

    # Also check full text for remote indicators if not found in header
    if not remote:
        remote_in_body = any(w in clean.lower() for w in ["remote", "anywhere", "distributed", "work from home"])
        if remote_in_body:
            remote = True

    if not location:
        location = "Remote" if remote else "On-site"
    elif remote and "remote" not in location.lower():
        location = f"{location} (Remote)"

    # Salary
    salary = extract_salary(header)
    if not salary:
        salary = extract_salary(clean)

    # Apply URL — first URL found in comment
    urls = extract_urls(text)
    apply_url = urls[0] if urls else f"https://news.ycombinator.com/item?id={comment_id}"

    # Description — everything after header, truncated
    body_parts = paragraphs[1:] if len(paragraphs) > 1 else []
    description_html = " ".join(body_parts)
    description = truncate(strip_html(description_html), 300)
    if not description:
        description = truncate(clean, 300)

    # Tags — extract tech keywords
    tags = extract_tech_tags(clean)

    return {
        "id": f"hn-{comment_id}",
        "company": company[:80],
        "position": extract_position(clean, company),
        "location": location[:80],
        "remote": remote or "remote" in location.lower(),
        "salary": salary,
        "description": description,
        "applyUrl": apply_url,
        "source": "HackerNews",
        "sourceUrl": f"https://news.ycombinator.com/item?id={comment_id}",
        "postedAt": posted_at,
        "tags": tags,
        "companyIcon": company_icon(company),
    }


def extract_position(text, company):
    """Try to extract a job title from the text."""
    # Common patterns in HN posts
    patterns = [
        r"(?:hiring|looking for|seeking)\s+(?:a\s+)?([A-Z][A-Za-z\s/\-&]+(?:Engineer|Developer|Architect|Designer|Manager|Lead|Scientist|Analyst|Programmer))",
        r"((?:Senior|Staff|Principal|Lead|Junior|Mid[- ]?Level|Head of)\s+[A-Za-z\s/\-&]+(?:Engineer|Developer|Architect|Designer|Manager|Scientist))",
        r"((?:Full[- ]?Stack|Front[- ]?end|Back[- ]?end|DevOps|ML|AI|Platform|Infrastructure|Software|Product)\s+(?:Engineer|Developer|Architect|Manager))",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            title = m.group(1).strip()
            # Don't return the company name as position
            if title.lower() != company.lower() and len(title) < 80:
                return title
    return "Software Engineer"


def extract_tech_tags(text):
    """Extract technology tags from text."""
    tech_keywords = {
        "react": "React", "next.js": "Next.js", "nextjs": "Next.js",
        "typescript": "TypeScript", "javascript": "JavaScript",
        "python": "Python", "rust": "Rust", "go ": "Go", "golang": "Go",
        "node.js": "Node.js", "nodejs": "Node.js",
        "postgresql": "PostgreSQL", "postgres": "PostgreSQL",
        "supabase": "Supabase", "firebase": "Firebase",
        "aws": "AWS", "gcp": "GCP", "azure": "Azure",
        "docker": "Docker", "kubernetes": "Kubernetes",
        "claude code": "Claude Code", "claude-code": "Claude Code",
        "cursor": "Cursor", "copilot": "Copilot",
        "react native": "React Native", "swift": "Swift",
        "kotlin": "Kotlin", "java ": "Java",
        "ruby": "Ruby", "rails": "Rails",
        "django": "Django", "flask": "Flask",
        "vue": "Vue.js", "angular": "Angular", "svelte": "Svelte",
        "tailwind": "Tailwind", "graphql": "GraphQL",
        "redis": "Redis", "mongodb": "MongoDB", "mysql": "MySQL",
    }
    found = []
    t = text.lower()
    for keyword, label in tech_keywords.items():
        if keyword in t and label not in found:
            found.append(label)
    return found[:10]  # Cap at 10 tags


# ---------------------------------------------------------------------------
# Source 1: HN Firebase API
# ---------------------------------------------------------------------------

def find_latest_hiring_threads():
    """Find the latest 'Who is Hiring' thread IDs via Algolia."""
    print("[1/4] Finding latest HN 'Who is Hiring' threads...")
    url = (
        "https://hn.algolia.com/api/v1/search?"
        "query=%22who%20is%20hiring%22&tags=story&hitsPerPage=6"
        f"&numericFilters=created_at_i>{int(time.time()) - 86400 * 100}"
    )
    data = fetch_json(url)
    if not data:
        return []
    threads = []
    for hit in data.get("hits", []):
        title = (hit.get("title") or "").lower()
        if "who is hiring" in title and "freelancer" not in title and "wants to be hired" not in title:
            threads.append({
                "id": int(hit["objectID"]),
                "title": hit.get("title", ""),
                "date": hit.get("created_at", ""),
            })
    print(f"  Found {len(threads)} hiring threads")
    return threads[:3]  # Last 3 months


def fetch_hn_thread_jobs(thread_id):
    """Fetch all top-level comments from a HN thread and filter for Claude jobs."""
    print(f"  Fetching thread {thread_id}...")
    thread_data = fetch_json(f"https://hacker-news.firebaseio.com/v0/item/{thread_id}.json")
    if not thread_data:
        return []

    kid_ids = thread_data.get("kids", [])
    print(f"  Thread has {len(kid_ids)} top-level comments, fetching...")

    jobs = []

    # Batch fetch comments with thread pool
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

    print(f"  Found {len(jobs)} Claude-related jobs in thread {thread_id}")
    return jobs


def collect_hn_firebase():
    """Collect jobs from HN Firebase API."""
    threads = find_latest_hiring_threads()
    all_jobs = []
    for thread in threads:
        jobs = fetch_hn_thread_jobs(thread["id"])
        # Tag jobs with the thread month
        for job in jobs:
            if not job.get("postedAt") and thread.get("date"):
                job["postedAt"] = thread["date"]
        all_jobs.extend(jobs)
        time.sleep(0.5)
    return all_jobs


# ---------------------------------------------------------------------------
# Source 2: HN Algolia API (supplementary search)
# ---------------------------------------------------------------------------

def collect_hn_algolia(existing_ids):
    """Search HN Algolia for Claude Code mentions in hiring threads."""
    print("[2/4] Searching HN Algolia for additional Claude Code mentions...")
    jobs = []

    search_terms = ["claude code", "claude-code"]
    for term in search_terms:
        url = (
            f"https://hn.algolia.com/api/v1/search?"
            f"query={quote_plus(term)}&tags=comment&hitsPerPage=50"
            f"&numericFilters=created_at_i>{int(time.time()) - 86400 * 100}"
        )
        data = fetch_json(url)
        if not data:
            continue

        for hit in data.get("hits", []):
            hn_id = f"hn-{hit.get('objectID', '')}"
            if hn_id in existing_ids:
                continue

            # Only include comments from hiring threads
            story_title = (hit.get("story_title") or "").lower()
            if "who is hiring" not in story_title:
                continue

            comment_text = hit.get("comment_text", "")
            if not is_claude_related(strip_html(comment_text)):
                continue

            # Build a minimal comment structure for the parser
            fake_comment = {
                "id": hit.get("objectID", ""),
                "text": comment_text,
                "time": hit.get("created_at_i", 0),
            }
            job = parse_hn_comment(fake_comment)
            if job:
                jobs.append(job)
                existing_ids.add(hn_id)

        time.sleep(0.5)

    print(f"  Found {len(jobs)} additional jobs via Algolia")
    return jobs


# ---------------------------------------------------------------------------
# Source 3: RemoteOK API
# ---------------------------------------------------------------------------

def collect_remoteok():
    """Collect jobs from RemoteOK API."""
    print("[3/4] Searching RemoteOK API...")
    data = fetch_json("https://remoteok.com/api")
    if not data:
        return []

    jobs = []
    for item in data[1:]:  # First element is metadata
        desc = item.get("description", "")
        tags_list = item.get("tags", [])
        tags_str = " ".join(tags_list) if isinstance(tags_list, list) else str(tags_list)
        full_text = f"{item.get('position', '')} {desc} {tags_str} {item.get('company', '')}"

        if not is_claude_related(full_text):
            continue

        slug = item.get("slug", item.get("id", ""))
        jobs.append({
            "id": f"rok-{slug}",
            "company": item.get("company", "Unknown"),
            "position": item.get("position", "Software Engineer"),
            "location": "Remote",
            "remote": True,
            "salary": extract_salary(f"{item.get('salary_min', '')} {item.get('salary_max', '')}"),
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
# Source 4: WeWorkRemotely RSS
# ---------------------------------------------------------------------------

def collect_weworkremotely():
    """Collect jobs from WeWorkRemotely RSS feed."""
    print("[4/4] Searching WeWorkRemotely RSS...")
    xml_text = fetch_text("https://weworkremotely.com/categories/remote-programming-jobs.rss")
    if not xml_text:
        return []

    jobs = []
    try:
        root = ET.fromstring(xml_text)
        for item in root.findall(".//item"):
            title = item.findtext("title", "")
            desc = item.findtext("description", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")

            full_text = f"{title} {strip_html(desc)}"
            if not is_claude_related(full_text):
                continue

            # WWR title format: "Company: Job Title"
            company_match = re.match(r"^([^:]+):\s*(.+)", title)
            company = company_match.group(1).strip() if company_match else "Remote Company"
            position = company_match.group(2).strip() if company_match else title

            jobs.append({
                "id": f"wwr-{link.rstrip('/').split('/')[-1] if link else 'unknown'}",
                "company": company[:80],
                "position": position[:120],
                "location": "Remote",
                "remote": True,
                "salary": extract_salary(full_text),
                "description": truncate(strip_html(desc), 300),
                "applyUrl": link,
                "source": "WeWorkRemotely",
                "sourceUrl": link,
                "postedAt": pub_date,
                "tags": extract_tech_tags(full_text),
                "companyIcon": company_icon(company),
            })
    except ET.ParseError as e:
        print(f"  [warn] XML parse error: {e}")

    print(f"  Found {len(jobs)} jobs from WeWorkRemotely")
    return jobs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def generate():
    print("=" * 60)
    print("Claude Code Jobs Scraper (free sources only)")
    print("=" * 60)

    all_jobs = []

    # 1. HN Firebase (primary)
    hn_jobs = collect_hn_firebase()
    all_jobs.extend(hn_jobs)

    # 2. HN Algolia (supplementary)
    existing_ids = {j["id"] for j in all_jobs}
    algolia_jobs = collect_hn_algolia(existing_ids)
    all_jobs.extend(algolia_jobs)

    # 3. RemoteOK
    rok_jobs = collect_remoteok()
    all_jobs.extend(rok_jobs)

    # 4. WeWorkRemotely
    wwr_jobs = collect_weworkremotely()
    all_jobs.extend(wwr_jobs)

    # Deduplicate by ID
    seen = set()
    unique = []
    for job in all_jobs:
        if job["id"] not in seen:
            seen.add(job["id"])
            unique.append(job)

    # Sort by postedAt descending
    unique.sort(key=lambda j: j.get("postedAt", ""), reverse=True)

    # Build output
    sources = sorted(set(j["source"] for j in unique))
    output = {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "totalJobs": len(unique),
        "sources": sources,
        "jobs": unique,
    }

    # Write to docs/
    output_path = "docs/claude-jobs.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # Also copy to dashboard/public/ if it exists
    import os
    dashboard_path = "dashboard/public/claude-jobs.json"
    if os.path.isdir("dashboard/public"):
        with open(dashboard_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"\nCopied to {dashboard_path}")

    # Summary
    print("\n" + "=" * 60)
    print(f"Total unique jobs: {len(unique)}")
    for src in sources:
        count = sum(1 for j in unique if j["source"] == src)
        print(f"  {src}: {count}")
    remote_count = sum(1 for j in unique if j.get("remote"))
    print(f"  Remote: {remote_count} / On-site: {len(unique) - remote_count}")
    print(f"\nSaved to {output_path}")
    print("=" * 60)


if __name__ == "__main__":
    generate()
