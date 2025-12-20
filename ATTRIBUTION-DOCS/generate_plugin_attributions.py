#!/usr/bin/env python3
"""
Generate per-plugin third-party attribution files.

For each plugin in marketplace.json, identify which commands/agents are from
third-party sources (awesome-claude-code or wshobson) and create attribution
files in .claude-plugin/third-party-licenses/<plugin-name>/
"""

import json
import csv
from pathlib import Path
from collections import defaultdict

def load_third_party_commands():
    """Load verified commands from awesome-claude-code"""
    commands = {}

    with open('VERIFIED_21_COMMANDS_FROM_AWESOME_CLAUDE_CODE.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Normalize path to match marketplace.json format
            path = row['Repository Path']
            # Remove 'commands/' prefix if present to match ./cli-tool/components/commands/...
            full_path = f"./cli-tool/components/{path}"

            commands[full_path] = {
                'name': row['Repository Command Name'],
                'author': row['Original Author'],
                'author_github': row['Author GitHub'],
                'license': row['License'],
                'source_url': row['Original Source URL'],
                'description': row.get('Description', ''),
                'source': 'awesome-claude-code'
            }

    return commands

def load_third_party_agents():
    """Load verified agents from wshobson"""
    agents = {}

    with open('VERIFIED_48_AGENTS_FROM_WSHOBSON.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Normalize path to match marketplace.json format
            path = row['Repository Path']
            full_path = f"./cli-tool/components/{path}"

            agents[full_path] = {
                'name': row['Repository Agent Name'],
                'author': row['Original Author'],
                'author_github': row['Author GitHub'],
                'license': row['License'],
                'source_url': row['Wshobson Source URL'],
                'similarity': row.get('Content Similarity', ''),
                'source': 'wshobson/agents'
            }

    return agents

def load_marketplace():
    """Load marketplace.json"""
    with open('.claude-plugin/marketplace.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_attribution_file(plugin_name, third_party_resources):
    """Generate attribution file for a plugin"""

    if not third_party_resources:
        return None

    lines = []
    lines.append(f"# Third-Party Attribution - {plugin_name}")
    lines.append("")
    lines.append("This plugin includes resources from third-party authors. Below is the complete attribution information.")
    lines.append("")

    # Group by source
    by_source = defaultdict(list)
    for resource in third_party_resources:
        by_source[resource['source']].append(resource)

    # awesome-claude-code commands
    if 'awesome-claude-code' in by_source:
        lines.append("## Commands from awesome-claude-code")
        lines.append("")
        lines.append("The following commands are sourced from the [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) curated list.")
        lines.append("")

        for resource in sorted(by_source['awesome-claude-code'], key=lambda x: x['name']):
            lines.append(f"### {resource['name']}")
            lines.append("")
            lines.append(f"- **Original Author**: {resource['author']}")
            lines.append(f"- **Author GitHub**: {resource['author_github']}")
            lines.append(f"- **License**: {resource['license']}")
            lines.append(f"- **Source URL**: {resource['source_url']}")
            if resource.get('description'):
                lines.append(f"- **Description**: {resource['description']}")
            lines.append("")

        lines.append("---")
        lines.append("")

    # wshobson agents
    if 'wshobson/agents' in by_source:
        lines.append("## Agents from wshobson/agents")
        lines.append("")
        lines.append("The following agents are sourced from [wshobson/agents](https://github.com/wshobson/agents) by Hobson.")
        lines.append("")

        for resource in sorted(by_source['wshobson/agents'], key=lambda x: x['name']):
            lines.append(f"### {resource['name']}")
            lines.append("")
            lines.append(f"- **Original Author**: {resource['author']}")
            lines.append(f"- **Author GitHub**: {resource['author_github']}")
            lines.append(f"- **License**: {resource['license']}")
            lines.append(f"- **Source URL**: {resource['source_url']}")
            if resource.get('similarity'):
                lines.append(f"- **Content Similarity**: {resource['similarity']} (verified)")
            lines.append("")

        lines.append("---")
        lines.append("")

    # Add license texts
    unique_licenses = set(r['license'] for r in third_party_resources)

    lines.append("## License Texts")
    lines.append("")

    if 'MIT' in unique_licenses:
        lines.append("### MIT License")
        lines.append("")
        lines.append("```")
        lines.append("MIT License")
        lines.append("")
        lines.append("Permission is hereby granted, free of charge, to any person obtaining a copy")
        lines.append("of this software and associated documentation files (the \"Software\"), to deal")
        lines.append("in the Software without restriction, including without limitation the rights")
        lines.append("to use, copy, modify, merge, publish, distribute, sublicense, and/or sell")
        lines.append("copies of the Software, and to permit persons to whom the Software is")
        lines.append("furnished to do so, subject to the following conditions:")
        lines.append("")
        lines.append("The above copyright notice and this permission notice shall be included in all")
        lines.append("copies or substantial portions of the Software.")
        lines.append("")
        lines.append("THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR")
        lines.append("IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,")
        lines.append("FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE")
        lines.append("AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER")
        lines.append("LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,")
        lines.append("OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE")
        lines.append("SOFTWARE.")
        lines.append("```")
        lines.append("")

    if 'Apache-2.0' in unique_licenses:
        lines.append("### Apache License 2.0")
        lines.append("")
        lines.append("Full license text available at: https://www.apache.org/licenses/LICENSE-2.0")
        lines.append("")

    if 'AGPL-3.0' in unique_licenses:
        lines.append("### GNU Affero General Public License v3.0")
        lines.append("")
        lines.append("Full license text available at: https://www.gnu.org/licenses/agpl-3.0.html")
        lines.append("")

    return '\n'.join(lines)

def main():
    print("=" * 80)
    print("GENERATING PER-PLUGIN ATTRIBUTION FILES")
    print("=" * 80)

    # Load data
    print("\nLoading third-party resources...")
    third_party_commands = load_third_party_commands()
    third_party_agents = load_third_party_agents()
    print(f"  - {len(third_party_commands)} commands from awesome-claude-code")
    print(f"  - {len(third_party_agents)} agents from wshobson")

    print("\nLoading marketplace.json...")
    marketplace = load_marketplace()
    plugins = marketplace['plugins']
    print(f"  - {len(plugins)} plugins found")

    # Create third-party-licenses directory
    base_dir = Path('.claude-plugin/third-party-licenses')
    base_dir.mkdir(parents=True, exist_ok=True)
    print(f"\nCreated directory: {base_dir}")

    # Process each plugin
    print("\nProcessing plugins...")
    plugins_with_attributions = []
    total_third_party_commands = 0
    total_third_party_agents = 0

    for plugin in plugins:
        plugin_name = plugin['name']
        print(f"\n  {plugin_name}:")

        third_party_resources = []

        # Check commands
        if 'commands' in plugin:
            for cmd_path in plugin['commands']:
                if cmd_path in third_party_commands:
                    cmd = third_party_commands[cmd_path]
                    third_party_resources.append({
                        'type': 'command',
                        'path': cmd_path,
                        **cmd
                    })
                    print(f"    ✓ Command: {cmd['name']} (from {cmd['author']})")
                    total_third_party_commands += 1

        # Check agents
        if 'agents' in plugin:
            for agent_path in plugin['agents']:
                if agent_path in third_party_agents:
                    agent = third_party_agents[agent_path]
                    third_party_resources.append({
                        'type': 'agent',
                        'path': agent_path,
                        **agent
                    })
                    print(f"    ✓ Agent: {agent['name']} (from {agent['author']})")
                    total_third_party_agents += 1

        # Generate attribution file if needed
        if third_party_resources:
            plugin_dir = base_dir / plugin_name
            plugin_dir.mkdir(exist_ok=True)

            attribution_content = generate_attribution_file(plugin_name, third_party_resources)

            if attribution_content:
                attribution_file = plugin_dir / 'THIRD_PARTY_NOTICES.md'
                with open(attribution_file, 'w', encoding='utf-8') as f:
                    f.write(attribution_content)

                print(f"    ✓ Created: {attribution_file}")
                plugins_with_attributions.append({
                    'name': plugin_name,
                    'commands': sum(1 for r in third_party_resources if r['type'] == 'command'),
                    'agents': sum(1 for r in third_party_resources if r['type'] == 'agent')
                })
        else:
            print(f"    ℹ No third-party resources")

    # Generate summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"\nTotal plugins: {len(plugins)}")
    print(f"Plugins with third-party resources: {len(plugins_with_attributions)}")
    print(f"Total third-party commands: {total_third_party_commands}")
    print(f"Total third-party agents: {total_third_party_agents}")

    print("\nPlugins with attributions:")
    for plugin in plugins_with_attributions:
        print(f"  - {plugin['name']}: {plugin['commands']} commands, {plugin['agents']} agents")

    # Generate top-level README
    readme_lines = []
    readme_lines.append("# Third-Party Licenses Directory")
    readme_lines.append("")
    readme_lines.append("This directory contains attribution information for all third-party resources used in the claude-code-templates marketplace plugins.")
    readme_lines.append("")
    readme_lines.append("## Overview")
    readme_lines.append("")
    readme_lines.append(f"- **Total Plugins**: {len(plugins)}")
    readme_lines.append(f"- **Plugins with Third-Party Resources**: {len(plugins_with_attributions)}")
    readme_lines.append(f"- **Third-Party Commands**: {total_third_party_commands} from [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)")
    readme_lines.append(f"- **Third-Party Agents**: {total_third_party_agents} from [wshobson/agents](https://github.com/wshobson/agents)")
    readme_lines.append("")
    readme_lines.append("## Structure")
    readme_lines.append("")
    readme_lines.append("Each plugin with third-party resources has its own subdirectory:")
    readme_lines.append("")
    readme_lines.append("```")
    readme_lines.append(".claude-plugin/third-party-licenses/")
    for plugin in plugins_with_attributions:
        readme_lines.append(f"├── {plugin['name']}/")
        readme_lines.append(f"│   └── THIRD_PARTY_NOTICES.md")
    readme_lines.append("```")
    readme_lines.append("")
    readme_lines.append("## Plugin Attribution Details")
    readme_lines.append("")

    for plugin in sorted(plugins_with_attributions, key=lambda x: x['name']):
        readme_lines.append(f"### {plugin['name']}")
        readme_lines.append("")
        readme_lines.append(f"- **Commands from awesome-claude-code**: {plugin['commands']}")
        readme_lines.append(f"- **Agents from wshobson**: {plugin['agents']}")
        readme_lines.append(f"- **Attribution File**: `.claude-plugin/third-party-licenses/{plugin['name']}/THIRD_PARTY_NOTICES.md`")
        readme_lines.append("")

    readme_lines.append("## Sources")
    readme_lines.append("")
    readme_lines.append("### awesome-claude-code")
    readme_lines.append("")
    readme_lines.append("A curated list of Claude Code resources from multiple community authors.")
    readme_lines.append("")
    readme_lines.append("- **Repository**: https://github.com/hesreallyhim/awesome-claude-code")
    readme_lines.append("- **Maintainer**: hesreallyhim")
    readme_lines.append("- **Authors**: Multiple community contributors (see individual attribution files)")
    readme_lines.append("- **Licenses**: MIT, Apache-2.0, AGPL-3.0")
    readme_lines.append("")
    readme_lines.append("### wshobson/agents")
    readme_lines.append("")
    readme_lines.append("A comprehensive collection of specialized AI agents for Claude Code.")
    readme_lines.append("")
    readme_lines.append("- **Repository**: https://github.com/wshobson/agents")
    readme_lines.append("- **Author**: Hobson (wshobson)")
    readme_lines.append("- **License**: MIT")
    readme_lines.append("")
    readme_lines.append("## License Compliance")
    readme_lines.append("")
    readme_lines.append("All third-party resources included in this marketplace comply with their respective licenses:")
    readme_lines.append("")
    readme_lines.append("- **MIT License**: Permissive license allowing commercial use with attribution")
    readme_lines.append("- **Apache License 2.0**: Permissive license with patent grant")
    readme_lines.append("- **AGPL-3.0**: Strong copyleft license requiring source disclosure for network use")
    readme_lines.append("")
    readme_lines.append("Please refer to individual plugin attribution files for complete license texts and specific author information.")
    readme_lines.append("")
    readme_lines.append("---")
    readme_lines.append("")
    readme_lines.append(f"**Last Updated**: {Path('VERIFIED_21_COMMANDS_FROM_AWESOME_CLAUDE_CODE.csv').stat().st_mtime}")
    readme_lines.append("**Attribution Analysis**: See root directory for detailed CSV files and analysis scripts")

    readme_file = base_dir / 'README.md'
    with open(readme_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(readme_lines))

    print(f"\n✅ Created: {readme_file}")
    print("\n✅ Attribution structure complete!")

if __name__ == '__main__':
    main()
