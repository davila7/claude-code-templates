#!/usr/bin/env python3
"""External skills: catalog entries whose code lives in another GitHub repo.

A catalog folder cli-tool/components/skills/{category}/{name}/ holds either a
SKILL.md (regular skill) or a source.json (external skill), never both:

    {
      "repo": "t3dotgg/tstack",
      "path": "skills/babysit-pr",
      "commit": "<40-hex sha>",
      "license": "MIT",
      "author": "Theo Browne",
      "requires": ["git/leaving-pr-comments"]
    }

The CLI (cli-tool/src/external-skill.js) downloads the files from that commit
at install time. Everything in this repo that reads a skill folder (the catalog
generator, SkillSpector, `claude plugin validate`) calls local_dir() instead,
which fetches the commit with git into .cache/external-skills/ and returns the
skill's folder there. The code is never committed to this repo.

Usage:
  python scripts/external_skills.py check [PATH ...]   validate manifests (all, or the given folders/files)
  python scripts/external_skills.py materialize DIR    print the local folder of the external skill in DIR
  python scripts/external_skills.py add OWNER/REPO PATH CATEGORY [--name N] [--requires a/b ...] [--commit SHA]
  python scripts/external_skills.py outdated           list manifests whose repo has newer commits
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS_ROOT = ROOT / "cli-tool" / "components" / "skills"
CACHE_ROOT = ROOT / ".cache" / "external-skills"
MANIFEST_NAME = "source.json"

REPO_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
SKILL_REF_RE = re.compile(r"^[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$", re.I)
ALLOWED_FIELDS = {"repo", "path", "commit", "license", "author", "requires"}

# Licenses that allow redistribution and modification. A repo with no license
# is "all rights reserved" and cannot be listed.
ALLOWED_LICENSES = {
    "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC",
    "MPL-2.0", "CC-BY-4.0", "Unlicense", "0BSD",
}
MAX_FILES = 200
MAX_TOTAL_BYTES = 5 * 1024 * 1024


class ManifestError(ValueError):
    pass


def is_external(skill_dir: Path) -> bool:
    return (skill_dir / MANIFEST_NAME).is_file() and not (skill_dir / "SKILL.md").is_file()


def _safe_rel(p: str, allow_empty: bool = False) -> bool:
    if p == "":
        return allow_empty
    if p.startswith("/") or "\\" in p or "\0" in p or re.match(r"^[A-Za-z]:", p):
        return False
    return all(seg not in ("..", ".") for seg in p.split("/"))


def validate_manifest(data: object) -> dict:
    """Same rules as validateManifest() in cli-tool/src/external-skill.js, plus the license allowlist."""
    if not isinstance(data, dict):
        raise ManifestError("source.json must be a JSON object")
    extra = set(data) - ALLOWED_FIELDS
    if extra:
        raise ManifestError(f"unknown fields: {', '.join(sorted(extra))}")
    repo, commit, lic = data.get("repo"), data.get("commit"), data.get("license")
    path = data.get("path", "")
    if not isinstance(repo, str) or not REPO_RE.match(repo) or ".." in repo:
        raise ManifestError(f'invalid "repo" (expected "owner/name"): {repo!r}')
    if not isinstance(commit, str) or not COMMIT_RE.match(commit):
        raise ManifestError('"commit" must be a full 40-character commit sha (branches and tags are not allowed)')
    if not isinstance(path, str) or not _safe_rel(path, allow_empty=True):
        raise ManifestError(f'invalid "path": {path!r}')
    if lic not in ALLOWED_LICENSES:
        raise ManifestError(f'"license" must be one of {", ".join(sorted(ALLOWED_LICENSES))} (got {lic!r})')
    requires = data.get("requires", [])
    if not isinstance(requires, list) or not all(isinstance(r, str) and SKILL_REF_RE.match(r) for r in requires):
        raise ManifestError('"requires" must be a list of "category/name" skills')
    if "author" in data and not isinstance(data["author"], str):
        raise ManifestError('"author" must be a string')
    return {**data, "path": path.strip("/"), "requires": requires}


def read_manifest(skill_dir: Path) -> dict:
    try:
        data = json.loads((skill_dir / MANIFEST_NAME).read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ManifestError(f"source.json is not valid JSON: {e}") from e
    return validate_manifest(data)


def _git(*args: str, cwd: Path | None = None) -> str:
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        raise ManifestError(f"git {' '.join(args)} failed: {r.stderr.strip()[:300]}")
    return r.stdout


def _fetch_commit(repo: str, commit: str) -> Path:
    """Shallow-fetch one commit into a bare cache repo; returns its git dir."""
    git_dir = CACHE_ROOT / "git" / repo.replace("/", "__")
    if not (git_dir / "HEAD").exists():
        git_dir.mkdir(parents=True, exist_ok=True)
        _git("init", "--bare", "-q", str(git_dir))
    has = subprocess.run(["git", "--git-dir", str(git_dir), "cat-file", "-e", f"{commit}^{{commit}}"],
                         capture_output=True).returncode == 0
    if not has:
        _git("--git-dir", str(git_dir), "fetch", "-q", "--depth", "1",
             f"https://github.com/{repo}.git", commit)
    return git_dir


def local_dir(skill_dir: Path) -> Path:
    """Folder holding the external skill's files at its pinned commit (fetched once, then cached)."""
    m = read_manifest(skill_dir)
    repo, commit, path = m["repo"], m["commit"], m["path"]
    dest = CACHE_ROOT / "trees" / repo.replace("/", "__") / commit / (path or "_root")
    done = dest.parent / f".{dest.name}.complete"
    if done.exists():
        return dest
    git_dir = _fetch_commit(repo, commit)
    listing = _git("--git-dir", str(git_dir), "ls-tree", "-r", "-l", "-z", commit, *(["--", path] if path else []))
    entries = []
    for line in filter(None, listing.split("\0")):
        meta, full = line.split("\t", 1)
        mode, kind, sha, size = meta.split()
        if kind != "blob" or mode == "120000":
            continue  # submodules and symlinks are never installed (same as the CLI)
        if path and not full.startswith(path + "/"):
            continue
        rel = full[len(path) + 1:] if path else full
        if not _safe_rel(rel):
            raise ManifestError(f"unsafe path in {repo}: {full}")
        entries.append((rel, sha, mode, int(size)))
    if not any(rel == "SKILL.md" for rel, *_ in entries):
        raise ManifestError(f"no SKILL.md in {repo}/{path} at {commit[:7]}")
    if len(entries) > MAX_FILES or sum(e[3] for e in entries) > MAX_TOTAL_BYTES:
        raise ManifestError(f"{repo}/{path} is over the size limit ({MAX_FILES} files / {MAX_TOTAL_BYTES} bytes)")
    shutil.rmtree(dest, ignore_errors=True)
    for rel, sha, mode, _ in entries:
        out = dest / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        blob = subprocess.run(["git", "--git-dir", str(git_dir), "cat-file", "blob", sha],
                              capture_output=True, check=True).stdout
        out.write_bytes(blob)
        if mode == "100755":
            out.chmod(0o755)
    done.write_text("")
    return dest


