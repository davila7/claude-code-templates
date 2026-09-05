/**
 * protected-paths-guard — Function Hook (EXPERIMENTAL)
 *
 * Denies Edit / Write / MultiEdit / NotebookEdit calls that target sensitive
 * files (.env, lockfiles, CI workflows, git internals, private keys) unless
 * the path is allowlisted. Placement: "instead" on match, pass-through otherwise.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

// Minimal glob support: "**" = any depth, "*" = any chars except "/".
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "(?:.*/)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`(^|/)${escaped}$`);
}

const DEFAULT_PROTECTED = [
  ".env",
  ".env.*",
  "**/.git/**",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  "poetry.lock",
  ".github/workflows/*.yml",
  ".github/workflows/*.yaml",
  "**/*.pem",
  "**/*.key",
  "**/id_rsa*",
];

export function register(on: any, options: Record<string, any> = {}) {
  const protectedGlobs: string[] = [...DEFAULT_PROTECTED, ...(options.protect ?? [])];
  const allowGlobs: string[] = options.allow ?? [];
  const protectedRes = protectedGlobs.map(globToRegExp);
  const allowRes = allowGlobs.map(globToRegExp);

  // An array in a matcher matches when any element matches (design doc §6.1).
  on("tool.call", { tool: ["Edit", "Write", "MultiEdit", "NotebookEdit"] }, ($: Engine, e: any, next: Next) => {
    const filePath: string = (e.file_path ?? e.notebook_path ?? "").replace(/\\/g, "/");
    if (!filePath) return next(e);

    if (allowRes.some((re) => re.test(filePath))) return next(e);

    const hit = protectedRes.findIndex((re) => re.test(filePath));
    if (hit !== -1) {
      $.ui.log(`[protected-paths-guard] denied ${e.tool} on ${filePath} (rule: ${protectedGlobs[hit]})`);
      return {
        deny: `${filePath} is protected by protected-paths-guard (rule "${protectedGlobs[hit]}"). ` +
          `Ask the user to edit it manually or add the path to the plugin's "allow" option.`,
      };
    }

    return next(e);
  });
}
