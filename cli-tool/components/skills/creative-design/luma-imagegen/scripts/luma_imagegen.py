#!/usr/bin/env python3
"""
Luma AI Image Generation CLI
Generates images via the Luma Dream Machine API (Photon model).

Usage:
    python3 luma_imagegen.py --prompt "a misty mountain lake at sunrise" --aspect-ratio 16:9
    python3 luma_imagegen.py --check-key
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import Optional


API_BASE = "https://api.lumalabs.ai/dream-machine/v1"
IMAGE_ENDPOINT = f"{API_BASE}/generations/image"
STATUS_ENDPOINT = f"{API_BASE}/generations/{{generation_id}}"

VALID_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "9:21", "21:9"]
VALID_MODELS = ["photon-1", "photon-flash-1"]


def get_api_key() -> str:
    """Read LUMA_API_KEY from environment or .env file."""
    key = os.environ.get("LUMA_API_KEY")
    if key:
        return key

    # Try .env file in current directory
    env_path = Path(".env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("LUMA_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
                if key:
                    return key

    return ""


def check_key() -> None:
    """Verify LUMA_API_KEY is available and exit."""
    key = get_api_key()
    if key:
        print("✅ LUMA_API_KEY is set.")
        sys.exit(0)
    else:
        print("❌ LUMA_API_KEY is not set.")
        print()
        print("To fix this:")
        print("  1. Get your API key at: https://lumalabs.ai/dream-machine/api/keys")
        print("  2. Add it to your .env file:")
        print("       LUMA_API_KEY=your_key_here")
        print("  3. Or export it in your shell:")
        print("       export LUMA_API_KEY=your_key_here")
        sys.exit(1)


def api_request(method: str, url: str, api_key: str, body: Optional[dict] = None) -> dict:
    """Make an authenticated API request to Luma."""
    data = json.dumps(body).encode() if body else None
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        try:
            error_data = json.loads(error_body)
            message = error_data.get("detail") or error_data.get("message") or error_body
        except json.JSONDecodeError:
            message = error_body
        print(f"❌ API error {e.code}: {message}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"❌ Network error: {e.reason}", file=sys.stderr)
        sys.exit(1)


def start_generation(api_key: str, args: argparse.Namespace) -> str:
    """Submit image generation request and return generation ID."""
    payload: dict = {
        "prompt": args.prompt,
        "aspect_ratio": args.aspect_ratio,
        "model": args.model,
    }

    if args.image_ref:
        payload["image_ref"] = [{"url": args.image_ref, "weight": args.image_ref_weight}]

    if args.modify_ref:
        payload["modify_image_ref"] = {"url": args.modify_ref, "weight": args.modify_ref_weight}

    print(f"🎨 Submitting generation request...")
    print(f"   Model: {args.model}")
    print(f"   Aspect ratio: {args.aspect_ratio}")
    print(f"   Prompt: {args.prompt[:80]}{'...' if len(args.prompt) > 80 else ''}")

    result = api_request("POST", IMAGE_ENDPOINT, api_key, payload)
    generation_id = result.get("id")
    if not generation_id:
        print(f"❌ Unexpected response: {result}", file=sys.stderr)
        sys.exit(1)

    print(f"   Generation ID: {generation_id}")
    return generation_id


def poll_until_complete(api_key: str, generation_id: str, poll_interval: int) -> dict:
    """Poll the API until generation is complete or failed."""
    url = STATUS_ENDPOINT.format(generation_id=generation_id)
    dots = 0

    print(f"⏳ Waiting for generation to complete", end="", flush=True)
    while True:
        time.sleep(poll_interval)
        result = api_request("GET", url, api_key)
        state = result.get("state")

        print(".", end="", flush=True)
        dots += 1

        if state == "completed":
            print(" ✅")
            return result
        elif state == "failed":
            print(" ❌")
            reason = result.get("failure_reason") or "Unknown error"
            print(f"❌ Generation failed: {reason}", file=sys.stderr)
            sys.exit(1)
        elif state not in ("dreaming", "queued", "pending"):
            print(f"\n⚠️  Unexpected state: {state}", file=sys.stderr)


def download_image(image_url: str, out_dir: Path, args: argparse.Namespace) -> Path:
    """Download the generated image to the output directory."""
    out_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_slug = args.model.replace("-", "")
    ratio_slug = args.aspect_ratio.replace(":", "x")
    filename = f"{model_slug}_{ratio_slug}_{timestamp}.png"
    out_path = out_dir / filename

    print(f"💾 Downloading image to {out_path}...")
    try:
        urllib.request.urlretrieve(image_url, out_path)
    except urllib.error.URLError as e:
        print(f"❌ Download failed: {e.reason}", file=sys.stderr)
        print(f"   Image URL: {image_url}")
        sys.exit(1)

    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate images using the Luma AI Dream Machine API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("--check-key", action="store_true", help="Verify LUMA_API_KEY is set and exit")
    parser.add_argument("--prompt", help="Text description of the image to generate")
    parser.add_argument("--aspect-ratio", default="16:9", choices=VALID_ASPECT_RATIOS, metavar="RATIO",
                        help=f"Aspect ratio (default: 16:9). Options: {', '.join(VALID_ASPECT_RATIOS)}")
    parser.add_argument("--model", default="photon-1", choices=VALID_MODELS,
                        help="Model to use (default: photon-1)")
    parser.add_argument("--image-ref", metavar="URL", help="Public URL of a reference image for style/structure guidance")
    parser.add_argument("--image-ref-weight", type=float, default=0.85, metavar="WEIGHT",
                        help="Weight for reference image (0.0–1.0, default: 0.85)")
    parser.add_argument("--modify-ref", metavar="URL", help="Public URL of a base image to modify")
    parser.add_argument("--modify-ref-weight", type=float, default=0.5, metavar="WEIGHT",
                        help="Weight for modification fidelity (0.0–1.0, default: 0.5)")
    parser.add_argument("--out", default="output/luma/", metavar="DIR", help="Output directory (default: output/luma/)")
    parser.add_argument("--poll-interval", type=int, default=3, metavar="SECONDS",
                        help="Seconds between polling requests (default: 3)")

    args = parser.parse_args()

    if args.check_key:
        check_key()
        return

    if not args.prompt:
        parser.error("--prompt is required")

    # Validate weights
    for weight_name, weight_val in [("--image-ref-weight", args.image_ref_weight),
                                     ("--modify-ref-weight", args.modify_ref_weight)]:
        if not 0.0 <= weight_val <= 1.0:
            parser.error(f"{weight_name} must be between 0.0 and 1.0")

    api_key = get_api_key()
    if not api_key:
        print("❌ LUMA_API_KEY is not set.")
        print()
        print("Run with --check-key for setup instructions.")
        sys.exit(1)

    # Generate
    generation_id = start_generation(api_key, args)
    result = poll_until_complete(api_key, generation_id, args.poll_interval)

    image_url = result.get("assets", {}).get("image")
    if not image_url:
        print(f"❌ No image URL in response: {result}", file=sys.stderr)
        sys.exit(1)

    out_path = download_image(image_url, Path(args.out), args)

    print()
    print("🎉 Done!")
    print(f"   Generation ID : {generation_id}")
    print(f"   Image URL     : {image_url}")
    print(f"   Saved to      : {out_path}")


if __name__ == "__main__":
    main()
