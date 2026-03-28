#!/usr/bin/env python3
"""
Plugins JSON Generator Script
Fetches .claude-plugin/ data from GitHub repos and generates plugins.json
with real marketplace.json and plugin.json contents.

Usage:
    python scripts/generate_plugins_json.py

Requires:
    - GITHUB_TOKEN env var (or gh CLI authenticated)
    - pip install requests python-dotenv
"""

import json
import os
import sys
import time
import subprocess

# Build a clean env for gh CLI (avoid conflicting tokens)
_GH_ENV = {k: v for k, v in os.environ.items()}
# Remove any stale GitHub tokens that might override gh CLI auth
for _key in ("GITHUB_TOKEN", "GH_TOKEN", "GITHUB_ENTERPRISE_TOKEN"):
    _GH_ENV.pop(_key, None)

# --- Configuration ---

# Repos to scan: (owner/repo, optional website URL)
REPOS = [
    ("anthropics/claude-plugins-official", None),
    ("anthropics/knowledge-work-plugins", None),
    ("affaan-m/everything-claude-code", None),
    ("thedotmack/claude-mem", None),
    ("jarrodwatts/claude-hud", None),
    ("EveryInc/compound-engineering-plugin", None),
    ("alirezarezvani/claude-skills", None),
    ("davepoon/buildwithclaude", "https://buildwithclaude.com/"),
    ("lackeyjb/playwright-skill", None),
    ("nyldn/claude-octopus", None),
    ("jeremylongshore/claude-code-plugins-plus-skills", None),
    ("timescale/pg-aiguide", None),
    ("CloudAI-X/claude-workflow-v2", None),
    ("numman-ali/n-skills", None),
    ("obra/superpowers-marketplace", None),
    ("muratcankoylan/ralph-wiggum-marketer", None),
    ("team-attention/plugins-for-claude-natives", None),
    ("ananddtyagi/cc-marketplace", None),
    ("agent-sh/agentsys", None),
    ("ccplugins/awesome-claude-code-plugins", None),
    ("hamelsmu/claude-review-loop", None),
    ("sangrokjung/claude-forge", None),
    ("gmickel/gmickel-claude-marketplace", None),
    ("kingbootoshi/cartographer", None),
    ("zscole/adversarial-spec", None),
    ("hashicorp/agent-skills", None),
    ("quant-sentiment-ai/claude-equity-research", None),
    ("777genius/claude-notifications-go", None),
    ("Piebald-AI/claude-code-lsps", None),
    ("chu2bard/pinion-os", None),
]

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "dashboard", "public", "plugins.json")

# --- GitHub API helpers (uses gh CLI) ---

_request_count = 0


def gh_api(endpoint, retries=3):
    """Call GitHub API via gh CLI subprocess."""
    global _request_count

    for attempt in range(retries):
        _request_count += 1
        # Respect rate limits
        if _request_count % 50 == 0:
            time.sleep(1)

        try:
            cmd = ["/usr/local/bin/gh", "api", endpoint.lstrip("/")]
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30, env=_GH_ENV
            )
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout)
            if "Not Found" in result.stderr or "404" in result.stderr:
                return None
            if "rate limit" in result.stderr.lower():
                wait = 30 * (attempt + 1)
                print(f"  ⏳ Rate limited. Waiting {wait}s...")
                time.sleep(wait)
                continue
            if result.returncode != 0:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return None
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  ⚠️  gh CLI failed: {e}")
                return None
    return None


def gh_file_content(repo, path):
    """Fetch and decode a file from a GitHub repo using gh CLI."""
    global _request_count
    _request_count += 1

    try:
        result = subprocess.run(
            ["/usr/local/bin/gh", "api", f"repos/{repo}/contents/{path}", "--jq", ".content"],
            capture_output=True, text=True, timeout=30, env=_GH_ENV
        )
        if result.returncode != 0 or not result.stdout.strip():
            return None
        import base64
        return base64.b64decode(result.stdout.strip()).decode("utf-8")
    except Exception:
        return None


