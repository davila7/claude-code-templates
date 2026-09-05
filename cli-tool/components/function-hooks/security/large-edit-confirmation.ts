/**
 * large-edit-confirmation — Function Hook (EXPERIMENTAL)
 *
 * Asks the user for confirmation before Claude edits or overwrites a file
 * larger than a configurable number of lines. Placement: "before".
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. $.fs.read and $.permissions.ask are
 * the assumed shape of the "files" and "permissions" primitives named in the
 * architecture doc, not documented calls.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

export function register(on: any, options: Record<string, any> = {}) {
  const threshold: number = options.maxLines ?? 1000;

  on("tool.call", { tool: ["Edit", "Write", "MultiEdit"] }, async ($: Engine, e: any, next: Next) => {
    const filePath: string = e.file_path ?? "";
    if (!filePath) return next(e);

    let lineCount = 0;
    try {
      const current: string = await $.fs.read({ path: filePath });
      lineCount = current.split("\n").length;
    } catch {
      // New file or unreadable: nothing to protect.
      return next(e);
    }

    if (lineCount <= threshold) return next(e);

    const approved: boolean = await $.permissions.ask({
      title: "Large file edit",
      message: `${filePath} has ${lineCount} lines (limit ${threshold}). Allow ${e.tool} to modify it?`,
      options: ["Allow once", "Deny"],
    });

    if (!approved) {
      $.ui.log(`[large-edit-confirmation] user denied ${e.tool} on ${filePath}`);
      return { deny: `The user declined the ${e.tool} on ${filePath} (${lineCount} lines). Propose a smaller, targeted change.` };
    }

    return next(e);
  });
}
