#!/usr/bin/env python3
"""Triage grader for skill components (the cheap, deterministic half of the
skill-improvement loop).

This is NOT the final quality judge. It is a fast, token-free pre-filter that
scores every skill against a heuristic rubric so the loop can pick the N skills
most in need of work *before* spending any LLM tokens. The real LLM rubric grade
(and the actual rewrite) is done afterwards by the Claude managed agent running
the `component-researcher` -> `component-improver` agents on the shortlist.

What it does:
  * Discovers skill directories under cli-tool/components/skills/ (a dir that
    directly contains a SKILL.md), reusing the same convention as
    skillspector_scan.py.
  * Scores each skill 0-100 against a structural rubric (frontmatter, description
    quality, examples, body depth) and applies penalties for deprecated patterns
    and absolute paths.
  * Optionally folds in SkillSpector findings from an aggregated SARIF file so the
    security signal raises a skill's improvement priority.
  * Ranks skills by improvement priority and emits:
      - a JSON shortlist (machine-readable, consumed by the workflow)
      - a Markdown report (for the run summary / issue body)
      - GitHub Action outputs (candidate_count, candidates_json)

Stdlib only, runs on Python 3.9+ so it can be exercised locally without any
dependency. Use --dry-run to list discovered skills without scoring.

Usage:
    skill_rubric_grade.py --all --top 5 --output-json shortlist.json
    skill_rubric_grade.py --category git --top 3 --output-md report.md
    skill_rubric_grade.py --all --skillspector-sarif skillspector.sarif --top 5
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

# Repo-relative root that holds every skill component.
SKILLS_ROOT = Path("cli-tool/components/skills")

# Accepted manifest filenames (case variants seen in the catalog).
MANIFEST_NAMES = {"skill.md"}

# Patterns that signal a skill is using outdated guidance.
DEPRECATED_PATTERNS = re.compile(
    r"\b(claude-2|claude-instant|claude-3(?:-|\b)|gpt-3\.5|text-davinci|davinci-00)",
    re.IGNORECASE,
)

# Absolute paths should never appear in a portable component.
ABSOLUTE_PATH_PATTERNS = re.compile(r"(/Users/|/home/|/root/|[A-Za-z]:\\\\)")

# Cues that a description tells the model *when* to use the skill.
TRIGGER_CUES = re.compile(
    r"(use when|usage|should be used|when you|trigger|invoke|/[a-z][\w-]+)",
    re.IGNORECASE,
)


def _has_manifest(directory: Path) -> bool:
    try:
        for entry in directory.iterdir():
            if entry.is_file() and entry.name.lower() in MANIFEST_NAMES:
                return True
    except OSError:
        return False
    return False


def discover_all_skills(root: Path = SKILLS_ROOT) -> list[Path]:
    """Find every skill directory (one that directly contains a SKILL.md)."""
    if not root.is_dir():
        return []
    skills: list[Path] = []
    for dirpath, _dirnames, filenames in os.walk(root):
        if any(name.lower() in MANIFEST_NAMES for name in filenames):
            skills.append(Path(dirpath))
    return sorted(set(skills))


def _manifest_path(skill_dir: Path) -> Path | None:
    for entry in skill_dir.iterdir():
        if entry.is_file() and entry.name.lower() in MANIFEST_NAMES:
            return entry
    return None


def _split_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Return (frontmatter dict, body).

    Minimal YAML parsing that handles single-line scalars and block scalars
    (``key: |`` / ``key: >``) so multi-line descriptions are not mistaken for
    empty ones.
    """
    fm: dict[str, str] = {}
    body = text
    if not text.startswith("---"):
        return fm, body
    end = text.find("\n---", 3)
    if end == -1:
        return fm, body
    block = text[3:end].strip("\n")
    body = text[end + 4 :]

    lines = block.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        # Skip comments, blank lines, and indented continuation lines that are
        # not the start of a new top-level key.
        if not stripped or stripped.startswith("#") or line[:1] in (" ", "\t"):
            i += 1
            continue
        if ":" not in line:
            i += 1
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()
        if value in ("|", ">", "|-", ">-", "|+", ">+"):
            # Block scalar: collect subsequent indented lines.
            collected: list[str] = []
            i += 1
            while i < len(lines) and (lines[i][:1] in (" ", "\t") or not lines[i].strip()):
                collected.append(lines[i].strip())
                i += 1
            fm[key] = " ".join(c for c in collected if c).strip()
            continue
        fm[key] = value.strip("\"'")
        i += 1
    return fm, body


