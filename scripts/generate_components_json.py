import os
import re
import json
import shutil
import requests
import yaml
import subprocess
from collections import defaultdict
from dotenv import load_dotenv
from pathlib import Path
from generate_trending_data import fetch_with_retry
from skillspector_catalog import attach_skillspector
import external_skills
from catalog_api_v1 import write_catalog_api_v1

# Load environment variables
load_dotenv()


def _line_frontmatter(frontmatter):
    """Line-based fallback for frontmatter that is not valid YAML (Claude Code
    tolerates many of these, e.g. unquoted colons in a description)."""
    meta = {}
    for line in frontmatter.split('\n'):
        for key in ('description', 'author', 'repo', 'version', 'license', 'tags'):
            if line.startswith(key + ':'):
                meta[key] = line.split(key + ':', 1)[1].strip()
    return meta


def parse_frontmatter_meta(content):
    """Return description, author, repo, version, license and keywords from a
    markdown file's frontmatter. Parses YAML so block scalars (`description: |`)
    and the Agent Skills `metadata:` map work; `metadata.*` is used only when the
    top-level key is absent."""
    out = {'description': '', 'author': '', 'repo': '', 'version': '', 'license': '', 'keywords': []}
    if not content.startswith('---'):
        return out
    end = content.find('---', 3)
    if end == -1:
        return out
    frontmatter = content[3:end]
    try:
        # BaseLoader keeps every scalar a string (version 1.10 stays "1.10")
        data = yaml.load(frontmatter, Loader=yaml.BaseLoader)
    except yaml.YAMLError:
        data = None
    if not isinstance(data, dict):
        data = _line_frontmatter(frontmatter)
    meta = data.get('metadata') if isinstance(data.get('metadata'), dict) else {}

    def pick(*keys):
        for source in (data, meta):
            for key in keys:
                value = source.get(key)
                if value not in (None, '', []):
                    return value
        return None

    def text(value):
        if value is None:
            return ''
        if isinstance(value, dict):
            value = value.get('name') or value.get('url') or ''
        return str(value).strip()

    out['description'] = text(pick('description'))
    out['author'] = text(pick('author'))
    out['repo'] = text(pick('repo'))
    out['version'] = text(pick('version'))
    out['license'] = text(pick('license'))
    tags = pick('tags')
    if isinstance(tags, list):
        out['keywords'] = [str(t).strip() for t in tags if str(t).strip()]
    elif isinstance(tags, str):
        tags = tags.strip()
        # Line fallback keeps the old "[tag1, tag2]" behaviour
        if tags.startswith('[') and tags.endswith(']'):
            out['keywords'] = [t.strip() for t in tags[1:-1].split(',')]
    return out

def run_security_validation():
    """
    Run security validation on all components and return the results.
    Returns a dictionary with component paths as keys and security data as values.
    """
    print("🔒 Running security validation on components...")

    try:
        # Change to cli-tool directory to run npm command
        cli_tool_dir = Path(__file__).parent / 'cli-tool'

        # Run security audit and generate JSON report
        result = subprocess.run(
            ['npm', 'run', 'security-audit:json'],
            cwd=cli_tool_dir,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        if result.returncode != 0:
            print(f"⚠️ Security validation completed with warnings")
            print(f"  stdout: {result.stdout[:200]}")
            print(f"  stderr: {result.stderr[:200]}")
        else:
            print("✅ Security validation completed successfully")

        # Read the generated security report
        security_report_path = cli_tool_dir / 'security-report.json'

        if not security_report_path.exists():
            print("⚠️ Security report not found, skipping security metadata")
            return {}

        with open(security_report_path, 'r', encoding='utf-8') as f:
            security_data = json.load(f)

        # Transform security data into a lookup dictionary
        # Key format: "agents/category/name" -> security metadata
        security_lookup = {}

        for component_result in security_data.get('components', []):
            component_info = component_result.get('component', {})
            component_path = component_info.get('path', '')
            component_type = component_info.get('type', '')

            if component_path:
                # Extract category and name from path
                # Path format: components/agents/development-team/frontend-developer.md
                path_parts = component_path.replace('\\', '/').split('/')

                # Handle both formats: "components/agents/..." and "cli-tool/components/agents/..."
                if 'components' in path_parts:
                    components_idx = path_parts.index('components')
                    if len(path_parts) > components_idx + 3:
                        component_type = path_parts[components_idx + 1]  # agents, commands, etc.
                        category = path_parts[components_idx + 2]
                        file_name = path_parts[components_idx + 3]
                        name = os.path.splitext(file_name)[0]

                        # Create lookup key
                        key = f"{component_type}/{category}/{name}"

                        # Extract security metadata
                        overall = component_result.get('overall', {})
                        validators = component_result.get('validators', {})

                        # Build validators object with detailed errors and warnings
                        validators_data = {}
                        for validator_name, validator_result in validators.items():
                            # Process errors to extract line/column information
                            processed_errors = []
                            for error in validator_result.get('errors', []):
                                error_data = {
                                    'level': error.get('level', 'error'),
                                    'code': error.get('code', ''),
                                    'message': error.get('message', ''),
                                    'timestamp': error.get('timestamp', '')
                                }

                                # Extract metadata with line/column info
                                metadata = error.get('metadata', {})
                                if metadata:
                                    error_data['metadata'] = metadata

                                    # Extract location info if available
                                    if 'line' in metadata:
                                        error_data['line'] = metadata['line']
                                    if 'column' in metadata:
                                        error_data['column'] = metadata['column']
                                    if 'position' in metadata:
                                        error_data['position'] = metadata['position']
                                    if 'lineText' in metadata:
                                        error_data['lineText'] = metadata['lineText']

                                    # Extract examples array if present (for patterns with multiple matches)
                                    if 'examples' in metadata:
                                        error_data['examples'] = metadata['examples']

                                processed_errors.append(error_data)

                            # Process warnings similarly
                            processed_warnings = []
                            for warning in validator_result.get('warnings', []):
                                warning_data = {
                                    'level': warning.get('level', 'warning'),
                                    'code': warning.get('code', ''),
                                    'message': warning.get('message', ''),
                                    'timestamp': warning.get('timestamp', '')
                                }

                                # Extract metadata with line/column info
                                metadata = warning.get('metadata', {})
                                if metadata:
                                    warning_data['metadata'] = metadata

                                    # Extract location info if available
                                    if 'line' in metadata:
                                        warning_data['line'] = metadata['line']
                                    if 'column' in metadata:
                                        warning_data['column'] = metadata['column']
                                    if 'position' in metadata:
                                        warning_data['position'] = metadata['position']
                                    if 'lineText' in metadata:
                                        warning_data['lineText'] = metadata['lineText']

                                    # Extract examples array if present
                                    if 'examples' in metadata:
                                        warning_data['examples'] = metadata['examples']

                                processed_warnings.append(warning_data)

                            validators_data[validator_name] = {
                                'valid': validator_result.get('valid', False),
                                'score': validator_result.get('score', 0),
                                'errorCount': validator_result.get('errorCount', 0),
                                'warningCount': validator_result.get('warningCount', 0),
                                'errors': processed_errors,
                                'warnings': processed_warnings,
                                'info': validator_result.get('info', [])
                            }

                        security_lookup[key] = {
                            'validated': True,
                            'valid': overall.get('valid', False),
                            'score': overall.get('score', 0),
                            'errorCount': overall.get('errorCount', 0),
                            'warningCount': overall.get('warningCount', 0),
                            'lastValidated': security_data.get('timestamp', ''),
                            'validators': validators_data
                        }

                        # Add hash if available from integrity validator
                        integrity_data = validators.get('integrity', {})
                        if 'info' in integrity_data:
                            for info_item in integrity_data['info']:
                                # info_item is a dictionary with code, message, metadata
                                if isinstance(info_item, dict):
                                    metadata = info_item.get('metadata', {})
                                    if 'fullHash' in metadata:
                                        security_lookup[key]['hash'] = metadata['fullHash']
                                        break
                                    elif 'hash' in metadata:
                                        security_lookup[key]['hash'] = metadata['hash']
                                        break

        print(f"✅ Security metadata extracted for {len(security_lookup)} components")
        return security_lookup

    except subprocess.TimeoutExpired:
        print("⚠️ Security validation timed out after 5 minutes")
        return {}
    except FileNotFoundError:
        print("⚠️ npm command not found, skipping security validation")
        return {}
    except Exception as e:
        print(f"⚠️ Error running security validation: {e}")
        return {}

def previous_download_stats(catalog_path='docs/components.json'):
    """
    The download counts already in the generated catalog, keyed the way
    fetch_download_stats() keys them (type/category/name, templates/name).
    Used by --skip-downloads (a content-only regeneration
    keeps yesterday's counts instead of resetting them to 0, and the daily
    cron brings them up to date) and whenever fetch_download_stats() fails.
    """
    try:
        with open(catalog_path, 'r', encoding='utf-8') as f:
            catalog = json.load(f)
    except (OSError, ValueError) as e:
        print(f"⚠️ Warning: could not read {catalog_path} ({e}); download counts start at 0")
        return {}
    counts = {}
    for component_type, entries in catalog.items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict) or 'downloads' not in entry:
                continue
            name = entry.get('name')
            if component_type == 'templates':
                key = f"templates/{name}"
            else:
                key = f"{component_type}/{entry.get('category')}/{name}"
            counts[key] = entry['downloads']
    print(f"📊 Keeping {len(counts)} download counts from {catalog_path}")
    return counts


