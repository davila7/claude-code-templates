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
      "requires": ["git/leaving-pr-comments"],
      "include": ["SKILL.md", "scripts"]
    }

`include` (optional) keeps only those files/folders under `path`, for repos whose
skill folder also carries demos, tests or dev tooling. It must list SKILL.md,
and the size limits apply after filtering.

The CLI (cli-tool/src/external-skill.js) downloads an external skill's files from
that commit at install time. Everything in this repo that reads a skill folder
(the catalog generator, SkillSpector, `claude plugin validate`) calls local_dir()
instead, which fetches the commit with git into .cache/external-skills/ and
returns the skill's folder there. The code is never committed to this repo.

Plugins: cli-tool/components/plugins/{category}/{name}/source.json pins a whole
Claude Code plugin (a folder with .claude-plugin/plugin.json) with the same
manifest, minus `include` and `requires`: Claude Code installs the whole folder,
and a plugin declares its own dependencies. The folder name must equal the
plugin's `name` and be unique across plugins/. Nothing copies plugin files into a
project: build_marketplace() turns the manifests into the `aitmpl` Claude Code
marketplace (dashboard/public/marketplace.json, served at MARKETPLACE_URL), each
entry a git-subdir source pinned to the reviewed commit, and Claude Code installs
from it into ~/.claude/plugins/cache/aitmpl/{name}/{version}/.

Usage:
  python scripts/external_skills.py check [PATH ...]   validate manifests (all, or the given folders/files)
  python scripts/external_skills.py materialize DIR    print the local folder of the external skill in DIR
  python scripts/external_skills.py add OWNER/REPO PATH CATEGORY [--plugin] [--name N] [--requires a/b ...] [--include p ...] [--commit SHA]
  python scripts/external_skills.py marketplace [--out FILE]  print (or write) the aitmpl marketplace.json
  python scripts/external_skills.py outdated           list manifests whose repo has newer commits
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILLS_ROOT = ROOT / "cli-tool" / "components" / "skills"
PLUGINS_ROOT = ROOT / "cli-tool" / "components" / "plugins"
CACHE_ROOT = ROOT / ".cache" / "external-skills"
MANIFEST_NAME = "source.json"

REPO_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
SKILL_REF_RE = re.compile(r"^[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$", re.I)
ALLOWED_FIELDS = {"repo", "path", "commit", "license", "author", "requires", "include"}

# Licenses that allow redistribution and modification. A repo with no license
# is "all rights reserved" and cannot be listed.
ALLOWED_LICENSES = {
    "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC",
    "MPL-2.0", "CC-BY-4.0", "Unlicense", "0BSD",
}
MAX_FILES = 200
MAX_TOTAL_BYTES = 5 * 1024 * 1024
PLUGIN_MANIFEST = ".claude-plugin/plugin.json"

# The Claude Code marketplace built from plugins/. The name is what users type
# after @ (champion-kit@aitmpl); the CLI (cli-tool/src/plugin-install.js) and the
# site (dashboard/src/lib/constants.ts) carry the same two values.
MARKETPLACE_NAME = "aitmpl"
MARKETPLACE_URL = "https://www.aitmpl.com/marketplace.json"
MARKETPLACE_FILE = ROOT / "dashboard" / "public" / "marketplace.json"
# A marketplace entry name: Claude Code allows letters, digits, ".", "_" and "-";
# the catalog keeps to lowercase kebab-case like every other component.
PLUGIN_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9.-]{0,63}$")
# plugin.json display fields copied onto the marketplace entry: before install,
# Claude Code shows only the entry's own fields for a non-relative source.
DISPLAY_FIELDS = ("displayName", "description", "author", "homepage", "repository", "keywords")


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


