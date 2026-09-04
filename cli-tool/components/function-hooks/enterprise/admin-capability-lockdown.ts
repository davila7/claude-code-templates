/**
 * admin-capability-lockdown — Function Hook (EXPERIMENTAL)
 *
 * An organization-level plugin that (1) withholds nouns from $ so no plugin
 * registered beneath it can reach the network or spawn processes, and
 * (2) allowlists which plugins may register at all.
 *
 * It only works if it is PREPENDED in managed settings: the first plugin in
 * the list returns last from engine.create and sees plugin.register first
 * (design doc §2.3, §4.2, §5).
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. The plugin.register event shape and
 * the exact noun names on $ ("http", "process") are assumptions the author
 * has hinted at in the issue thread, not documented API.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

export function register(on: any, options: Record<string, any> = {}) {
  const withhold: string[] = options.withhold ?? ["http", "process"];
  const allowedPlugins: string[] | undefined = options.allowedPlugins; // undefined = allow all
  const ownName: string = options.pluginName ?? "admin-capability-lockdown";

  // 1. Shape $ itself. Everything below has already added its nouns when we
  //    get the table back from next(e); we return it minus the withheld ones.
  on("engine.create", async ($: Engine, e: any, next: Next) => {
    const below = await next(e);
    const shaped: Record<string, unknown> = {};
    for (const [noun, api] of Object.entries(below)) {
      if (!withhold.includes(noun)) shaped[noun] = api;
    }
    return shaped;
  });

  // 2. Decide which plugins may exist.
  on("plugin.register", ($: Engine, e: any, next: Next) => {
    if (!allowedPlugins || e.name === ownName || allowedPlugins.includes(e.name)) return next(e);
    $.ui.log(`[admin-capability-lockdown] refused plugin "${e.name}" (not in allowlist)`);
    return { deny: `Plugin "${e.name}" is not on the organization allowlist.` };
  });

  // 3. Belt and braces: even with $.http gone, a plugin below could still ask
  //    the Bash tool to curl. Deny obvious network commands from the shell.
  if (options.blockShellNetwork ?? true) {
    on("tool.call", { tool: "Bash" }, ($: Engine, e: any, next: Next) => {
      const command: string = e.command ?? "";
      if (/\b(curl|wget|nc|ncat|ssh|scp|rsync)\b/.test(command)) {
        return { deny: "Outbound network commands are disabled by your organization's admin-capability-lockdown plugin." };
      }
      return next(e);
    });
  }
}
