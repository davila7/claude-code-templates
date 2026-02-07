# Figma MCP tools and prompt patterns

Quick reference for the Figma MCP toolset, when to use each tool, and prompt examples to steer output toward your stack.

## Core tools
- `get_design_context` (Figma Design, Figma Make): Primary tool. Returns structured design data and default React + Tailwind code. Selection-based prompting works on desktop; the remote server uses a frame/layer link to extract the node ID.
- `get_variable_defs` (Figma Design): Lists variables/styles (colors, spacing, typography) used in the selection. Useful to align with tokens.
- `get_metadata` (Figma Design): Sparse XML outline of layer IDs/names/types/positions/sizes. Use before re-calling `get_design_context` on large nodes to avoid truncation.
- `get_screenshot` (Figma Design, FigJam): Screenshot of the selection for visual fidelity checks.
- `get_figjam` (FigJam): XML + screenshots for FigJam diagrams (architecture, flows).
- `create_design_system_rules` (no file context): Generates a rule file with design-to-code guidance for your stack. Save it where the agent can read it.
- `get_code_connect_map` (Figma Design): Returns mapping of Figma node IDs to code components (`codeConnectSrc`, `codeConnectName`). Use to reuse existing components.
- `add_code_connect_map` (Figma Design): Adds/updates a mapping between a Figma node and a code component to improve reuse.
- `get_strategy_for_mapping` (alpha, local only): Figma-prompted tool to decide mapping strategy for connecting a node to a code component.
- `send_get_strategy_response` (alpha, local only): Sends the response after `get_strategy_for_mapping`.
- `whoami` (remote only): Returns the authenticated Figma user identity (email, plans, seat types).

## Prompt patterns (design context)
- Change framework: “generate my Figma selection in Vue” or “in plain HTML + CSS” or “for iOS”.
- Use my components: “generate my Figma selection using components from `src/components/ui`”.
- Combine: “generate my Figma selection using components from `src/ui` and style with Tailwind”.
- Note: On the remote server, selection-based prompting requires a frame/layer link; the server extracts the node ID from the URL.

## Prompt patterns (variables/styles)
- “get the variables used in my Figma selection”
- “what color and spacing variables are used in my Figma selection?”
- “list the variable names and their values used in my Figma selection”

## Prompt patterns (code connect)
- “show the code connect map for this selection”
- “map this node to `src/components/ui/Button.tsx` with name `Button`”

## Best-practice flow reminder
Use `get_design_context` → (optionally `get_metadata` for large nodes) → `get_screenshot`, and keep project rules from `SKILL.md` in mind when applying the generated output.
