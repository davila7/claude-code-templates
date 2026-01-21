import os
import json
import requests
import subprocess
from collections import defaultdict
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

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

def fetch_download_stats():
    """
    Fetch download statistics from Supabase
    Returns a dictionary with component_type-component_name as key and download count as value
    Supports: agents, commands, mcps, settings, hooks, sandbox, skills, templates, plugins
    """
    print("📊 Fetching download statistics from Supabase...")

    # Define type mapping once (DRY principle)
    TYPE_MAPPING = {
        'agent': 'agents',
        'command': 'commands',
        'setting': 'settings',
        'hook': 'hooks',
        'mcp': 'mcps',
        'skill': 'skills',
        'template': 'templates',
        'plugin': 'plugins',
        'sandbox': 'sandbox'
    }

    # Get Supabase credentials (same as generate_trending_data.py)
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_api_key = os.getenv("SUPABASE_API_KEY")

    if not supabase_url or not supabase_api_key:
        print("⚠️ Warning: Missing Supabase credentials, skipping download stats")
        return {}
    
    try:
        headers = {
            'apikey': supabase_api_key,
            'Authorization': f'Bearer {supabase_api_key}'
        }
        
        # First, let's query component_downloads to aggregate counts per component
        # We need to handle pagination since there can be many records
        api_url = f"{supabase_url}/rest/v1/component_downloads"
        
        all_downloads = []
        offset = 0
        limit = 1000

        # Fetch all records with pagination
        max_pages = 1000  # Safety limit (1000 pages * 1000 records = 1,000,000 max)
        for page in range(max_pages):
            paginated_headers = headers.copy()
            paginated_headers['Range'] = f'{offset}-{offset + limit - 1}'
            
            response = requests.get(api_url, headers=paginated_headers)
            
            if response.status_code not in [200, 206]:
                print(f"  Page {page+1}: Got status {response.status_code}, stopping")
                break
                
            batch = response.json()
            if not batch:
                break
                
            all_downloads.extend(batch)
            
            # Check if we have more records to fetch
            content_range = response.headers.get('content-range', '')
            
            # If we get a range like "45000-45977/*", check if we got less than limit records
            if len(batch) < limit:
                break  # We've reached the end
            
            # Also check for explicit total if provided
            if content_range and '/' in content_range:
                parts = content_range.split('/')
                if parts[1] != '*':
                    try:
                        total = int(parts[1])
                        if offset + limit >= total:
                            break
                    except ValueError:
                        pass
            
            offset += limit
            
            # Progress indicator every 10 pages
            if (page + 1) % 10 == 0:
                print(f"  Fetched {len(all_downloads)} records so far...")
        
        print(f"📊 Total records fetched: {len(all_downloads)}")
        
        # If we fetched records, use them
        if len(all_downloads) > 0:
            # Process component_downloads data
            downloads = all_downloads
            
            # Aggregate downloads by component
            download_counts = {}
            component_totals = defaultdict(int)
            
            for download in downloads:
                component_type = download.get('component_type', '')
                component_name = download.get('component_name', '')

                if component_type and component_name:
                    # Handle case where component_name already includes category
                    if '/' in component_name:
                        category = component_name.split('/')[0]
                        actual_name = component_name.split('/')[-1]
                    else:
                        actual_name = component_name
                        category = 'general'

                    # Create a key for aggregation matching trending data structure
                    key = f"{component_type}|{category}|{actual_name}"
                    component_totals[key] += 1

            # Convert to the format we need using the TYPE_MAPPING constant
            for key, count in component_totals.items():
                parts = key.split('|')
                if len(parts) == 3:
                    component_type, category, component_name = parts
                    mapped_type = TYPE_MAPPING.get(component_type, component_type + 's')
                    final_key = f"{mapped_type}/{category}/{component_name}"
                    download_counts[final_key] = count
            
            print(f"✅ Fetched and aggregated {len(download_counts)} component download stats")
            return download_counts
        else:
            # Try alternative: fetch from download_stats table if it exists
            print("⚠️ No data from component_downloads, trying download_stats table...")
            alt_url = f"{supabase_url}/rest/v1/download_stats"
            alt_response = requests.get(alt_url, headers=headers)
            
            if alt_response.status_code == 200:
                print("📊 Using download_stats table instead...")
                stats = alt_response.json()
                download_counts = {}
                
                for stat in stats:
                    component_type = stat.get('component_type', '')
                    component_name = stat.get('component_name', '')
                    total_downloads = stat.get('total_downloads', 0)

                    # Handle case where component_name already includes category
                    if '/' in component_name:
                        category = component_name.split('/')[0]
                        actual_name = component_name.split('/')[-1]
                    else:
                        actual_name = component_name
                        category = 'general'

                    # Map to plural form using TYPE_MAPPING constant
                    mapped_type = TYPE_MAPPING.get(component_type, component_type + 's')
                    key = f"{mapped_type}/{category}/{actual_name}"
                    download_counts[key] = total_downloads
                
                print(f"✅ Fetched stats for {len(download_counts)} components from download_stats")
                return download_counts
            else:
                print("⚠️ No download stats available")
                return {}
        
    except Exception as e:
        print(f"⚠️ Error fetching download stats: {e}")
        return {}

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

