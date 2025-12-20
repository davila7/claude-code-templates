#!/usr/bin/env python3
"""
Analyze components to identify which came from awesome-claude-code
"""

import os
import json
from pathlib import Path
from collections import defaultdict

# Known commands from awesome-claude-code (based on documentation)
AWESOME_CLAUDE_CODE_COMMANDS = {
    # Git/Version Control
    'commit', 'create-pr', 'create-pull-request', 'create-worktrees',
    'fix-github-issue', 'update-branch-name', 'pr-review', 'husky',

    # Documentation
    'add-to-changelog', 'update-docs', 'load-llms-txt', 'create-docs',

    # Project Management
    'create-jtbd', 'create-prd', 'create-prp',
}

# README states 21 commands came from awesome-claude-code
README_STATED_COUNT = 21

def analyze_components(base_path='cli-tool/components'):
    """Analyze all components and categorize them"""

    results = {
        'commands': {
            'total': 0,
            'likely_from_awesome_claude_code': [],
            'other': []
        },
        'agents': {
            'total': 0,
            'likely_from_wshobson': [],
            'other': []
        },
        'mcps': {'total': 0, 'files': []},
        'hooks': {'total': 0, 'files': []},
        'settings': {'total': 0, 'files': []},
        'skills': {'total': 0, 'files': []}
    }

    # Analyze commands
    commands_path = Path(base_path) / 'commands'
    if commands_path.exists():
        for md_file in commands_path.rglob('*.md'):
            results['commands']['total'] += 1
            command_name = md_file.stem
            relative_path = str(md_file.relative_to(base_path))

            # Check if command name matches awesome-claude-code list
            if command_name in AWESOME_CLAUDE_CODE_COMMANDS:
                results['commands']['likely_from_awesome_claude_code'].append({
                    'name': command_name,
                    'path': relative_path,
                    'category': md_file.parent.name
                })
            else:
                results['commands']['other'].append({
                    'name': command_name,
                    'path': relative_path,
                    'category': md_file.parent.name
                })

    # Analyze agents
    agents_path = Path(base_path) / 'agents'
    if agents_path.exists():
        for md_file in agents_path.rglob('*.md'):
            results['agents']['total'] += 1
            agent_name = md_file.stem
            relative_path = str(md_file.relative_to(base_path))

            # Check if file has attribution
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
                has_attribution = 'wshobson' in content.lower() or 'source:' in content.lower()

            agent_info = {
                'name': agent_name,
                'path': relative_path,
                'category': md_file.parent.name,
                'has_explicit_attribution': has_attribution
            }

            # Known agents from wshobson based on README and common patterns
            wshobson_agents = [
                'frontend-developer', 'backend-architect', 'database-architect',
                'security-auditor', 'deployment-engineer', 'test-automator'
            ]

            if agent_name in wshobson_agents or has_attribution:
                results['agents']['likely_from_wshobson'].append(agent_info)
            else:
                results['agents']['other'].append(agent_info)

    # Analyze other component types
    for component_type in ['mcps', 'hooks', 'settings', 'skills']:
        component_path = Path(base_path) / component_type
        if component_path.exists():
            for md_file in component_path.rglob('*.md'):
                if md_file.name == 'ANTHROPIC_ATTRIBUTION.md':
                    continue
                results[component_type]['total'] += 1
                results[component_type]['files'].append({
                    'name': md_file.stem,
                    'path': str(md_file.relative_to(base_path))
                })

    return results

def print_report(results):
    """Print detailed analysis report"""

    print("=" * 80)
    print("AWESOME-CLAUDE-CODE RESOURCE ANALYSIS")
    print("=" * 80)
    print()

    print("📊 OVERVIEW")
    print("-" * 80)
    print(f"Total Commands: {results['commands']['total']}")
    print(f"Total Agents: {results['agents']['total']}")
    print(f"Total MCPs: {results['mcps']['total']}")
    print(f"Total Hooks: {results['hooks']['total']}")
    print(f"Total Settings: {results['settings']['total']}")
    print(f"Total Skills: {results['skills']['total']}")
    print()

    print("⚡ COMMANDS FROM AWESOME-CLAUDE-CODE")
    print("-" * 80)
    print(f"Identified: {len(results['commands']['likely_from_awesome_claude_code'])} commands")
    print(f"README states: {README_STATED_COUNT} commands from awesome-claude-code")
    print()

    if results['commands']['likely_from_awesome_claude_code']:
        print("Commands likely from awesome-claude-code (based on name matching):")
        print()

        by_category = defaultdict(list)
        for cmd in results['commands']['likely_from_awesome_claude_code']:
            by_category[cmd['category']].append(cmd)

        for category in sorted(by_category.keys()):
            print(f"  {category}/")
            for cmd in sorted(by_category[category], key=lambda x: x['name']):
                print(f"    - {cmd['name']}")
        print()

    print("🤖 AGENTS FROM WSHOBSON COLLECTION")
    print("-" * 80)
    print(f"Identified: {len(results['agents']['likely_from_wshobson'])} agents")
    print(f"README states: 48 agents from wshobson")
    print()

    if results['agents']['likely_from_wshobson']:
        print("Agents likely from wshobson (based on patterns and attribution):")
        print()

        by_category = defaultdict(list)
        for agent in results['agents']['likely_from_wshobson']:
            by_category[agent['category']].append(agent)

        for category in sorted(by_category.keys()):
            print(f"  {category}/")
            for agent in sorted(by_category[category], key=lambda x: x['name']):
                attribution_mark = " ✓" if agent['has_explicit_attribution'] else ""
                print(f"    - {agent['name']}{attribution_mark}")
        print()
        print("  ✓ = Has explicit attribution in file")
        print()

    print("📋 ANALYSIS SUMMARY")
    print("-" * 80)
    print(f"✅ Found {len(results['commands']['likely_from_awesome_claude_code'])} commands matching awesome-claude-code")
    print(f"⚠️  README states 21 commands - need to identify {README_STATED_COUNT - len(results['commands']['likely_from_awesome_claude_code'])} more")
    print()
    print(f"✅ Found {len(results['agents']['likely_from_wshobson'])} agents from wshobson")
    print(f"⚠️  README states 48 agents - need to identify {48 - len(results['agents']['likely_from_wshobson'])} more")
    print()

    print("💡 RECOMMENDATIONS")
    print("-" * 80)
    print("1. Add attribution headers to all components from external sources")
    print("2. Create a comprehensive attribution mapping file")
    print("3. Consider adding metadata to component frontmatter:")
    print("   - source: awesome-claude-code | wshobson | original")
    print("   - author: <original author>")
    print("   - license: <license type>")
    print("   - url: <source url>")
    print()

    # Save results to JSON
    output_file = 'awesome_claude_code_analysis.json'
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"📄 Full analysis saved to: {output_file}")
    print()

if __name__ == '__main__':
    results = analyze_components()
    print_report(results)