def gh_dir_listing(repo, path):
    """List files/dirs at a path in a GitHub repo."""
    data = gh_api(f"repos/{repo}/contents/{path}")
    if not data or not isinstance(data, list):
        return []
    return data


# --- Plugin data extraction ---

def parse_json_safe(text):
    """Parse JSON, tolerating trailing commas and minor issues."""
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try stripping BOM or trailing garbage
        text = text.strip().lstrip("\ufeff")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None


def extract_plugin_components(plugin_json):
    """Extract component counts from a plugin.json manifest."""
    if not plugin_json:
        return {}
    counts = {}
    for key in ("skills", "agents", "commands"):
        val = plugin_json.get(key)
        if isinstance(val, list):
            # Count only actual file entries, not directory paths
            file_entries = [v for v in val if isinstance(v, str) and not v.endswith("/")]
            dir_entries = [v for v in val if isinstance(v, str) and v.endswith("/")]
            # File entries count directly; dir entries count as 1 (minimum)
            count = len(file_entries) + len(dir_entries)
            if count > 0:
                counts[key] = count
        elif isinstance(val, str):
            counts[key] = 1
    # Hooks
    hooks = plugin_json.get("hooks")
    if hooks:
        if isinstance(hooks, list):
            counts["hooks"] = len(hooks)
        elif isinstance(hooks, str):
            counts["hooks"] = 1
    # MCPs
    mcps = plugin_json.get("mcpServers")
    if isinstance(mcps, dict) and len(mcps) > 0:
        counts["mcps"] = len(mcps)
    # LSPs
    lsps = plugin_json.get("lspServers")
    if isinstance(lsps, dict) and len(lsps) > 0:
        counts["lsps"] = len(lsps)
    # Rules
    rules = plugin_json.get("rules")
    if rules:
        counts["rules"] = 1 if isinstance(rules, str) else len(rules)
    return counts


def classify_repo_type(marketplace, plugin_json):
    """Determine if repo is a marketplace or single plugin."""
    if not marketplace:
        return "plugin"
    plugins_list = marketplace.get("plugins", [])
    if len(plugins_list) > 1:
        return "marketplace"
    # Single plugin in marketplace = it's a plugin repo
    return "plugin"


def extract_tags_from_components(components):
    """Derive tags from component counts."""
    tag_map = {
        "skills": "skills",
        "agents": "agents",
        "commands": "commands",
        "hooks": "hooks",
        "mcps": "mcps",
        "lsps": "lsps",
        "rules": "rules",
    }
    return [tag_map[k] for k in tag_map if components.get(k, 0) > 0]


def get_local_source_path(plugin_entry):
    """Extract local source path from a plugin entry, or None if external."""
    source = plugin_entry.get("source", "")
    if isinstance(source, str):
        if source.startswith("./") or source.startswith("../") or source == "./" or source == ".":
            return source.rstrip("/")
        # Could be a short-form like "owner/repo" — that's external
        if source.startswith("http") or source.endswith(".git") or "/" in source:
            return None
        return None
    elif isinstance(source, dict):
        src_type = source.get("source", "")
        if src_type in ("url", "git-subdir", "github"):
            return None
        # Local path in source dict
        path = source.get("path", "")
        if path.startswith("./"):
            return path.rstrip("/")
    return None


