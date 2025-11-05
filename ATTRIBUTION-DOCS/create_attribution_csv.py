#!/usr/bin/env python3
"""
Create detailed attribution CSV for components from awesome-claude-code.

This script:
1. Reads THE_RESOURCES_TABLE.csv from awesome-claude-code
2. Identifies slash-commands and their original authors
3. Cross-references with components in this repository
4. Creates a detailed CSV mapping components to their original authors and licenses
"""

import csv
import os
from pathlib import Path
from urllib.parse import urlparse
import re

def normalize_command_name(name):
    """Normalize command names for comparison (remove leading slash, lowercase, etc.)"""
    # Remove leading slash
    name = name.lstrip('/')
    # Convert to lowercase for comparison
    name = name.lower()
    # Remove common variations
    name = name.replace('-', '_').replace('_', '-')
    return name

def extract_command_name_from_url(url):
    """Extract command name from GitHub URL"""
    if not url:
        return None

    # Try to extract filename from URL
    # Example: https://github.com/.../commands/commit.md -> commit
    parts = url.split('/')
    if len(parts) > 0:
        filename = parts[-1]
        if filename.endswith('.md'):
            return filename[:-3]  # Remove .md extension
    return None

def read_awesome_claude_code_csv(csv_path):
    """Read and parse THE_RESOURCES_TABLE.csv"""
    resources = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Only include slash-commands category
            if row.get('Category') == 'Slash-Commands':
                # Extract command name from Display Name (remove leading /)
                display_name = row.get('Display Name', '')
                command_name = display_name.lstrip('/')

                # Also try to extract from URL if available
                url_command = extract_command_name_from_url(row.get('Primary Link'))

                resources.append({
                    'display_name': display_name,
                    'command_name': command_name,
                    'url_command': url_command,
                    'category': row.get('Sub-Category', 'General'),
                    'author_name': row.get('Author Name', 'Unknown'),
                    'author_link': row.get('Author Link', ''),
                    'license': row.get('License', 'NOT_FOUND'),
                    'primary_link': row.get('Primary Link', ''),
                    'description': row.get('Description', ''),
                    'id': row.get('ID', '')
                })

    return resources

def scan_repository_commands(base_path='cli-tool/components/commands'):
    """Scan repository for all command files"""
    commands = []

    commands_path = Path(base_path)
    if commands_path.exists():
        for md_file in commands_path.rglob('*.md'):
            command_name = md_file.stem
            relative_path = str(md_file.relative_to('cli-tool/components'))
            category = md_file.parent.name

            commands.append({
                'name': command_name,
                'path': relative_path,
                'category': category,
                'full_path': str(md_file)
            })

    return commands

def fuzzy_match_command(repo_command_name, awesome_resources):
    """Try to match a repository command with awesome-claude-code resources"""

    # Normalize the repository command name
    norm_repo = normalize_command_name(repo_command_name)

    # Try exact match first
    for resource in awesome_resources:
        norm_awesome = normalize_command_name(resource['command_name'])
        if norm_repo == norm_awesome:
            return resource, 'exact_match'

    # Try URL-based match
    for resource in awesome_resources:
        if resource['url_command']:
            norm_url = normalize_command_name(resource['url_command'])
            if norm_repo == norm_url:
                return resource, 'url_match'

    # Try partial match (contains)
    for resource in awesome_resources:
        norm_awesome = normalize_command_name(resource['command_name'])
        if norm_repo in norm_awesome or norm_awesome in norm_repo:
            return resource, 'partial_match'

    return None, None

def create_attribution_csv(output_path='AWESOME_CLAUDE_CODE_COMMANDS_ATTRIBUTION.csv'):
    """Create the attribution CSV file"""

    # Read awesome-claude-code resources
    print("Reading THE_RESOURCES_TABLE.csv...")
    awesome_resources = read_awesome_claude_code_csv('/tmp/awesome_claude_code_resources.csv')
    print(f"Found {len(awesome_resources)} slash-commands in awesome-claude-code")

    # Scan repository commands
    print("\nScanning repository commands...")
    repo_commands = scan_repository_commands()
    print(f"Found {len(repo_commands)} commands in repository")

    # Match and create attribution records
    print("\nMatching commands...")
    attribution_records = []
    matched_count = 0

    for repo_cmd in repo_commands:
        match, match_type = fuzzy_match_command(repo_cmd['name'], awesome_resources)

        if match:
            matched_count += 1
            attribution_records.append({
                'Repository Command Name': repo_cmd['name'],
                'Repository Path': repo_cmd['path'],
                'Repository Category': repo_cmd['category'],
                'Awesome-Claude-Code Display Name': match['display_name'],
                'Original Author': match['author_name'],
                'Author GitHub': match['author_link'],
                'License': match['license'],
                'Original Source URL': match['primary_link'],
                'Awesome-Claude-Code Category': match['category'],
                'Match Type': match_type,
                'Match Confidence': 'high' if match_type == 'exact_match' else 'medium' if match_type == 'url_match' else 'low',
                'Description': match['description'][:200] + '...' if len(match['description']) > 200 else match['description'],
                'Awesome-Claude-Code ID': match['id']
            })

    # Add unmatched commands for reference
    matched_names = {r['Repository Command Name'] for r in attribution_records}
    for repo_cmd in repo_commands:
        if repo_cmd['name'] not in matched_names:
            attribution_records.append({
                'Repository Command Name': repo_cmd['name'],
                'Repository Path': repo_cmd['path'],
                'Repository Category': repo_cmd['category'],
                'Awesome-Claude-Code Display Name': 'NOT FOUND',
                'Original Author': 'Unknown (not from awesome-claude-code)',
                'Author GitHub': '',
                'License': 'Unknown',
                'Original Source URL': '',
                'Awesome-Claude-Code Category': '',
                'Match Type': 'no_match',
                'Match Confidence': 'none',
                'Description': '',
                'Awesome-Claude-Code ID': ''
            })

    # Write CSV
    print(f"\nWriting attribution CSV to {output_path}...")
    fieldnames = [
        'Repository Command Name',
        'Repository Path',
        'Repository Category',
        'Awesome-Claude-Code Display Name',
        'Original Author',
        'Author GitHub',
        'License',
        'Original Source URL',
        'Awesome-Claude-Code Category',
        'Match Type',
        'Match Confidence',
        'Description',
        'Awesome-Claude-Code ID'
    ]

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(attribution_records)

    # Print summary
    print("\n" + "=" * 80)
    print("ATTRIBUTION ANALYSIS SUMMARY")
    print("=" * 80)
    print(f"Total commands in repository: {len(repo_commands)}")
    print(f"Total slash-commands in awesome-claude-code: {len(awesome_resources)}")
    print(f"Matched commands: {matched_count}")
    print(f"Unmatched commands: {len(repo_commands) - matched_count}")
    print(f"\nAttribution CSV created: {output_path}")

    # Show top authors
    author_counts = {}
    for record in attribution_records:
        if record['Match Confidence'] != 'none':
            author = record['Original Author']
            author_counts[author] = author_counts.get(author, 0) + 1

    if author_counts:
        print("\n" + "=" * 80)
        print("TOP AUTHORS (commands from awesome-claude-code)")
        print("=" * 80)
        for author, count in sorted(author_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"{author}: {count} commands")

    return attribution_records

if __name__ == '__main__':
    attribution_records = create_attribution_csv()
    print("\n✅ Attribution CSV created successfully!")
