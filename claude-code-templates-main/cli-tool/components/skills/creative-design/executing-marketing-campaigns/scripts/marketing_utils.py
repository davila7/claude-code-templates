#!/usr/bin/env python3
"""
Marketing Campaign Utility Script

Helps with:
- Generating UTM parameters for campaign links
- Validating UTM parameter formats
- Creating campaign tracking URLs
- Exporting campaign tracking configuration

Usage:
    python marketing_utils.py --action generate_utm --campaign "Q3_Product_Launch" --channel "email"
    python marketing_utils.py --action validate_url --url "https://example.com?utm_source=email&utm_campaign=Q3"
    python marketing_utils.py --action batch_generate --file campaigns.csv
"""

import argparse
import csv
import json
import sys
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urlencode, urlparse, parse_qs

def generate_utm_parameters(
    source: str,
    medium: str,
    campaign: str,
    content: Optional[str] = None,
    term: Optional[str] = None
) -> Dict[str, str]:
    """
    Generate UTM parameters following best practices.
    
    Args:
        source: utm_source (e.g., "email", "google", "facebook") - REQUIRED
        medium: utm_medium (e.g., "newsletter", "cpc", "organic") - REQUIRED
        campaign: utm_campaign (e.g., "Q3_product_launch") - REQUIRED
        content: utm_content (e.g., "hero_image", "button_v1") - OPTIONAL
        term: utm_term (for paid search keywords) - OPTIONAL
    
    Returns:
        Dictionary of UTM parameters
    """
    
    # Validate required parameters
    if not all([source, medium, campaign]):
        raise ValueError("source, medium, and campaign are required")
    
    # Validate format (lowercase, underscores, no spaces)
    for param_name, param_value in [("source", source), ("medium", medium), ("campaign", campaign)]:
        if not param_value.replace("_", "").replace("-", "").isalnum():
            raise ValueError(f"{param_name} contains invalid characters. Use only alphanumeric, hyphens, and underscores.")
        if " " in param_value:
            raise ValueError(f"{param_name} cannot contain spaces. Use underscores instead.")
    
    utm_params = {
        "utm_source": source.lower(),
        "utm_medium": medium.lower(),
        "utm_campaign": campaign.lower()
    }
    
    if content:
        utm_params["utm_content"] = content.lower()
    
    if term:
        utm_params["utm_term"] = term.lower()
    
    return utm_params


def build_tracking_url(base_url: str, utm_params: Dict[str, str]) -> str:
    """
    Build a complete tracking URL with UTM parameters.
    
    Args:
        base_url: The destination URL (e.g., "https://example.com/pricing")
        utm_params: Dictionary of UTM parameters
    
    Returns:
        Complete URL with UTM parameters
    """
    
    if not base_url.startswith(("http://", "https://")):
        raise ValueError("URL must start with http:// or https://")
    
    # Parse existing URL parameters
    parsed = urlparse(base_url)
    existing_params = parse_qs(parsed.query)
    
    # Flatten existing params (parse_qs returns lists)
    existing_params_flat = {k: v[0] if isinstance(v, list) and v else v for k, v in existing_params.items()}
    
    # Merge with UTM parameters (UTM takes precedence)
    all_params = {**existing_params_flat, **utm_params}
    
    # Rebuild URL
    query_string = urlencode(all_params)
    
    if parsed.query:
        # URL already has parameters
        base_url_without_query = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        return f"{base_url_without_query}?{query_string}"
    else:
        return f"{base_url}?{query_string}"


def validate_tracking_url(url: str) -> Dict:
    """
    Validate that a tracking URL has proper UTM parameters.
    
    Args:
        url: URL to validate
    
    Returns:
        Dictionary with validation results
    """
    
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    
    # Check for required UTM parameters
    required_params = ["utm_source", "utm_medium", "utm_campaign"]
    missing_params = [p for p in required_params if p not in params]
    
    result = {
        "url": url,
        "valid": len(missing_params) == 0,
        "missing_parameters": missing_params,
        "utm_parameters": {k: v[0] if v else None for k, v in params.items() if k.startswith("utm_")},
        "other_parameters": {k: v[0] if v else None for k, v in params.items() if not k.startswith("utm_")}
    }
    
    if result["valid"]:
        result["status"] = "✓ Valid tracking URL"
    else:
        result["status"] = f"✗ Missing parameters: {', '.join(missing_params)}"
    
    return result


def generate_campaign_tracking_sheet(
    campaigns: List[Dict[str, str]],
    base_url: str,
    output_file: Optional[str] = None
) -> List[Dict]:
    """
    Generate tracking URLs for multiple campaigns.
    
    Args:
        campaigns: List of campaign dicts with keys: name, channel, content_type
        base_url: Base destination URL
        output_file: Optional CSV file to save results
    
    Returns:
        List of campaign tracking configurations
    """
    
    tracking_config = []
    
    for campaign in campaigns:
        try:
            utm_params = generate_utm_parameters(
                source=campaign.get("channel", "unknown"),
                medium=campaign.get("content_type", "content"),
                campaign=campaign.get("name", "campaign"),
                content=campaign.get("variant", None)
            )
            
            tracking_url = build_tracking_url(base_url, utm_params)
            
            tracking_config.append({
                "campaign_name": campaign.get("name"),
                "channel": campaign.get("channel"),
                "content_type": campaign.get("content_type"),
                "variant": campaign.get("variant", ""),
                "utm_source": utm_params["utm_source"],
                "utm_medium": utm_params["utm_medium"],
                "utm_campaign": utm_params["utm_campaign"],
                "tracking_url": tracking_url,
                "generated_date": datetime.now().isoformat()
            })
            
        except Exception as e:
            print(f"Error processing campaign {campaign.get('name')}: {str(e)}", file=sys.stderr)
    
    # Save to CSV if requested
    if output_file and tracking_config:
        try:
            with open(output_file, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=tracking_config[0].keys())
                writer.writeheader()
                writer.writerows(tracking_config)
            print(f"✓ Campaign tracking sheet saved to {output_file}")
        except Exception as e:
            print(f"Error saving to file: {str(e)}", file=sys.stderr)
    
    return tracking_config