def scan_plugin_dir_components(repo, dir_path):
    """Scan a plugin directory for skills/, agents/, commands/, hooks/ subdirs
    and count the files inside each. Returns component counts dict."""
    components = {}
    # List the plugin's root directory
    listing = gh_dir_listing(repo, dir_path)
    if not listing:
        return components

    dir_names = {item["name"]: item["type"] for item in listing if isinstance(item, dict)}
    component_dirs = ["skills", "agents", "commands", "hooks"]

    for comp_dir in component_dirs:
        if comp_dir in dir_names and dir_names[comp_dir] == "dir":
            # Count items inside this component directory
            items = gh_dir_listing(repo, f"{dir_path}/{comp_dir}")
            if items:
                # Count files and dirs (each dir = 1 component, each .md/.json file = 1 component)
                count = len([
                    item for item in items
                    if isinstance(item, dict) and (
                        item["type"] == "dir" or
                        item["name"].endswith((".md", ".json", ".js", ".ts", ".py"))
                    )
                ])
                if count > 0:
                    components[comp_dir] = count

    # Check for mcpServers in plugin.json
    plugin_json_raw = gh_file_content(repo, f"{dir_path}/.claude-plugin/plugin.json")
    if plugin_json_raw:
        pj = parse_json_safe(plugin_json_raw)
        if pj:
            mcps = pj.get("mcpServers")
            if isinstance(mcps, dict) and len(mcps) > 0:
                components["mcps"] = len(mcps)
            lsps = pj.get("lspServers")
            if isinstance(lsps, dict) and len(lsps) > 0:
                components["lsps"] = len(lsps)

    return components


def extract_marketplace_plugins_detail(marketplace, repo=None, scan_local=True):
    """Extract detailed plugin list from marketplace.json.
    If scan_local=True and repo is provided, scan local plugin directories
    for actual component counts."""
    if not marketplace:
        return []
    plugins_list = marketplace.get("plugins", [])
    details = []
    local_scan_count = 0
    max_local_scans = 50  # Limit API calls

    for p in plugins_list:
        entry = {
            "name": p.get("name", "unknown"),
            "description": p.get("description", ""),
        }
        # Extract source info
        source = p.get("source", "")
        local_path = get_local_source_path(p)

        if isinstance(source, str):
            entry["source"] = source
        elif isinstance(source, dict):
            entry["source"] = source.get("url", source.get("repo", ""))
            if source.get("path"):
                entry["source_path"] = source["path"]

        # Extract author if present
        author = p.get("author")
        if isinstance(author, dict):
            entry["author"] = author.get("name", "")
        elif isinstance(author, str):
            entry["author"] = author

        # Tags/keywords
        tags = p.get("tags", p.get("keywords", []))
        if tags:
            entry["tags"] = tags

        # Inline components from marketplace.json
        components = {}
        for key in ("skills", "agents", "commands"):
            val = p.get(key)
            if isinstance(val, list) and len(val) > 0:
                components[key] = len(val)
        mcps = p.get("mcpServers")
        if isinstance(mcps, dict) and len(mcps) > 0:
            components["mcps"] = len(mcps)
        lsps = p.get("lspServers")
        if isinstance(lsps, dict) and len(lsps) > 0:
            components["lsps"] = len(lsps)

        # If no inline components and this is a local plugin, scan its directory
        if not components and local_path and repo and scan_local and local_scan_count < max_local_scans:
            scanned = scan_plugin_dir_components(repo, local_path.lstrip("./"))
            if scanned:
                components = scanned
                local_scan_count += 1

        if components:
            entry["components"] = components

        details.append(entry)
    return details


def aggregate_marketplace_components(plugins_detail):
    """Sum component counts across all plugins in a marketplace."""
    totals = {}
    for p in plugins_detail:
        for key, count in p.get("components", {}).items():
            totals[key] = totals.get(key, 0) + count
    return totals


