#!/usr/bin/env python3
"""
Script to generate blog images using Google Imagen API (Nano Banana)
Generates banners and workflow diagrams for Claude Code component blogs
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai.types import GenerateImagesConfig

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent / '.env')

# Configuration
API_KEY = os.environ.get("GOOGLE_API_KEY")
if not API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables. Check your .env file.")

OUTPUT_DIR = Path(__file__).parent.parent / "docs/blog/assets"
MODEL = "gemini-2.5-flash-image"  # Using Gemini 2.5 Flash Image (nano banana)

# Blog definitions with prompts
BLOGS = [
    {
        "id": "frontend-developer-agent",
        "title": "Claude Code Frontend Developer Agent: Complete 2025 Tutorial",
        "banner_prompt": """Modern tech banner image with dark terminal background.
        Text overlay in green monospace font: 'Frontend Developer Agent - Complete 2025 Tutorial - Claude Code'.
        Include subtle React, Vue, and Next.js logos.
        Terminal aesthetic with code snippets in background.
        Professional, clean design. 1200x630px aspect ratio.""",

        "diagram_prompt": """Simple flowchart diagram showing:
        User Input → Frontend Agent → Analysis Phase (React/Vue/Next detection) →
        Code Generation → Component Creation → Testing → Output.
        Clean, minimal design with arrows. Terminal green and black color scheme.
        Professional technical documentation style."""
    },
    {
        "id": "code-reviewer-agent",
        "title": "AI Code Review Automation with Claude Code: 2025 Complete Guide",
        "banner_prompt": """Tech banner with code review theme. Dark background with code diff visualization.
        Text: 'AI Code Review Automation - Claude Code 2025'.
        Include checkmarks, security icons, and code quality symbols.
        Terminal aesthetic. Green accents on dark background. 1200x630px.""",

        "diagram_prompt": """Workflow diagram:
        Code Commit → Code Reviewer Agent → Security Scan + Best Practices Check + Performance Analysis →
        Review Report → Approval/Changes Required.
        Simple flowchart with icons. Green and black terminal colors."""
    },
    {
        "id": "context7-mcp",
        "title": "Context7 MCP for Claude Code: Real-Time Documentation Integration",
        "banner_prompt": """Modern banner showing documentation concept. Dark terminal background.
        Text: 'Context7 MCP - Real-Time Documentation - Claude Code'.
        Include book/docs icons, API symbols, and code snippets.
        Professional tech aesthetic with green highlights. 1200x630px.""",

        "diagram_prompt": """Flow diagram:
        User Query → 'use context7' → MCP Server → Fetch Official Docs →
        Version-Specific Examples → Inject to Prompt → Claude Response.
        Clean arrows and boxes. Terminal color scheme."""
    },
    {
        "id": "skills-creator",
        "title": "Claude Code Skills Tutorial: Create Custom AI Workflows in 2025",
        "banner_prompt": """Banner for skill creation tutorial. Dark background with workflow icons.
        Text: 'Claude Skills Tutorial - Custom AI Workflows - 2025'.
        Include puzzle pieces, automation symbols, and skill badges.
        Terminal green on black. Professional design. 1200x630px.""",

        "diagram_prompt": """Diagram showing:
        Skill Definition (SKILL.md) → Progressive Context Loading → Reference Files →
        Workflow Execution → Multi-Step Automation → Output.
        Simple boxes and arrows. Green/black theme."""
    },
    {
        "id": "ultra-think-command",
        "title": "Ultra-Think Command: Deep Reasoning for Complex Coding Problems",
        "banner_prompt": """Tech banner with brain/thinking theme. Dark background with neural network pattern.
        Text: 'Ultra-Think Command - Deep Reasoning - Claude Code'.
        Include thinking symbols, complex code patterns, lightbulb icons.
        Terminal aesthetic. 1200x630px.""",

        "diagram_prompt": """Flow showing:
        Complex Problem → Ultra-Think Activation → Deep Analysis →
        Multiple Solution Paths → Evaluation → Best Solution.
        Tree-like diagram structure. Green terminal colors."""
    },
    {
        "id": "context-monitor-setting",
        "title": "Context Monitor Setting: Real-Time Claude Code Performance Tracking",
        "banner_prompt": """Monitoring dashboard theme. Dark terminal with metrics visualization.
        Text: 'Context Monitor - Performance Tracking - Claude Code'.
        Include graphs, stats, monitoring icons.
        Green terminal aesthetic. 1200x630px.""",

        "diagram_prompt": """Diagram:
        Claude Session → Context Monitor → Token Usage Tracking + Memory Analysis +
        Performance Metrics → Real-time Dashboard → Alerts.
        Dashboard-style layout with metrics. Green/black."""
    },
    {
        "id": "backend-architect-agent",
        "title": "Backend Architect Agent: Building Scalable Systems with AI",
        "banner_prompt": """Architecture blueprint theme. Dark background with system diagrams.
        Text: 'Backend Architect Agent - Scalable Systems - Claude Code'.
        Include database symbols, API icons, cloud infrastructure elements.
        Professional tech design. 1200x630px.""",

        "diagram_prompt": """Architecture diagram:
        Requirements → Backend Architect → Database Design + API Structure +
        Scalability Planning → Implementation Blueprint → System Architecture.
        Clean technical diagram. Terminal colors."""
    },
    {
        "id": "ui-ux-designer-agent",
        "title": "UI/UX Designer Agent: AI-Powered Design Implementation",
        "banner_prompt": """Design-focused banner. Dark background with UI elements and wireframes.
        Text: 'UI/UX Designer Agent - AI Design - Claude Code 2025'.
        Include design tools icons, color palette, component mockups.
        Modern, clean aesthetic. 1200x630px.""",

        "diagram_prompt": """Flow:
        Design Brief → UI/UX Agent → User Research + Wireframing +
        Component Design → Accessibility Check → Final Design + Code.
        Design-focused flowchart. Green accents."""
    },
    {
        "id": "generate-tests-command",
        "title": "Generate-Tests Command: Automated Test Creation Guide",
        "banner_prompt": """Testing theme banner. Dark background with test checkmarks and code coverage.
        Text: 'Generate-Tests Command - Automated Testing - Claude Code'.
        Include test icons, checkmarks, code snippets with assertions.
        Terminal style. 1200x630px.""",

        "diagram_prompt": """Test generation flow:
        Source Code → Test Generator → Unit Tests + Integration Tests +
        E2E Tests → Coverage Analysis → Test Suite.
        Simple flowchart with test icons. Green/black."""
    },
    {
        "id": "simple-notifications-hook",
        "title": "Simple Notifications Hook: Workflow Automation Setup",
        "banner_prompt": """Notification system banner. Dark terminal with notification bells and alerts.
        Text: 'Simple Notifications Hook - Workflow Automation - Claude Code'.
        Include bell icons, webhook symbols, automation arrows.
        Professional design. 1200x630px.""",

        "diagram_prompt": """Hook workflow:
        Claude Event → Notification Hook → Filter Rules →
        Discord/Slack/Telegram Integration → User Notification.
        Clean flowchart with communication icons. Terminal theme."""
    },
    {
        "id": "prompt-engineer-agent",
        "title": "Prompt Engineer Agent: Mastering AI Prompt Optimization",
        "banner_prompt": """Prompt engineering theme. Dark background with text optimization symbols.
        Text: 'Prompt Engineer Agent - AI Optimization - Claude Code 2025'.
        Include AI brain, text bubbles, optimization arrows.
        Modern tech design. 1200x630px.""",

        "diagram_prompt": """Optimization flow:
        Initial Prompt → Prompt Engineer → Analysis + Optimization +
        Testing → Improved Prompt → Performance Metrics.
        Iterative improvement diagram. Green terminal colors."""
    }
]


def create_output_dir():
    """Create output directory if it doesn't exist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"✓ Output directory ready: {OUTPUT_DIR}")