def kind_of(folder: Path) -> str:
    """'plugin' for a catalog folder plugins/{category}/{name}, else 'skill'.

    Read from the catalog layout, not from where this checkout is: the PR scan
    extracts the base-ref copy of a folder under a temp dir, and that copy must
    get the same kind."""
    parts = Path(folder).resolve().parts
    return "plugin" if len(parts) >= 3 and parts[-3] == PLUGINS_ROOT.name else "skill"


def validate_manifest(data: object, kind: str = "skill") -> dict:
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
    if kind == "plugin":
        # Claude Code fetches the whole plugin folder, so the review covers the whole
        # folder; plugin dependencies live in the plugin's own manifest.
        for field in ("include", "requires"):
            if field in data:
                raise ManifestError(f'"{field}" is not allowed for a plugin (Claude Code installs the whole folder)')
    include = None
    if "include" in data:
        raw = data["include"]
        if not isinstance(raw, list) or not raw or not all(isinstance(p, str) and _safe_rel(p.rstrip("/")) for p in raw):
            raise ManifestError('"include" must be a non-empty list of relative paths')
        include = [p.rstrip("/") for p in raw]
        if not is_included("SKILL.md", include):
            raise ManifestError('"include" must list SKILL.md')
    return {**data, "path": path.strip("/"), "requires": requires, "include": include}


def is_included(rel: str, include: list[str] | None) -> bool:
    """True when rel is one of the include entries or sits under one (no include = everything)."""
    return include is None or any(rel == inc or rel.startswith(inc + "/") for inc in include)