def generate_components_json():
    """
    Scans the cli-tool/components and cli-tool/templates directories and generates a components.json file
    for the static website, including the content of each file and download statistics.
    """
    components_base_path = 'cli-tool/components'
    templates_base_path = 'cli-tool/templates'
    plugins_path = '.claude-plugin/marketplace.json'
    output_path = 'docs/components.json'
    components_data = {'agents': [], 'commands': [], 'mcps': [], 'settings': [], 'hooks': [], 'sandbox': [], 'skills': [], 'templates': [], 'plugins': []}

    # Run security validation
    security_metadata = run_security_validation()

    # Fetch download statistics
    download_stats = fetch_download_stats()
    component_types = ['agents', 'commands', 'mcps', 'settings', 'hooks', 'sandbox', 'skills']

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
                            # Look for SKILL.md inside the skill directory
                            skill_file_path = os.path.join(skill_dir_path, 'SKILL.md')
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
                                    if content.startswith('---'):
                                        frontmatter_end = content.find('---', 3)
                                        if frontmatter_end != -1:
                                            frontmatter = content[3:frontmatter_end]
                                            for line in frontmatter.split('\n'):
                                                if line.startswith('description:'):
                                                    description = line.split('description:', 1)[1].strip()
                                                elif line.startswith('author:'):
                                                    author = line.split('author:', 1)[1].strip()
                                                elif line.startswith('repo:'):
                                                    repo = line.split('repo:', 1)[1].strip()
                                                elif line.startswith('version:'):
                                                    version = line.split('version:', 1)[1].strip()
                                                elif line.startswith('license:'):
                                                    license_field = line.split('license:', 1)[1].strip()
                                                elif line.startswith('tags:'):
                                                    tags_str = line.split('tags:', 1)[1].strip()
                                                    # Parse tags array [tag1, tag2, tag3]
                                                    if tags_str.startswith('[') and tags_str.endswith(']'):
                                                        tags_str = tags_str[1:-1]
                                                        keywords = [tag.strip() for tag in tags_str.split(',')]

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
                                    'security': security
                                }
                                components_data[component_type].append(component)
                                print(f"  Processed skill: {category}/{name}")
            continue  # Skip the normal file scanning for skills

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
                                if content.startswith('---'):
                                    frontmatter_end = content.find('---', 3)
                                    if frontmatter_end != -1:
                                        frontmatter = content[3:frontmatter_end]
                                        for line in frontmatter.split('\n'):
                                            if line.startswith('description:'):
                                                description = line.split('description:', 1)[1].strip()
                                            elif line.startswith('author:'):
                                                author = line.split('author:', 1)[1].strip()
                                            elif line.startswith('repo:'):
                                                repo = line.split('repo:', 1)[1].strip()
                                            elif line.startswith('version:'):
                                                version = line.split('version:', 1)[1].strip()
                                            elif line.startswith('license:'):
                                                license_field = line.split('license:', 1)[1].strip()
                                            elif line.startswith('tags:'):
                                                tags_str = line.split('tags:', 1)[1].strip()
                                                # Parse tags array [tag1, tag2, tag3]
                                                if tags_str.startswith('[') and tags_str.endswith(']'):
                                                    tags_str = tags_str[1:-1]
                                                    keywords = [tag.strip() for tag in tags_str.split(',')]

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
                    'files': language_files,
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
                                'files': framework_files,
                                'installCommand': f'npx claude-code-templates@latest --template={framework_dir} --yes',
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

    # Scan plugins from marketplace.json and store marketplace data
    marketplace_full_data = None
    if os.path.isfile(plugins_path):
        print(f"Scanning for plugins in {plugins_path}...")
        try:
            with open(plugins_path, 'r', encoding='utf-8') as f:
                marketplace_data = json.load(f)

            # Store full marketplace data for inclusion in components.json
            marketplace_full_data = marketplace_data

            if 'plugins' in marketplace_data:
                for plugin in marketplace_data['plugins']:
                    plugin_name = plugin.get('name', '')
                    plugin_description = plugin.get('description', '')
                    plugin_version = plugin.get('version', '1.0.0')
                    plugin_keywords = plugin.get('keywords', [])
                    plugin_author = plugin.get('author', {}).get('name', '')

                    # Get component lists with file names
                    commands_list = plugin.get('commands', [])
                    agents_list = plugin.get('agents', [])
                    mcps_list = plugin.get('mcpServers', [])

                    # Extract component names with category/folder from file paths
                    def extract_component_with_category(path):
                        # Extract category/name from path like "./cli-tool/components/commands/git/feature.md"
                        # Result should be "git/feature"
                        parts = path.split('/')
                        if len(parts) >= 2:
                            filename = parts[-1].replace('.md', '').replace('.json', '')
                            category = parts[-2]
                            return f"{category}/{filename}"
                        else:
                            # Fallback to just filename if path structure is unexpected
                            filename = path.split('/')[-1]
                            return filename.replace('.md', '').replace('.json', '')

                    commands_names = [extract_component_with_category(cmd) for cmd in commands_list]
                    agents_names = [extract_component_with_category(agent) for agent in agents_list]
                    mcps_names = [extract_component_with_category(mcp) for mcp in mcps_list]

                    # Look up download count for this plugin
                    plugin_download_key = f"plugins/{plugin_name}"
                    plugin_downloads = download_stats.get(plugin_download_key, 0)

                    # Create plugin entry
                    plugin_entry = {
                        'name': plugin_name,
                        'id': plugin_name,
                        'type': 'plugin',
                        'description': plugin_description,
                        'version': plugin_version,
                        'keywords': plugin_keywords,
                        'author': plugin_author,
                        'commands': len(commands_list),
                        'agents': len(agents_list),
                        'mcpServers': len(mcps_list),
                        'commandsList': commands_names,
                        'agentsList': agents_names,
                        'mcpServersList': mcps_names,
                        'installCommand': f'/plugin install {plugin_name}@claude-code-templates',
                        'downloads': plugin_downloads
                    }
                    components_data['plugins'].append(plugin_entry)
                    print(f"  Processed plugin: {plugin_name}")

            print(f"✅ Processed {len(components_data['plugins'])} plugins from marketplace.json")
        except Exception as e:
            print(f"⚠️ Error reading plugins from {plugins_path}: {e}")
    else:
        print(f"Warning: Plugins file not found: {plugins_path}")

    # Sort components alphabetically
    for component_type in components_data:
        if component_type in ['templates', 'plugins']:
            # Sort templates and plugins by name since they don't have path
            components_data[component_type].sort(key=lambda x: x['name'])
        else:
            # Sort other components by path
            components_data[component_type].sort(key=lambda x: x['path'])

    # Add marketplace metadata (root level - our public marketplace)
    if marketplace_full_data:
        components_data['marketplace'] = marketplace_full_data
        print("✅ Added public marketplace metadata to components.json")

    # Add components marketplace metadata (Claude Code standard)
    if components_marketplace:
        components_data['componentsMarketplace'] = components_marketplace
        print("✅ Added components marketplace metadata to components.json")

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(components_data, f, indent=2, ensure_ascii=False)
        print(f"Successfully generated {output_path} with file content.")
        
        # Log summary
        print("\n--- Generation Summary ---")
        for component_type, components in components_data.items():
            # Skip marketplace metadata in summary (it's not a component type)
            if component_type in ['marketplace', 'componentsMarketplace']:
                continue

            print(f"  - Found and processed {len(components)} {component_type}")
            if component_type == 'templates':
                languages = len([t for t in components if t.get('subtype') == 'language'])
                frameworks = len([t for t in components if t.get('subtype') == 'framework'])
                print(f"    • {languages} languages, {frameworks} frameworks")
            elif component_type == 'plugins':
                total_commands = sum(p.get('commands', 0) for p in components)
                total_agents = sum(p.get('agents', 0) for p in components)
                total_mcps = sum(p.get('mcpServers', 0) for p in components)
                print(f"    • {total_commands} commands, {total_agents} agents, {total_mcps} MCPs")

            # Security statistics for components with security metadata
            if component_type not in ['templates', 'plugins']:
                validated = len([c for c in components if c.get('security', {}).get('validated', False)])
                valid_components = len([c for c in components if c.get('security', {}).get('valid', False)])
                avg_score = sum(c.get('security', {}).get('score', 0) for c in components if c.get('security', {}).get('validated', False)) / validated if validated > 0 else 0
                print(f"    • Security: {validated} validated, {valid_components} passed, avg score: {avg_score:.1f}")

        print("--------------------------")

    except IOError as e:
        print(f"Error writing to {output_path}: {e}")

if __name__ == '__main__':
    generate_components_json()
