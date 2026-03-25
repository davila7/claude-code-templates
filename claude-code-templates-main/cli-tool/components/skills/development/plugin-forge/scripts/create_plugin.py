#!/usr/bin/env python3
"""
Create a new Claude Code plugin with proper directory structure and manifests.
"""

import argparse
import json
import os
import sys
from pathlib import Path


def create_plugin_structure(plugin_name: str, marketplace_root: Path, author_name: str, author_email: str, description: str, keywords: list[str], category: str = "productivity") -> None:
    """Create complete plugin directory structure with manifests."""

    # Create plugin directory
    plugin_dir = marketplace_root / "plugins" / plugin_name
    if plugin_dir.exists():
        print(f"❌ Plugin directory already exists: {plugin_dir}")
        sys.exit(1)

    # Create directory structure
    plugin_config_dir = plugin_dir / ".claude-plugin"
    commands_dir = plugin_dir / "commands"
    skills_dir = plugin_dir / "skills"

    plugin_config_dir.mkdir(parents=True, exist_ok=True)
    commands_dir.mkdir(parents=True, exist_ok=True)
    skills_dir.mkdir(parents=True, exist_ok=True)

    # Create plugin.json
    plugin_manifest = {
        "name": plugin_name,
        "version": "0.1.0",
        "description": description,
        "author": {
            "name": author_name,
            "email": author_email
        },
        "keywords": keywords
    }

    plugin_json_path = plugin_config_dir / "plugin.json"
    with open(plugin_json_path, "w") as f:
        json.dump(plugin_manifest, f, indent=2)

    print(f"✅ Created plugin manifest: {plugin_json_path}")

    # Create README.md
    readme_content = f"""# {plugin_name}

{description}

## Installation

```bash
/plugin marketplace add <marketplace-source>
/plugin install {plugin_name}@<marketplace-name>
```

## Features

- TODO: List features here

## Usage

TODO: Add usage examples

## Development

See [workflows.md](../../CLAUDE.md) for development guidelines.
"""

    readme_path = plugin_dir / "README.md"
    with open(readme_path, "w") as f:
        f.write(readme_content)

    print(f"✅ Created README: {readme_path}")

    # Update marketplace.json
    marketplace_json_path = marketplace_root / ".claude-plugin" / "marketplace.json"

    if not marketplace_json_path.exists():
        print(f"❌ Marketplace manifest not found: {marketplace_json_path}")
        sys.exit(1)

    with open(marketplace_json_path, "r") as f:
        marketplace_data = json.load(f)

    # Check if plugin already exists in marketplace
    for plugin in marketplace_data.get("plugins", []):
        if plugin.get("name") == plugin_name:
            print(f"❌ Plugin '{plugin_name}' already exists in marketplace manifest")
            sys.exit(1)

    # Add plugin entry
    plugin_entry = {
        "name": plugin_name,
        "source": f"./plugins/{plugin_name}",
        "description": description,
        "version": "0.1.0",
        "keywords": keywords,
        "category": category
    }

    if "plugins" not in marketplace_data:
        marketplace_data["plugins"] = []

    marketplace_data["plugins"].append(plugin_entry)

    with open(marketplace_json_path, "w") as f:
        json.dump(marketplace_data, f, indent=2)

    print(f"✅ Updated marketplace manifest: {marketplace_json_path}")

    print(f"\n🎉 Plugin '{plugin_name}' created successfully!")
    print(f"\nNext steps:")
    print(f"1. Add commands to: {commands_dir}")
    print(f"2. Add skills to: {skills_dir}")
    print(f"3. Test with: /plugin install {plugin_name}@marketplace-name")


def main():
    parser = argparse.ArgumentParser(description="Create a new Claude Code plugin")
    parser.add_argument("plugin_name", help="Plugin name (kebab-case)")
    parser.add_argument("--marketplace-root", default=".", help="Path to marketplace root directory")
    parser.add_argument("--author-name", required=True, help="Plugin author name")
    parser.add_argument("--author-email", required=True, help="Plugin author email")
    parser.add_argument("--description", required=True, help="Plugin description")
    parser.add_argument("--keywords", required=True, help="Comma-separated keywords")
    parser.add_argument("--category", default="productivity", help="Plugin category (default: productivity)")

    args = parser.parse_args()

    marketplace_root = Path(args.marketplace_root).resolve()
    keywords = [k.strip() for k in args.keywords.split(",")]

    create_plugin_structure(
        plugin_name=args.plugin_name,
        marketplace_root=marketplace_root,
        author_name=args.author_name,
        author_email=args.author_email,
        description=args.description,
        keywords=keywords,
        category=args.category
    )


if __name__ == "__main__":
    main()