def source_url(m: dict) -> str:
    tail = f"/{m['path']}" if m["path"] else ""
    return f"https://github.com/{m['repo']}/tree/{m['commit']}{tail}"


# --- licenses ---------------------------------------------------------------

def detect_license(text: str) -> str | None:
    t = " ".join(text.split()).lower()
    if "permission is hereby granted, free of charge" in t:
        return "MIT"
    if "apache license" in t and "version 2.0" in t:
        return "Apache-2.0"
    if "mozilla public license" in t and "2.0" in t:
        return "MPL-2.0"
    if "this is free and unencumbered software released into the public domain" in t:
        return "Unlicense"
    if "creative commons attribution 4.0" in t:
        return "CC-BY-4.0"
    if "redistribution and use in source and binary forms" in t:
        return "BSD-3-Clause" if "neither the name" in t or "endorse or promote" in t else "BSD-2-Clause"
    if "permission to use, copy, modify, and/or distribute this software for any purpose" in t:
        return "ISC" if "provided that the above copyright notice" in t else "0BSD"
    return None


LICENSE_NAMES = ("LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "COPYING", "license", "License.md")


def license_at_commit(m: dict) -> tuple[str | None, str | None]:
    """(detected SPDX id, file it came from): the skill folder's own LICENSE wins over the repo root's."""
    git_dir = _fetch_commit(m["repo"], m["commit"])
    dirs = ([m["path"]] if m["path"] else []) + [""]
    for d in dirs:
        for name in LICENSE_NAMES:
            spec = f"{m['commit']}:{d + '/' if d else ''}{name}"
            r = subprocess.run(["git", "--git-dir", str(git_dir), "show", spec], capture_output=True, text=True)
            if r.returncode == 0:
                return detect_license(r.stdout), (f"{d}/{name}" if d else name)
    return None, None


# --- commands ---------------------------------------------------------------

def all_external_dirs() -> list[Path]:
    return sorted(p.parent for p in SKILLS_ROOT.glob(f"*/*/{MANIFEST_NAME}"))


def check(dirs: list[Path]) -> list[str]:
    errors = []
    catalog = {f"{p.parent.name}/{p.name}" for p in SKILLS_ROOT.glob("*/*") if p.is_dir()}
    for d in dirs:
        rel = d.relative_to(ROOT).as_posix()
        try:
            if (d / "SKILL.md").is_file():
                raise ManifestError("has both SKILL.md and source.json")
            extra = [p.name for p in d.iterdir() if p.name != MANIFEST_NAME]
            if extra:
                raise ManifestError(f"an external skill folder holds only source.json (found {', '.join(extra)})")
            m = read_manifest(d)
            for ref in m["requires"]:
                if ref not in catalog:
                    raise ManifestError(f'"requires" names {ref}, which is not in the catalog')
            local_dir(d)
            detected, where = license_at_commit(m)
            if detected is None:
                raise ManifestError(f"no recognisable license file in {m['repo']} at {m['commit'][:7]}"
                                    + (f" ({where})" if where else ""))
            if detected != m["license"]:
                raise ManifestError(f'"license" says {m["license"]} but {where} is {detected}')
            print(f"✓ {rel}: {m['repo']}@{m['commit'][:7]} ({detected})")
        except (ManifestError, OSError, subprocess.CalledProcessError) as e:
            errors.append(f"{rel}: {e}")
    return errors


def _dirs_from_args(paths: list[str]) -> list[Path]:
    out = set()
    for p in paths:
        path = (ROOT / p).resolve() if not Path(p).is_absolute() else Path(p)
        if path.name == MANIFEST_NAME:
            path = path.parent
        if path.is_dir() and (path / MANIFEST_NAME).is_file():
            out.add(path)
    return sorted(out)


def remote_head(repo: str) -> str:
    out = _git("ls-remote", f"https://github.com/{repo}.git", "HEAD")
    return out.split()[0]


def add(repo: str, path: str, category: str, name: str | None, requires: list[str], commit: str | None,
        author: str | None) -> Path:
    commit = commit or remote_head(repo)
    name = name or (path.rstrip("/").split("/")[-1] if path else repo.split("/")[1])
    m = {"repo": repo, "path": path.strip("/"), "commit": commit, "license": "MIT"}
    _fetch_commit(repo, commit)
    detected, where = license_at_commit(m)
    if detected not in ALLOWED_LICENSES:
        raise ManifestError(f"{repo} at {commit[:7]}: license {detected or 'not found'} ({where}) is not allowed")
    m["license"] = detected
    if author:
        m["author"] = author
    if requires:
        m["requires"] = requires
    validate_manifest(m)
    dest = SKILLS_ROOT / category / name
    if dest.exists():
        raise ManifestError(f"{dest.relative_to(ROOT)} already exists")
    dest.mkdir(parents=True)
    (dest / MANIFEST_NAME).write_text(json.dumps(m, indent=2) + "\n", encoding="utf-8")
    local_dir(dest)
    return dest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("paths", nargs="*")
    mat = sub.add_parser("materialize")
    mat.add_argument("dir")
    a = sub.add_parser("add")
    a.add_argument("repo")
    a.add_argument("path")
    a.add_argument("category")
    a.add_argument("--name")
    a.add_argument("--author")
    a.add_argument("--commit")
    a.add_argument("--requires", nargs="*", default=[])
    sub.add_parser("outdated")
    args = ap.parse_args()

    if args.cmd == "check":
        dirs = _dirs_from_args(args.paths) if args.paths else all_external_dirs()
        errors = check(dirs)
        for e in errors:
            print(f"::error::{e}")
        print(f"checked {len(dirs)} external skill(s): {len(errors)} with errors")
        return 1 if errors else 0
    if args.cmd == "materialize":
        print(local_dir(Path(args.dir).resolve()))
        return 0
    if args.cmd == "add":
        dest = add(args.repo, args.path, args.category, args.name, args.requires, args.commit, args.author)
        print(f"wrote {(dest / MANIFEST_NAME).relative_to(ROOT)}")
        return 0
    if args.cmd == "outdated":
        heads: dict[str, str] = {}
        for d in all_external_dirs():
            m = read_manifest(d)
            head = heads.setdefault(m["repo"], remote_head(m["repo"]))
            if head != m["commit"]:
                print(f"{d.relative_to(SKILLS_ROOT).as_posix()}\t{m['repo']}\t{m['commit']}\t{head}")
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
