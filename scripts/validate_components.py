#!/usr/bin/env python3
"""Run `claude plugin validate` over the component catalog.

The validator only understands plugin layouts, and the catalog nests
components by category, so agents, commands and skills are copied flat into a
scratch plugin. A catalog plugin (plugins/, source.json) is validated as
itself, and the aitmpl marketplace.json built from all of them is validated
whenever one changes. Hooks and MCP components are single JSON files; each is
wrapped as hooks/hooks.json or .mcp.json of its own scratch plugin. Mods are
validated by mods-typecheck.yml; settings and loops have no official validator.

Usage:
  python scripts/validate_components.py                # whole catalog
  python scripts/validate_components.py --changed FILE # only the paths listed in FILE
  python scripts/validate_components.py --strict       # warnings count as errors
Exit code 1 when any (selected) component has an error, or with --strict a warning.
"""
import argparse, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

import external_skills

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "cli-tool" / "components"
MANIFEST = {"name": "catalog-probe", "version": "0.0.0", "description": "scratch plugin", "author": {"name": "catalog"}}


def claude(path, strict):
    cmd = ["claude", "plugin", "validate", str(path), "--json"] + (["--strict"] if strict else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return {"contents": [{"file": str(path), "type": "?", "errors": [{"message": (r.stdout + r.stderr)[:300]}], "warnings": []}]}


def results(report):
    """Every result of a validate run: the manifest (plugin.json or marketplace.json)
    is reported apart from the component files under `contents`."""
    return ([report["manifest"]] if report.get("manifest") else []) + report.get("contents", [])


def new_plugin(tmp):
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / ".claude-plugin").mkdir(parents=True)
    (tmp / ".claude-plugin" / "plugin.json").write_text(json.dumps(MANIFEST))


def wanted(rel, changed):
    return changed is None or rel in changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--changed")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--report", default="component-validation.json")
    a = ap.parse_args()
    changed = None
    if a.changed:
        changed = {l.strip() for l in Path(a.changed).read_text().splitlines() if l.strip()}
        changed = {c[len("cli-tool/components/"):] for c in changed if c.startswith("cli-tool/components/")}

    work = Path(tempfile.mkdtemp(prefix="cct-validate-"))
    findings, mapping = [], {}
    plug = work / "plug"
    new_plugin(plug)
    for t in ("agents", "commands", "skills"):
        (plug / t).mkdir()
    n = 0
    for t in ("agents", "commands"):
        for p in sorted((BASE / t).rglob("*.md")):
            rel = p.relative_to(BASE).as_posix()
            if wanted(rel, changed):
                flat = f"{t}/" + p.relative_to(BASE / t).as_posix().replace("/", "__")
                shutil.copy(p, plug / flat); mapping[flat] = rel; n += 1
    for p in sorted((BASE / "skills").rglob("SKILL.md")):
        rel = p.relative_to(BASE).as_posix()
        if changed is None or any(c.startswith(p.parent.relative_to(BASE).as_posix() + "/") for c in changed):
            flat = "skills/" + p.parent.relative_to(BASE / "skills").as_posix().replace("/", "__")
            shutil.copytree(p.parent, plug / flat, symlinks=True); mapping[flat] = rel; n += 1
    # External skills and plugins: source.json + the files at the pinned commit.
    for d in external_skills.all_external_dirs():
        rel = (d / "source.json").relative_to(BASE).as_posix()
        if changed is None or any(c.startswith(d.relative_to(BASE).as_posix() + "/") for c in changed):
            flat = "skills/" + d.relative_to(BASE).as_posix().split("/", 1)[1].replace("/", "__")
            try:
                local = external_skills.local_dir(d)
                if external_skills.kind_of(d) == "plugin":
                    # A whole plugin is validated as itself, not flattened into the probe.
                    for c in results(claude(local, a.strict)):
                        findings.append({**c, "file": rel})
                    n += 1
                    continue
                shutil.copytree(local, plug / flat); mapping[flat] = rel; n += 1
            except (external_skills.ManifestError, OSError) as e:
                findings.append({"type": external_skills.kind_of(d), "file": rel, "errors": [{"message": str(e)}], "warnings": []})
    # The aitmpl marketplace (dashboard/public/marketplace.json) as the generator
    # would write it: a bad entry would reach everyone who added the marketplace.
    plugins = external_skills.plugin_dirs()
    if plugins and (changed is None or any(c.startswith("plugins/") for c in changed)):
        rel = "plugins (marketplace.json)"
        try:
            mk = work / "marketplace" / ".claude-plugin"
            mk.mkdir(parents=True)
            (mk / "marketplace.json").write_text(
                external_skills.marketplace_json(external_skills.build_marketplace(plugins)))
            for c in results(claude(mk / "marketplace.json", a.strict)):
                findings.append({**c, "file": rel})
            n += 1
        except (external_skills.ManifestError, OSError) as e:
            findings.append({"type": "marketplace", "file": rel, "errors": [{"message": str(e)}], "warnings": []})
    if n:
        for c in claude(plug, a.strict).get("contents", []):
            f = Path(c["file"]).relative_to(plug).as_posix()
            key = f if f.startswith("skills/") is False else f.rsplit("/", 1)[0]
            findings.append({**c, "file": mapping.get(key, f)})

    one = work / "one"
    for kind, sub in (("hooks", "hooks"), ("mcp", "mcps")):
        for p in sorted((BASE / sub).rglob("*.json")):
            rel = p.relative_to(BASE).as_posix()
            if not wanted(rel, changed):
                continue
            try:
                body = json.loads(p.read_text())
            except json.JSONDecodeError as e:
                findings.append({"type": kind, "file": rel, "errors": [{"message": f"invalid JSON: {e}"}], "warnings": []}); continue
            n += 1
            if kind == "hooks":
                if "hooks" not in body:
                    continue  # reference data (HOOK_PATTERNS_COMPRESSED.json), not a hooks component
                new_plugin(one); (one / "hooks").mkdir(); (one / "hooks" / "hooks.json").write_text(json.dumps(body))
            else:
                if "mcpServers" not in body:
                    findings.append({"type": kind, "file": rel, "errors": [{"message": "no top-level mcpServers key"}], "warnings": []}); continue
                new_plugin(one); (one / ".mcp.json").write_text(json.dumps(body))
            for c in claude(one, a.strict).get("contents", []):
                findings.append({**c, "file": rel})
    shutil.rmtree(work, ignore_errors=True)

    findings = [f for f in findings if f["errors"] or f["warnings"]]
    Path(a.report).write_text(json.dumps(findings, indent=1))
    errs = [f for f in findings if f["errors"]]
    warns = [f for f in findings if not f["errors"]]
    print(f"validated {n} components: {len(errs)} with errors, {len(warns)} with warnings only")
    for f in errs:
        for e in f["errors"]:
            print(f"::error file=cli-tool/components/{f['file']}::{e['message'][:300]}")
    # `claude plugin validate --strict --json` keeps warnings under "warnings" and
    # only sets "success" to false, so --strict has to count them here.
    level = "error" if a.strict else "warning"
    for f in warns:
        for w in f["warnings"]:
            print(f"::{level} file=cli-tool/components/{f['file']}::{w['message'][:300]}")
    return 1 if errs or (a.strict and warns) else 0


if __name__ == "__main__":
    sys.exit(main())