def fetch_download_stats():
    """
    Fetch download statistics from Supabase
    Returns a dictionary with type/category/name as key and download count as value,
    or None when the table could not be read in full (the caller then keeps the
    counts already in the catalog rather than publishing a partial count)
    Supports: agents, commands, mcps, settings, hooks, sandbox, skills, loops, mods,
    templates, plugins
    """
    print("📊 Fetching download statistics from Supabase...")

    # Define type mapping once (DRY principle)
    # Maps the raw `component_type` in Supabase to the plural directory name under
    # cli-tool/components/. `function-hook` is the pre-#910 name for `mod` and older
    # CLI versions still write it, so it has to map to 'mods' too or those downloads
    # are looked up under a key no component has and silently dropped.
    TYPE_MAPPING = {
        'agent': 'agents',
        'command': 'commands',
        'setting': 'settings',
        'hook': 'hooks',
        'mcp': 'mcps',
        'skill': 'skills',
        'loop': 'loops',
        'mod': 'mods',
        'function-hook': 'mods',
        'function-hooks': 'mods',
        'template': 'templates',
        'plugin': 'plugins',
        'sandbox': 'sandbox'
    }

    # Get Supabase credentials (same as generate_trending_data.py)
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_api_key = os.getenv("SUPABASE_API_KEY")

    if not supabase_url or not supabase_api_key:
        print("⚠️ Warning: Missing Supabase credentials, keeping existing download counts")
        return None
    
    headers = {
        'apikey': supabase_api_key,
        'Authorization': f'Bearer {supabase_api_key}'
    }

    # Keyset pagination on the primary key, the same way generate_trending_data.py
    # reads this table. The old Range/offset paging made Postgres scan and discard
    # every earlier row, so deep pages timed out (HTTP 500 around row 98,000 of
    # 1.6M) and the loop kept whatever it had: the catalog then published a
    # fraction of each component's downloads and the counts dropped overnight.
    page_size = 1000
    last_id = 0
    component_totals = defaultdict(int)
    records = 0
    while True:
        api_url = (f"{supabase_url}/rest/v1/component_downloads"
                   f"?select=id,component_type,component_name"
                   f"&id=gt.{last_id}&order=id.asc&limit={page_size}")
        response = fetch_with_retry(api_url, headers, max_retries=5, timeout=60)
        if response is None:
            # A partial read undercounts every component, so it must never be
            # published: the caller keeps the counts the catalog already has.
            print(f"❌ Supabase read failed after id {last_id} ({records:,} records); "
                  f"download counts NOT updated")
            return None

        batch = response.json()
        for download in batch:
            component_type = download.get('component_type', '')
            component_name = download.get('component_name', '')
            if not (component_type and component_name):
                continue
            # component_name may already include the category
            if '/' in component_name:
                category = component_name.split('/')[0]
                actual_name = component_name.split('/')[-1]
            else:
                actual_name = component_name
                category = 'general'
            mapped_type = TYPE_MAPPING.get(component_type, component_type + 's')
            # Several raw types can share one key (e.g. mod + function-hook)
            component_totals[f"{mapped_type}/{category}/{actual_name}"] += 1

        records += len(batch)
        if len(batch) < page_size:
            break
        last_id = batch[-1]['id']
        if (records // page_size) % 100 == 0:
            print(f"  Fetched {records:,} records so far...")

    print(f"📊 Total records fetched: {records:,}")
    if records == 0:
        print("❌ component_downloads returned no rows; download counts NOT updated")
        return None

    print(f"✅ Fetched and aggregated {len(component_totals)} component download stats")
    return dict(component_totals)

def scan_directory_recursively(directory_path, relative_to_path=None):
    """
    Recursively scan a directory and return all files with their relative paths.
    """
    files_list = []
    
    if not os.path.isdir(directory_path):
        return files_list
    
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            file_path = os.path.join(root, file)
            if relative_to_path:
                relative_path = os.path.relpath(file_path, relative_to_path)
                files_list.append(relative_path.replace("\\", "/"))
            else:
                files_list.append(file)
    
    return files_list

# Language per extension for the component page's language bar; the same map
# as dashboard/scripts/generate-og-images.mjs, so the share card and the page agree.
LANGUAGE_BY_EXT = {
    '.md': 'Markdown', '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.mjs': 'JavaScript',
    '.json': 'JSON', '.py': 'Python', '.sh': 'Shell', '.txt': 'Text', '.yaml': 'YAML', '.yml': 'YAML',
}

def git_component_history(components_base_path):
    """
    One `git log` pass over the components tree. Returns {repo path: {'last': commit, 'added': date}}
    keyed by every changed file and by every skill/mod directory, or None when the history is not
    there (a shallow clone), so the caller can keep the previous values instead of wrong ones.
    """
    try:
        shallow = subprocess.run(['git', 'rev-parse', '--is-shallow-repository'],
                                 capture_output=True, text=True, check=True).stdout.strip()
        if shallow == 'true':
            print("Warning: shallow clone, keeping the previous git metadata of each component")
            return None
        log = subprocess.run(
            ['git', 'log', '--no-renames', '--format=%x01%H%x09%aI%x09%an%x09%s', '--name-only', '--', components_base_path],
            capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"Warning: could not read git history: {e}")
        return None

    history = {}
    for block in log.split('\x01')[1:]:
        header, _, names = block.partition('\n')
        sha, date, author, subject = (header.split('\t', 3) + ['', '', '', ''])[:4]
        commit = {'sha': sha, 'date': date, 'author': author, 'subject': subject}
        keys = set()
        for name in names.split('\n'):
            if not name:
                continue
            keys.add(name)
            parts = name.split('/')
            if len(parts) > 5 and parts[2] in ('skills', 'mods', 'plugins'):
                keys.add('/'.join(parts[:5]))
        # Newest first: the first commit seen is the last change, the last one seen is the oldest.
        for key in keys:
            entry = history.setdefault(key, {'last': commit})
            entry['added'] = date
    return history

def component_file_stats(root):
    """Files of a component on disk with their size, line count and language, plus bytes per language."""
    if os.path.isdir(root):
        rels = sorted(scan_directory_recursively(root, root))
        paths = [(rel, os.path.join(root, rel)) for rel in rels]
    elif os.path.isfile(root):
        paths = [(os.path.basename(root), root)]
    else:
        return [], []
    files = []
    language_bytes = defaultdict(int)
    for rel, full in paths:
        try:
            size = os.path.getsize(full)
            with open(full, 'rb') as f:
                data = f.read()
        except OSError:
            continue
        lines = None if b'\0' in data else data.count(b'\n') + (1 if data and not data.endswith(b'\n') else 0)
        files.append({'path': rel, 'bytes': size, 'lines': lines})
        # Licence texts would dominate small components, as on the share card.
        if not os.path.basename(rel).startswith('LICENSE'):
            language_bytes[LANGUAGE_BY_EXT.get(os.path.splitext(rel)[1].lower(), 'Other')] += size
    languages = [{'name': n, 'bytes': b} for n, b in sorted(language_bytes.items(), key=lambda x: -x[1])]
    return files, languages

def component_page_meta(components_base_path, ctype, component, history, previous):
    """The `meta` block of a component's content file: files, languages and its git history."""
    repo_path = f"{components_base_path}/{ctype}/{component['path']}"
    stats_root = repo_path
    # External skills and plugins: list the files the CLI installs (upstream, pinned commit), not the source.json.
    if ctype in ('skills', 'plugins') and os.path.isdir(repo_path) and external_skills.is_external(Path(repo_path)):
        try:
            stats_root = str(external_skills.local_dir(Path(repo_path)))
        except (OSError, ValueError) as e:
            print(f"   Warning: could not materialize external skill {component['path']}: {e}")
    files, languages = component_file_stats(stats_root)
    meta = {'files': files, 'languages': languages}
    if history is None:
        for key in ('lastCommit', 'addedAt'):
            if previous.get(key):
                meta[key] = previous[key]
    elif repo_path in history:
        entry = history[repo_path]
        last = dict(entry['last'])
        pr = re.search(r'\(#(\d+)\)\s*$', last['subject'])
        last['pr'] = int(pr.group(1)) if pr else None
        meta['lastCommit'] = last
        meta['addedAt'] = entry['added']
    return meta

def loops_by_component(loops):
    """{'{type plural}/{path without extension}': [loop path without extension, ...]} from each
    loop's `components: [type:path, ...]` frontmatter (the same tokens the loop page parses)."""
    out = defaultdict(list)
    for loop in loops:
        match = re.match(r'^---\s*\n([\s\S]*?)\n---', loop.get('content', ''))
        if not match:
            continue
        line = re.search(r'^components\s*:\s*\[(.*)\]\s*$', match.group(1), re.M)
        if not line:
            continue
        loop_path = re.sub(r'\.md$', '', loop['path'])
        for token in line.group(1).split(','):
            token = token.strip().strip('"\'')
            ref_type, sep, ref_path = token.partition(':')
            if not sep or not ref_type.strip() or not ref_path.strip():
                continue
            ref_type = ref_type.strip()
            plural = ref_type if ref_type.endswith('s') else ref_type + 's'
            key = f"{plural}/{re.sub(r'[.](md|json)$', '', ref_path.strip())}"
            if loop_path not in out[key]:
                out[key].append(loop_path)
    return {k: sorted(v) for k, v in out.items()}

def template_content_payload(templates_base_path, template):
    """Content file of a template: the CLAUDE.md its install writes, plus its files."""
    if template.get('subtype') == 'framework':
        language_root = os.path.join(templates_base_path, template.get('language', ''))
        root = os.path.join(language_root, 'examples', template['name'])
        candidates = [os.path.join(root, 'CLAUDE.md'), os.path.join(language_root, 'CLAUDE.md'), os.path.join(root, 'README.md')]
    else:
        root = os.path.join(templates_base_path, template['name'])
        candidates = [os.path.join(root, 'CLAUDE.md'), os.path.join(root, 'README.md')]
    content, main_file = '', ''
    for candidate in candidates:
        if os.path.isfile(candidate):
            with open(candidate, 'r', encoding='utf-8') as f:
                content = f.read()
            main_file = os.path.basename(candidate)
            break
    files = []
    language_bytes = defaultdict(int)
    for rel in template.get('files', []):
        full = os.path.join(root, rel)
        try:
            with open(full, 'rb') as f:
                data = f.read()
        except OSError:
            continue
        lines = None if b'\0' in data else data.count(b'\n') + (1 if data and not data.endswith(b'\n') else 0)
        files.append({'path': rel, 'bytes': len(data), 'lines': lines})
        language_bytes[LANGUAGE_BY_EXT.get(os.path.splitext(rel)[1].lower(), 'Other')] += len(data)
    if not content and not files:
        return None
    languages = [{'name': n, 'bytes': b} for n, b in sorted(language_bytes.items(), key=lambda x: -x[1])]
    payload = {'content': content, 'meta': {'files': files, 'languages': languages}}
    if main_file:
        payload['mainFile'] = main_file
    return payload

def generate_components_json(skip_downloads=False, skip_skillspector=False, skillspector_only=None):
    """
    Scans the cli-tool/components and cli-tool/templates directories and generates a components.json file
    for the static website, including the content of each file and download statistics.
    """
    components_base_path = 'cli-tool/components'
    templates_base_path = 'cli-tool/templates'
    output_path = 'docs/components.json'
    components_data = {'agents': [], 'commands': [], 'mcps': [], 'settings': [], 'hooks': [], 'sandbox': [], 'skills': [], 'loops': [], 'mods': [], 'templates': [], 'plugins': []}

    # Run security validation
    security_metadata = run_security_validation()

    # Fetch download statistics. Pulling the whole component_downloads table
    # from Supabase is what makes a run take minutes; a content-only refresh
    # keeps the counts the catalog already has.
    download_stats = None if skip_downloads else fetch_download_stats()
    if download_stats is None:
        download_stats = previous_download_stats(output_path)
    component_types = ['agents', 'commands', 'mcps', 'settings', 'hooks', 'sandbox', 'skills', 'loops', 'mods', 'plugins']
    marketplace_dirs = []  # catalog plugins that made it into the catalog

    print(f"Starting scan of {components_base_path} and {templates_base_path}...")

    # Scan components (existing logic)
    for component_type in component_types:
        type_path = os.path.join(components_base_path, component_type)
        if not os.path.isdir(type_path):
            print(f"Warning: Directory not found for type: {component_type}")
            continue

        print(f"Scanning for {component_type} in {type_path}...")

        # Special handling for skills - they use SKILL.md inside category/skill directories
        if component_type == 'skills':
            for category in os.listdir(type_path):
                category_path = os.path.join(type_path, category)
                if os.path.isdir(category_path) and not category.endswith('.md'):
                    for skill_dir in os.listdir(category_path):
                        skill_dir_path = os.path.join(category_path, skill_dir)
                        if os.path.isdir(skill_dir_path):
                            # External skill: source.json points at a pinned commit of
                            # another repo; read the files from the local checkout of it.
                            source = None
                            skill_root = skill_dir_path
                            if external_skills.is_external(Path(skill_dir_path)):
                                manifest = external_skills.read_manifest(Path(skill_dir_path))
                                skill_root = str(external_skills.local_dir(Path(skill_dir_path)))
                                source = {
                                    'repo': manifest['repo'],
                                    'path': manifest['path'],
                                    'commit': manifest['commit'],
                                    'license': manifest['license'],
                                    'url': external_skills.source_url(manifest),
                                    'requires': manifest['requires'],
                                }
                            # Look for SKILL.md inside the skill directory
                            skill_file_path = os.path.join(skill_root, 'SKILL.md')
                            if os.path.isfile(skill_file_path):
                                name = skill_dir  # Use directory name as skill name

                                # Read file content
                                content = ''
                                description = ''
                                try:
                                    with open(skill_file_path, 'r', encoding='utf-8') as f:
                                        content = f.read()

                                    # Extract metadata from frontmatter if available
                                    author = ''
                                    repo = ''
                                    version = ''
                                    license_field = ''
                                    keywords = []
                                    meta = parse_frontmatter_meta(content)
                                    description = meta['description']
                                    author = meta['author']
                                    repo = meta['repo']
                                    version = meta['version']
                                    license_field = meta['license']
                                    keywords = meta['keywords']

                                except Exception as e:
                                    print(f"Warning: Could not read file {skill_file_path}: {e}")

                                # Look up download count for this skill
                                download_key = f"{component_type}/{category}/{name}"
                                downloads = download_stats.get(download_key, 0)

                                # Look up security metadata for this skill
                                security_key = f"{component_type}/{category}/{name}"
                                security = security_metadata.get(security_key, {
                                    'validated': False,
                                    'valid': None,
                                    'score': None,
                                    'errorCount': 0,
                                    'warningCount': 0,
                                    'lastValidated': None
                                })

                                # Collect reference files (all files except SKILL.md)
                                references = []
                                for ref_file in scan_directory_recursively(skill_root, skill_root):
                                    if ref_file != 'SKILL.md':
                                        references.append(ref_file)
                                references.sort()

                                if source:
                                    author = manifest.get('author') or author
                                    license_field = manifest['license']
                                    repo = f"https://github.com/{manifest['repo']}"

                                # Path includes category for proper organization
                                component = {
                                    'name': name,  # Just the skill directory name
                                    'path': f"{category}/{name}",  # category/skill-name format
                                    'category': category,
                                    'type': 'skill',
                                    'content': content,
                                    'description': description,
                                    'author': author,
                                    'repo': repo,
                                    'version': version,
                                    'license': license_field,
                                    'keywords': keywords,
                                    'downloads': downloads,
                                    'security': security,
                                    'references': references
                                }
                                if source:
                                    component['source'] = source
                                    # The site cannot read these files from this repo, so
                                    # they ride in the content file (like mods).
                                    component['files'] = {}
                                    for rel in ['SKILL.md'] + references:
                                        try:
                                            with open(os.path.join(skill_root, rel), 'r', encoding='utf-8') as f:
                                                component['files'][rel] = f.read()
                                        except (UnicodeDecodeError, OSError):
                                            pass
                                components_data[component_type].append(component)
                                print(f"  Processed skill: {category}/{name}")
            continue  # Skip the normal file scanning for skills

        # Plugins: cli-tool/components/plugins/{category}/{name}/source.json pins a
        # whole Claude Code plugin in another repo (same manifest as external
        # skills). The README is the content; plugin.json gives the metadata and
        # every text file travels in the content file, like mods. Each plugin
        # listed here is also an entry of the aitmpl marketplace written below.
        if component_type == 'plugins':
            for category in sorted(os.listdir(type_path)):
                category_path = os.path.join(type_path, category)
                if not os.path.isdir(category_path):
                    continue
                for plugin_dir in sorted(os.listdir(category_path)):
                    plugin_path = Path(category_path) / plugin_dir
                    if not external_skills.is_external(plugin_path):
                        continue
                    try:
                        manifest = external_skills.read_manifest(plugin_path)
                        root = external_skills.local_dir(plugin_path)
                        meta = external_skills.plugin_manifest(root)
                        contains = external_skills.plugin_inventory(root)
                    except (OSError, ValueError) as e:
                        print(f"Warning: skipping plugin {category}/{plugin_dir}: {e}")
                        continue
                    name = plugin_dir
                    content = ''
                    readme = root / 'README.md'
                    try:
                        content = readme.read_text(encoding='utf-8') if readme.is_file() else ''
                    except (OSError, UnicodeDecodeError):
                        content = ''  # falls back to the description below
                    description = str(meta.get('description') or '')
                    if not content:
                        content = f"# {name}\n\n{description}\n"
                    author_field = meta.get('author')
                    author = (author_field.get('name', '') if isinstance(author_field, dict) else str(author_field or '')) or manifest.get('author', '')
                    keywords = [str(k) for k in meta.get('keywords') or [] if isinstance(k, (str, int, float))]
                    references = sorted(r for r in scan_directory_recursively(str(root), str(root)) if r != 'README.md')
                    files = {'README.md': content}
                    for rel in references:
                        try:
                            files[rel] = (root / rel).read_text(encoding='utf-8')
                        except (UnicodeDecodeError, OSError):
                            pass
                    components_data['plugins'].append({
                        'name': name,
                        'path': f"{category}/{name}",
                        'category': category,
                        'type': 'plugin',
                        'content': content,
                        'description': description,
                        'author': author,
                        'repo': f"https://github.com/{manifest['repo']}",
                        'version': str(meta.get('version') or ''),
                        'license': manifest['license'],
                        'keywords': keywords,
                        # Read by the legacy docs/ grid (docs/js/index-events.js) for every plugin card.
                        'installCommand': f'npx claude-code-templates@latest --plugin {category}/{name}',
                        'downloads': download_stats.get(f"plugins/{category}/{name}", 0),
                        'references': references,
                        'files': files,
                        # What it ships, by kind (skills, agents, commands, hooks, ...).
                        'contains': contains,
                        'source': {
                            'repo': manifest['repo'],
                            'path': manifest['path'],
                            'commit': manifest['commit'],
                            'license': manifest['license'],
                            'url': external_skills.source_url(manifest),
                        },
                    })
                    marketplace_dirs.append(plugin_path.resolve())
                    print(f"  Processed plugin: {category}/{name}")
            continue

        # Mods: one directory per plugin, exactly Anthropic's mods/ layout
        # (.claude-plugin/plugin.json + hooks/hooks.json + hooks/** + optional
        # types/, tests/, README.md). The README is the content shown on the
        # site; every text file travels in the content file so the site's
        # explorer and the "send to repo" flow have the whole plugin.
        if component_type == 'mods':
            MOD_TEXT_EXT = ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md', '.d.ts', '.txt', '.css', '.yml', '.yaml', 'LICENSE')
            for category in sorted(os.listdir(type_path)):
                category_path = os.path.join(type_path, category)
                if not os.path.isdir(category_path) or category in ('types',):
                    continue
                for mod_dir in sorted(os.listdir(category_path)):
                    mod_path = os.path.join(category_path, mod_dir)
                    manifest_path = os.path.join(mod_path, '.claude-plugin', 'plugin.json')
                    hooks_path = os.path.join(mod_path, 'hooks', 'hooks.json')
                    if not (os.path.isdir(mod_path) and os.path.isfile(manifest_path) and os.path.isfile(hooks_path)):
                        continue
                    try:
                        with open(manifest_path, 'r', encoding='utf-8') as f:
                            manifest = json.load(f)
                        with open(hooks_path, 'r', encoding='utf-8') as f:
                            hooks_json = json.load(f)
                    except (OSError, ValueError) as e:
                        print(f"Warning: skipping mod {category}/{mod_dir}: {e}")
                        continue
                    name = manifest.get('name') or mod_dir
                    description = manifest.get('description') or hooks_json.get('description', '')
                    author_field = manifest.get('author', '')
                    author = author_field.get('name', '') if isinstance(author_field, dict) else str(author_field)
                    repo = manifest.get('repository') or manifest.get('homepage') or ''
                    modules = [str(m).lstrip('./') for m in (hooks_json.get('modules') or [])]

                    readme_path = os.path.join(mod_path, 'README.md')
                    content = ''
                    if os.path.isfile(readme_path):
                        with open(readme_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                    if not content:
                        content = f"# {name}\n\n{description}\n"

                    files = {}
                    references = []
                    for rel in sorted(scan_directory_recursively(mod_path, mod_path)):
                        if rel == 'README.md' or '/node_modules/' in rel or rel.startswith('.git/'):
                            continue
                        references.append(rel)
                        if rel.endswith(MOD_TEXT_EXT) or os.path.basename(rel) == 'LICENSE':
                            try:
                                with open(os.path.join(mod_path, rel), 'r', encoding='utf-8') as f:
                                    files[rel] = f.read()
                            except (OSError, UnicodeDecodeError):
                                pass

                    download_key = f"{component_type}/{category}/{name}"
                    downloads = download_stats.get(download_key, 0)
                    security = security_metadata.get(download_key, {
                        'validated': False, 'valid': None, 'score': None,
                        'errorCount': 0, 'warningCount': 0, 'lastValidated': None
                    })
                    components_data[component_type].append({
                        'name': name,
                        'path': f"{category}/{mod_dir}",
                        'category': category,
                        'type': 'mod',
                        'content': content,
                        'description': description,
                        'author': author,
                        'repo': repo,
                        'version': manifest.get('version', ''),
                        'license': manifest.get('license', ''),
                        'keywords': manifest.get('keywords', []) if isinstance(manifest.get('keywords'), list) else [],
                        'downloads': downloads,
                        'security': security,
                        'modules': modules,
                        'userConfig': manifest.get('userConfig', {}),
                        'references': references,
                        'files': files,
                    })
                    print(f"  Processed mod: {category}/{mod_dir} ({len(references)} files)")
            continue

        # Normal scanning for other component types
        for category in os.listdir(type_path):
            category_path = os.path.join(type_path, category)
            if os.path.isdir(category_path):
                for file_name in os.listdir(category_path):
                    file_path = os.path.join(category_path, file_name)
                    if os.path.isfile(file_path) and (file_name.endswith('.md') or file_name.endswith('.json')) and not file_name.endswith('.py'):
                        name = os.path.splitext(file_name)[0]
                        
                        # Read file content
                        content = ''
                        description = ''
                        author = ''
                        repo = ''
                        version = ''
                        license_field = ''
                        keywords = []
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()

                            # Extract description, author and repo from JSON files
                            if file_name.endswith('.json'):
                                try:
                                    import json
                                    json_data = json.loads(content)

                                    if component_type == 'mcps':
                                        # Extract description from the first mcpServer entry
                                        if 'mcpServers' in json_data:
                                            for server_name, server_config in json_data['mcpServers'].items():
                                                if isinstance(server_config, dict) and 'description' in server_config:
                                                    description = server_config['description']
                                                    break  # Use the first description found
                                    elif component_type in ['settings', 'hooks']:
                                        # Extract metadata from settings/hooks JSON files
                                        if 'description' in json_data:
                                            description = json_data['description']
                                        if 'author' in json_data:
                                            author = json_data['author']
                                        if 'repo' in json_data:
                                            repo = json_data['repo']
                                        if 'version' in json_data:
                                            version = json_data['version']
                                        if 'license' in json_data:
                                            license_field = json_data['license']
                                        if 'keywords' in json_data and isinstance(json_data['keywords'], list):
                                            keywords = json_data['keywords']

                                except json.JSONDecodeError:
                                    print(f"Warning: Invalid JSON in {file_path}")

                            # Extract metadata from markdown frontmatter
                            elif file_name.endswith('.md'):
                                meta = parse_frontmatter_meta(content)
                                description = meta['description']
                                author = meta['author']
                                repo = meta['repo']
                                version = meta['version']
                                license_field = meta['license']
                                keywords = meta['keywords']

                        except Exception as e:
                            print(f"Warning: Could not read file {file_path}: {e}")

                        # Look up download count for this component
                        # The key in download_stats uses the plural form: agents/category/name
                        download_key = f"{component_type}/{category}/{name}"
                        downloads = download_stats.get(download_key, 0)

                        # Look up security metadata for this component
                        security_key = f"{component_type}/{category}/{name}"
                        security = security_metadata.get(security_key, {
                            'validated': False,
                            'valid': None,
                            'score': None,
                            'errorCount': 0,
                            'warningCount': 0,
                            'lastValidated': None
                        })

                        component = {
                            'name': name,
                            'path': os.path.join(category, file_name).replace("\\", "/"),
                            'category': category,
                            'type': component_type[:-1],  # singular form
                            'content': content,  # Add file content
                            'description': description,  # Add description for MCPs
                            'author': author,  # Add author field
                            'repo': repo,  # Add repository field
                            'version': version,  # Add version field
                            'license': license_field,  # Add license field
                            'keywords': keywords,  # Add keywords field
                            'downloads': downloads,  # Add download count
                            'security': security  # Add security metadata
                        }
                        components_data[component_type].append(component)

    # Scan templates (new logic)
    if os.path.isdir(templates_base_path):
        print(f"Scanning for templates in {templates_base_path}...")
        
        for language_dir in os.listdir(templates_base_path):
            language_path = os.path.join(templates_base_path, language_dir)
            if os.path.isdir(language_path):
                print(f"  Processing language: {language_dir}")
                
                # Collect files in the language directory (excluding examples folder)
                language_files = []
                for item in os.listdir(language_path):
                    item_path = os.path.join(language_path, item)
                    if os.path.isfile(item_path):
                        language_files.append(item)
                    elif os.path.isdir(item_path) and item != 'examples':
                        # For directories like .claude, scan recursively
                        if item == '.claude':
                            recursive_files = scan_directory_recursively(item_path, language_path)
                            language_files.extend(recursive_files)
                        else:
                            # For other directories, just add the directory name (optional)
                            pass
                
                # Look up download count for this template
                template_download_key = f"templates/{language_dir}"
                template_downloads = download_stats.get(template_download_key, 0)
                
                # Create language template entry
                language_template = {
                    'name': language_dir,
                    'id': language_dir,
                    'type': 'template',
                    'subtype': 'language',
                    'category': 'languages',
                    'description': f'{language_dir.title()} project template',
                    'files': sorted(language_files),  # os.listdir order differs per filesystem
                    'installCommand': f'npx claude-code-templates@latest --template={language_dir} --yes',
                    'downloads': template_downloads
                }
                components_data['templates'].append(language_template)
                
                # Check for examples folder (contains frameworks)
                examples_path = os.path.join(language_path, 'examples')
                if os.path.isdir(examples_path):
                    for framework_dir in os.listdir(examples_path):
                        framework_path = os.path.join(examples_path, framework_dir)
                        if os.path.isdir(framework_path):
                            print(f"    Processing framework: {framework_dir}")
                            
                            # Collect files in the framework directory
                            framework_files = []
                            for item in os.listdir(framework_path):
                                item_path = os.path.join(framework_path, item)
                                if os.path.isfile(item_path):
                                    framework_files.append(item)
                                elif os.path.isdir(item_path):
                                    # For directories like .claude, scan recursively
                                    if item == '.claude':
                                        recursive_files = scan_directory_recursively(item_path, framework_path)
                                        framework_files.extend(recursive_files)
                                    else:
                                        # For other directories, just add the directory name (optional)
                                        pass
                            
                            # Look up download count for this framework
                            framework_download_key = f"templates/{framework_dir}"
                            framework_downloads = download_stats.get(framework_download_key, 0)
                            
                            # Create framework template entry
                            framework_template = {
                                'name': framework_dir,
                                'id': framework_dir,
                                'type': 'template',
                                'subtype': 'framework',
                                'category': 'frameworks',
                                'language': language_dir,
                                'description': f'{framework_dir.title()} with {language_dir.title()}',
                                'files': sorted(framework_files),  # os.listdir order differs per filesystem
                                # The CLI takes a framework as --framework of its language
                                # (cli-tool/src/templates.js keys: react, node, django...);
                                # --template=angular-app fails with "Unknown language template".
                                'installCommand': f'npx claude-code-templates@latest --template={language_dir} --framework={re.sub(r"-(app|api)$", "", framework_dir)} --yes',
                                'downloads': framework_downloads
                            }
                            components_data['templates'].append(framework_template)
    else:
        print(f"Warning: Templates directory not found: {templates_base_path}")

    # Load components metadata from marketplace.json (Claude Code standard)
    components_marketplace_path = 'cli-tool/components/.claude-plugin/marketplace.json'
    components_marketplace = None
    if os.path.isfile(components_marketplace_path):
        print(f"Loading components metadata from {components_marketplace_path}...")
        try:
            with open(components_marketplace_path, 'r', encoding='utf-8') as f:
                components_marketplace = json.load(f)
            print(f"✅ Loaded metadata for {len(components_marketplace.get('agents', []))} agents")
        except Exception as e:
            print(f"⚠️ Error reading components metadata from {components_marketplace_path}: {e}")

    # Sort components alphabetically
    for component_type in components_data:
        if component_type == 'templates':
            # Templates have no path: sort them by name
            components_data[component_type].sort(key=lambda x: x['name'])
        else:
            # Sort other components by path
            components_data[component_type].sort(key=lambda x: x['path'])

    # Add components marketplace metadata (Claude Code standard)
    if components_marketplace:
        components_data['componentsMarketplace'] = components_marketplace
        print("✅ Added components marketplace metadata to components.json")

    # ---------------------------------------------------------------------------
    # Performance optimization: separate content from the lightweight index.
    #
    # docs/components.json           → index without 'content' (~87% smaller)
    # dashboard/public/components.json → same, served by Cloudflare Pages
    # dashboard/public/component-content/{type}/{slug}.json → per-component
    #   raw content, loaded on demand only on detail pages.
    # ---------------------------------------------------------------------------
    dashboard_public_dir = 'dashboard/public'
    dashboard_content_dir = os.path.join(dashboard_public_dir, 'component-content')

    # SkillSpector risk signal (display-only, never used for ordering).
    # Rescans only components whose files changed since the last catalog.
    # --skip-skillspector still copies the previous results across.
    attach_skillspector(components_data, output_path, only=skillspector_only,
                        scan_enabled=not skip_skillspector)

    # Component types that carry a 'content' field
    content_bearing_types = ['agents', 'commands', 'mcps', 'settings', 'hooks', 'sandbox', 'skills', 'loops', 'mods', 'plugins']

    # 1. Write per-component content files directly to dashboard/public/component-content/
    os.makedirs(dashboard_content_dir, exist_ok=True)
    written_content_count = 0
    git_history = git_component_history(components_base_path)
    used_by_loops = loops_by_component(components_data.get('loops', []))
    for ctype in content_bearing_types:
        for component in components_data.get(ctype, []):
            raw_content = component.get('content', '')
            if not raw_content:
                continue
            # Slug: path with extension stripped (matches detail-page URL lookup)
            slug = component['path'].replace('.md', '').replace('.json', '')
            content_file_path = os.path.join(dashboard_content_dir, ctype, slug + '.json')
            os.makedirs(os.path.dirname(content_file_path), exist_ok=True)
            content_payload = {'content': raw_content}
            if component.get('files'):
                # Mods: the whole plugin (every text file) rides in the content file
                content_payload['files'] = component['files']
            previous_meta = {}
            if git_history is None:
                try:
                    with open(content_file_path, 'r', encoding='utf-8') as f:
                        previous_meta = json.load(f).get('meta') or {}
                except (OSError, ValueError):
                    pass
            # Shown on the component page: file list, language bar, last commit and date added.
            content_payload['meta'] = component_page_meta(components_base_path, ctype, component, git_history, previous_meta)
            # Loops that install this component, for the page's "Next step" block.
            loops = used_by_loops.get(f"{ctype}/{slug}")
            if loops:
                content_payload['usedByLoops'] = loops
            try:
                with open(content_file_path, 'w', encoding='utf-8') as f:
                    json.dump(content_payload, f, ensure_ascii=False)
                written_content_count += 1
            except IOError as e:
                print(f"Warning: Could not write content file {content_file_path}: {e}")

    # Templates have no catalog folder: their page shows the CLAUDE.md the CLI
    # writes (the framework's own, else the language's, else the README) and
    # the template's files. Without this file the page had no body.
    for template in components_data.get('templates', []):
        content_payload = template_content_payload(templates_base_path, template)
        if not content_payload:
            continue
        content_file_path = os.path.join(dashboard_content_dir, 'templates', template['name'] + '.json')
        os.makedirs(os.path.dirname(content_file_path), exist_ok=True)
        try:
            with open(content_file_path, 'w', encoding='utf-8') as f:
                json.dump(content_payload, f, ensure_ascii=False)
            written_content_count += 1
        except IOError as e:
            print(f"Warning: Could not write content file {content_file_path}: {e}")

    print(f"Generated {written_content_count} component content files in {dashboard_content_dir}/")

    # 2. Build the legacy/docs index: strip only 'content'.
    #    The legacy static site (docs/js/*) renders security badges, so the
    #    'security' field MUST stay in docs/components.json.
    index_data = {}
    for k, v in components_data.items():
        if k in content_bearing_types:
            index_data[k] = [{key: val for key, val in c.items() if key not in ('content', 'files')} for c in v]
        else:
            index_data[k] = v

    # 3. Write the docs index (with 'security', without 'content').
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        print(f"Successfully generated {output_path} (index without content).")
    except IOError as e:
        print(f"Error writing to {output_path}: {e}")

    # ---------------------------------------------------------------------------
    # Dashboard-specific artifacts (Cloudflare Pages, www.aitmpl.com).
    #
    # The dashboard never reads the 'security' field, so we strip it here to
    # shrink the payload the browser downloads. We also emit smaller,
    # purpose-built artifacts so islands stop downloading the whole index:
    #
    #   components.json          → full index, no 'content', no 'security'
    #   counts.json              → { type: count } (sidebars/plugins pages)
    #   components/{type}.json   → per-type slice (grid loads only active type)
    #   search-index.json        → flat [{type,name,path,description,category}]
    # ---------------------------------------------------------------------------
    STRIP_KEYS = {'content', 'security', 'files'}

    def strip_for_dashboard(component):
        out = {key: val for key, val in component.items() if key not in STRIP_KEYS}
        if out.get('skillspector'):
            # The cache key only matters to the generator.
            out['skillspector'] = {k: v for k, v in out['skillspector'].items() if k != 'hash'}
        return out

    # Build the dashboard index (content + security stripped from components).
    dashboard_index_data = {}
    for k, v in index_data.items():
        if k in content_bearing_types and isinstance(v, list):
            dashboard_index_data[k] = [strip_for_dashboard(c) for c in v]
        elif isinstance(v, list):
            # Non-content types (e.g. mcps/settings/hooks may carry security)
            dashboard_index_data[k] = [strip_for_dashboard(c) for c in v]
        else:
            dashboard_index_data[k] = v

    try:
        os.makedirs(dashboard_public_dir, exist_ok=True)
        dashboard_index_path = os.path.join(dashboard_public_dir, 'components.json')
        with open(dashboard_index_path, 'w', encoding='utf-8') as f:
            json.dump(dashboard_index_data, f, ensure_ascii=False)
        print(f"Generated {dashboard_index_path} (dashboard index, no content/security).")
    except Exception as e:
        print(f"Warning: Could not write dashboard index: {e}")

    # counts.json — tiny per-type counts so sidebars/plugins pages stop
    # downloading the full index just to read array lengths.
    try:
        counts = {k: len(v) for k, v in dashboard_index_data.items() if isinstance(v, list)}
        counts_path = os.path.join(dashboard_public_dir, 'counts.json')
        with open(counts_path, 'w', encoding='utf-8') as f:
            json.dump(counts, f, ensure_ascii=False)
        print(f"Generated {counts_path} ({counts}).")
    except Exception as e:
        print(f"Warning: Could not write counts.json: {e}")

    # components/{type}.json — per-type slices so the grid loads only the
    # active type instead of all 1800+ components at once.
    try:
        per_type_dir = os.path.join(dashboard_public_dir, 'components')
        os.makedirs(per_type_dir, exist_ok=True)
        for k, v in dashboard_index_data.items():
            if not isinstance(v, list):
                continue
            type_path = os.path.join(per_type_dir, f'{k}.json')
            with open(type_path, 'w', encoding='utf-8') as f:
                json.dump(v, f, ensure_ascii=False)
        print(f"Generated per-type index files in {per_type_dir}/")
    except Exception as e:
        print(f"Warning: Could not write per-type index files: {e}")

    # search-index.json — flat array with only the fields the global (Cmd+K)
    # search reads: type, name, path, description, category.
    try:
        search_index = []
        for k, v in dashboard_index_data.items():
            if not isinstance(v, list):
                continue
            for c in v:
                search_index.append({
                    'type': c.get('type'),
                    'name': c.get('name'),
                    'path': c.get('path'),
                    'description': c.get('description', ''),
                    'category': c.get('category'),
                })
        search_path = os.path.join(dashboard_public_dir, 'search-index.json')
        with open(search_path, 'w', encoding='utf-8') as f:
            json.dump(search_index, f, ensure_ascii=False)
        print(f"Generated {search_path} ({len(search_index)} entries).")
    except Exception as e:
        print(f"Warning: Could not write search-index.json: {e}")

    # marketplace.json — the aitmpl Claude Code marketplace (served at
    # external_skills.MARKETPLACE_URL), one entry per catalog plugin, pinned to
    # its reviewed commit. Claude Code reads it on `marketplace add` and on every
    # update, so like the API below a failure stops the run instead of
    # publishing a half-built file.
    marketplace = external_skills.build_marketplace(marketplace_dirs)
    marketplace_path = os.path.join(dashboard_public_dir, 'marketplace.json')
    with open(marketplace_path, 'w', encoding='utf-8') as f:
        f.write(external_skills.marketplace_json(marketplace))
    print(f"Generated {marketplace_path} ({len(marketplace['plugins'])} plugins).")

    # Catalog API v1 (dashboard/public/api/v1/): the versioned contract for
    # external consumers, built from the same index. Unlike the files above it
    # is not best-effort: an output that fails its schema stops the run.
    v1 = write_catalog_api_v1(index_data, content_dir=dashboard_content_dir)
    print(f"Generated catalog API v1 ({v1['count']} components, generatedAt {v1['generatedAt']}).")

    # Log summary (uses original components_data which still has content for accurate counts)
    print("\n--- Generation Summary ---")
    for component_type, components in components_data.items():
        # componentsMarketplace is metadata, not a component type
        if component_type == 'componentsMarketplace':
            continue

        print(f"  - Found and processed {len(components)} {component_type}")
        if component_type == 'templates':
            languages = len([t for t in components if t.get('subtype') == 'language'])
            frameworks = len([t for t in components if t.get('subtype') == 'framework'])
            print(f"    • {languages} languages, {frameworks} frameworks")
        elif component_type == 'plugins':
            kinds = {}
            for p in components:
                for kind, names in (p.get('contains') or {}).items():
                    kinds[kind] = kinds.get(kind, 0) + len(names)
            print("    • " + (", ".join(f"{n} {k}" for k, n in sorted(kinds.items())) or "empty"))

        # Security statistics for components with security metadata
        if component_type not in ['templates', 'plugins']:
            validated = len([c for c in components if c.get('security', {}).get('validated', False)])
            valid_components = len([c for c in components if c.get('security', {}).get('valid', False)])
            avg_score = sum(c.get('security', {}).get('score', 0) for c in components if c.get('security', {}).get('validated', False)) / validated if validated > 0 else 0
            print(f"    • Security: {validated} validated, {valid_components} passed, avg score: {avg_score:.1f}")

    print("--------------------------")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Generate docs/components.json and the dashboard/public artifacts')
    parser.add_argument('--skip-downloads', action='store_true',
                        help='do not query Supabase; keep the download counts already in docs/components.json (seconds instead of minutes)')
    parser.add_argument('--skip-skillspector', action='store_true',
                        help='do not run SkillSpector; keep the results already in docs/components.json')
    parser.add_argument('--skillspector-only', nargs='+', metavar='TYPE/PATH',
                        help='scan only these components (e.g. agents/security/x.md skills/security/y); the rest keep their previous result')
    args = parser.parse_args()
    generate_components_json(
        skip_downloads=args.skip_downloads,
        skip_skillspector=args.skip_skillspector,
        skillspector_only=set(args.skillspector_only) if args.skillspector_only else None,
    )
