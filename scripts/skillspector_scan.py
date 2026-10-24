#!/usr/bin/env python3
"""Batch-orchestrate SkillSpector scans over skill components.

Discovers skill directories under cli-tool/components/skills/, runs the
SkillSpector CLI (`skillspector scan <dir> --no-llm --format json`) on each,
aggregates the per-skill JSON reports, and emits:

  * a Markdown summary (for PR comments / step summaries)
  * an aggregated SARIF 2.1.0 log (for GitHub code scanning)
  * GitHub Action outputs (failed, high_critical_count, scanned, errors)

SkillSpector itself requires Python 3.12+, but this orchestrator only uses the
standard library and runs on 3.9+ so the discovery logic can be exercised
locally without installing the scanner (see --dry-run).

Usage:
    skillspector_scan.py --all
    skillspector_scan.py --changed --base-ref origin/main
    skillspector_scan.py --changed --compare-base --fail-on-risk
    skillspector_scan.py --all --dry-run            # list dirs, no scanning

With --compare-base each changed skill is also scanned as it is on the merge
base, and --fail-on-risk only fails when a skill is above the threshold AND
its score went up. A skill that already scored high on main can still be
edited (frontmatter cleanups, renames) without being blocked for findings it
already had; a new skill counts as base score 0.

The CLI exit code of `skillspector scan` is intentionally ignored: it returns
1 when a skill's risk score is high (a signal, not a failure) and 2 on real
errors. We parse stdout JSON and classify per-skill instead, so one broken
skill never aborts the whole batch.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

# Repo-relative root that holds every skill component.
SKILLS_ROOT = Path("cli-tool/components/skills")

# Accepted manifest filenames (case variants seen in the catalog).
MANIFEST_NAMES = {"skill.md"}

# Risk score above which a skill is considered HIGH/CRITICAL.
DEFAULT_THRESHOLD = 50

# Keep PR comments under GitHub's ~65k character limit.
MAX_COMMENT_CHARS = 60000

# Marker so the PR comment can be found and updated idempotently.
COMMENT_MARKER = "<!-- skillspector-report:v1 -->"


def _has_manifest(directory: Path) -> bool:
    """Return True if directory directly contains a SKILL.md (any case)."""
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


def _changed_files(base_ref: str) -> list[Path]:
    """Return repo-relative paths changed vs base_ref (three-dot diff)."""
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", f"{base_ref}...HEAD"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    except subprocess.CalledProcessError:
        # Fall back to two-dot if the merge base is unavailable (shallow clone).
        out = subprocess.run(
            ["git", "diff", "--name-only", base_ref],
            capture_output=True,
            text=True,
            check=False,
        ).stdout
    return [Path(line.strip()) for line in out.splitlines() if line.strip()]


def _merge_base(base_ref: str) -> str:
    """Commit the PR diverged from; falls back to base_ref (shallow clone)."""
    proc = subprocess.run(
        ["git", "merge-base", base_ref, "HEAD"],
        capture_output=True,
        text=True,
        check=False,
    )
    return proc.stdout.strip() if proc.returncode == 0 and proc.stdout.strip() else base_ref


def _renamed_files(base_ref: str) -> dict[Path, Path]:
    """Map new path -> old path for files renamed vs base_ref."""
    proc = subprocess.run(
        ["git", "diff", "--name-status", "-M", f"{base_ref}...HEAD"],
        capture_output=True,
        text=True,
        check=False,
    )
    renames: dict[Path, Path] = {}
    for line in proc.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) == 3 and parts[0].startswith("R"):
            renames[Path(parts[2])] = Path(parts[1])
    return renames


def _exists_at(commit: str, path: Path) -> bool:
    return subprocess.run(
        ["git", "cat-file", "-e", f"{commit}:{path.as_posix()}"],
        capture_output=True,
        check=False,
    ).returncode == 0


def base_path_for(directory: Path, renames: dict[Path, Path], commit: str) -> Path:
    """Where a skill dir lived on the base ref.

    The same path wins whenever it already holds a skill there. Otherwise the
    dir counts as renamed only if its own manifest was renamed into it, so a
    single auxiliary file moved in from another skill never lends that
    skill's base score.
    """
    if any(_exists_at(commit, directory / name) for name in ("SKILL.md", "skill.md")):
        return directory
    for new, old in renames.items():
        if new.parent == directory and new.name.lower() in MANIFEST_NAMES:
            return old.parent
    return directory


def extract_base_skill(commit: str, directory: Path, dest: Path) -> Path | None:
    """Write the base-ref copy of a skill dir under dest; None if absent there."""
    proc = subprocess.run(
        ["git", "archive", "--format=tar", commit, "--", f"{directory.as_posix()}/"],
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0 or not proc.stdout:
        return None
    tar_path = dest / "base.tar"
    tar_path.write_bytes(proc.stdout)
    with tarfile.open(tar_path) as tar:
        # git archive output is trusted (our own history); still refuse
        # anything that would land outside dest.
        for member in tar.getmembers():
            target = (dest / member.name).resolve()
            if dest.resolve() not in target.parents and target != dest.resolve():
                return None
        tar.extractall(dest)
    tar_path.unlink()
    extracted = dest / directory
    return extracted if _has_manifest(extracted) else None


def attach_base_scores(results: list[dict], base_ref: str) -> None:
    """Scan each result's skill as it is on the merge base; set base_score."""
    commit = _merge_base(base_ref)
    renames = _renamed_files(base_ref)
    for res in results:
        if res.get("status") != "ok":
            continue
        old_dir = base_path_for(Path(res["path"]), renames, commit)
        with tempfile.TemporaryDirectory() as tmp:
            extracted = extract_base_skill(commit, old_dir, Path(tmp))
            if extracted is None:
                res["base_score"] = None  # new skill
                continue
            base = scan_skill(extracted)
        if base.get("status") == "ok":
            res["base_score"] = base["score"]
        else:
            # Fail closed: an unscannable base can't prove the score didn't rise.
            res["base_score"] = None
            res["base_error"] = base.get("error", "base scan failed")


