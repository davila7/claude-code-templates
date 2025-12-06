#!/usr/bin/env python3
"""
Comprehensive verification of wshobson agents using GitHub API to find ALL plugin directories.
"""

import csv
import requests
import time

def get_all_wshobson_agent_files():
    """Fetch ALL agent file paths from wshobson/agents using GitHub API"""
    url = "https://api.github.com/repos/wshobson/agents/git/trees/main?recursive=1"

    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            tree = data.get('tree', [])

            # Filter for agent .md files (in plugins/*/agents/*.md)
            agent_files = {}
            for item in tree:
                path = item.get('path', '')
                if '/agents/' in path and path.endswith('.md') and 'plugins/' in path:
                    # Extract agent name from path
                    agent_name = path.split('/')[-1].replace('.md', '')
                    # Store path for this agent
                    if agent_name not in agent_files:
                        agent_files[agent_name] = path

            return agent_files
    except Exception as e:
        print(f"Error fetching wshobson repository structure: {e}")
        return {}

def fetch_content_from_github(path):
    """Fetch file content from GitHub"""
    base_url = "https://raw.githubusercontent.com/wshobson/agents/main/"
    url = base_url + path

    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return response.text, url
    except:
        pass

    return None, None

def calculate_similarity(text1, text2):
    """Calculate simple similarity ratio"""
    if not text1 or not text2:
        return 0.0

    text1 = ' '.join(text1.lower().split())
    text2 = ' '.join(text2.lower().split())

    set1 = set(text1)
    set2 = set(text2)
    intersection = len(set1 & set2)
    union = len(set1 | set2)

    return intersection / union if union > 0 else 0.0

def verify_agents_comprehensive():
    """Comprehensive verification against wshobson/agents"""

    print("=" * 80)
    print("COMPREHENSIVE WSHOBSON AGENTS VERIFICATION")
    print("=" * 80)

    # Get all wshobson agent files
    print("\nFetching complete list of agents from wshobson/agents...")
    wshobson_agent_files = get_all_wshobson_agent_files()
    print(f"Found {len(wshobson_agent_files)} agents in wshobson/agents repository")

    # Read our high-confidence matches
    high_confidence = []
    with open('AGENTS_FROM_WSHOBSON_HIGH_CONFIDENCE.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        high_confidence = list(reader)

    print(f"Verifying {len(high_confidence)} high-confidence name matches...\n")

    verified = []
    unverified = []

    for i, agent in enumerate(high_confidence, 1):
        agent_name = agent['Repository Agent Name']
        repo_path = f"cli-tool/components/{agent['Repository Path']}"

        print(f"[{i}/{len(high_confidence)}] {agent_name}...", end=' ')

        # Read local content
        try:
            with open(repo_path, 'r', encoding='utf-8') as f:
                local_content = f.read()
        except:
            print("❌ Could not read local file")
            unverified.append(agent)
            continue

        # Check if agent exists in wshobson
        if agent_name in wshobson_agent_files:
            wshobson_path = wshobson_agent_files[agent_name]
            wshobson_content, source_url = fetch_content_from_github(wshobson_path)

            if wshobson_content:
                similarity = calculate_similarity(local_content, wshobson_content)

                agent['Content Similarity'] = f"{similarity:.2%}"
                agent['Wshobson Source URL'] = source_url
                agent['Wshobson Path'] = wshobson_path
                agent['Verification Status'] = 'verified' if similarity > 0.3 else 'low_similarity'

                if similarity > 0.3:
                    print(f"✅ {similarity:.0%}")
                    verified.append(agent)
                else:
                    print(f"⚠️  {similarity:.0%} (low)")
                    unverified.append(agent)
            else:
                print("❌ Could not fetch")
                unverified.append(agent)
        else:
            print("❌ Not in wshobson")
            agent['Content Similarity'] = 'N/A'
            agent['Wshobson Source URL'] = 'Not found'
            agent['Wshobson Path'] = 'N/A'
            agent['Verification Status'] = 'not_found'
            unverified.append(agent)

        time.sleep(0.3)  # Rate limiting

    # Write results
    print("\n" + "=" * 80)
    print("VERIFICATION RESULTS")
    print("=" * 80)
    print(f"✅ Verified: {len(verified)}")
    print(f"❌ Unverified: {len(unverified)}")

    # Write verified CSV (should be 48!)
    if verified:
        fieldnames = list(verified[0].keys())
        with open('VERIFIED_48_AGENTS_FROM_WSHOBSON.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(verified)
        print(f"\n✅ VERIFIED_48_AGENTS_FROM_WSHOBSON.csv created ({len(verified)} agents)")

    # Write unverified
    if unverified:
        fieldnames = list(high_confidence[0].keys())
        fieldnames.extend(['Content Similarity', 'Wshobson Source URL', 'Wshobson Path', 'Verification Status'])
        # Add these fields to unverified records if missing
        for record in unverified:
            for field in ['Content Similarity', 'Wshobson Source URL', 'Wshobson Path', 'Verification Status']:
                if field not in record:
                    record[field] = 'N/A'

        with open('AGENTS_WSHOBSON_UNVERIFIED_FINAL.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(unverified)
        print(f"⚠️  AGENTS_WSHOBSON_UNVERIFIED_FINAL.csv created ({len(unverified)} agents)")

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Exact name matches: {len(high_confidence)}")
    print(f"Verified by content: {len(verified)}")
    print(f"Target from README: 48 agents")

    if len(verified) == 48:
        print("\n🎉 PERFECT! We found exactly 48 verified agents from wshobson!")
    elif len(verified) < 48:
        print(f"\n⚠️  We found {48 - len(verified)} fewer than expected")
        print(f"   This might be due to:")
        print(f"   - Heavily modified agents (low content similarity)")
        print(f"   - Agents not actually from wshobson")
    else:
        print(f"\n⚠️  We found {len(verified) - 48} more than expected")

    # List verified agents
    print("\n" + "=" * 80)
    print(f"VERIFIED {len(verified)} AGENTS FROM WSHOBSON")
    print("=" * 80)
    for agent in sorted(verified, key=lambda x: x['Repository Agent Name']):
        similarity = agent.get('Content Similarity', 'N/A')
        print(f"  {agent['Repository Agent Name']:<35} {similarity:>6}")

if __name__ == '__main__':
    verify_agents_comprehensive()