def _scaled(value: float, lo: float, hi: float, points: float) -> float:
    """Linearly scale value in [lo, hi] to [0, points], clamped."""
    if value <= lo:
        return 0.0
    if value >= hi:
        return points
    return round(points * (value - lo) / (hi - lo), 1)


def grade_skill(skill_dir: Path) -> dict:
    """Score a single skill against the structural rubric (0-100)."""
    manifest = _manifest_path(skill_dir)
    rel = str(skill_dir).replace("\\", "/")
    if manifest is None:
        return {
            "path": rel,
            "name": skill_dir.name,
            "quality_score": 0,
            "reasons": ["No SKILL.md found"],
            "security_findings": 0,
        }

    text = manifest.read_text(encoding="utf-8", errors="replace")
    fm, body = _split_frontmatter(text)
    reasons: list[str] = []
    score = 0.0

    name = fm.get("name", "").strip()
    description = fm.get("description", "").strip()

    # name present (10)
    if name:
        score += 10
    else:
        reasons.append("Missing frontmatter `name`")

    # description present (10)
    if description:
        score += 10
    else:
        reasons.append("Missing frontmatter `description`")

    # description length: ideal 40-600 chars (20)
    dlen = len(description)
    if description:
        if dlen < 40:
            reasons.append(f"Description very short ({dlen} chars)")
            score += _scaled(dlen, 0, 40, 20)
        elif dlen > 600:
            reasons.append(f"Description very long ({dlen} chars)")
            score += 12
        else:
            score += 20

    # description has a trigger/usage cue (10)
    if description and TRIGGER_CUES.search(description):
        score += 10
    elif description:
        reasons.append("Description lacks a clear trigger / usage cue")

    # body has >= 2 markdown headings (15)
    headings = len(re.findall(r"(?m)^#{1,6}\s", body))
    if headings >= 2:
        score += 15
    else:
        reasons.append(f"Only {headings} markdown heading(s) in body")
        score += _scaled(headings, 0, 2, 15)

    # body has a code example or explicit example/usage section (15)
    has_code = "```" in body
    has_example_word = re.search(r"(?i)\b(example|usage)\b", body) is not None
    if has_code:
        score += 15
    elif has_example_word:
        score += 8
        reasons.append("Has an example section but no code block")
    else:
        reasons.append("No code examples or usage section")

    # body depth: >= 400 chars (20)
    blen = len(body.strip())
    if blen >= 400:
        score += 20
    else:
        reasons.append(f"Thin body ({blen} chars)")
        score += _scaled(blen, 80, 400, 20)

    # penalties
    if DEPRECATED_PATTERNS.search(text):
        score -= 10
        reasons.append("References deprecated model IDs")
    if ABSOLUTE_PATH_PATTERNS.search(text):
        score -= 10
        reasons.append("Contains absolute paths")

    score = max(0, min(100, round(score)))

    return {
        "path": rel,
        "manifest": str(manifest).replace("\\", "/"),
        "name": name or skill_dir.name,
        "quality_score": score,
        "reasons": reasons or ["No structural issues detected"],
        "security_findings": 0,
    }


