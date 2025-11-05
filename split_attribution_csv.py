#!/usr/bin/env python3
"""
Split attribution CSV into high-confidence and low-confidence matches.
"""

import csv
from collections import defaultdict

def split_attribution_csv():
    """Split the main CSV into high and low confidence CSVs"""

    high_confidence = []
    low_confidence = []

    # Read the main CSV
    with open('AWESOME_CLAUDE_CODE_COMMANDS_ATTRIBUTION.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        for row in reader:
            match_confidence = row.get('Match Confidence', '')

            if match_confidence == 'high':
                high_confidence.append(row)
            elif match_confidence in ['medium', 'low', 'none']:
                low_confidence.append(row)

    # Write high-confidence CSV
    print(f"Writing {len(high_confidence)} high-confidence matches...")
    with open('COMMANDS_FROM_AWESOME_CLAUDE_CODE_HIGH_CONFIDENCE.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(high_confidence)

    # Write low-confidence CSV
    print(f"Writing {len(low_confidence)} lower-confidence matches...")
    with open('COMMANDS_FROM_AWESOME_CLAUDE_CODE_LOW_CONFIDENCE.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(low_confidence)

    # Analyze high-confidence matches
    print("\n" + "=" * 80)
    print("HIGH-CONFIDENCE MATCHES ANALYSIS")
    print("=" * 80)

    # Group by command name to find duplicates
    by_name = defaultdict(list)
    unique_commands = set()

    for row in high_confidence:
        cmd_name = row['Repository Command Name']
        by_name[cmd_name].append(row)
        unique_commands.add(cmd_name)

    print(f"\nTotal high-confidence rows: {len(high_confidence)}")
    print(f"Unique command names: {len(unique_commands)}")

    # Show duplicates
    duplicates = {name: rows for name, rows in by_name.items() if len(rows) > 1}
    if duplicates:
        print(f"\nDuplicate commands (same name in multiple locations):")
        for name, rows in duplicates.items():
            print(f"\n  {name}:")
            for row in rows:
                print(f"    - {row['Repository Path']}")

    # Show top authors
    author_counts = defaultdict(int)
    license_counts = defaultdict(int)

    for row in high_confidence:
        author = row['Original Author']
        license = row['License']
        author_counts[author] += 1
        license_counts[license] += 1

    print("\n" + "=" * 80)
    print("TOP AUTHORS (High-Confidence Only)")
    print("=" * 80)
    for author, count in sorted(author_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"{author}: {count} commands")

    print("\n" + "=" * 80)
    print("LICENSE DISTRIBUTION (High-Confidence Only)")
    print("=" * 80)
    for license, count in sorted(license_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"{license}: {count}")

    # List all unique high-confidence commands
    print("\n" + "=" * 80)
    print("ALL HIGH-CONFIDENCE COMMANDS (Alphabetical)")
    print("=" * 80)
    for cmd_name in sorted(unique_commands):
        rows = by_name[cmd_name]
        author = rows[0]['Original Author']
        license = rows[0]['License']
        print(f"{cmd_name:30} {author:20} {license}")

    # Low-confidence summary
    print("\n" + "=" * 80)
    print("LOW-CONFIDENCE MATCHES SUMMARY")
    print("=" * 80)

    low_by_confidence = defaultdict(int)
    for row in low_confidence:
        conf = row['Match Confidence']
        low_by_confidence[conf] += 1

    print(f"\nTotal low-confidence rows: {len(low_confidence)}")
    for conf, count in sorted(low_by_confidence.items()):
        print(f"  {conf}: {count}")

    print("\n✅ Files created:")
    print("  - COMMANDS_FROM_AWESOME_CLAUDE_CODE_HIGH_CONFIDENCE.csv")
    print("  - COMMANDS_FROM_AWESOME_CLAUDE_CODE_LOW_CONFIDENCE.csv")

if __name__ == '__main__':
    split_attribution_csv()
