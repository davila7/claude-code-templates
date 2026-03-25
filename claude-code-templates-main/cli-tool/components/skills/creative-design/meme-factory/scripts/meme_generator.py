#!/usr/bin/env python3
"""Meme Generator Helper.

A Python interface for the memegen.link API to generate memes programmatically.

Usage:
    python meme_generator.py generate buzz "memes" "memes everywhere"
    python meme_generator.py list-templates
    python meme_generator.py suggest "deployment success"

Or import as a module:
    from meme_generator import MemeGenerator
    meme = MemeGenerator()
    url = meme.generate("buzz", "hello", "world")
"""

import argparse
import urllib.parse


class MemeGenerator:
    """Generate memes using the memegen.link API."""

    BASE_URL = "https://api.memegen.link"

    # Popular templates with their use cases
    TEMPLATES = {
        "buzz": "X, X everywhere (Buzz Lightyear)",
        "drake": "Comparing two options (Drake Hotline Bling)",
        "success": "Celebrating wins (Success Kid)",
        "fine": "Things going wrong (This is Fine Dog)",
        "fry": "Uncertainty (Futurama Fry)",
        "changemind": "Controversial opinions (Change My Mind)",
        "distracted": "Priorities/distractions (Distracted Boyfriend)",
        "yodawg": "Yo dawg, I heard you like X (Xzibit)",
        "interesting": "I don't always X (Most Interesting Man)",
        "mordor": "One does not simply X (Boromir)",
        "yuno": "Y U NO (Y U NO Guy)",
        "doge": "Much X, very Y (Doge)",
        "wonka": "Condescending statements (Wonka)",
        "ancient": "Aliens/conspiracy (Ancient Aliens Guy)",
        "skeptical": "Skeptical reactions (Third World Skeptical Kid)",
        "awesome": "Good/bad situations (Awesome/Awkward Penguin)",
        "rollsafe": "Can't X if Y (Roll Safe)",
        "surprised": "Surprised reactions (Surprised Pikachu)",
        "thinking": "Thinking/pondering (Thinking Guy)",
        "boardroom": "Bad suggestions (Boardroom Meeting)",
    }

    # Context-based template suggestions
    CONTEXT_MAP = {
        "success": ["success", "awesome"],
        "failure": ["fine", "yuno"],
        "comparison": ["drake", "awesome", "distracted"],
        "uncertainty": ["fry", "suspicious"],
        "statement": ["buzz", "yodawg", "interesting", "mordor", "changemind"],
        "reaction": ["success", "fine", "surprised", "thinking"],
        "humor": ["doge", "wonka", "ancient", "rollsafe"],
        "deployment": ["success", "fine", "interesting"],
        "testing": ["success", "fry", "interesting"],
        "debugging": ["fine", "fry", "buzz"],
        "documentation": ["yodawg", "buzz", "wonka"],
    }

    def __init__(self) -> None:
        """Initialize the meme generator."""

    def _format_text(self, text: str) -> str:
        """Format text for URL inclusion following memegen rules."""
        replacements = {
            " ": "_",
            "-": "--",
            "_": "__",
            "?": "~q",
            "%": "~p",
            "#": "~h",
            "/": "~s",
            '"': "''",
        }

        escaped = "".join(replacements.get(char, char) for char in text)

        # Percent-encode any remaining reserved characters while preserving
        # memegen's escape sequences and allowed characters.
        return urllib.parse.quote(escaped, safe="-_~")

    def generate(  # noqa: PLR0913
        self,
        template: str,
        top_text: str = "",
        bottom_text: str = "",
        extension: str = "png",
        width: int | None = None,
        height: int | None = None,
        layout: str | None = None,
        style: str | None = None,
        font: str | None = None,
    ) -> str:
        """Generate a meme URL.

        Args:
            template: Template name (e.g., 'buzz', 'drake')
            top_text: Text for the top of the meme
            bottom_text: Text for the bottom of the meme
            extension: Image format ('png', 'jpg', 'webp', 'gif')
            width: Optional width in pixels
            height: Optional height in pixels
            layout: Optional layout ('top', 'bottom', 'default')
            style: Optional style or custom background URL
            font: Optional font name

        Returns:
            URL to the generated meme

        """
        # Format text
        top = self._format_text(top_text) if top_text else "_"
        bottom = self._format_text(bottom_text) if bottom_text else "_"

        # Build base URL
        url = f"{self.BASE_URL}/images/{template}/{top}/{bottom}.{extension}"

        # Add query parameters
        params = {}
        if width:
            params["width"] = str(width)
        if height:
            params["height"] = str(height)
        if layout:
            params["layout"] = layout
        if style:
            params["style"] = style
        if font:
            params["font"] = font

        if params:
            query_string = urllib.parse.urlencode(params)
            url = f"{url}?{query_string}"

        return url

    def suggest_template_for_context(self, context: str) -> str:
        """Suggest a template based on context.

        Args:
            context: Description of the situation (e.g., 'deployment success')

        Returns:
            Suggested template name

        """
        context_lower = context.lower()

        # Check for keyword matches
        for key, templates in self.CONTEXT_MAP.items():
            if key in context_lower:
                return templates[0]

        # Default fallback
        return "buzz"

    def list_templates(self) -> dict[str, str]:
        """List all available templates with descriptions.

        Returns:
            Dictionary of template names and descriptions

        """
        return self.TEMPLATES

    def get_markdown_image(self, url: str, alt_text: str = "Meme", width: int | None = None) -> str:
        """Generate markdown for embedding the meme image.

        Args:
            url: The meme URL
            alt_text: Alternative text for the image
            width: Optional width specification

        Returns:
            Markdown image syntax

        """
        if width:
            return f'<img src="{url}" alt="{alt_text}" width="{width}"/>'
        return f"![{alt_text}]({url})"


def main() -> None:
    """CLI interface for the meme generator."""
    parser = argparse.ArgumentParser(description="Generate memes using memegen.link")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Generate command
    generate_parser = subparsers.add_parser("generate", help="Generate a meme")
    generate_parser.add_argument("template", help="Template name (e.g., buzz, drake)")
    generate_parser.add_argument("top", help="Top text")
    generate_parser.add_argument("bottom", nargs="?", default="", help="Bottom text")
    generate_parser.add_argument(
        "--extension", "-e", default="png", help="Image format (png, jpg, webp, gif)"
    )
    generate_parser.add_argument("--width", "-w", type=int, help="Image width")
    generate_parser.add_argument("--height", type=int, help="Image height")
    generate_parser.add_argument("--layout", "-l", help="Layout (top, bottom, default)")
    generate_parser.add_argument("--markdown", "-m", action="store_true", help="Output as markdown")

    # List templates command
    subparsers.add_parser("list-templates", help="List all available templates")

    # Suggest template command
    suggest_parser = subparsers.add_parser("suggest", help="Suggest template for context")
    suggest_parser.add_argument("context", help="Context description")

    args = parser.parse_args()
    generator = MemeGenerator()

    if args.command == "generate":
        generator.generate(
            template=args.template,
            top_text=args.top,
            bottom_text=args.bottom,
            extension=args.extension,
            width=args.width,
            height=getattr(args, "height", None),
            layout=args.layout,
        )
        if args.markdown:
            pass
        else:
            pass

    elif args.command == "list-templates":
        templates = generator.list_templates()
        for _name, _description in sorted(templates.items()):
            pass

    elif args.command == "suggest":
        generator.suggest_template_for_context(args.context)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