def campaign_summary(tracking_config: List[Dict]) -> None:
    """Print a summary of generated campaigns."""
    
    if not tracking_config:
        print("No campaigns to summarize")
        return
    
    print("\n" + "="*80)
    print("CAMPAIGN TRACKING SUMMARY")
    print("="*80 + "\n")
    
    # Group by channel
    by_channel = {}
    for config in tracking_config:
        channel = config["channel"]
        if channel not in by_channel:
            by_channel[channel] = []
        by_channel[channel].append(config)
    
    for channel, configs in sorted(by_channel.items()):
        print(f"\n📊 {channel.upper()} ({len(configs)} campaigns)")
        print("-" * 80)
        for config in configs:
            print(f"  Campaign: {config['campaign_name']}")
            print(f"    URL: {config['tracking_url']}")
            if config.get('variant'):
                print(f"    Variant: {config['variant']}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Marketing Campaign Utility - Generate and validate tracking URLs"
    )
    
    subparsers = parser.add_subparsers(dest="action", help="Action to perform")
    
    # Generate UTM parameters
    utm_parser = subparsers.add_parser("generate_utm", help="Generate UTM parameters")
    utm_parser.add_argument("--source", required=True, help="utm_source (e.g., email, google, facebook)")
    utm_parser.add_argument("--medium", required=True, help="utm_medium (e.g., newsletter, cpc, organic)")
    utm_parser.add_argument("--campaign", required=True, help="utm_campaign (e.g., Q3_launch)")
    utm_parser.add_argument("--content", help="utm_content (optional, e.g., hero_image)")
    utm_parser.add_argument("--term", help="utm_term (optional, for paid search)")
    
    # Build tracking URL
    url_parser = subparsers.add_parser("build_url", help="Build complete tracking URL")
    url_parser.add_argument("--url", required=True, help="Base URL destination")
    url_parser.add_argument("--source", required=True, help="utm_source")
    url_parser.add_argument("--medium", required=True, help="utm_medium")
    url_parser.add_argument("--campaign", required=True, help="utm_campaign")
    url_parser.add_argument("--content", help="utm_content (optional)")
    
    # Validate tracking URL
    validate_parser = subparsers.add_parser("validate", help="Validate tracking URL")
    validate_parser.add_argument("--url", required=True, help="URL to validate")
    
    # Batch process from CSV
    batch_parser = subparsers.add_parser("batch", help="Process batch of campaigns from CSV")
    batch_parser.add_argument("--file", required=True, help="CSV file with campaigns")
    batch_parser.add_argument("--url", required=True, help="Base URL for all campaigns")
    batch_parser.add_argument("--output", help="Output CSV file")
    
    args = parser.parse_args()
    
    if args.action == "generate_utm":
        try:
            params = generate_utm_parameters(
                source=args.source,
                medium=args.medium,
                campaign=args.campaign,
                content=args.content,
                term=args.term
            )
            print("\n✓ UTM Parameters Generated:")
            print(json.dumps(params, indent=2))
            print("\nQuery string:")
            print(urlencode(params))
        except Exception as e:
            print(f"✗ Error: {str(e)}", file=sys.stderr)
            sys.exit(1)
    
    elif args.action == "build_url":
        try:
            params = generate_utm_parameters(
                source=args.source,
                medium=args.medium,
                campaign=args.campaign,
                content=args.content
            )
            tracking_url = build_tracking_url(args.url, params)
            print("\n✓ Tracking URL Generated:")
            print(tracking_url)
        except Exception as e:
            print(f"✗ Error: {str(e)}", file=sys.stderr)
            sys.exit(1)
    
    elif args.action == "validate":
        result = validate_tracking_url(args.url)
        print("\n" + result["status"])
        print(json.dumps({k: v for k, v in result.items() if k != "status"}, indent=2))
    
    elif args.action == "batch":
        try:
            campaigns = []
            with open(args.file, 'r') as f:
                reader = csv.DictReader(f)
                campaigns = list(reader)
            
            if not campaigns:
                print(f"✗ No campaigns found in {args.file}", file=sys.stderr)
                sys.exit(1)
            
            tracking_config = generate_campaign_tracking_sheet(
                campaigns,
                args.url,
                args.output
            )
            
            campaign_summary(tracking_config)
            
        except FileNotFoundError:
            print(f"✗ File not found: {args.file}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"✗ Error: {str(e)}", file=sys.stderr)
            sys.exit(1)
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
