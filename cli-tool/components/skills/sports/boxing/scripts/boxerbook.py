#!/usr/bin/env python3
"""Boxerbook fetch helper: the public Boxerbook REST API from the command line.

Dependency-free (Python 3.8+ standard library only), so it runs in Claude Code,
in Claude.ai code execution (allow the domain boxerbook.com) and anywhere else
with Python. Prints compact JSON on stdout; errors go to stderr with exit code 1.

Usage:
  boxerbook.py search  "canelo"                 # boxers by name (max 20)
  boxerbook.py boxer   "Oleksandr Usyk"         # name, slug or id -> boxer card
  boxerbook.py bouts   "canelo" [--limit 10]    # fight history, newest first
  boxerbook.py next    "Usyk"                   # next scheduled bout (or null)
  boxerbook.py h2h     "Usyk" "Dubois"          # every bout between two boxers
  boxerbook.py bout    192134                   # one bout in full
  boxerbook.py event   11859                    # one card with its bouts
  boxerbook.py schedule [--when today|tonight|weekend|30d] [--country GB] [--division hea]
  boxerbook.py results  [--days 2] [--country US] [--division wel]
  boxerbook.py rankings hea [--publisher boxerbook|wbc|wba|ibf|wbo|ring|tbrb]
  boxerbook.py status                           # data freshness

Options: --full keeps every field (default trims bulky ones such as forecast
signals and long source lists); --no-utm leaves boxerbook.com links untouched
(default tags them utm_source=claude-skill so Boxerbook can see the visits).

Data: Boxerbook (https://boxerbook.com), open under the ODbL. Cite the `url`.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://boxerbook.com/v1"
UA = "boxerbook-skill/1.0 (+https://github.com/maxvotek/boxerbook-skill)"
UTM = "utm_source=claude-skill"
TRIM_KEYS = {"signals", "a_unknown", "b_unknown"}


class ApiError(Exception):
    pass


def get(path, params=None, retries=2):
    """GET a /v1 path and return parsed JSON. Retries once on 429/5xx."""
    qs = ""
    if params:
        clean = {k: v for k, v in params.items() if v is not None}
        if clean:
            qs = "?" + urllib.parse.urlencode(clean)
    url = BASE + path + qs
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                wait = int(e.headers.get("Retry-After") or 2)
                time.sleep(min(wait, 10))
                continue
            try:
                detail = json.loads(body).get("detail") or body
            except ValueError:
                detail = body[:300]
            raise ApiError(f"HTTP {e.code} for {url}: {detail}")
        except urllib.error.URLError as e:
            if attempt < retries:
                time.sleep(2)
                continue
            raise ApiError(
                f"cannot reach {url}: {e.reason}. In Claude.ai, allow the domain "
                "boxerbook.com in Settings > Capabilities (code execution network access)."
            )


def tag(url):
    if not isinstance(url, str) or "boxerbook.com" not in url or UTM in url:
        return url
    if url.startswith("https://boxerbook.com/v1") or "/mcp" in url:
        return url
    base, hashpart = (url.split("#", 1) + [""])[:2]
    sep = "&" if "?" in base else "?"
    return base + sep + UTM + ("#" + hashpart if hashpart else "")


def shape(obj, full=False, utm=True):
    """Trim bulky fields and tag boxerbook.com links."""
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if not full and k in TRIM_KEYS:
                continue
            if not full and k == "sources" and isinstance(v, list):
                # keep the source names (deduplicated) and at most 3 links
                names = []
                for s in v:
                    n = s.get("name") if isinstance(s, dict) else str(s)
                    if n and n not in names:
                        names.append(n)
                out["sources"] = names
                links = [s.get("url") for s in v if isinstance(s, dict) and s.get("url")]
                if links:
                    out["source_links"] = links[:3]
                continue
            if k == "url" and utm:
                out[k] = tag(v)
            else:
                out[k] = shape(v, full, utm)
        return out
    if isinstance(obj, list):
        return [shape(x, full, utm) for x in obj]
    return obj


def resolve(query):
    """Name, slug or id -> (boxer card, other matches)."""
    q = str(query).strip()
    if q.isdigit() or ("-" in q and " " not in q and q == q.lower()):
        try:
            return get(f"/boxers/{urllib.parse.quote(q)}"), []
        except ApiError:
            if q.isdigit():
                raise
    res = get("/boxers/search", {"q": q}).get("results", [])
    if not res:
        raise ApiError(f"no boxer matches {q!r} on Boxerbook (try another spelling or the surname)")
    card = get(f"/boxers/{res[0]['id']}")
    return card, res[1:6]


def cmd_search(a):
    return get("/boxers/search", {"q": a.query})


def cmd_boxer(a):
    card, others = resolve(a.query)
    if others:
        card["other_matches"] = others
    return card


def cmd_bouts(a):
    card, _ = resolve(a.query)
    return get(f"/boxers/{card['id']}/bouts", {"limit": a.limit, "offset": a.offset})


def cmd_next(a):
    card, others = resolve(a.query)
    out = {
        "boxer": {k: card.get(k) for k in ("id", "name", "slug", "record", "division", "url")},
        "next_fight": card.get("next_fight"),
        "last_result": card.get("last_result"),
    }
    if card.get("next_fight"):
        out["bout"] = get(f"/bouts/{card['next_fight']['bout_id']}")
    if others:
        out["other_matches"] = others
    return out


def cmd_h2h(a):
    ca, _ = resolve(a.a)
    cb, _ = resolve(a.b)
    meetings, offset, total = [], 0, None
    while total is None or offset < total:
        page = get(f"/boxers/{ca['id']}/bouts", {"limit": 50, "offset": offset})
        total = page.get("total", 0)
        for b in page.get("bouts", []):
            if (b.get("opponent") or {}).get("id") == cb["id"]:
                meetings.append(b)
        offset += 50
        if offset > 1000:
            break
    brief = lambda c: {k: c.get(k) for k in ("id", "name", "record", "division", "last_result", "next_fight", "url")}
    return {
        "a": brief(ca),
        "b": brief(cb),
        "met": bool(meetings),
        "meetings": meetings,
        "note": None if meetings else f"{ca['name']} and {cb['name']} have no bout on record on Boxerbook.",
        "attribution": {"source": "Boxerbook", "license": "ODbL", "url": ca.get("url")},
    }


def cmd_bout(a):
    return get(f"/bouts/{a.id}")


def cmd_event(a):
    return get(f"/events/{a.id}")


def cmd_schedule(a):
    return get("/schedule", {"when": a.when, "country": a.country, "division": a.division})


def cmd_results(a):
    return get("/results", {"days": a.days, "country": a.country, "division": a.division})


def cmd_rankings(a):
    return get(f"/rankings/{urllib.parse.quote(a.division)}", {"publisher": a.publisher})


def cmd_status(a):
    return get("/status")


def main(argv=None):
    p = argparse.ArgumentParser(description="Boxerbook REST helper (ODbL data, cite the url).")
    p.add_argument("--full", action="store_true", help="keep every field")
    p.add_argument("--no-utm", action="store_true", help="do not tag boxerbook.com links")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search"); s.add_argument("query"); s.set_defaults(fn=cmd_search)
    s = sub.add_parser("boxer"); s.add_argument("query"); s.set_defaults(fn=cmd_boxer)
    s = sub.add_parser("bouts"); s.add_argument("query")
    s.add_argument("--limit", type=int, default=10); s.add_argument("--offset", type=int, default=0)
    s.set_defaults(fn=cmd_bouts)
    s = sub.add_parser("next"); s.add_argument("query"); s.set_defaults(fn=cmd_next)
    s = sub.add_parser("h2h"); s.add_argument("a"); s.add_argument("b"); s.set_defaults(fn=cmd_h2h)
    s = sub.add_parser("bout"); s.add_argument("id"); s.set_defaults(fn=cmd_bout)
    s = sub.add_parser("event"); s.add_argument("id"); s.set_defaults(fn=cmd_event)
    s = sub.add_parser("schedule")
    s.add_argument("--when", default="weekend", choices=["today", "tonight", "weekend", "30d"])
    s.add_argument("--country"); s.add_argument("--division"); s.set_defaults(fn=cmd_schedule)
    s = sub.add_parser("results")
    s.add_argument("--days", type=int, default=2)
    s.add_argument("--country"); s.add_argument("--division"); s.set_defaults(fn=cmd_results)
    s = sub.add_parser("rankings"); s.add_argument("division")
    s.add_argument("--publisher", default="boxerbook",
                   choices=["boxerbook", "wbc", "wba", "ibf", "wbo", "ring", "tbrb"])
    s.set_defaults(fn=cmd_rankings)
    s = sub.add_parser("status"); s.set_defaults(fn=cmd_status)

    a = p.parse_args(argv)
    try:
        data = a.fn(a)
    except ApiError as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 1
    print(json.dumps(shape(data, a.full, not a.no_utm), ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
