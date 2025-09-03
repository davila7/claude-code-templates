import os
import json

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
    for the static website, including the content of each file.
    """
    components_base_path = 'cli-tool/components'
    templates_base_path = 'cli-tool/templates'
    output_path = 'docs/components.json'
    components_data = {'agents': [], 'commands': [], 'mcps': [], 'settings': [], 'hooks': [], 'templates': []}
    component_types = ['agents', 'commands', 'mcps', 'settings', 'hooks']

    print(f"Starting scan of {components_base_path} and {templates_base_path}...")

    # Scan components (existing logic)
    for component_type in component_types:
        type_path = os.path.join(components_base_path, component_type)
        if not os.path.isdir(type_path):
            print(f"Warning: Directory not found for type: {component_type}")
            continue

        print(f"Scanning for {component_type} in {type_path}...")
        
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
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                
                            # Extract description field from JSON files
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
                                        # Extract description from settings/hooks JSON files
                                        if 'description' in json_data:
                                            description = json_data['description']
                                            
                                except json.JSONDecodeError:
                                    print(f"Warning: Invalid JSON in {file_path}")
                                    
                        except Exception as e:
                            print(f"Warning: Could not read file {file_path}: {e}")

                        component = {
                            'name': name,
                            'path': os.path.join(category, file_name).replace("\\", "/"),
                            'category': category,
                            'type': component_type[:-1],  # singular form
                            'content': content,  # Add file content
                            'description': description  # Add description for MCPs
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
                
                # Create language template entry
                language_template = {
                    'name': language_dir,
                    'id': language_dir,
                    'type': 'template',
                    'subtype': 'language',
                    'category': 'languages',
                    'description': f'{language_dir.title()} project template',
                    'files': language_files,
                    'installCommand': f'npx claude-code-templates@latest --template={language_dir} --yes'
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
                                'installCommand': f'npx claude-code-templates@latest --template={framework_dir} --yes'
                            }
                            components_data['templates'].append(framework_template)
    else:
        print(f"Warning: Templates directory not found: {templates_base_path}")

    # Sort components alphabetically 
    for component_type in components_data:
        if component_type == 'templates':
            # Sort templates by name since they don't have path
            components_data[component_type].sort(key=lambda x: x['name'])
        else:
            # Sort other components by path
            components_data[component_type].sort(key=lambda x: x['path'])

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(components_data, f, indent=2, ensure_ascii=False)
        print(f"Successfully generated {output_path} with file content.")
        
        # Log summary
        print("\n--- Generation Summary ---")
        for component_type, components in components_data.items():
            print(f"  - Found and processed {len(components)} {component_type}")
            if component_type == 'templates':
                languages = len([t for t in components if t.get('subtype') == 'language'])
                frameworks = len([t for t in components if t.get('subtype') == 'framework'])
                print(f"    • {languages} languages, {frameworks} frameworks")
        print("--------------------------")

    except IOError as e:
        print(f"Error writing to {output_path}: {e}")

if __name__ == '__main__':
    generate_components_json()
