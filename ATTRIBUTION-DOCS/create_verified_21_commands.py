#!/usr/bin/env python3
"""
Create the verified list of 21 commands from awesome-claude-code.

Excludes commands with questionable licenses (NOT_FOUND, NOASSERTION).
"""

import csv

def create_verified_21():
    """Create CSV with only the 21 verified commands"""

    # Commands to exclude due to license issues
    EXCLUDE_LICENSES = ['NOT_FOUND', 'NOASSERTION']

    verified_commands = []
    excluded_commands = []

    # Read high-confidence CSV
    with open('COMMANDS_FROM_AWESOME_CLAUDE_CODE_HIGH_CONFIDENCE.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        for row in reader:
            license = row['License']

            if license in EXCLUDE_LICENSES:
                excluded_commands.append(row)
            else:
                verified_commands.append(row)

    # Write verified commands CSV
    print(f"Writing {len(verified_commands)} verified commands...")
    with open('VERIFIED_21_COMMANDS_FROM_AWESOME_CLAUDE_CODE.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(verified_commands)

    print("\n" + "=" * 80)
    print("VERIFIED 21 COMMANDS FROM AWESOME-CLAUDE-CODE")
    print("=" * 80)
    print(f"\nTotal verified commands: {len(verified_commands)}")

    # Count unique command names
    unique_names = set(row['Repository Command Name'] for row in verified_commands)
    print(f"Unique command names: {len(unique_names)}")

    # Show excluded commands
    print("\n" + "=" * 80)
    print("EXCLUDED COMMANDS (License Issues)")
    print("=" * 80)
    print(f"\nTotal excluded: {len(excluded_commands)}")
    for row in excluded_commands:
        print(f"  - {row['Repository Command Name']:<30} {row['Original Author']:<20} {row['License']}")

    # List all verified commands
    print("\n" + "=" * 80)
    print("ALL 21 VERIFIED COMMANDS")
    print("=" * 80)
    print(f"\n{'Command':<30} {'Author':<25} {'License':<15}")
    print("-" * 70)

    # Sort by command name, keeping only unique names
    seen = set()
    for row in sorted(verified_commands, key=lambda x: x['Repository Command Name']):
        cmd_name = row['Repository Command Name']
        if cmd_name not in seen:
            seen.add(cmd_name)
            print(f"{cmd_name:<30} {row['Original Author']:<25} {row['License']:<15}")

    print("\n✅ File created: VERIFIED_21_COMMANDS_FROM_AWESOME_CLAUDE_CODE.csv")

if __name__ == '__main__':
    create_verified_21()
