#!/usr/bin/env python3
"""AWS アイコン検索スクリプト

references/aws-icons.md からサービス名でアイコン情報を検索する。
トークン効率を向上させるため、必要な情報のみを抽出する。

Usage:
    python find_aws_icon.py <service_name>
    python find_aws_icon.py ec2
    python find_aws_icon.py lambda
    python find_aws_icon.py s3
"""

import re
import sys
from pathlib import Path


def load_icon_data() -> dict[str, str]:
    """aws-icons.md からアイコンデータを読み込む"""
    icons = {}
    script_dir = Path(__file__).parent
    aws_icons_path = script_dir.parent / "references" / "aws-icons.md"

    if not aws_icons_path.exists():
        return icons

    content = aws_icons_path.read_text(encoding="utf-8")

    # テーブル行からサービス名と resIcon を抽出
    # | Amazon EC2 | mxgraph.aws4.ec2 |
    pattern = r"\|\s*([^|]+?)\s*\|\s*(mxgraph\.aws4\.[a-z0-9_]+)\s*\|"
    for match in re.finditer(pattern, content):
        service_name = match.group(1).strip()
        res_icon = match.group(2).strip()
        icons[service_name.lower()] = {
            "name": service_name,
            "resIcon": res_icon,
        }

    return icons


def search_icon(query: str) -> list[dict]:
    """クエリに一致するアイコンを検索"""
    icons = load_icon_data()
    query_lower = query.lower()
    results = []

    for key, data in icons.items():
        if query_lower in key or query_lower in data["resIcon"]:
            results.append(data)

    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python find_aws_icon.py <service_name>")
        print("Example: python find_aws_icon.py ec2")
        sys.exit(1)

    query = sys.argv[1]
    results = search_icon(query)

    if not results:
        print(f"No icons found for: {query}")
        sys.exit(1)

    print(f"Found {len(results)} icon(s) for '{query}':\n")
    for result in results:
        print(f"Service: {result['name']}")
        print(f"resIcon: {result['resIcon']}")
        print(f"Style: shape=mxgraph.aws4.resourceIcon;resIcon={result['resIcon']};")
        print()


if __name__ == "__main__":
    main()
