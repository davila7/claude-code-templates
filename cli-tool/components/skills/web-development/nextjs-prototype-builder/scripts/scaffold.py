#!/usr/bin/env python3
"""
Scaffold a new Next.js prototype from the template.

Usage:
  python3 scaffold.py --name my-project --brand "ACME" --accent cyan --theme dark --target ./my-project
"""

import argparse
import os
import shutil
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "assets", "template")

# Accent color mappings: name -> (tailwind class prefix, rgba values)
ACCENT_COLORS = {
    "cyan": {
        "tw": "cyan",
        "rgb": "34, 211, 238",
        "gradient_from": "from-cyan-400",
        "gradient_via": "via-cyan-500",
        "gradient_to": "to-blue-500",
    },
    "emerald": {
        "tw": "emerald",
        "rgb": "52, 211, 153",
        "gradient_from": "from-emerald-400",
        "gradient_via": "via-emerald-500",
        "gradient_to": "to-teal-500",
    },
    "violet": {
        "tw": "violet",
        "rgb": "167, 139, 250",
        "gradient_from": "from-violet-400",
        "gradient_via": "via-violet-500",
        "gradient_to": "to-purple-500",
    },
    "amber": {
        "tw": "amber",
        "rgb": "251, 191, 36",
        "gradient_from": "from-amber-400",
        "gradient_via": "via-amber-500",
        "gradient_to": "to-orange-500",
    },
    "rose": {
        "tw": "rose",
        "rgb": "251, 113, 133",
        "gradient_from": "from-rose-400",
        "gradient_via": "via-rose-500",
        "gradient_to": "to-pink-500",
    },
    "blue": {
        "tw": "blue",
        "rgb": "96, 165, 250",
        "gradient_from": "from-blue-400",
        "gradient_via": "via-blue-500",
        "gradient_to": "to-indigo-500",
    },
}


# ── Light theme replacement content ──

