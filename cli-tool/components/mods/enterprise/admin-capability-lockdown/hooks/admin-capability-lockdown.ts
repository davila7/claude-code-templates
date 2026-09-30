/**
 * admin-capability-lockdown — Claude Mod (EARLY ACCESS)
 *
 * An organization-level mod that (1) withholds the `http` and `process`
 * nouns from `$` so no plugin seated beneath it can reach the network or
 * spawn processes, (2) refuses
 * plugins at `plugin.register` by name allowlist and by the `$` calls their
 * source declares, and (3) optionally withholds or guards the Bash tool.
 *
 * Only (1), (2) and the "deny" shell policy are real boundaries. The
 * "guardrail" shell denylist is bypassable by design and is labelled as such.
 *
 * SEATING. Withholding and refusal only bind the plugins BENEATH this one.
 * Put it in the prepend tier through managed settings, e.g.
 *   "prependPlugins": ["admin-capability-lockdown@acme-tools", "sec-default@builtin"]
 * so it is outermost: its `engine.create` step returns last (its withholding
 * wins) and it judges every `plugin.register` after it. Loaded with
 * --plugin-dir it sits in the user tier and only binds plugins listed after it.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   allowedPlugins: string  plugin names that may register, comma-separated (unset = any name)
 *   refuseCalls:    string  a user-tier plugin whose source calls any of these is refused, comma-separated
 *                             (default: the withheld nouns' calls, e.g. "http.fetch", "process.run")
 *   shellPolicy:    "deny" | "guardrail" | "allow"  (default "deny")
 */
import type { Register } from 'claude-code'

/** A list option: a string[] or a comma-separated string (what a manifest's `userConfig` string field holds); empty means unset. */
function strings(value: unknown): string[] | undefined {
  const list = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : typeof value === 'string'
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  return list.length > 0 ? list : undefined
}

export const register: Register = (on, options) => {
  const withhold = ['http', 'process'] // fixed, see the engine.create step below
  const allowedPlugins = strings(options.allowedPlugins) // undefined = allow any name
  const refuseCalls = strings(options.refuseCalls) ?? withhold.map((noun) => `${noun}.`)
  const shellPolicy =
    options.shellPolicy === 'guardrail' || options.shellPolicy === 'allow' ? options.shellPolicy : 'deny'

  // 1. Shape $ itself. Every plugin beneath has already added its nouns when
  //    the built table comes back from next(e); return it without http and
  //    process. The host's static scan admits only destructuring that value
  //    and spreading the rest (a destructured noun may not be read again, and
  //    engine.create may be registered once), so the withheld set is fixed
  //    here: to withhold a different set, edit this one line.
  on('engine.create', async ($, e, next) => {
    const { http: _http, process: _process, ...rest } = await next(e)
    return rest
  })

  // 2. Decide which plugins may join the chain. `e.uses.calls` is the host's
  //    static scan of the module's `$.noun.event(...)` call sites, so a
  //    user-tier plugin that reaches for a withheld noun is refused up front
  //    instead of failing at run time. Managed tiers are the org's own.
  on('plugin.register', ($, e, next) => {
    if (e.tier !== 'user') return next(e)

    if (allowedPlugins && !allowedPlugins.includes(e.name)) {
      $.ui.log(`[admin-capability-lockdown] refused plugin "${e.name}" (not in allowlist)`)
      return { refuse: `Plugin "${e.name}" is not on the organization allowlist.` }
    }

    const reaching = e.uses.calls.find((call) =>
      refuseCalls.some((rule) => (rule.endsWith('.') ? call.startsWith(rule) : call === rule)),
    )
    if (reaching) {
      $.ui.log(`[admin-capability-lockdown] refused plugin "${e.name}" (calls $.${reaching})`)
      return { refuse: `Plugin "${e.name}" calls $.${reaching}, which this organization withholds from user plugins.` }
    }

    return next(e)
  })

  // 3. Shell policy. The real security boundary is step 1 (no $.http /
  //    $.process for plugins beneath). A Bash denylist can always be bypassed
  //    with an unlisted client, quoting, or a Python one-liner, so it is NOT a
  //    boundary:
  //      "deny"      -> withhold the Bash tool entirely (the only mode that enforces "no egress")
  //      "guardrail" -> keep Bash, deny the obvious network clients as a speed bump
  //      "allow"     -> leave Bash alone
  if (shellPolicy === 'deny') {
    on('tool.call', { tool: 'Bash' }, () => ({
      deny: "The Bash tool is disabled by your organization's admin-capability-lockdown mod.",
    }))
  } else if (shellPolicy === 'guardrail') {
    const NETWORK_CLIENTS = /\b(curl|wget|nc|ncat|netcat|socat|ssh|scp|sftp|rsync|telnet|ftp|openssl\s+s_client)\b/i
    on('tool.call', { tool: 'Bash' }, ($, e, next) => {
      if (NETWORK_CLIENTS.test(e.command)) {
        return {
          deny: "Outbound network commands are disabled by your organization's admin-capability-lockdown mod (guardrail mode: not a hard boundary).",
        }
      }
      return next(e)
    })
  }
}
