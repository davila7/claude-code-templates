#!/usr/bin/env python3
"""
Bump plugin version in both plugin.json and marketplace.json.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Literal


VersionPart = Literal["major", "minor", "patch"]


def parse_version(version: str) -> tuple[int, int, int]:
    """Parse semantic version string into tuple."""
    try:
        parts = version.split(".")
        return int(parts[0]), int(parts[1]), int(parts[2])
    except (ValueError, IndexError):
        print(f"❌ Invalid version format: {version}")
        sys.exit(1)


def bump_version(version: str, part: VersionPart) -> str:
    """Bump semantic version."""
    major, minor, patch = parse_version(version)

    if part == "major":
        return f"{major + 1}.0.0"
    elif part == "minor":
        return f"{major}.{minor + 1}.0"
    elif part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    else:
        print(f"❌ Invalid version part: {part}")
        sys.exit(1)


def update_plugin_version(plugin_name: str, marketplace_root: Path, part: VersionPart) -> None:
    """Update version in both plugin.json and marketplace.json."""

    # Update plugin.json
    plugin_json_path = marketplace_root / "plugins" / plugin_name / ".claude-plugin" / "plugin.json"

    if not plugin_json_path.exists():
        print(f"❌ Plugin manifest not found: {plugin_json_path}")
        sys.exit(1)

    with open(plugin_json_path, "r") as f:
        plugin_data = json.load(f)

    old_version = plugin_data.get("version", "0.0.0")
    new_version = bump_version(old_version, part)
    plugin_data["version"] = new_version

    with open(plugin_json_path, "w") as f:
        json.dump(plugin_data, f, indent=2)

    print(f"✅ Updated plugin.json: {old_version} → {new_version}")

    # Update marketplace.json
    marketplace_json_path = marketplace_root / ".claude-plugin" / "marketplace.json"

    if not marketplace_json_path.exists():
        print(f"❌ Marketplace manifest not found: {marketplace_json_path}")
        sys.exit(1)

    with open(marketplace_json_path, "r") as f:
        marketplace_data = json.load(f)

    plugin_found = False
    for plugin in marketplace_data.get("plugins", []):
        if plugin.get("name") == plugin_name:
            plugin["version"] = new_version
            plugin_found = True
            break

    if not plugin_found:
        print(f"❌ Plugin '{plugin_name}' not found in marketplace manifest")
        sys.exit(1)

    with open(marketplace_json_path, "w") as f:
        json.dump(marketplace_data, f, indent=2)

    print(f"✅ Updated marketplace.json: {old_version} → {new_version}")
    print(f"\n🎉 Version bumped successfully: {old_version} → {new_version}")


def main():
    parser = argparse.ArgumentParser(description="Bump plugin version")
    parser.add_argument("plugin_name", help="Plugin name")
    parser.add_argument("part", choices=["major", "minor", "patch"], help="Version part to bump")
    parser.add_argument("--marketplace-root", default=".", help="Path to marketplace root directory")

    args = parser.parse_args()

    marketplace_root = Path(args.marketplace_root).resolve()

    update_plugin_version(
        plugin_name=args.plugin_name,
        marketplace_root=marketplace_root,
        part=args.part
    )


if __name__ == "__main__":
    main()