def load_skillspector_findings(sarif_path: Path) -> dict[str, int]:
    """Parse an aggregated SARIF file -> {normalized_path: finding_count}."""
    counts: dict[str, int] = {}
    try:
        data = json.loads(sarif_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return counts
    for run in data.get("runs", []):
        for result in run.get("results", []):
            for loc in result.get("locations", []):
                uri = (
                    loc.get("physicalLocation", {})
                    .get("artifactLocation", {})
                    .get("uri", "")
                )
                if not uri:
                    continue
                norm = uri.replace("\\", "/").lstrip("./")
                counts[norm] = counts.get(norm, 0) + 1
    return counts


def _attach_security(graded: list[dict], findings: dict[str, int]) -> None:
    """Fold SkillSpector finding counts into each graded skill in-place."""
    for g in graded:
        prefix = g["path"].lstrip("./")
        hits = 0
        for uri, count in findings.items():
            if uri.startswith(prefix):
                hits += count
        g["security_findings"] = hits
        if hits:
            g["reasons"].append(f"SkillSpector findings: {hits}")


def improvement_priority(g: dict) -> int:
    """Higher = more in need of improvement."""
    return (100 - g["quality_score"]) + g["security_findings"] * 5


def render_markdown(shortlist: list[dict], total: int) -> str:
    lines = [
        "## 🔁 Skill Improvement Loop — triage report",
        "",
        f"Scanned **{total}** skills. Showing the **{len(shortlist)}** with the "
        "lowest structural quality (highest improvement priority).",
        "",
        "| # | Skill | Quality | Security | Priority | Top issue |",
        "|---|-------|:-------:|:--------:|:--------:|-----------|",
    ]
    for i, g in enumerate(shortlist, 1):
        top_issue = g["reasons"][0] if g["reasons"] else "—"
        lines.append(
            f"| {i} | `{g['path']}` | {g['quality_score']}/100 | "
            f"{g['security_findings']} | {improvement_priority(g)} | {top_issue} |"
        )
    lines += [
        "",
        "> This is a cheap heuristic triage. The Claude managed agent applies the "
        "full LLM rubric and opens a draft PR per skill.",
    ]
    return "\n".join(lines) + "\n"


def _set_output(name: str, value: str) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if not out:
        return
    with open(out, "a", encoding="utf-8") as fh:
        if "\n" in value:
            delim = "EOF_RUBRIC"
            fh.write(f"{name}<<{delim}\n{value}\n{delim}\n")
        else:
            fh.write(f"{name}={value}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument("--all", action="store_true", help="Grade every skill.")
    scope.add_argument(
        "--category", help="Grade only skills under this category dir."
    )
    parser.add_argument("--top", type=int, default=5, help="Shortlist size.")
    parser.add_argument(
        "--max-quality",
        type=int,
        default=100,
        help="Only shortlist skills scoring at or below this quality.",
    )
    parser.add_argument(
        "--skillspector-sarif",
        help="Optional aggregated SARIF from skillspector_scan.py.",
    )
    parser.add_argument("--output-json", default="skill-shortlist.json")
    parser.add_argument("--output-md", default="skill-rubric-report.md")
    parser.add_argument(
        "--dry-run", action="store_true", help="List discovered skills and exit."
    )
    args = parser.parse_args()

    if args.category:
        root = SKILLS_ROOT / args.category
        skills = discover_all_skills(root)
    else:
        skills = discover_all_skills()

    if not skills:
        print("No skills found.", file=sys.stderr)
        _set_output("candidate_count", "0")
        return 0

    if args.dry_run:
        for s in skills:
            print(s)
        print(f"\n{len(skills)} skill(s) discovered.", file=sys.stderr)
        return 0

    graded = [grade_skill(s) for s in skills]

    if args.skillspector_sarif and Path(args.skillspector_sarif).is_file():
        findings = load_skillspector_findings(Path(args.skillspector_sarif))
        _attach_security(graded, findings)

    graded.sort(key=improvement_priority, reverse=True)
    eligible = [g for g in graded if g["quality_score"] <= args.max_quality]
    shortlist = eligible[: args.top]

    Path(args.output_json).write_text(
        json.dumps(shortlist, indent=2), encoding="utf-8"
    )
    Path(args.output_md).write_text(
        render_markdown(shortlist, len(graded)), encoding="utf-8"
    )

    _set_output("candidate_count", str(len(shortlist)))
    _set_output(
        "candidates_json",
        json.dumps([g["path"] for g in shortlist]),
    )

    print(render_markdown(shortlist, len(graded)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
