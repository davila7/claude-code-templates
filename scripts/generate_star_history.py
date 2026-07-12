#!/usr/bin/env python3
"""Generate a self-hosted "Stargazers over time" SVG chart.

GitHub now restricts the stargazers endpoint to a repository's own admins and
collaborators, so third-party live-chart services (star-history free tier,
starchart.cc, ...) return "Requires authentication" for everyone. This script
fetches the star data with an authenticated token (in CI, the repo's own
GITHUB_TOKEN works because it can read the repo's own stargazers) and renders a
static, theme-aware SVG committed to docs/star-history.svg.

Usage:
    GITHUB_TOKEN=xxx python scripts/generate_star_history.py
    # local test:
    GITHUB_TOKEN=$(gh auth token) python scripts/generate_star_history.py
"""

import os
import sys
from datetime import datetime, timezone

import requests

REPO = os.environ.get("STAR_HISTORY_REPO", "davila7/claude-code-templates")
OUTPUT = os.environ.get("STAR_HISTORY_OUTPUT", "docs/star-history.svg")
PER_PAGE = 100
MAX_PAGES = 400  # GitHub caps stargazers pagination at 400 pages (40k stars)

WIDTH, HEIGHT = 800, 400
PAD_L, PAD_R, PAD_T, PAD_B = 70, 55, 50, 55


def fetch_stargazers(token):
    """Return a sorted list of datetime objects, one per star."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.star+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "claude-code-templates-star-history",
    })

    dates = []
    for page in range(1, MAX_PAGES + 1):
        resp = session.get(
            f"https://api.github.com/repos/{REPO}/stargazers",
            params={"per_page": PER_PAGE, "page": page},
            timeout=30,
        )
        if resp.status_code != 200:
            raise SystemExit(
                f"GitHub API error {resp.status_code} on page {page}: {resp.text[:200]}"
            )
        batch = resp.json()
        if not batch:
            break
        for entry in batch:
            starred_at = entry.get("starred_at")
            if starred_at:
                dates.append(
                    datetime.strptime(starred_at, "%Y-%m-%dT%H:%M:%SZ").replace(
                        tzinfo=timezone.utc
                    )
                )
        if len(batch) < PER_PAGE:
            break

    dates.sort()
    return dates


def build_series(dates, max_points=100):
    """Cumulative (timestamp, count) points, downsampled to max_points."""
    total = len(dates)
    if total == 0:
        return []
    points = [(d, i + 1) for i, d in enumerate(dates)]
    if total <= max_points:
        return points
    step = total / max_points
    sampled = [points[int(i * step)] for i in range(max_points)]
    sampled.append(points[-1])  # always include the latest point
    return sampled


def esc(text):
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def render_svg(series, repo):
    if not series:
        raise SystemExit("No stargazer data to render.")

    t_min = series[0][0].timestamp()
    t_max = series[-1][0].timestamp()
    c_max = series[-1][1]
    t_span = max(t_max - t_min, 1)

    plot_w = WIDTH - PAD_L - PAD_R
    plot_h = HEIGHT - PAD_T - PAD_B

    def x(ts):
        return PAD_L + (ts - t_min) / t_span * plot_w

    def y(count):
        return PAD_T + plot_h - (count / c_max) * plot_h

    pts = [(x(ts.timestamp()), y(c)) for ts, c in series]
    line = " ".join(f"{px:.1f},{py:.1f}" for px, py in pts)
    area = (
        f"{PAD_L:.1f},{PAD_T + plot_h:.1f} "
        + line
        + f" {pts[-1][0]:.1f},{PAD_T + plot_h:.1f}"
    )

    # Y axis ticks (5 gridlines)
    y_ticks = []
    for i in range(5):
        val = round(c_max * i / 4)
        y_ticks.append((y(val), val))

    # X axis ticks (dates)
    x_ticks = []
    for i in range(5):
        ts = t_min + t_span * i / 4
        label = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%b %Y")
        x_ticks.append((x(ts), label))

    grid_lines = ""
    for gy, val in y_ticks:
        grid_lines += (
            f'<line x1="{PAD_L}" y1="{gy:.1f}" x2="{WIDTH - PAD_R}" y2="{gy:.1f}" '
            f'class="grid"/>\n'
            f'<text x="{PAD_L - 10}" y="{gy + 4:.1f}" text-anchor="end" '
            f'class="tick">{val:,}</text>\n'
        )
    x_labels = ""
    for gx, label in x_ticks:
        x_labels += (
            f'<text x="{gx:.1f}" y="{HEIGHT - PAD_B + 22}" text-anchor="middle" '
            f'class="tick">{esc(label)}</text>\n'
        )

    updated = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">
  <style>
    .bg {{ fill: #ffffff; }}
    .title {{ fill: #1f2328; font-size: 17px; font-weight: 600; }}
    .subtitle {{ fill: #656d76; font-size: 11px; }}
    .grid {{ stroke: #d0d7de; stroke-width: 1; stroke-dasharray: 3 3; }}
    .axis {{ stroke: #656d76; stroke-width: 1.5; }}
    .tick {{ fill: #656d76; font-size: 11px; }}
    .area {{ fill: #ffd33d; opacity: 0.18; }}
    .line {{ stroke: #f0b400; stroke-width: 2.5; fill: none; stroke-linejoin: round; stroke-linecap: round; }}
    .dot {{ fill: #f0b400; }}
    @media (prefers-color-scheme: dark) {{
      .bg {{ fill: #0d1117; }}
      .title {{ fill: #e6edf3; }}
      .subtitle {{ fill: #8b949e; }}
      .grid {{ stroke: #30363d; }}
      .axis {{ stroke: #8b949e; }}
      .tick {{ fill: #8b949e; }}
    }}
  </style>
  <rect class="bg" width="{WIDTH}" height="{HEIGHT}" rx="6"/>
  <text x="{PAD_L}" y="26" class="title">Stargazers over time</text>
  <text x="{PAD_L}" y="42" class="subtitle">{esc(repo)} · {c_max:,} stars · updated {updated}</text>
{grid_lines}
  <line x1="{PAD_L}" y1="{PAD_T}" x2="{PAD_L}" y2="{PAD_T + plot_h}" class="axis"/>
  <line x1="{PAD_L}" y1="{PAD_T + plot_h}" x2="{WIDTH - PAD_R}" y2="{PAD_T + plot_h}" class="axis"/>
  <polygon class="area" points="{area}"/>
  <polyline class="line" points="{line}"/>
  <circle class="dot" cx="{pts[-1][0]:.1f}" cy="{pts[-1][1]:.1f}" r="4"/>
{x_labels}
</svg>
'''


def main():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit("GITHUB_TOKEN is required (repo read access to stargazers).")

    print(f"Fetching stargazers for {REPO} ...", file=sys.stderr)
    dates = fetch_stargazers(token)
    print(f"Got {len(dates)} stars.", file=sys.stderr)

    series = build_series(dates)
    svg = render_svg(series, REPO)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as fh:
        fh.write(svg)
    print(f"Wrote {OUTPUT} ({len(svg)} bytes).", file=sys.stderr)


if __name__ == "__main__":
    main()
