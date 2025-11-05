#!/usr/bin/env python3
"""
Identify agents from wshobson/agents repository in this repo.

This script:
1. Gets the list of all unique agents from wshobson/agents
2. Scans agents in this repository
3. Matches by exact name
4. Creates high-confidence and low-confidence CSVs
"""

import csv
import os
from pathlib import Path
from collections import defaultdict

# List of unique agent names from wshobson/agents (extracted from GitHub API)
WSHOBSON_AGENTS = [
    'ai-engineer',
    'api-documenter',
    'architect-review',
    'arm-cortex-expert',
    'backend-architect',
    'backend-security-coder',
    'bash-pro',
    'blockchain-developer',
    'business-analyst',
    'c-pro',
    'cloud-architect',
    'code-reviewer',
    'content-marketer',
    'context-manager',
    'cpp-pro',
    'csharp-pro',
    'customer-support',
    'data-engineer',
    'data-scientist',
    'database-admin',
    'database-architect',
    'database-optimizer',
    'debugger',
    'deployment-engineer',
    'devops-troubleshooter',
    'django-pro',
    'docs-architect',
    'dx-optimizer',
    'elixir-pro',
    'error-detective',
    'fastapi-pro',
    'flutter-expert',
    'frontend-developer',
    'frontend-security-coder',
    'golang-pro',
    'graphql-architect',
    'hr-pro',
    'hybrid-cloud-architect',
    'incident-responder',
    'ios-developer',
    'java-pro',
    'javascript-pro',
    'julia-pro',
    'kubernetes-architect',
    'legacy-modernizer',
    'legal-advisor',
    'mermaid-expert',
    'minecraft-bukkit-pro',
    'ml-engineer',
    'mlops-engineer',
    'mobile-developer',
    'mobile-security-coder',
    'network-engineer',
    'observability-engineer',
    'payment-integration',
    'performance-engineer',
    'php-pro',
    'posix-shell-pro',
    'prompt-engineer',
    'python-pro',
    'quant-analyst',
    'reference-builder',
    'risk-manager',
    'ruby-pro',
    'rust-pro',
    'sales-automator',
    'scala-pro',
    'search-specialist',
    'security-auditor',
    'seo-authority-builder',
    'seo-cannibalization-detector',
    'seo-content-auditor',
    'seo-content-planner',
    'seo-content-refresher',
    'seo-content-writer',
    'seo-keyword-strategist',
    'seo-meta-optimizer',
    'seo-snippet-hunter',
    'seo-structure-architect',
    'sql-pro',
    'tdd-orchestrator',
    'terraform-specialist',
    'test-automator',
    'tutorial-engineer',
    'typescript-pro',
    'ui-ux-designer',
    'ui-visual-validator',
    'unity-developer',
]

def scan_repository_agents(base_path='cli-tool/components/agents'):
    """Scan repository for all agent files"""
    agents = []

    agents_path = Path(base_path)
    if agents_path.exists():
        for md_file in agents_path.rglob('*.md'):
            agent_name = md_file.stem
            relative_path = str(md_file.relative_to('cli-tool/components'))
            category = md_file.parent.name

            agents.append({
                'name': agent_name,
                'path': relative_path,
                'category': category,
                'full_path': str(md_file)
            })

    return agents

def match_agent(repo_agent_name, wshobson_agents_set):
    """Check if agent name matches wshobson agents"""

    # Normalize names (lowercase, handle variations)
    norm_repo = repo_agent_name.lower().replace('_', '-')

    # Exact match
    if norm_repo in wshobson_agents_set:
        return True, 'exact_match', 'high'

    # Check without common suffixes/prefixes
    # e.g., "frontend-developer" vs "react-frontend-developer"
    for wshobson_agent in wshobson_agents_set:
        if wshobson_agent in norm_repo or norm_repo in wshobson_agent:
            # Only consider it a match if it's a significant overlap
            if len(wshobson_agent) > 5 and len(norm_repo) > 5:
                overlap = len(set(wshobson_agent) & set(norm_repo))
                if overlap / min(len(wshobson_agent), len(norm_repo)) > 0.7:
                    return True, 'partial_match', 'medium'

    return False, 'no_match', 'none'