def generate_image(prompt, output_path, image_type="banner"):
    """Generate a single image using Imagen API"""
    try:
        client = genai.Client(api_key=API_KEY)

        print(f"  Generating {image_type}...")

        result = client.models.generate_images(
            model=MODEL,
            prompt=prompt,
            config=GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9" if image_type == "banner" else "4:3",
                safety_filter_level="block_some"
            )
        )

        if result.generated_images:
            result.generated_images[0].image.save(output_path)
            print(f"  ✓ Saved: {output_path}")
            return True
        else:
            print(f"  ✗ Failed to generate image")
            return False

    except Exception as e:
        print(f"  ✗ Error: {str(e)}")
        return False


def generate_all_images():
    """Generate all blog images"""
    create_output_dir()

    total = len(BLOGS) * 2  # 2 images per blog
    current = 0

    print(f"\n🎨 Generating images for {len(BLOGS)} blogs ({total} total images)\n")

    for blog in BLOGS:
        blog_id = blog["id"]
        print(f"\n📝 Blog: {blog['title']}")

        # Generate banner
        banner_path = os.path.join(OUTPUT_DIR, f"{blog_id}-cover.png")
        current += 1
        print(f"  [{current}/{total}] Banner")
        generate_image(blog["banner_prompt"], banner_path, "banner")

        # Generate diagram
        diagram_path = os.path.join(OUTPUT_DIR, f"{blog_id}-workflow.png")
        current += 1
        print(f"  [{current}/{total}] Workflow Diagram")
        generate_image(blog["diagram_prompt"], diagram_path, "diagram")

    print(f"\n✅ Complete! Generated {total} images in {OUTPUT_DIR}")
    print(f"\nImage URLs for blogs:")
    for blog in BLOGS:
        blog_id = blog["id"]
        print(f"  - Banner: https://www.aitmpl.com/blog/assets/{blog_id}-cover.png")
        print(f"  - Diagram: https://www.aitmpl.com/blog/assets/{blog_id}-workflow.png")


if __name__ == "__main__":
    generate_all_images()
