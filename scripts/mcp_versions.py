#!/usr/bin/env python3
"""Exact version pins for the packages MCP components run.

An MCP component (cli-tool/components/mcps/{category}/{name}.json) is copied
verbatim into the user's .mcp.json, and its server starts with `npx <pkg>`,
`uvx <pkg>` or `pipx run <pkg>` on every Claude Code start. Unpinned, a new
(or hijacked) release of that package runs on users' machines without ever
passing review here. So every package is pinned to an exact version, and a
version only moves through a PR that bumps it.

  check [FILE ...]   fail on any unpinned package (all MCPs when no files)
  pin   [FILE ...]   pin unpinned packages to the registry's latest version
  outdated           TSV of pins behind the registry: file, package, pinned, latest

npm packages are pinned as name@1.2.3, PyPI packages as name==1.2.3 (pipx)
or name@1.2.3 (uvx). A package npx installs from GitHub is pinned to a full
commit sha, github:owner/repo#<40 hex> (a tag or branch can move); `pin` and
`outdated` leave those alone. Docker images and local binaries are out of scope.
"""

import json
import re
import shlex
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MCPS = ROOT / 'cli-tool' / 'components' / 'mcps'

NPM_RUNNERS = {'npx', 'pnpx'}
EXACT = re.compile(r'^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$')
COMMIT = re.compile(r'^[0-9a-f]{40}$')
# uvx options that take a value; the value is not the package
UVX_VALUE_OPTS = {'--python', '-p', '--with', '--index', '--index-url', '--extra-index-url'}


def server_package(command, args):
    """(registry, spec) of the package a server runs, or None."""
    parts = shlex.split(command) if ' ' in command else [command]
    runner, args = parts[0], parts[1:] + list(args or [])

    if runner in NPM_RUNNERS:
        for i, a in enumerate(args):
            if a in ('--package', '-p') and i + 1 < len(args):
                return 'npm', args[i + 1]
            if a.startswith('--package='):
                return 'npm', a.split('=', 1)[1]
        for a in args:
            if a == '--':
                break
            if not a.startswith('-'):
                return 'npm', a
        return None

    if runner == 'uvx':
        skip = False
        for i, a in enumerate(args):
            if skip:
                skip = False
                continue
            if a == '--from' and i + 1 < len(args):
                return 'pypi-uvx', args[i + 1]
            if a in UVX_VALUE_OPTS:
                skip = True
                continue
            if not a.startswith('-'):
                return 'pypi-uvx', a
        return None

    if runner == 'pipx' and args[:1] == ['run']:
        for i, a in enumerate(args[1:], 1):
            if a == '--spec' and i + 1 < len(args):
                return 'pypi-pipx', args[i + 1]
            if not a.startswith('-'):
                return 'pypi-pipx', a
    return None


def split_spec(registry, spec):
    """(name, version or None)."""
    if registry == 'npm':
        if spec.startswith('github:'):
            name, _, ref = spec.partition('#')
            return name, ref or None
        at = spec.rfind('@')
        if at > 0:
            return spec[:at], spec[at + 1:]
        return spec, None
    for sep in ('==', '@'):
        if sep in spec:
            name, ver = spec.split(sep, 1)
            return name, ver
    return spec, None


def is_pinned(registry, spec):
    name, ver = split_spec(registry, spec)
    if not ver:
        return False
    return bool(COMMIT.match(ver)) if name.startswith('github:') else bool(EXACT.match(ver))


def pinned_spec(registry, name, version):
    return f'{name}=={version}' if registry == 'pypi-pipx' else f'{name}@{version}'


def entries(files=None):
    """(path, registry, spec) for every package an MCP file runs."""
    paths = [Path(f).resolve() for f in files] if files else sorted(MCPS.rglob('*.json'))
    out = []
    for path in paths:
        if MCPS not in path.parents or path.suffix != '.json' or not path.exists():
            continue
        servers = json.loads(path.read_text()).get('mcpServers') or {}
        for server in servers.values():
            pkg = server_package(server.get('command', ''), server.get('args'))
            if pkg:
                out.append((path, *pkg))
    return out


def latest(registry, name):
    if registry == 'npm':
        url = f'https://registry.npmjs.org/{urllib.parse.quote(name, safe="@")}/latest'
        key = lambda d: d['version']
    else:
        url = f'https://pypi.org/pypi/{urllib.parse.quote(name)}/json'
        key = lambda d: d['info']['version']
    with urllib.request.urlopen(url, timeout=20) as res:
        return key(json.load(res))


def rel(path):
    return path.relative_to(ROOT).as_posix()


def cmd_check(files):
    bad = []
    for path, registry, spec in entries(files):
        if not is_pinned(registry, spec):
            bad.append(f'{rel(path)}: "{spec}" is not pinned to an exact version')
    for line in bad:
        print(f'::error::{line}' if '--github' in sys.argv else line)
    if bad:
        print(f'\n{len(bad)} unpinned package(s). Run: python3 scripts/mcp_versions.py pin <file>')
        return 1
    print('All MCP packages are pinned.')
    return 0


def cmd_pin(files):
    failed = 0
    for path, registry, spec in entries(files):
        name, _ = split_spec(registry, spec)
        if is_pinned(registry, spec):
            continue
        if name.startswith('github:'):
            print(f'FAIL {rel(path)}: {spec}: pin it to a full commit sha by hand')
            failed += 1
            continue
        try:
            new = pinned_spec(registry, name, latest(registry, name))
        except Exception as e:  # missing or unreachable package
            print(f'FAIL {rel(path)}: {name}: {e}')
            failed += 1
            continue
        text = path.read_text()
        # Replace the JSON string itself so the file keeps its formatting
        # The JSON string as a value, never as a key (a server is often named after its package)
        text, count = re.subn(rf'"{re.escape(spec)}"(?!\s*:)', f'"{new}"', text)
        if not count:  # inside a whole-line "command": "npx pkg ..." string
            text, count = re.subn(rf'("command":\s*"[^"]*?)(?<=[\s"]){re.escape(spec)}(?=[\s"])', rf'\g<1>{new}', text, count=1)
        if not count:
            print(f'FAIL {rel(path)}: could not find "{spec}"')
            failed += 1
            continue
        path.write_text(text)
        print(f'{rel(path)}: {spec} -> {new}')
    return 1 if failed else 0


def cmd_outdated():
    for path, registry, spec in entries():
        name, ver = split_spec(registry, spec)
        if not (ver and EXACT.match(ver)):
            continue
        try:
            new = latest(registry, name)
        except Exception:
            continue
        if new != ver:
            print(f'{rel(path)}\t{name}\t{ver}\t{new}')
    return 0


def main():
    args = [a for a in sys.argv[1:] if a != '--github']
    if not args or args[0] not in ('check', 'pin', 'outdated'):
        print(__doc__)
        return 2
    if args[0] == 'check':
        return cmd_check(args[1:])
    if args[0] == 'pin':
        return cmd_pin(args[1:])
    return cmd_outdated()


if __name__ == '__main__':
    sys.exit(main())
