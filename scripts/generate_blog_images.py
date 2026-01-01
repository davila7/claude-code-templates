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


def generate_blog_image(title, description, component_type, component_name, install_command, output_path, api_key):
    """
    Generate a blog cover image using Google's Imagen API via AI Studio.

    Args:
        title: Article title
        description: Article description
        component_type: Type of component (Agent, MCP, Skill, etc.)
        component_name: Name of the component
        install_command: Installation command
        output_path: Path to save the generated image
        api_key: Google API key
    """
    # Split install command into two lines for better readability
    if "--agent" in install_command:
        cmd_parts = install_command.split("--agent ")
        cmd_line1 = cmd_parts[0].strip()
        cmd_line2 = "--agent " + cmd_parts[1]
    elif "--mcp" in install_command:
        cmd_parts = install_command.split("--mcp ")
        cmd_line1 = cmd_parts[0].strip()
        cmd_line2 = "--mcp " + cmd_parts[1]
    elif "--skill" in install_command:
        cmd_parts = install_command.split("--skill ")
        cmd_line1 = cmd_parts[0].strip()
        cmd_line2 = "--skill " + cmd_parts[1]
    else:
        cmd_line1 = install_command
        cmd_line2 = ""

    # Simplify the command display to avoid text rendering issues
    # Show just the essential part
    if cmd_line2:
        simple_cmd = cmd_line2.strip()  # Just show "--agent folder/name" etc
    else:
        simple_cmd = cmd_line1

    # Create detailed prompt similar to supabase-claude-code-templates-cover.png
    prompt = f"""Create a professional blog cover image with this EXACT layout and text:

LEFT SIDE (40% width):
- Black background (#000000)
- Text exactly as "CLAUDE CODE TEMPLATES" in pixelated/retro orange font (#F97316)
- Font style: Bold, blocky, retro gaming aesthetic similar to arcade game fonts
- Stacked vertically with equal spacing between words
- Centered vertically on left side

CENTER:
- Vertical line divider in dark gray (#333333) 2px width
- Full height of image from top to bottom

RIGHT SIDE (60% width):
- Black background (#000000)
- At top: Small badge with text "{component_type}" in solid orange rectangle (#F97316) with rounded corners, black text inside
- Below badge: Large bold white text saying "{component_name}"
- At bottom: Small gray monospace text showing: "{simple_cmd}"

CRITICAL TEXT RENDERING REQUIREMENTS:
- All text must be perfectly readable and not corrupted
- Use clear, legible fonts
- Ensure proper spacing so text doesn't overlap or get cut off
- The installation command at bottom should be clearly visible

Overall specifications:
- Exact dimensions: 1200x675 pixels (16:9 aspect ratio)
- Background: Pure black (#000000)
- Primary accent color: Orange (#F97316)
- Text colors: White (#FFFFFF) for component name, Gray (#999999) for command
- Minimalist, professional design
- No decorative elements, gradients, or patterns - just text and divider
- Clean, modern tech aesthetic similar to terminal/CLI interfaces

The layout divides the image into two sections with a vertical line: left side shows "CLAUDE CODE TEMPLATES" in retro orange font, right side shows component type, name, and install command."""

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

        # Extract component information from article ID
        article_id = article.get("id", "")

        # Determine component type and name based on article category
        category = article.get("category", "")

        if "agent" in article_id.lower() or category == "Agents":
            component_type = "AGENT"
            # Extract agent name from ID (e.g., frontend-developer-agent -> frontend-developer)
            agent_name = article_id.replace("-agent", "")
            component_name = agent_name.replace("-", " ").title()

            # Find actual agent path in components/agents/
            import subprocess
            try:
                result = subprocess.run(
                    ["find", "cli-tool/components/agents", "-name", f"{agent_name}.md", "-type", "f"],
                    capture_output=True,
                    text=True
                )
                agent_path = result.stdout.strip()
                if agent_path:
                    # Extract folder/name from path (e.g., development-team/frontend-developer)
                    parts = agent_path.split("/agents/")[1].replace(".md", "")
                    install_command = f"npx claude-code-templates@latest --agent {parts}"
                else:
                    install_command = f"npx claude-code-templates@latest --agent {agent_name}"
            except:
                install_command = f"npx claude-code-templates@latest --agent {agent_name}"
        elif "mcp" in article_id.lower() or category == "MCP":
            component_type = "MCP"
            component_name = article_id.replace("-mcp", "").replace("-", " ").title()
            install_command = f"npx claude-code-templates@latest --mcp {article_id.replace('-mcp', '')}"
        elif "skill" in article_id.lower() or category == "Skills":
            component_type = "SKILL"
            component_name = article_id.replace("-skill", "").replace("-", " ").title()
            install_command = f"npx claude-code-templates@latest --skill {article_id}"
        elif "sandbox" in article_id.lower() or "e2b" in article_id.lower():
            component_type = "SANDBOX"
            component_name = article_id.replace("-", " ").title()
            install_command = f"npx claude-code-templates@latest --sandbox e2b"
        else:
            component_type = "COMPONENT"
            component_name = article_id.replace("-", " ").title()
            install_command = f"npx claude-code-templates@latest"

        print(f"\n{'='*60}")
        print(f"📄 Article: {article['title']}")
        print(f"🏷️  Type: {component_type}")
        print(f"📦 Component: {component_name}")
        print(f"💻 Command: {install_command}")
        print(f"💾 Output: {filename}")
        print(f"{'='*60}\n")

        success = generate_blog_image(
            title=article["title"],
            description=article["description"],
            component_type=component_type,
            component_name=component_name,
            install_command=install_command,
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
