#!/usr/bin/env python3
"""
Script to generate blog images using Google Gemini 2.5 Flash Image (nano banana)
Generates banners and workflow diagrams for Claude Code component blogs
"""

import os
import base64
from pathlib import Path
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent / '.env')

# Configuration
API_KEY = os.environ.get("GOOGLE_API_KEY")
if not API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables. Check your .env file.")

OUTPUT_DIR = Path(__file__).parent.parent / "docs/blog/assets"
MODEL = "gemini-2.0-flash-exp-image-generation"  # Using Gemini 2.0 Flash Exp with image generation

# Blog definitions with prompts
BLOGS = [
    {
        "id": "frontend-developer-agent",
        "title": "Claude Code Frontend Developer Agent: Complete 2025 Tutorial",
        "banner_prompt": """Create a professional tech banner image with these elements:
        - Dark terminal/coding background with subtle grid pattern
        - Text overlay in bright green monospace font: 'Frontend Developer Agent'
        - Subtitle in smaller text: 'Complete 2025 Tutorial - Claude Code'
        - Include subtle React, Vue, and Next.js logo icons in corners
        - Modern code editor aesthetic with syntax highlighting in background
        - Color scheme: Dark (#1a1a1a) with neon green (#00ff41) accents
        - Professional, clean, minimalist design
        - 1200x630 px banner format""",

        "diagram_prompt": """Create a simple technical flowchart diagram:
        Title: Frontend Agent Workflow
        Flow: User Input → Frontend Agent Analysis → Framework Detection (React/Vue/Next) → Code Generation → Component Creation → Testing → Output
        Style: Clean minimal flowchart with boxes and arrows
        Colors: Terminal theme with green text on dark background
        Professional documentation style"""
    }
]

def create_output_dir():
    """Create output directory if it doesn't exist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"✓ Output directory ready: {OUTPUT_DIR}")


def generate_image_with_gemini(prompt, output_path):
    """Generate image using Gemini with native image generation"""
    try:
        client = genai.Client(api_key=API_KEY)

        print(f"  Generating with {MODEL}...")

        # Use generate_content for Gemini models with image generation
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt
        )

        # The response should contain image data
        if hasattr(response, 'parts') and response.parts:
            for part in response.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    # Save the image
                    with open(output_path, 'wb') as f:
                        f.write(part.inline_data.data)
                    print(f"  ✓ Saved: {output_path}")
                    return True

        print(f"  ✗ No image data in response")
        print(f"  Response: {response}")
        return False

    except Exception as e:
        print(f"  ✗ Error: {str(e)}")
        return False


def test_single_image():
    """Test with a single image first"""
    create_output_dir()

    blog = BLOGS[0]
    print(f"\n🎨 Testing image generation for: {blog['title']}\n")

    # Test banner
    banner_path = os.path.join(OUTPUT_DIR, f"{blog['id']}-cover-test.png")
    print("Testing Banner Generation:")
    success = generate_image_with_gemini(blog["banner_prompt"], banner_path)

    if success:
        print(f"\n✅ Success! Test image saved to: {banner_path}")
    else:
        print(f"\n❌ Failed to generate image. Check API key and model availability.")
        print(f"\nTip: The API key might need Imagen 4 enabled or use a different approach.")


if __name__ == "__main__":
    test_single_image()