def build_highlights(marketplace, plugin_json, repo_type, repo_info):
    """Auto-generate highlights from real data."""
    highlights = []
    owner = repo_info.get("owner", {}).get("login", "")

    if owner == "anthropics":
        highlights.append("Official Anthropic repository")
    elif owner == "hashicorp":
        highlights.append("Official HashiCorp release")
    elif owner == "timescale":
        highlights.append("Official Timescale plugin")

    if marketplace:
        plugins_list = marketplace.get("plugins", [])
        if len(plugins_list) > 1:
            highlights.append(f"{len(plugins_list)} plugins in marketplace")

    if plugin_json:
        parts = []
        for key, label in [("skills", "skills"), ("agents", "agents"), ("commands", "commands"),
                           ("hooks", "hooks"), ("mcpServers", "MCPs"), ("lspServers", "LSPs")]:
            val = plugin_json.get(key)
            if isinstance(val, list) and len(val) > 0:
                parts.append(f"{len(val)} {label}")
            elif isinstance(val, dict) and len(val) > 0:
                parts.append(f"{len(val)} {label}")
        if parts:
            highlights.append("Plugin declares: " + ", ".join(parts))

    # Website
    website = repo_info.get("homepage")
    if website and website.startswith("http"):
        highlights.append(f"Web UI: {website}")

    return highlights[:3]  # Max 3


def process_repo(repo_full, website_override=None):
    """Process a single repo and return its plugin data."""
    owner, name = repo_full.split("/")
    print(f"\n📦 Processing {repo_full}...")

    # 1. Get repo info
    repo_info = gh_api(f"repos/{repo_full}")
    if not repo_info:
        print(f"  ❌ Repo not found")
        return None

    stars = repo_info.get("stargazers_count", 0)
    description = repo_info.get("description", "")
    repo_owner = repo_info.get("owner", {}).get("login", owner)

    # 2. Read marketplace.json
    marketplace_raw = gh_file_content(repo_full, ".claude-plugin/marketplace.json")
    marketplace = parse_json_safe(marketplace_raw)
    if not marketplace:
        print(f"  ⚠️  No valid marketplace.json")
        return None

    # 3. Read plugin.json (optional)
    plugin_raw = gh_file_content(repo_full, ".claude-plugin/plugin.json")
    plugin_json = parse_json_safe(plugin_raw)

    # 4. Classify type
    repo_type = classify_repo_type(marketplace, plugin_json)
    print(f"  Type: {repo_type} | Stars: {stars:,}")

    # 5. Extract marketplace plugin details (scan local dirs for component counts)
    plugins_detail = extract_marketplace_plugins_detail(marketplace, repo=repo_full, scan_local=True)
    marketplace_component_totals = aggregate_marketplace_components(plugins_detail)

    # 6. Extract single plugin components
    single_components = extract_plugin_components(plugin_json) if plugin_json else {}

    # 7. Build contains
    if repo_type == "marketplace":
        contains = {"plugins": len(marketplace.get("plugins", []))}
        if marketplace_component_totals:
            contains["components"] = marketplace_component_totals
    else:
        contains = single_components if single_components else {}

    # 8. Build tags
    all_components = {**marketplace_component_totals, **single_components}
    tags = extract_tags_from_components(all_components)
    # If no tags from components, infer from plugin descriptions and marketplace data
    if not tags:
        tag_set = set()
        # Check plugin entry tags/keywords
        for p in plugins_detail:
            for t in p.get("tags", []):
                t_lower = t.lower()
                if t_lower in ("skills", "agents", "commands", "hooks", "mcps", "lsps"):
                    tag_set.add(t_lower)
        # Scan descriptions for clues
        all_text = " ".join(p.get("description", "") for p in plugins_detail).lower()
        all_text += " " + description.lower()
        keyword_map = {
            "skill": "skills", "agent": "agents", "subagent": "agents",
            "command": "commands", "slash command": "commands",
            "hook": "hooks", "mcp": "mcps", "lsp": "lsps",
        }
        for keyword, tag in keyword_map.items():
            if keyword in all_text:
                tag_set.add(tag)
        tags = sorted(tag_set)

    # 9. Build highlights
    highlights = build_highlights(marketplace, plugin_json, repo_type, repo_info)

    # 10. Determine name — prefer repo name humanized over marketplace slug
    repo_display = repo_info.get("name", name)
    mp_name = marketplace.get("name", "")
    plugin_name = plugin_json.get("name", "") if plugin_json else ""
    # Use marketplace/plugin name only if it looks human-readable (has spaces or capitals)
    if mp_name and (mp_name != mp_name.lower().replace(" ", "-") or " " in mp_name):
        display_name = mp_name
    elif plugin_name and (plugin_name != plugin_name.lower().replace(" ", "-") or " " in plugin_name):
        display_name = plugin_name
    else:
        display_name = repo_display.replace("-", " ").title()

    # 11. Slug
    slug = name.lower()
    # Avoid collisions by prepending owner for common names
    if slug in ("claude-skills", "awesome-claude-skills", "awesome-claude-code-plugins"):
        slug = f"{owner.lower()}-{slug}"

    # 12. Website
    website = website_override or repo_info.get("homepage") or None
    if website and not website.startswith("http"):
        website = None

    # 13. Build result
    result = {
        "slug": slug,
        "name": display_name,
        "author": repo_owner,
        "description": description or marketplace.get("description", ""),
        "github": f"https://github.com/{repo_full}",
        "stars": stars,
        "type": repo_type,
        "tags": tags,
        "contains": contains,
        "highlights": highlights,
    }

    if website:
        result["website"] = website

    # 14. Add marketplace plugins list (for individual pages)
    if repo_type == "marketplace" and plugins_detail:
        result["plugins_list"] = plugins_detail

    # 15. Add plugin.json details for single plugins
    if plugin_json and repo_type == "plugin":
        plugin_detail = {}
        for key in ("skills", "agents", "commands"):
            val = plugin_json.get(key)
            if isinstance(val, list) and val:
                plugin_detail[key] = val
        mcps = plugin_json.get("mcpServers")
        if isinstance(mcps, dict) and mcps:
            plugin_detail["mcpServers"] = list(mcps.keys())
        lsps = plugin_json.get("lspServers")
        if isinstance(lsps, dict) and lsps:
            plugin_detail["lspServers"] = list(lsps.keys())
        if plugin_detail:
            result["plugin_manifest"] = plugin_detail

    print(f"  ✅ {display_name} — {repo_type} — {stars:,} stars — tags: {tags}")
    return result