LIGHT_GLOBALS_CSS = """\
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --sidebar-bg: #f8fafc;
  --bg: #f1f5f9;
  --card: #ffffff;
  --card-hover: #f8fafc;
  --hover: rgba(0, 0, 0, 0.03);
  --input-bg: rgba(0, 0, 0, 0.02);
  --border: rgba(0, 0, 0, 0.08);
  --radius: 10px;
  --glow-cyan: rgba(34, 211, 238, 0.10);
  --glow-violet: rgba(167, 139, 250, 0.10);
}

html { scroll-behavior: smooth; }
body { -webkit-font-smoothing: antialiased; }

::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.10); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.18); }

::selection { background: rgba(34, 211, 238, 0.20); }

a { transition: color 0.15s ease; }

/* ═══ Animations ═══ */
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
  30% { transform: translateY(-4px); opacity: 1; }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(34, 211, 238, 0.06); }
  50% { box-shadow: 0 0 16px rgba(34, 211, 238, 0.12); }
}
@keyframes flow-dot {
  0% { left: 0; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { left: 100%; opacity: 0; }
}
@keyframes countUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes tourIn {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pulseRing {
  0%, 100% { box-shadow: 0 0 8px rgba(34, 211, 238, 0.06), inset 0 0 8px rgba(34, 211, 238, 0.02); }
  50% { box-shadow: 0 0 16px rgba(34, 211, 238, 0.12), inset 0 0 16px rgba(34, 211, 238, 0.04); }
}

.animate-pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
.typing-dot { animation: typing 1.4s ease-in-out infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
.animate-fade-in { animation: fadeIn 0.4s ease-out both; }
.animate-slide-in { animation: slideInRight 0.3s ease-out both; }
.animate-scale-in { animation: scaleIn 0.3s ease-out both; }
.animate-glow { animation: glow-pulse 3s ease-in-out infinite; }
.animate-tour-in { animation: tourIn 0.25s ease-out both; }
.animate-pulse-ring { animation: pulseRing 2s ease-in-out infinite; }
.animate-count { animation: countUp 0.5s ease-out both; }

/* Stagger children animations */
.stagger > * { animation: fadeIn 0.35s ease-out both; }
.stagger > *:nth-child(1) { animation-delay: 0.02s; }
.stagger > *:nth-child(2) { animation-delay: 0.06s; }
.stagger > *:nth-child(3) { animation-delay: 0.10s; }
.stagger > *:nth-child(4) { animation-delay: 0.14s; }
.stagger > *:nth-child(5) { animation-delay: 0.18s; }
.stagger > *:nth-child(6) { animation-delay: 0.22s; }
.stagger > *:nth-child(7) { animation-delay: 0.26s; }
.stagger > *:nth-child(8) { animation-delay: 0.30s; }

/* ═══ Glassmorphism cards (light) ═══ */
.glass {
  background: linear-gradient(168deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 4px 12px -2px rgba(0, 0, 0, 0.03),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.glass-hover:hover {
  background: linear-gradient(168deg, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.92));
  border-color: rgba(0, 0, 0, 0.10);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.06),
    0 8px 20px -4px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

/* ═══ Glow accents (light) ═══ */
.glow-cyan { box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px -4px rgba(34,211,238,0.12), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 1px rgba(34,211,238,0.06); }
.glow-emerald { box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px -4px rgba(52,211,153,0.12), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 1px rgba(52,211,153,0.06); }
.glow-violet { box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px -4px rgba(167,139,250,0.12), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 1px rgba(167,139,250,0.06); }
.glow-amber { box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px -4px rgba(251,191,36,0.10), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 1px rgba(251,191,36,0.05); }

/* ═══ Gradient mesh background (light) ═══ */
.bg-mesh {
  background:
    radial-gradient(ellipse 80% 50% at 20% 40%, rgba(34, 211, 238, 0.04) 0%, transparent 70%),
    radial-gradient(ellipse 60% 40% at 80% 60%, rgba(167, 139, 250, 0.03) 0%, transparent 70%),
    radial-gradient(ellipse 70% 50% at 50% 80%, rgba(52, 211, 153, 0.02) 0%, transparent 70%);
}

/* ═══ Card shine on hover (light) ═══ */
.card-shine {
  position: relative;
  overflow: hidden;
}
.card-shine::before {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  transition: left 0.5s ease;
  pointer-events: none;
}
.card-shine:hover::before { left: 100%; }

/* ═══ Flow connector animation ═══ */
.flow-connector {
  position: relative;
  overflow: hidden;
}
.flow-connector::after {
  content: '';
  position: absolute;
  top: 50%; transform: translateY(-50%);
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--glow-cyan);
  animation: flow-dot 2s linear infinite;
}

/* ═══ KPI value highlight (light — no text-shadow) ═══ */
.kpi-glow {
  text-shadow: none;
}

/* ═══ Smooth bar chart transition ═══ */
.bar-animate {
  transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ═══ Status ring (light) ═══ */
.status-ring-active {
  box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.12), 0 0 8px rgba(34, 211, 238, 0.06);
}
.status-ring-processing {
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.12), 0 0 8px rgba(96, 165, 250, 0.06);
  animation: glow-pulse 2s ease-in-out infinite;
}
"""

LIGHT_TAILWIND_SURFACE = """\
        surface: {
          0: '#ffffff',
          1: '#f9fafb',
          2: '#f3f4f6',
          3: '#e5e7eb',
          4: '#d1d5db',
        },"""

DARK_TAILWIND_SURFACE = """\
        surface: {
          0: '#04060c',
          1: '#07090f',
          2: '#0c1017',
          3: '#141a25',
          4: '#1a2235',
        },"""

LIGHT_BADGE_STYLES = """\
export const badgeStyles: Record<string, string> = {
  info: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/40',
  success: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/40',
  warning: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/40',
  error: 'bg-red-50 text-red-600 ring-1 ring-red-200/40',
  primary: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/40',
  purple: 'bg-violet-50 text-violet-600 ring-1 ring-violet-200/40',
  orange: 'bg-orange-50 text-orange-600 ring-1 ring-orange-200/40',
  muted: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/50',
}"""

