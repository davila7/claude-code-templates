#!/usr/bin/env python3
"""Checks that keep docs-site/ in sync with the CLI and the catalog.

1. Every page in docs.json navigation exists, and every .mdx page is in it.
2. Every install example (`--agent category/name`, `--skill …`, …) points at a
   component that exists in cli-tool/components/.
3. No page documents a flag removed in 1.31.0, except the page that lists them.
4. No page links to a docs page that does not exist.

Usage (from the repository root): python3 docs-site/scripts/check_docs.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS = os.path.join(ROOT, 'docs-site')
COMPONENTS = os.path.join(ROOT, 'cli-tool', 'components')
REMOVED_PAGE = 'cli/removed-in-1-31'

FLAG_DIRS = {
    'agent': ('agents', '.md'),
    'command': ('commands', '.md'),
    'hook': ('hooks', '.json'),
    'setting': ('settings', '.json'),
    'mcp': ('mcps', '.json'),
    'loop': ('loops', '.md'),
    'skill': ('skills', ''),
    'mod': ('mods', ''),
    'plugin': ('plugins', ''),
}
INSTALL_RE = re.compile(r'--(agent|command|hook|setting|mcp|loop|skill|mod|plugin)[ =]([a-z0-9][a-z0-9/_.,-]*)')
PLACEHOLDER_RE = re.compile(r'category|name')


def removed_flags():
    with open(os.path.join(ROOT, 'cli-tool', 'src', 'removed-commands.js')) as f:
        return re.findall(r"flag: '(--[a-z0-9-]+)'", f.read())


def nav_pages(node, out):
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for item in node:
            nav_pages(item, out)
    elif isinstance(node, dict):
        for key in ('tabs', 'groups', 'pages'):
            if key in node:
                nav_pages(node[key], out)
    return out


def component_exists(flag, path):
    folder, ext = FLAG_DIRS[flag]
    base = os.path.join(COMPONENTS, folder, path)
    if ext:
        return os.path.isfile(base + ext)
    return os.path.isdir(base)


def main():
    errors = []
    with open(os.path.join(DOCS, 'docs.json')) as f:
        config = json.load(f)
    pages = nav_pages(config['navigation'], [])
    page_set = set(pages)

    mdx_files = {}
    for dirpath, dirnames, filenames in os.walk(DOCS):
        dirnames[:] = [d for d in dirnames if d not in ('node_modules', 'snippets', 'scripts')]
        for name in filenames:
            if name.endswith('.mdx'):
                rel = os.path.relpath(os.path.join(dirpath, name), DOCS)[:-4]
                mdx_files[rel] = os.path.join(dirpath, name)

    for page in pages:
        if page not in mdx_files:
            errors.append(f'docs.json lists "{page}" but {page}.mdx does not exist')
    for page in mdx_files:
        if page not in page_set:
            errors.append(f'{page}.mdx is not in the docs.json navigation')

    redirects = {r['source'].strip('/') for r in config.get('redirects', [])}
    removed = removed_flags()

    for page, path in sorted(mdx_files.items()):
        with open(path) as f:
            text = f.read()
        for match in INSTALL_RE.finditer(text):
            flag = match.group(1)
            for item in match.group(2).split(','):
                item = item.strip('.')
                if not item or PLACEHOLDER_RE.search(item) and '/' not in item:
                    continue
                if '{' in item or '<' in item:
                    continue
                if '/' not in item:
                    errors.append(f'{page}: --{flag} {item} has no category (the CLI needs category/name)')
                elif not component_exists(flag, item):
                    errors.append(f'{page}: --{flag} {item} does not exist in cli-tool/components/')
        if page != REMOVED_PAGE:
            for flag in removed:
                if re.search(re.escape(flag) + r'(?![a-z0-9-])', text):
                    errors.append(f'{page}: mentions {flag}, removed in 1.31.0')
        for link in re.findall(r'\]\((/[a-z0-9/_-]*)(?:#[^)]*)?\)|href="(/[a-z0-9/_-]*)(?:#[^"]*)?"', text):
            target = (link[0] or link[1]).strip('/')
            if target and target not in mdx_files and target not in redirects and not target.startswith(('logo', 'snippets')):
                errors.append(f'{page}: links to /{target}, which is not a page')

    if errors:
        print('\n'.join(errors))
        print(f'\n{len(errors)} problem(s) in docs-site/')
        sys.exit(1)
    print(f'docs-site OK: {len(mdx_files)} pages')


if __name__ == '__main__':
    main()