def read_manifest(skill_dir: Path) -> dict:
    try:
        data = json.loads((skill_dir / MANIFEST_NAME).read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ManifestError(f"source.json is not valid JSON: {e}") from e
    return validate_manifest(data, kind_of(skill_dir))


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
    if m["include"]:
        # A different include is a different file set: give it its own cache folder.
        digest = hashlib.sha256("\0".join(sorted(m["include"])).encode()).hexdigest()[:12]
        dest = dest.parent / f"{dest.name}@{digest}"
    done = dest.parent / f".{dest.name}.complete"
    if done.exists():
        return dest
    plugin = kind_of(skill_dir) == "plugin"
    git_dir = _fetch_commit(repo, commit)
    listing = _git("--git-dir", str(git_dir), "ls-tree", "-r", "-l", "-z", commit, *(["--", path] if path else []))
    entries = []
    for line in filter(None, listing.split("\0")):
        meta, full = line.split("\t", 1)
        mode, otype, sha, size = meta.split()
        if path and not full.startswith(path + "/"):
            continue
        if otype != "blob" or mode == "120000":
            if plugin:
                # Claude Code installs the plugin folder as git has it, so a link we
                # skip here would reach users without having been reviewed.
                what = "symlink" if mode == "120000" else "submodule"
                raise ManifestError(f"{repo}: {full} is a {what}; a catalog plugin cannot contain one")
            continue  # submodules and symlinks are never installed (same as the CLI)
        rel = full[len(path) + 1:] if path else full
        if not is_included(rel, m["include"]):
            continue
        if not _safe_rel(rel):
            raise ManifestError(f"unsafe path in {repo}: {full}")
        entries.append((rel, sha, mode, int(size)))
    entry = PLUGIN_MANIFEST if plugin else "SKILL.md"
    if not any(rel == entry for rel, *_ in entries):
        raise ManifestError(f"no {entry} in {repo}/{path} at {commit[:7]}")
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


def is_plugin(local: Path) -> bool:
    """True when a materialized external folder is a whole plugin (it has a plugin.json)."""
    return (local / PLUGIN_MANIFEST).is_file()


def plugin_manifest(local: Path) -> dict:
    try:
        data = json.loads((local / PLUGIN_MANIFEST).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:  # ValueError covers JSONDecodeError and UnicodeDecodeError
        raise ManifestError(f"{PLUGIN_MANIFEST} is not valid UTF-8 JSON: {e}") from e
    if not isinstance(data, dict):
        raise ManifestError(f"{PLUGIN_MANIFEST} must be a JSON object")
    return data


def stage_plugin_for_scan(local: Path, tmp: Path, name: str) -> Path:
    """Copy a plugin into tmp/name with a stub SKILL.md, the layout SkillSpector accepts.

    A plugin whose only skill is a SKILL.md at its root keeps that file."""
    target = tmp / name
    shutil.copytree(local, target)
    if not (target / "SKILL.md").is_file():
        desc = " ".join(str(plugin_manifest(local).get("description") or name).split())
        (target / "SKILL.md").write_text(
            f"---\nname: {name}\ndescription: {json.dumps(desc, ensure_ascii=False)}\n---\n", encoding="utf-8")
    return target


def _component_paths(value: object) -> list[str]:
    """A plugin.json component key as relative paths (a string or a list of strings)."""
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [v for v in value if isinstance(v, str)]
    return []


def _inside(local: Path, rel: str) -> Path | None:
    p = (local / rel).resolve()
    base = local.resolve()
    return p if p == base or base in p.parents else None


def _md_names(local: Path, default_dir: str, value: object) -> list[str]:
    """Names of the Markdown components (commands, agents, output styles) Claude Code loads:
    the manifest key replaces the default folder; subfolders join with ':'."""
    roots = _component_paths(value) if value is not None else [default_dir]
    names = set(str(k) for k in value) if isinstance(value, dict) else set()
    for rel in roots:
        p = _inside(local, rel)
        if p is None:
            continue
        if p.is_file() and p.suffix == ".md":
            names.add(p.stem)
        elif p.is_dir():
            names.update(":".join(f.relative_to(p).with_suffix("").parts) for f in p.rglob("*.md"))
    return sorted(names)


def _json_keys(path: Path, wrapper: str | None = None) -> list[str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if wrapper is not None:
        data = data.get(wrapper) if isinstance(data, dict) else None
    return sorted(str(k) for k in data) if isinstance(data, dict) else []


def plugin_inventory(local: Path) -> dict:
    """What a plugin ships, by kind, read from its default folders and plugin.json keys.

    Names are the ones Claude Code shows after the plugin prefix
    (/{plugin}:{skill}, {plugin}:{agent}); kinds with nothing are left out.
    Display only: Claude Code itself decides what loads."""
    meta = plugin_manifest(local)
    skills = set()
    roots = ["skills"] + _component_paths(meta.get("skills"))
    for rel in roots:
        p = _inside(local, rel)
        if p is None or not p.is_dir():
            continue
        if p != local.resolve() and (p / "SKILL.md").is_file():
            skills.add(p.name)
        skills.update(d.name for d in p.iterdir() if d.is_dir() and (d / "SKILL.md").is_file())
    if not skills and "skills" not in meta and (local / "SKILL.md").is_file():
        skills.add(str(meta.get("name") or local.name))  # a single skill at the plugin root
    inv = {
        "skills": sorted(skills),
        "commands": _md_names(local, "commands", meta.get("commands")),
        "agents": _md_names(local, "agents", meta.get("agents")),
        "hooks": _json_keys(local / "hooks" / "hooks.json", "hooks"),
        "mcpServers": _json_keys(local / ".mcp.json", "mcpServers"),
        "lspServers": _json_keys(local / ".lsp.json"),
        "outputStyles": _md_names(local, "output-styles", meta.get("outputStyles")),
        "themes": sorted(p.stem for p in (local / "themes").glob("*.json")),
        "bin": sorted(p.name for p in (local / "bin").glob("*") if p.is_file()),
    }
    for key in ("hooks", "mcpServers", "lspServers"):
        if isinstance(meta.get(key), dict):
            # An inline map in plugin.json merges with the default file.
            extra = meta[key].get("hooks", meta[key]) if key == "hooks" else meta[key]
            inv[key] = sorted(set(inv[key]) | {str(k) for k in extra})
    try:
        monitors = json.loads((local / "monitors" / "monitors.json").read_text(encoding="utf-8"))
        inv["monitors"] = sorted(str(m.get("name")) for m in monitors if isinstance(m, dict) and m.get("name"))
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return {k: v for k, v in inv.items() if v}


def source_url(m: dict) -> str:
    tail = f"/{m['path']}" if m["path"] else ""
    return f"https://github.com/{m['repo']}/tree/{m['commit']}{tail}"


# --- the aitmpl marketplace -------------------------------------------------

def git_url(repo: str) -> str:
    """Full https clone URL. For owner/repo shorthand Claude Code clones over SSH when
    an SSH key for github.com looks configured, which fails for people whose key isn't
    set up for GitHub; every catalog plugin is public, so https always works."""
    return f"https://github.com/{repo}.git"


def _display_value(field: str, value: object) -> object | None:
    if field == "author":
        return value if isinstance(value, dict) and isinstance(value.get("name"), str) and value["name"] else None
    if field == "keywords":
        return value if isinstance(value, list) and value and all(isinstance(k, str) for k in value) else None
    return value if isinstance(value, str) and value.strip() else None


def marketplace_entry(plugin_dir: Path) -> dict:
    """The marketplace entry for one catalog plugin, pinned to its reviewed commit."""
    m = read_manifest(plugin_dir)
    meta = plugin_manifest(local_dir(plugin_dir))
    if m["path"]:
        source = {"source": "git-subdir", "url": git_url(m["repo"]), "path": m["path"], "sha": m["commit"]}
    else:
        source = {"source": "url", "url": git_url(m["repo"]), "sha": m["commit"]}
    entry: dict = {"name": plugin_dir.name, "source": source}
    for field in DISPLAY_FIELDS:
        value = _display_value(field, meta.get(field))
        if value is not None:
            entry[field] = value
    if "author" not in entry and m.get("author"):
        entry["author"] = {"name": m["author"]}
    category, name = plugin_dir.parent.name, plugin_dir.name
    entry.setdefault("homepage", f"https://www.aitmpl.com/component/plugins/{category}/{name}")
    entry.setdefault("repository", f"https://github.com/{m['repo']}")
    # Checked against the repo's LICENSE at that commit, so it beats plugin.json.
    entry["license"] = m["license"]
    entry["category"] = category
    # No "version": the plugin's own version (or, without one, the commit) decides it.
    return entry


def build_marketplace(dirs: list[Path] | None = None) -> dict:
    """The aitmpl marketplace.json: one entry per catalog plugin, sorted by name."""
    entries = [marketplace_entry(d) for d in (plugin_dirs() if dirs is None else dirs)]
    return {
        "name": MARKETPLACE_NAME,
        "owner": {"name": "aitmpl.com", "url": "https://www.aitmpl.com"},
        "description": "Claude Code plugins listed on aitmpl.com, each pinned to the commit that was reviewed and scanned.",
        "plugins": sorted(entries, key=lambda e: e["name"]),
    }


def marketplace_json(data: dict) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


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
    """Every external skill and plugin folder."""
    return sorted(p.parent for root in (SKILLS_ROOT, PLUGINS_ROOT) for p in root.glob(f"*/*/{MANIFEST_NAME}"))


def plugin_dirs() -> list[Path]:
    """Every catalog plugin folder (plugins/{category}/{name}/source.json)."""
    return sorted(p.parent for p in PLUGINS_ROOT.glob(f"*/*/{MANIFEST_NAME}"))


def check(dirs: list[Path]) -> list[str]:
    errors = []
    catalog = {f"{p.parent.name}/{p.name}" for p in SKILLS_ROOT.glob("*/*") if p.is_dir()}
    # The marketplace is flat (installs are name@aitmpl), so a plugin name is unique
    # across categories.
    plugin_names: dict[str, list[str]] = {}
    for p in plugin_dirs():
        plugin_names.setdefault(p.name, []).append(p.parent.name)
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
            if kind_of(d) == "plugin":
                if not PLUGIN_NAME_RE.match(d.name):
                    raise ManifestError(f"plugin folder name {d.name!r} must be lowercase letters, digits, '.' and '-'")
                if len(plugin_names.get(d.name, [])) > 1:
                    raise ManifestError(f"plugin name {d.name!r} is used in more than one category: "
                                        + ", ".join(sorted(plugin_names[d.name])))
            local = local_dir(d)
            if kind_of(d) == "plugin":
                if not is_plugin(local):
                    raise ManifestError(f"a plugin needs {PLUGIN_MANIFEST}")
                pname = plugin_manifest(local).get("name")
                if pname != d.name:
                    raise ManifestError(f'plugin name {pname!r} must equal the folder name {d.name!r}')
            elif not (local / "SKILL.md").is_file():
                raise ManifestError("no SKILL.md at the skill's root (a whole plugin goes under plugins/)")
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
        author: str | None, include: list[str] | None = None, plugin: bool = False) -> Path:
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
    if include:
        m["include"] = include
    validate_manifest(m, "plugin" if plugin else "skill")
    if plugin and (not PLUGIN_NAME_RE.match(name) or (PLUGINS_ROOT.is_dir() and any(PLUGINS_ROOT.glob(f"*/{name}")))):
        raise ManifestError(f"plugin name {name!r} is not a valid, unused catalog plugin name")
    dest = (PLUGINS_ROOT if plugin else SKILLS_ROOT) / category / name
    if dest.exists():
        raise ManifestError(f"{dest.relative_to(ROOT)} already exists")
    dest.mkdir(parents=True)
    (dest / MANIFEST_NAME).write_text(json.dumps(m, indent=2) + "\n", encoding="utf-8")
    try:
        local = local_dir(dest)
        if plugin and plugin_manifest(local).get("name") != name:
            raise ManifestError(f"{PLUGIN_MANIFEST} names the plugin {plugin_manifest(local).get('name')!r}; "
                                f"pass --name with that name")
    except ManifestError:
        shutil.rmtree(dest, ignore_errors=True)
        raise
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
    a.add_argument("--include", nargs="*", default=None)
    a.add_argument("--plugin", action="store_true", help="a whole Claude Code plugin, listed under plugins/")
    mk = sub.add_parser("marketplace")
    mk.add_argument("--out", help="write the marketplace to this file instead of printing it")
    sub.add_parser("outdated")
    args = ap.parse_args()

    if args.cmd == "marketplace":
        text = marketplace_json(build_marketplace())
        if args.out:
            Path(args.out).write_text(text, encoding="utf-8")
        else:
            sys.stdout.write(text)
        return 0

    if args.cmd == "check":
        dirs = _dirs_from_args(args.paths) if args.paths else all_external_dirs()
        errors = check(dirs)
        for e in errors:
            print(f"::error::{e}")
        print(f"checked {len(dirs)} external skill(s)/plugin(s): {len(errors)} with errors")
        return 1 if errors else 0
    if args.cmd == "materialize":
        print(local_dir(Path(args.dir).resolve()))
        return 0
    if args.cmd == "add":
        dest = add(args.repo, args.path, args.category, args.name, args.requires, args.commit, args.author, args.include, args.plugin)
        print(f"wrote {(dest / MANIFEST_NAME).relative_to(ROOT)}")
        return 0
    if args.cmd == "outdated":
        heads: dict[str, str] = {}
        for d in all_external_dirs():
            m = read_manifest(d)
            head = heads.setdefault(m["repo"], remote_head(m["repo"]))
            if head != m["commit"]:
                print(f"{d.relative_to(ROOT / 'cli-tool' / 'components').as_posix()}\t{m['repo']}\t{m['commit']}\t{head}")
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
