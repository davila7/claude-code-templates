#!/usr/bin/env python3
"""
Verify which agents are actually from wshobson by comparing content similarity.

This will help us narrow down from 50 exact name matches to the verified 45.
"""

import csv
import requests
from pathlib import Path
import time

def fetch_wshobson_agent_content(agent_name):
    """
    Try to fetch the agent content from wshobson/agents.
    The agent might be in multiple plugin directories, so try common ones.
    """

    # Common plugin directories where agents might be located
    plugin_paths = [
        f"plugins/application-performance/agents/{agent_name}.md",
        f"plugins/api-scaffolding/agents/{agent_name}.md",
        f"plugins/backend-development/agents/{agent_name}.md",
        f"plugins/cicd-automation/agents/{agent_name}.md",
        f"plugins/cloud-infrastructure/agents/{agent_name}.md",
        f"plugins/data-engineering/agents/{agent_name}.md",
        f"plugins/database-design/agents/{agent_name}.md",
        f"plugins/frontend-mobile-development/agents/{agent_name}.md",
        f"plugins/machine-learning-ops/agents/{agent_name}.md",
        f"plugins/multi-platform-apps/agents/{agent_name}.md",
        f"plugins/python-development/agents/{agent_name}.md",
        f"plugins/systems-programming/agents/{agent_name}.md",
        f"plugins/javascript-typescript/agents/{agent_name}.md",
        f"plugins/jvm-languages/agents/{agent_name}.md",
        f"plugins/shell-scripting/agents/{agent_name}.md",
        f"plugins/web-scripting/agents/{agent_name}.md",
        f"plugins/security-compliance/agents/{agent_name}.md",
        f"plugins/documentation-generation/agents/{agent_name}.md",
        f"plugins/business-analytics/agents/{agent_name}.md",
        f"plugins/hr-legal-compliance/agents/{agent_name}.md",
        f"plugins/llm-application-dev/agents/{agent_name}.md",
        f"plugins/code-documentation/agents/{agent_name}.md",
        f"plugins/performance-testing-review/agents/{agent_name}.md",
        f"plugins/tdd-workflows/agents/{agent_name}.md",
        f"plugins/debugging-toolkit/agents/{agent_name}.md",
        f"plugins/expert-advisors/agents/{agent_name}.md",
    ]

    base_url = "https://raw.githubusercontent.com/wshobson/agents/main/"

    for path in plugin_paths:
        try:
            url = base_url + path
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                return response.text, url
        except:
            pass

    return None, None

def calculate_similarity(text1, text2):
    """Calculate simple similarity ratio between two texts"""
    if not text1 or not text2:
        return 0.0

    # Normalize texts (lowercase, remove extra whitespace)
    text1 = ' '.join(text1.lower().split())
    text2 = ' '.join(text2.lower().split())

    # Simple character overlap ratio
    set1 = set(text1)
    set2 = set(text2)
    intersection = len(set1 & set2)
    union = len(set1 | set2)

    return intersection / union if union > 0 else 0.0

def verify_agents():
    """Verify agents by comparing content with wshobson/agents"""

    print("=" * 80)
    print("VERIFYING AGENTS AGAINST WSHOBSON/AGENTS CONTENT")
    print("=" * 80)

    # Read high-confidence CSV
    high_confidence = []
    with open('AGENTS_FROM_WSHOBSON_HIGH_CONFIDENCE.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        high_confidence = list(reader)

    print(f"\nVerifying {len(high_confidence)} high-confidence agents...")
    print("This will take a few minutes as we fetch content from GitHub...\n")

    verified = []
    unverified = []

    for i, agent in enumerate(high_confidence, 1):
        agent_name = agent['Repository Agent Name']
        repo_path = f"cli-tool/components/{agent['Repository Path']}"

        print(f"[{i}/{len(high_confidence)}] Checking {agent_name}...")

        # Read local agent content
        try:
            with open(repo_path, 'r', encoding='utf-8') as f:
                local_content = f.read()
        except:
            print(f"  ❌ Could not read local file")
            unverified.append(agent)
            continue

        # Fetch wshobson content
        wshobson_content, source_url = fetch_wshobson_agent_content(agent_name)

        if wshobson_content:
            # Calculate similarity
            similarity = calculate_similarity(local_content, wshobson_content)

            agent['Content Similarity'] = f"{similarity:.2%}"
            agent['Wshobson Source URL'] = source_url
            agent['Verification Status'] = 'verified' if similarity > 0.3 else 'questionable'

            if similarity > 0.3:
                print(f"  ✅ Verified ({similarity:.1%} similarity)")
                print(f"     Source: {source_url}")
                verified.append(agent)
            else:
                print(f"  ⚠️  Low similarity ({similarity:.1%}) - might not be from wshobson")
                unverified.append(agent)
        else:
            print(f"  ❌ Not found in wshobson/agents")
            agent['Content Similarity'] = 'N/A'
            agent['Wshobson Source URL'] = 'Not found'
            agent['Verification Status'] = 'not_found'
            unverified.append(agent)

        # Rate limiting
        time.sleep(0.5)

    # Write results
    print("\n" + "=" * 80)
    print("VERIFICATION RESULTS")
    print("=" * 80)
    print(f"\n✅ Verified agents: {len(verified)}")
    print(f"❌ Unverified/questionable: {len(unverified)}")

    # Write verified CSV
    if verified:
        fieldnames = list(verified[0].keys())
        with open('VERIFIED_45_AGENTS_FROM_WSHOBSON.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(verified)
        print(f"\n✅ Created: VERIFIED_45_AGENTS_FROM_WSHOBSON.csv")

    # Write unverified CSV
    if unverified:
        fieldnames = list(high_confidence[0].keys())
        fieldnames.extend(['Content Similarity', 'Wshobson Source URL', 'Verification Status'])
        with open('AGENTS_WSHOBSON_UNVERIFIED.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(unverified)
        print(f"⚠️  Created: AGENTS_WSHOBSON_UNVERIFIED.csv")

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Started with: {len(high_confidence)} exact name matches")
    print(f"Verified by content: {len(verified)} agents")
    print(f"Unverified/Not found: {len(unverified)} agents")
    print(f"\nTarget from README: 45 agents")

    if len(verified) == 45:
        print("✅ PERFECT MATCH! We found exactly 45 verified agents!")
    elif len(verified) < 45:
        print(f"⚠️  We found {45 - len(verified)} fewer than expected")
    else:
        print(f"⚠️  We found {len(verified) - 45} more than expected")

if __name__ == '__main__':
    try:
        verify_agents()
    except KeyboardInterrupt:
        print("\n\nVerification interrupted. Partial results may be saved.")
