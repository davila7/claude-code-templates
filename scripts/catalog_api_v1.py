"""
Catalog API v1: the versioned, documented catalog for programs and agents
outside the site (https://www.aitmpl.com/api/v1/).

generate_components_json.py calls write_catalog_api_v1() after it has written
every legacy file. It reads the same in-memory index and writes:

  dashboard/public/api/v1/catalog.json          every component
  dashboard/public/api/v1/catalog/{type}.json   one type
  dashboard/public/api/v1/version.json          schemaVersion, generatedAt, sha256, counts
  dashboard/public/api/v1/schema.json           copy of catalog_api_v1.schema.json

The legacy files (components.json, components/{type}.json, ...) belong to the
site and may change with it. These do not: within schemaVersion 1.x a change
is additive only (docs/catalog-api/CHANGELOG.md, /developers/catalog-api).
Every write is validated against the schema; an invalid catalog raises.
"""

import hashlib
import json
import os
import re

SCHEMA_VERSION = '1.1.0'
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'catalog_api_v1.schema.json')

SITE = 'https://www.aitmpl.com'
REPO = 'https://github.com/davila7/claude-code-templates'
DOCS = f'{SITE}/developers/catalog-api'

# Plural group key in the legacy index -> CLI flag. Order is the site's.
# sandbox (docs files, not components), templates (retired), plugins (empty)
# and componentsMarketplace are deliberately not part of v1.
TYPES = {
    'agents': '--agent',
    'commands': '--command',
    'mcps': '--mcp',
    'settings': '--setting',
    'hooks': '--hook',
    'skills': '--skill',
    'loops': '--loop',
    'mods': '--mod',
}

# Skills and mods are directories; everything else is one file.
DIRECTORY_TYPES = {'skills', 'mods'}

_EXTENSION = re.compile(r'\.(md|json)$')


def _slug(path):
    return _EXTENSION.sub('', path)


def _or_none(value):
    return value if isinstance(value, str) and value.strip() else None


def _scan(skillspector):
    if not isinstance(skillspector, dict) or 'severity' not in skillspector:
        return None
    return {
        'tool': 'skillspector',
        'toolVersion': skillspector.get('version'),
        'severity': skillspector.get('severity'),
        'score': skillspector.get('score'),
        'scannedAt': skillspector.get('scannedAt'),
    }


def _source(source):
    """External skills: where the code lives (see scripts/external_skills.py)."""
    if not isinstance(source, dict) or not source.get('commit'):
        return None
    return {k: source[k] for k in ('repo', 'path', 'commit', 'license')}


def to_v1(component, type_key, has_content=True):
    """One legacy index entry -> one v1 component."""
    path = component['path']
    slug = _slug(path)
    flag = TYPES[type_key]
    blob = 'tree' if type_key in DIRECTORY_TYPES else 'blob'
    source = _source(component.get('source'))
    return {
        'id': f'{type_key}/{slug}',
        'type': type_key,
        'name': component['name'],
        'category': component['category'],
        'path': path,
        'description': component.get('description') or '',
        'author': _or_none(component.get('author')),
        'repo': _or_none(component.get('repo')),
        'version': _or_none(component.get('version')),
        'license': _or_none(component.get('license')),
        'keywords': [k for k in component.get('keywords') or [] if isinstance(k, str)],
        'downloads': int(component.get('downloads') or 0),
        'install': {
            'command': f'npx claude-code-templates@latest {flag} {slug}',
            'args': [flag, slug],
        },
        'urls': {
            'page': f'{SITE}/component/{type_key}/{slug}',
            'source': component['source']['url'] if source else f'{REPO}/{blob}/main/cli-tool/components/{type_key}/{path}',
            'content': f'{SITE}/component-content/{type_key}/{slug}.json' if has_content else None,
        },
        'files': list(component.get('references') or []) if type_key in DIRECTORY_TYPES else None,
        'scan': _scan(component.get('skillspector')),
        'source': source,
    }


def build_components(index_data, content_exists=None):
    """Every v1 component, sorted by id. `content_exists(type_key, slug)` says
    whether a component-content file was written for it."""
    components = []
    for type_key in TYPES:
        for component in index_data.get(type_key) or []:
            has_content = content_exists(type_key, _slug(component['path'])) if content_exists else True
            components.append(to_v1(component, type_key, has_content))
    components.sort(key=lambda c: c['id'])
    ids = [c['id'] for c in components]
    if len(ids) != len(set(ids)):
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        raise ValueError(f'catalog API v1: duplicate ids {dupes[:5]}')
    return components