def create_wshobson_attribution():
    """Create attribution CSVs for wshobson agents"""

    print("=" * 80)
    print("WSHOBSON AGENTS ATTRIBUTION ANALYSIS")
    print("=" * 80)

    # Convert to set for faster lookup
    wshobson_set = set(agent.lower().replace('_', '-') for agent in WSHOBSON_AGENTS)

    print(f"\nTotal unique agents in wshobson/agents: {len(WSHOBSON_AGENTS)}")

    # Scan repository agents
    print("Scanning repository agents...")
    repo_agents = scan_repository_agents()
    print(f"Total agents in repository: {len(repo_agents)}")

    # Match agents
    high_confidence = []
    low_confidence = []

    for agent in repo_agents:
        is_match, match_type, confidence = match_agent(agent['name'], wshobson_set)

        record = {
            'Repository Agent Name': agent['name'],
            'Repository Path': agent['path'],
            'Repository Category': agent['category'],
            'Match Type': match_type,
            'Match Confidence': confidence,
            'Original Author': 'wshobson' if is_match else 'Unknown',
            'Author GitHub': 'https://github.com/wshobson' if is_match else '',
            'License': 'MIT' if is_match else 'Unknown',
            'Original Source URL': f"https://github.com/wshobson/agents" if is_match else '',
            'Notes': 'Exact name match' if match_type == 'exact_match' else 'Partial match - verify manually' if match_type == 'partial_match' else 'Not from wshobson'
        }

        if confidence == 'high':
            high_confidence.append(record)
        else:
            low_confidence.append(record)

    # Write high-confidence CSV
    fieldnames = [
        'Repository Agent Name',
        'Repository Path',
        'Repository Category',
        'Match Type',
        'Match Confidence',
        'Original Author',
        'Author GitHub',
        'License',
        'Original Source URL',
        'Notes'
    ]

    print(f"\nWriting {len(high_confidence)} high-confidence matches...")
    with open('AGENTS_FROM_WSHOBSON_HIGH_CONFIDENCE.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(high_confidence)

    print(f"Writing {len(low_confidence)} low-confidence/no matches...")
    with open('AGENTS_FROM_WSHOBSON_LOW_CONFIDENCE.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(low_confidence)

    # Analysis
    print("\n" + "=" * 80)
    print("HIGH-CONFIDENCE MATCHES")
    print("=" * 80)
    print(f"\nTotal high-confidence matches: {len(high_confidence)}")

    # Group by category
    by_category = defaultdict(list)
    for record in high_confidence:
        by_category[record['Repository Category']].append(record)

    print("\nBy Category:")
    for category in sorted(by_category.keys()):
        print(f"\n  {category}/ ({len(by_category[category])} agents)")
        for record in sorted(by_category[category], key=lambda x: x['Repository Agent Name']):
            print(f"    - {record['Repository Agent Name']}")

    # List all high-confidence agents
    print("\n" + "=" * 80)
    print(f"ALL {len(high_confidence)} HIGH-CONFIDENCE AGENTS (Alphabetical)")
    print("=" * 80)
    for record in sorted(high_confidence, key=lambda x: x['Repository Agent Name']):
        print(f"{record['Repository Agent Name']:<35} {record['Repository Category']}")

    print("\n" + "=" * 80)
    print("LOW-CONFIDENCE SUMMARY")
    print("=" * 80)
    print(f"\nTotal low-confidence/no match: {len(low_confidence)}")

    # Count by confidence
    conf_counts = defaultdict(int)
    for record in low_confidence:
        conf_counts[record['Match Confidence']] += 1

    for conf, count in sorted(conf_counts.items()):
        print(f"  {conf}: {count}")

    print("\n✅ Files created:")
    print("  - AGENTS_FROM_WSHOBSON_HIGH_CONFIDENCE.csv")
    print("  - AGENTS_FROM_WSHOBSON_LOW_CONFIDENCE.csv")

    return high_confidence, low_confidence

if __name__ == '__main__':
    high, low = create_wshobson_attribution()