DARK_BADGE_STYLES = """\
export const badgeStyles: Record<string, string> = {
  info: 'bg-blue-400/10 text-blue-400',
  success: 'bg-emerald-400/10 text-emerald-400',
  warning: 'bg-amber-400/10 text-amber-400',
  error: 'bg-red-400/10 text-red-400',
  primary: 'bg-cyan-400/10 text-cyan-400',
  purple: 'bg-violet-400/10 text-violet-400',
  orange: 'bg-orange-400/10 text-orange-400',
  muted: 'bg-white/[0.04] text-slate-500',
}"""

LIGHT_DOT_STYLES = """\
export const dotStyles: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  primary: 'bg-blue-500',
  muted: 'bg-slate-400',
}"""

DARK_DOT_STYLES = """\
export const dotStyles: Record<string, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
  primary: 'bg-cyan-400',
  muted: 'bg-slate-500',
}"""


def copy_template(target: str) -> None:
    """Copy the template directory to the target location."""
    if os.path.exists(target):
        print(f"Error: Target directory '{target}' already exists.", file=sys.stderr)
        sys.exit(1)

    shutil.copytree(TEMPLATE_DIR, target)
    print(f"  Copied template to {target}")


def replace_in_file(filepath: str, old: str, new: str) -> int:
    """Replace all occurrences of old with new in a file. Returns count."""
    with open(filepath, "r") as f:
        content = f.read()

    count = content.count(old)
    if count > 0:
        content = content.replace(old, new)
        with open(filepath, "w") as f:
            f.write(content)

    return count


def customize_name(target: str, name: str) -> None:
    """Replace project name tokens."""
    pkg_path = os.path.join(target, "package.json")
    if os.path.exists(pkg_path):
        replace_in_file(pkg_path, '"prototype"', f'"{name}"')
        print(f"  Updated package.json name to '{name}'")


def customize_brand(target: str, brand: str) -> None:
    """Replace brand name tokens."""
    sidebar_path = os.path.join(target, "src", "components", "Sidebar.tsx")
    if os.path.exists(sidebar_path):
        replace_in_file(sidebar_path, "PROTOTYPE", brand.upper())
        print(f"  Updated Sidebar brand to '{brand.upper()}'")

    layout_path = os.path.join(target, "src", "app", "layout.tsx")
    if os.path.exists(layout_path):
        replace_in_file(layout_path, "Prototype", brand)
        replace_in_file(layout_path, "prototype", brand.lower())
        print(f"  Updated layout.tsx metadata")

    tour_path = os.path.join(target, "src", "components", "TourProvider.tsx")
    if os.path.exists(tour_path):
        replace_in_file(tour_path, "prototype-tour", f"{name_to_slug(brand)}-tour")
        print(f"  Updated tour storage key")

    deploy_path = os.path.join(target, "deploy.sh")
    if os.path.exists(deploy_path):
        replace_in_file(deploy_path, "prototype", name_to_slug(brand))
        print(f"  Updated deploy.sh project name")


def name_to_slug(name: str) -> str:
    """Convert a brand name to a URL-safe slug."""
    return name.lower().replace(" ", "-").replace("_", "-")