# --- Main ---

def main():
    print("🔌 Generating plugins.json from GitHub .claude-plugin/ data...\n")

    # Check gh CLI is available
    try:
        test = subprocess.run(
            ["/usr/local/bin/gh", "api", "rate_limit", "--jq", ".rate.remaining"],
            capture_output=True, text=True, timeout=10, env=_GH_ENV
        )
        if test.returncode == 0:
            print(f"✅ gh CLI authenticated. API requests remaining: {test.stdout.strip()}\n")
        else:
            print("⚠️  gh CLI may not be authenticated. Run `gh auth login` first.\n")
    except FileNotFoundError:
        print("❌ gh CLI not found. Install it: https://cli.github.com\n")
        sys.exit(1)

    results = []
    errors = []

    for repo_full, website in REPOS:
        try:
            data = process_repo(repo_full, website)
            if data:
                results.append(data)
            else:
                errors.append(repo_full)
        except Exception as e:
            print(f"  ❌ Error processing {repo_full}: {e}")
            errors.append(repo_full)

    # Sort by stars descending
    results.sort(key=lambda x: x["stars"], reverse=True)

    # Write output
    output_path = os.path.abspath(OUTPUT_PATH)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"✅ Generated {output_path}")
    print(f"   {len(results)} plugins/marketplaces written")
    print(f"   {len(errors)} errors: {errors}" if errors else "   0 errors")
    print(f"   Total API requests: {_request_count}")

    # Summary
    marketplaces = [r for r in results if r["type"] == "marketplace"]
    plugins = [r for r in results if r["type"] == "plugin"]
    print(f"\n   📊 {len(marketplaces)} marketplaces | {len(plugins)} individual plugins")
    total_stars = sum(r["stars"] for r in results)
    print(f"   ⭐ {total_stars:,} total stars across all repos")


if __name__ == "__main__":
    main()