def blocks(result: dict, threshold: int) -> bool:
    """A scanned skill blocks when above threshold and higher than before.

    Without a base comparison (no base_score key) every skill above the
    threshold blocks, as before.
    """
    if result.get("status") != "ok" or result["score"] <= threshold:
        return False
    if "base_score" not in result:
        return True
    if result.get("base_error"):
        return True
    return result["score"] > (result["base_score"] or 0)


def discover_changed_skills(base_ref: str, root: Path = SKILLS_ROOT) -> list[Path]:
    """Map changed files under the skills tree to their owning skill dirs."""
    changed = _changed_files(base_ref)
    skills: set[Path] = set()
    root_resolved = root.resolve()
    for rel in changed:
        # Only consider files under the skills tree.
        try:
            rel.resolve().relative_to(root_resolved)
        except ValueError:
            if root not in rel.parents and rel != root:
                continue
        # Walk up from the file's directory until we find the skill dir.
        current = (rel if rel.is_dir() else rel.parent)
        while True:
            if current == root or current == Path("."):
                break
            if current.is_dir() and _has_manifest(current):
                skills.add(current)
                break
            # Stop once we climb above the skills root.
            if root not in current.parents:
                break
            current = current.parent
    return sorted(skills)


def scan_skill(directory: Path) -> dict:
    """Run skillspector on one skill dir; return a normalized result dict."""
    result: dict = {"path": str(directory), "status": "ok"}
    try:
        proc = subprocess.run(
            [
                "skillspector",
                "scan",
                str(directory),
                "--no-llm",
                "--format",
                "json",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        result["status"] = "error"
        result["error"] = "skillspector CLI not found on PATH"
        return result

    # Exit code 2 == real error. 0/1 are both valid (1 == high score).
    if proc.returncode == 2:
        result["status"] = "error"
        result["error"] = (proc.stderr or proc.stdout or "scan failed").strip()[:500]
        return result

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        result["status"] = "error"
        result["error"] = "could not parse skillspector JSON output"
        result["raw"] = (proc.stdout or proc.stderr or "")[:500]
        return result

    risk = data.get("risk_assessment", {})
    result["name"] = (data.get("skill") or {}).get("name") or directory.name
    result["score"] = int(risk.get("score") or 0)
    result["severity"] = (risk.get("severity") or "LOW").upper()
    result["recommendation"] = risk.get("recommendation") or "SAFE"
    result["issues"] = data.get("issues") or []
    result["report"] = data
    return result


def _rule_id(issue: dict) -> str:
    return str(issue.get("id") or issue.get("rule_id") or "UNKNOWN")


def _issue_message(issue: dict) -> str:
    pattern = str(issue.get("pattern") or "").strip()
    finding = str(issue.get("finding") or issue.get("message") or "").strip()
    text = f"{pattern}: {finding}" if pattern and finding else pattern or finding
    return text or _rule_id(issue)


def _aggregate_sarif(results: list[dict]) -> dict:
    """Merge per-skill SARIF-equivalent findings into one SARIF 2.1.0 log."""
    sarif_results: list[dict] = []
    severity_to_level = {
        "CRITICAL": "error",
        "HIGH": "error",
        "MEDIUM": "warning",
        "LOW": "note",
    }
    for res in results:
        if res.get("status") != "ok":
            continue
        skill_dir = res["path"].rstrip("/")
        for issue in res.get("issues", []):
            # SkillSpector 2.x nests file/lines under "location".
            loc = issue.get("location") or {}
            file_rel = loc.get("file") or issue.get("file") or ""
            # Prefix the issue's file (relative to the skill dir) with the
            # repo-relative skill dir so code scanning links resolve.
            if file_rel and not file_rel.startswith(skill_dir):
                uri = f"{skill_dir}/{file_rel.lstrip('./')}"
            else:
                uri = file_rel or skill_dir
            severity = (issue.get("severity") or "LOW").upper()
            region: dict = {}
            start = loc.get("start_line") or issue.get("start_line")
            end = loc.get("end_line") or issue.get("end_line")
            if start:
                region["startLine"] = start
            if end:
                region["endLine"] = end
            location = {"physicalLocation": {"artifactLocation": {"uri": uri}}}
            if region:
                location["physicalLocation"]["region"] = region
            sarif_results.append(
                {
                    "ruleId": _rule_id(issue),
                    "level": severity_to_level.get(severity, "note"),
                    "message": {"text": _issue_message(issue)},
                    "locations": [location],
                }
            )
    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "skillspector",
                        "informationUri": "https://github.com/NVIDIA/skillspector",
                        "rules": [],
                    }
                },
                "results": sarif_results,
            }
        ],
    }


