/**
 * block-destructive-commands — Function Hook (EXPERIMENTAL)
 *
 * Denies Bash commands that match destructive patterns before they run.
 * Placement: "instead" (returns { deny } without calling next) on a match,
 * pass-through otherwise.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

// Provisional typings. Claude Code will ship real ones with the feature.
type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

interface Rule { pattern: RegExp; reason: string }

const DEFAULT_RULES: Rule[] = [
  // rm with a recursive flag anywhere in its arguments (-r, -rf, -r -f, --recursive, -fR ...)
  // and a root/home/cwd target, optionally quoted or with a trailing slash ("~/", "$HOME/", "/").
  { pattern: /\brm\s+(?=(?:\S+\s+)*?(?:-[a-z]*r[a-z]*|--recursive)\b)(?:\S+\s+)*?["']?(?:\/|~|\$HOME|\$\{HOME\}|\.\.?)\/?["']?(?:\s|$|;|&|\|)/i, reason: "recursive delete of a root, home or working directory" },
  { pattern: /\brm\s+.*--no-preserve-root\b/i, reason: "rm with --no-preserve-root" },
  { pattern: /\bgit\s+push\b(?!.*--force-with-lease).*(--force\b|\s-f\b)/, reason: "force push" },
  { pattern: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/, reason: "history or working-tree destruction" },
  { pattern: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, reason: "destructive SQL" },
  { pattern: /\bmkfs(\.|\s)/, reason: "filesystem format" },
  { pattern: /\bdd\s+.*\bof=\/dev\//, reason: "raw disk write" },
  { pattern: /\bchmod\s+(-R\s+)?777\b/, reason: "world-writable permissions" },
];

export function register(on: any, options: Record<string, any> = {}) {
  // Extra patterns come from the plugin's userConfig, e.g. { "patterns": ["\\bkubectl\\s+delete\\b"] }
  const custom: Rule[] = (options.patterns ?? []).map((p: string) => ({
    pattern: new RegExp(p),
    reason: `custom pattern ${p}`,
  }));
  const rules = [...DEFAULT_RULES, ...custom];

  on("tool.call", { tool: "Bash" }, ($: Engine, e: any, next: Next) => {
    const command: string = e.command ?? "";

    for (const { pattern, reason } of rules) {
      if (pattern.test(command)) {
        $.ui.log(`[block-destructive-commands] denied Bash call: ${reason}`);
        return {
          deny: `Blocked by block-destructive-commands (${reason}). ` +
            `If this is intentional, ask the user to run it manually.`,
        };
      }
    }

    // Nothing matched: let the rest of the chain (and the real tool) run.
    return next(e);
  });
}