def _dump(data):
    return json.dumps(data, ensure_ascii=False, separators=(',', ':'))


def _envelope(components, generated_at):
    return {
        'schemaVersion': SCHEMA_VERSION,
        'generatedAt': generated_at,
        'source': REPO,
        'docs': DOCS,
        'count': len(components),
        'components': components,
    }


def _previous_generated_at(out_dir, components):
    """generatedAt of the previous catalog when its components are unchanged.

    The content workflow regenerates the catalog on every component merge;
    keeping the timestamp when nothing changed keeps the output byte-identical,
    so no empty commit or deploy follows and pollers see no change.
    """
    try:
        with open(os.path.join(out_dir, 'catalog.json'), 'r', encoding='utf-8') as f:
            previous = json.load(f)
    except (OSError, ValueError):
        return None
    if previous.get('schemaVersion') == SCHEMA_VERSION and previous.get('components') == components:
        return previous.get('generatedAt')
    return None


def load_schema():
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def validate(documents, schema=None):
    """Validate {name: document} against the v1 schema. Without the jsonschema
    package this only warns locally and fails in CI, where it is installed."""
    try:
        import jsonschema
    except ImportError:
        message = 'catalog API v1: jsonschema is not installed, output not validated (pip install jsonschema)'
        if os.environ.get('CI'):
            raise RuntimeError(message)
        print(f'⚠️ {message}')
        return
    schema = schema or load_schema()
    defs = schema['$defs']
    for name, (definition, document) in documents.items():
        resolver_schema = dict(schema, **{'$ref': f'#/$defs/{definition}'})
        errors = sorted(jsonschema.Draft202012Validator(resolver_schema).iter_errors(document),
                        key=lambda e: list(e.absolute_path))
        if errors:
            first = errors[0]
            where = '/'.join(str(p) for p in first.absolute_path)
            raise ValueError(f'catalog API v1: {name} does not match the schema at {where}: {first.message} '
                             f'({len(errors)} error(s))')
    # Strict on our side: every key we publish is declared, so the schema
    # cannot silently fall behind the data (consumers must still ignore
    # unknown keys; the published schema allows them).
    declared = set(defs['component']['properties'])
    for name, (definition, document) in documents.items():
        for component in document.get('components', []) if definition == 'catalog' else []:
            extra = set(component) - declared
            if extra:
                raise ValueError(f'catalog API v1: {name} has undeclared fields {sorted(extra)}')


def write_catalog_api_v1(index_data, out_dir='dashboard/public/api/v1', content_dir=None, now=None):
    """Write the v1 catalog next to the legacy files. Returns version.json's data."""
    def content_exists(type_key, slug):
        return content_dir is None or os.path.isfile(os.path.join(content_dir, type_key, slug + '.json'))

    components = build_components(index_data, content_exists)
    generated_at = _previous_generated_at(out_dir, components)
    if generated_at is None:
        from datetime import datetime, timezone
        generated_at = (now or datetime.now(timezone.utc)).strftime('%Y-%m-%dT%H:%M:%SZ')

    catalog = _envelope(components, generated_at)
    per_type = {t: _envelope([c for c in components if c['type'] == t], generated_at) for t in TYPES}
    catalog_text = _dump(catalog)
    version = {
        'schemaVersion': SCHEMA_VERSION,
        'generatedAt': generated_at,
        'sha256': hashlib.sha256(catalog_text.encode('utf-8')).hexdigest(),
        'count': len(components),
        'counts': {t: per_type[t]['count'] for t in TYPES},
        'catalog': f'{SITE}/api/v1/catalog.json',
        'docs': DOCS,
    }

    schema = load_schema()
    documents = {'catalog.json': ('catalog', catalog), 'version.json': ('version', version)}
    documents.update({f'catalog/{t}.json': ('catalog', per_type[t]) for t in TYPES})
    validate(documents, schema)

    os.makedirs(os.path.join(out_dir, 'catalog'), exist_ok=True)
    with open(os.path.join(out_dir, 'catalog.json'), 'w', encoding='utf-8') as f:
        f.write(catalog_text)
    for t, document in per_type.items():
        with open(os.path.join(out_dir, 'catalog', f'{t}.json'), 'w', encoding='utf-8') as f:
            f.write(_dump(document))
    with open(os.path.join(out_dir, 'version.json'), 'w', encoding='utf-8') as f:
        json.dump(version, f, ensure_ascii=False, indent=2)
        f.write('\n')
    with open(os.path.join(out_dir, 'schema.json'), 'w', encoding='utf-8') as f:
        json.dump(schema, f, ensure_ascii=False, indent=2)
        f.write('\n')
    return version
