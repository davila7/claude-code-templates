/**
 * admin-capability-lockdown — Function Hook (EXPERIMENTAL)
 *
 * An organization-level plugin that (1) withholds nouns from $ so no plugin
 * registered beneath it can reach the network or spawn processes, and
 * (2) allowlists which plugins may register at all, and (3) optionally
 * withholds the Bash tool. Only (1) and the "deny" shell policy are real
 * boundaries; the "guardrail" denylist is bypassable by design and is
 * labelled as such.
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

  // 3. Shell policy. The real security boundary is step 1 (no $.http / $.process
  //    for plugins below). A Bash denylist can always be bypassed with an
  //    unlisted client, quoting, or a Python one-liner, so this is NOT a
  //    boundary. Two modes:
  //      shellPolicy: "deny"      -> withhold the Bash tool entirely (default,
  //                                  the only mode that actually enforces "no egress")
  //      shellPolicy: "guardrail" -> keep Bash, deny the obvious network clients
  //                                  as a speed bump against accidental egress
  //      shellPolicy: "allow"     -> leave Bash alone
  const shellPolicy: "deny" | "guardrail" | "allow" =
    options.shellPolicy ?? ((options.blockShellNetwork ?? true) ? "deny" : "allow");
  if (shellPolicy === "deny") {
    on("tool.call", { tool: "Bash" }, () => ({
      deny: "The Bash tool is disabled by your organization's admin-capability-lockdown plugin.",
    }));
  } else if (shellPolicy === "guardrail") {
    const NETWORK_CLIENTS = /\b(curl|wget|nc|ncat|netcat|socat|ssh|scp|sftp|rsync|telnet|ftp|openssl\s+s_client)\b/i;
    on("tool.call", { tool: "Bash" }, ($: Engine, e: any, next: Next) => {
      const command: string = e.command ?? "";
      if (NETWORK_CLIENTS.test(command)) {
        return { deny: "Outbound network commands are disabled by your organization's admin-capability-lockdown plugin (guardrail mode: not a hard boundary)." };
      }
      return next(e);
    });
  }
}