def customize_theme(target: str, theme: str) -> None:
    """Apply light theme transformations. Dark is the template default — no-op."""
    if theme == "dark":
        print("  Theme is already dark — no changes needed")
        return

    # 1. Replace globals.css entirely
    css_path = os.path.join(target, "src", "app", "globals.css")
    if os.path.exists(css_path):
        with open(css_path, "w") as f:
            f.write(LIGHT_GLOBALS_CSS)
        print("  Replaced globals.css with light theme")

    # 2. Swap tailwind surface palette
    tw_path = os.path.join(target, "tailwind.config.ts")
    if os.path.exists(tw_path):
        replace_in_file(tw_path, DARK_TAILWIND_SURFACE, LIGHT_TAILWIND_SURFACE)
        print("  Updated tailwind.config.ts surface colors")

    # 3. Swap body text color in layout.tsx
    layout_path = os.path.join(target, "src", "app", "layout.tsx")
    if os.path.exists(layout_path):
        replace_in_file(layout_path, "text-slate-200", "text-slate-800")
        print("  Updated layout.tsx body text to dark-on-light")

    # 4. Swap badge and dot styles in utils.ts
    utils_path = os.path.join(target, "src", "lib", "utils.ts")
    if os.path.exists(utils_path):
        replace_in_file(utils_path, DARK_BADGE_STYLES, LIGHT_BADGE_STYLES)
        replace_in_file(utils_path, DARK_DOT_STYLES, LIGHT_DOT_STYLES)
        print("  Updated utils.ts badge/dot styles for light theme")


def customize_accent(target: str, accent: str) -> None:
    """Swap the default cyan accent to a different color."""
    if accent == "cyan":
        print("  Accent is already cyan — no changes needed")
        return

    if accent not in ACCENT_COLORS:
        print(f"  Warning: Unknown accent '{accent}', skipping color swap", file=sys.stderr)
        return

    color = ACCENT_COLORS[accent]
    total = 0

    # Walk all .tsx, .css, .ts files
    for root, _dirs, files in os.walk(os.path.join(target, "src")):
        for fname in files:
            if not fname.endswith((".tsx", ".ts", ".css")):
                continue

            fpath = os.path.join(root, fname)

            # Replace Tailwind class references
            total += replace_in_file(fpath, "cyan-400", f"{color['tw']}-400")
            total += replace_in_file(fpath, "cyan-500", f"{color['tw']}-500")
            total += replace_in_file(fpath, "cyan-300", f"{color['tw']}-300")

    # Replace CSS rgba values in globals.css
    css_path = os.path.join(target, "src", "app", "globals.css")
    if os.path.exists(css_path):
        total += replace_in_file(css_path, "34, 211, 238", color["rgb"])

    print(f"  Swapped accent to {accent} ({total} replacements)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scaffold a new Next.js prototype from the template"
    )
    parser.add_argument("--name", required=True, help="Project name (for package.json)")
    parser.add_argument("--brand", default=None, help="Brand name (for sidebar, defaults to --name)")
    parser.add_argument("--accent", default="cyan", choices=list(ACCENT_COLORS.keys()), help="Primary accent color (default: cyan)")
    parser.add_argument("--theme", default="dark", choices=["dark", "light"], help="Theme variant (default: dark)")
    parser.add_argument("--target", default=None, help="Target directory (defaults to ./<name>)")

    args = parser.parse_args()

    brand = args.brand or args.name
    target = args.target or os.path.join(".", args.name)

    print(f"\nScaffolding '{args.name}' prototype...")
    print(f"  Brand: {brand.upper()}")
    print(f"  Theme: {args.theme}")
    print(f"  Accent: {args.accent}")
    print(f"  Target: {os.path.abspath(target)}\n")

    # Step 1: Copy template
    copy_template(target)

    # Step 2: Customize name
    customize_name(target, args.name)

    # Step 3: Customize brand
    customize_brand(target, brand)

    # Step 4: Apply theme (before accent, so accent swap works on correct CSS)
    customize_theme(target, args.theme)

    # Step 5: Customize accent color
    customize_accent(target, args.accent)

    print(f"\nDone! Next steps:")
    print(f"  cd {target}")
    print(f"  npm install")
    print(f"  npm run dev")
    print(f"\nThen customize:")
    print(f"  - src/data/mock.ts     — Define your domain types and data")
    print(f"  - src/components/Sidebar.tsx — Update navigation items")
    print(f"  - src/app/page.tsx     — Build your dashboard")
    print(f"  - src/components/TourProvider.tsx — Define tour steps")


if __name__ == "__main__":
    main()