def _severity_emoji(severity: str) -> str:
    return {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🔴", "CRITICAL": "🔴"}.get(severity, "")


def build_markdown(results: list[dict], threshold: int) -> str:
    """Produce the PR-comment Markdown summary."""
    scanned = [r for r in results if r.get("status") == "ok"]
    errors = [r for r in results if r.get("status") == "error"]
    flagged = sorted(
        [r for r in scanned if r["score"] > threshold],
        key=lambda r: r["score"],
        reverse=True,
    )
    high_critical = len(flagged)
    compared = any("base_score" in r for r in scanned)
    blocking = [r for r in flagged if blocks(r, threshold)]

    sev_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for r in scanned:
        sev_counts[r["severity"]] = sev_counts.get(r["severity"], 0) + 1

    if compared:
        status = "❌ SCORE ROSE ABOVE THRESHOLD" if blocking else "✅ PASSED"
        emoji = "⚠️" if blocking else "🎉"
    else:
        status = "❌ ISSUES FOUND" if high_critical else "✅ PASSED"
        emoji = "⚠️" if high_critical else "🎉"

    lines = [COMMENT_MARKER]
    lines.append(f"## {emoji} SkillSpector Security Scan")
    lines.append("")
    lines.append(
        "Static analysis (`--no-llm`) by "
        "[SkillSpector](https://github.com/NVIDIA/skillspector) (NVIDIA, Apache-2.0)."
    )
    lines.append("")
    lines.append(f"**Status:** {status}")
    lines.append("")
    lines.append("| Metric | Count |")
    lines.append("|--------|-------|")
    lines.append(f"| Skills scanned | {len(scanned)} |")
    lines.append(f"| 🔴 HIGH/CRITICAL (score > {threshold}) | {high_critical} |")
    if compared:
        lines.append(f"| ⛔ Blocking (above threshold and score rose) | {len(blocking)} |")
    lines.append(f"| 🟡 MEDIUM | {sev_counts['MEDIUM']} |")
    lines.append(f"| 🟢 LOW / clean | {sev_counts['LOW']} |")
    if errors:
        lines.append(f"| ⚠️ Scan errors | {len(errors)} |")
    lines.append("")

    if flagged:
        lines.append("### 🔴 Flagged skills")
        lines.append("")
        if compared:
            lines.append(
                "A skill blocks only when its score is above the threshold and higher "
                "than on the base branch; one that already scored this high keeps the "
                "findings it had and does not block."
            )
            lines.append("")
            lines.append("| Skill | Score | Base | Blocks | Severity | Issues | Top findings |")
            lines.append("|-------|-------|------|--------|----------|--------|--------------|")
        else:
            lines.append("| Skill | Score | Severity | Recommendation | Issues | Top findings |")
            lines.append("|-------|-------|----------|----------------|--------|--------------|")
        # Blocking rows first so the row limit never hides why the check failed.
        if compared:
            flagged = sorted(flagged, key=lambda r: not blocks(r, threshold))
        for r in flagged[:30]:
            top_rules = ", ".join(
                sorted({_rule_id(i) for i in r.get("issues", [])})[:5]
            )
            rec = str(r.get("recommendation", "")).replace("_", " ")
            sev = f"{_severity_emoji(r['severity'])} {r['severity']}"
            if compared:
                if r.get("base_error"):
                    base = "scan error"
                elif r.get("base_score") is None:
                    base = "new"
                else:
                    base = str(r["base_score"])
                lines.append(
                    f"| `{r['name']}` | {r['score']}/100 | {base} | "
                    f"{'⛔ yes' if blocks(r, threshold) else 'no'} | {sev} | "
                    f"{len(r.get('issues', []))} | {top_rules} |"
                )
            else:
                lines.append(
                    f"| `{r['name']}` | {r['score']}/100 | {sev} | {rec} | "
                    f"{len(r.get('issues', []))} | {top_rules} |"
                )
        if len(flagged) > 30:
            lines.append("")
            lines.append(f"_...and {len(flagged) - 30} more flagged skill(s)._")
        lines.append("")

    if errors:
        lines.append("### ⚠️ Scan errors")
        lines.append("")
        for r in errors[:10]:
            lines.append(f"- `{r['path']}` — {r.get('error', 'unknown error')}")
        if len(errors) > 10:
            lines.append(f"- _...and {len(errors) - 10} more._")
        lines.append("")

    base_errors = [r for r in scanned if r.get("base_error")]
    if base_errors:
        lines.append("### ⚠️ Base scan errors (these skills block until the base scans)")
        lines.append("")
        for r in base_errors[:10]:
            lines.append(f"- `{r['path']}` — {r['base_error']}")
        lines.append("")

    if not flagged and not errors:
        lines.append("No HIGH/CRITICAL findings. ✅")
        lines.append("")

    lines.append("---")
    lines.append(
        "_Generated by SkillSpector. Score bands: 0-20 LOW, 21-50 MEDIUM, "
        "51-80 HIGH, 81-100 CRITICAL._"
    )

    text = "\n".join(lines)
    if len(text) > MAX_COMMENT_CHARS:
        text = text[: MAX_COMMENT_CHARS - 200] + "\n\n_...report truncated (too long)._"
    return text


def _write_output(name: str, value: str) -> None:
    """Append a key=value pair to $GITHUB_OUTPUT (no-op if unset)."""
    out_path = os.environ.get("GITHUB_OUTPUT")
    if not out_path:
        return
    with open(out_path, "a", encoding="utf-8") as fh:
        if "\n" in value:
            fh.write(f"{name}<<__EOF__\n{value}\n__EOF__\n")
        else:
            fh.write(f"{name}={value}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch SkillSpector scanner.")
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument("--all", action="store_true", help="Scan every skill dir.")
    scope.add_argument(
        "--changed", action="store_true", help="Scan only skills changed vs --base-ref."
    )
    parser.add_argument("--base-ref", default="origin/main", help="Base ref for --changed.")
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD)
    parser.add_argument(
        "--fail-on-risk",
        action="store_true",
        help="Set output failed=true (and exit 1) if any skill exceeds threshold "
        "(with --compare-base: exceeds it and its score rose).",
    )
    parser.add_argument(
        "--compare-base",
        action="store_true",
        help="With --changed, also scan each skill on the merge base and block "
        "only on a score increase.",
    )
    parser.add_argument("--output-md", default="skillspector-report.md")
    parser.add_argument("--output-sarif", default="skillspector.sarif")
    parser.add_argument(
        "--dry-run", action="store_true", help="List discovered skills without scanning."
    )
    args = parser.parse_args()

    if args.changed:
        skills = discover_changed_skills(args.base_ref)
    else:
        skills = discover_all_skills()

    print(f"Discovered {len(skills)} skill director{'y' if len(skills) == 1 else 'ies'}.")

    if args.dry_run:
        for s in skills:
            print(f"  {s}")
        return 0

    if not skills:
        # Nothing to scan is a pass.
        Path(args.output_md).write_text(
            f"{COMMENT_MARKER}\n## 🎉 SkillSpector Security Scan\n\n"
            "No skill components were changed in this PR.\n",
            encoding="utf-8",
        )
        Path(args.output_sarif).write_text(json.dumps(_aggregate_sarif([]), indent=2))
        _write_output("scanned", "0")
        _write_output("high_critical_count", "0")
        _write_output("errors", "0")
        _write_output("failed", "false")
        return 0

    results: list[dict] = []
    for idx, skill in enumerate(skills, 1):
        print(f"[{idx}/{len(skills)}] scanning {skill}")
        results.append(scan_skill(skill))

    if args.compare_base and args.changed:
        print("Scanning base versions of flagged skills...")
        attach_base_scores(
            [r for r in results if r.get("status") == "ok" and r["score"] > args.threshold],
            args.base_ref,
        )

    scanned = [r for r in results if r.get("status") == "ok"]
    errors = [r for r in results if r.get("status") == "error"]
    flagged = [r for r in scanned if r["score"] > args.threshold]
    blocking = [r for r in flagged if blocks(r, args.threshold)]

    markdown = build_markdown(results, args.threshold)
    Path(args.output_md).write_text(markdown, encoding="utf-8")
    Path(args.output_sarif).write_text(
        json.dumps(_aggregate_sarif(results), indent=2), encoding="utf-8"
    )

    print(
        f"Scanned={len(scanned)} flagged={len(flagged)} blocking={len(blocking)} "
        f"errors={len(errors)} (threshold={args.threshold})"
    )

    failed = bool(blocking) and args.fail_on_risk
    _write_output("scanned", str(len(scanned)))
    _write_output("high_critical_count", str(len(flagged)))
    _write_output("errors", str(len(errors)))
    _write_output("failed", "true" if failed else "false")

    if failed:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
