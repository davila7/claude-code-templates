/**
 * npm-to-pnpm-rewriter — Function Hook (EXPERIMENTAL)
 *
 * Rewrites npm / npx invocations to the package manager your project uses
 * (pnpm by default, yarn or bun via options). Placement: "modifying" —
 * the hook forwards a copy of the event with a changed command.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

type Manager = "pnpm" | "yarn" | "bun";

// [regex on the npm form, replacement per manager]. $1 keeps the command separator.
const REWRITES: Array<[RegExp, Record<Manager, string>]> = [
  [/(^|&&\s*|;\s*|\|\s*)npm\s+ci\b/g, { pnpm: "$1pnpm install --frozen-lockfile", yarn: "$1yarn install --immutable", bun: "$1bun install --frozen-lockfile" }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+(install|i|add)\b/g, { pnpm: "$1pnpm add", yarn: "$1yarn add", bun: "$1bun add" }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+(uninstall|remove|rm)\b/g, { pnpm: "$1pnpm remove", yarn: "$1yarn remove", bun: "$1bun remove" }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+run\b/g, { pnpm: "$1pnpm run", yarn: "$1yarn run", bun: "$1bun run" }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+(test|start|build)\b/g, { pnpm: "$1pnpm $2", yarn: "$1yarn $2", bun: "$1bun run $2" }],
  [/(^|&&\s*|;\s*|\|\s*)npx\s+/g, { pnpm: "$1pnpm dlx ", yarn: "$1yarn dlx ", bun: "$1bunx " }],
];

// "<manager> add" with no package means "install everything": keep the bare install form.
function fixBareAdd(command: string, manager: Manager): string {
  return command.replace(new RegExp(`${manager} add(\\s*(&&|;|\\||$))`, "g"), `${manager} install$1`);
}

export function register(on: any, options: Record<string, any> = {}) {
  const manager: Manager = options.manager ?? "pnpm";

  on("tool.call", { tool: "Bash" }, ($: Engine, e: any, next: Next) => {
    const original: string = e.command ?? "";
    if (!/\bnp[mx]\b/.test(original)) return next(e);

    let rewritten = original;
    for (const [re, byManager] of REWRITES) rewritten = rewritten.replace(re, byManager[manager]);
    rewritten = fixBareAdd(rewritten, manager);

    if (rewritten === original) return next(e);

    $.ui.log(`[npm-to-pnpm-rewriter] ${original}  ->  ${rewritten}`);
    // Events are immutable: forward a modified copy instead of mutating e.
    return next({ ...e, command: rewritten });
  });
}
