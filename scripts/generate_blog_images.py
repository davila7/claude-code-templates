#!/usr/bin/env python3
"""
Generate blog cover images using Google AI (Imagen API).

Reads blog articles from ../docs/blog/blog-articles.json and generates
cover images for articles that don't have images in ../docs/blog/assets/
"""

import os
import sys
import json
import base64
import requests
from pathlib import Path


def check_google_api_key():
    """Check for Google API key in environment."""
    api_key = os.getenv('GOOGLE_API_KEY')

    if not api_key:
        # Try loading from .env file
        env_file = Path('.env')
        if env_file.exists():
            with open(env_file, 'r') as f:
                for line in f:
                    if line.startswith('GOOGLE_API_KEY='):
                        api_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                        break

    if not api_key:
        print("❌ Error: GOOGLE_API_KEY not found!")
        print("\nPlease set the environment variable:")
        print("export GOOGLE_API_KEY=your-api-key-here")
        print("\nOr create a .env file with:")
        print("GOOGLE_API_KEY=your-api-key-here")
        sys.exit(1)

    return api_key


def generate_blog_image(title, description, output_path, api_key):
    """
    Generate a blog cover image using Google's Imagen API via AI Studio.

    Args:
        title: Article title
        description: Article description
        output_path: Path to save the generated image
        api_key: Google API key
    """
    # Create detailed prompt for blog cover image
    prompt = f"""Create a professional, modern blog cover image for a technical tutorial.

Title: {title}

Description: {description}

Style requirements:
- Clean, modern design with a tech/developer aesthetic
- Use terminal/code theme with dark background
- Include subtle circuit board or code patterns
- Professional color scheme (orange #F97316 as accent, dark gray/black background)
- Bold, readable typography
- Technical but approachable feel
- 16:9 aspect ratio (1200x675px ideal)
- High contrast for readability
- Minimalist composition

Visual elements:
- Terminal window or IDE interface subtle in background
- Abstract tech patterns (lines, nodes, circuits)
- Modern gradient overlays
- Clean geometric shapes

NO text in the image - just visual design elements."""

    print(f"🎨 Generating image for: {title}")
    print(f"📝 Prompt length: {len(prompt)} chars")

    # Google AI Nano Banana (gemini-2.5-flash-image) endpoint
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ]
    }

    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, headers=headers, json=payload)

        if response.status_code != 200:
            print(f"❌ API Error ({response.status_code}): {response.text}")
            return False

        result = response.json()

        # Extract image from Nano Banana response
        if "candidates" in result and len(result["candidates"]) > 0:
            candidate = result["candidates"][0]

            if "content" in candidate and "parts" in candidate["content"]:
                parts = candidate["content"]["parts"]

                # Find the inline data part with the image
                for part in parts:
                    if "inlineData" in part:
                        inline_data = part["inlineData"]

                        # Extract base64 data
                        if "data" in inline_data:
                            image_data = base64.b64decode(inline_data["data"])

                            # Save image
                            with open(output_path, 'wb') as f:
                                f.write(image_data)

                            print(f"✅ Image saved to: {output_path}")
                            return True

                print(f"⚠️ No inline data found in response parts")
                return False
            else:
                print(f"⚠️ Unexpected response structure: {result}")
                return False
        else:
            print(f"❌ No candidates in response: {result}")
            return False

    except Exception as e:
        print(f"❌ Error generating image: {e}")
        return False


def main():
    """Main function to generate blog images."""
    # Get Google API key
    api_key = check_google_api_key()

    # Load blog articles
    blog_json_path = Path(__file__).parent.parent / "docs" / "blog" / "blog-articles.json"

    if not blog_json_path.exists():
        print(f"❌ Error: Blog articles file not found: {blog_json_path}")
        sys.exit(1)

    with open(blog_json_path, 'r') as f:
        data = json.load(f)

    articles = data.get("articles", [])
    assets_dir = blog_json_path.parent / "assets"

    # Create assets directory if it doesn't exist
    assets_dir.mkdir(exist_ok=True)

    print(f"\n📚 Found {len(articles)} articles")
    print(f"📁 Assets directory: {assets_dir}\n")

    # Filter articles that need images generated (hosted on aitmpl.com/blog/assets/)
    articles_needing_images = []
    for article in articles:
        image_url = article.get("image", "")
        if "aitmpl.com/blog/assets/" in image_url and "-cover.png" in image_url:
            # Extract filename from URL
            filename = image_url.split("/")[-1]
            output_path = assets_dir / filename

            if not output_path.exists():
                articles_needing_images.append({
                    "article": article,
                    "filename": filename,
                    "output_path": output_path
                })
            else:
                print(f"⏭️  Skipping {filename} (already exists)")

    if not articles_needing_images:
        print("\n✅ All blog images already exist!")
        return

    print(f"\n🎨 Generating {len(articles_needing_images)} images...\n")

    # Generate images
    success_count = 0
    for item in articles_needing_images:
        article = item["article"]
        filename = item["filename"]
        output_path = item["output_path"]

        print(f"\n{'='*60}")
        print(f"📄 Article: {article['title']}")
        print(f"💾 Output: {filename}")
        print(f"{'='*60}\n")

        success = generate_blog_image(
            title=article["title"],
            description=article["description"],
            output_path=str(output_path),
            api_key=api_key
        )

        if success:
            success_count += 1

        print()  # Extra newline for readability

    print(f"\n{'='*60}")
    print(f"✅ Successfully generated {success_count}/{len(articles_needing_images)} images")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
