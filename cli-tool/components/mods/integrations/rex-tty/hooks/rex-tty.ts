/**
 * rex-tty — Claude Mod
 *
 * Claude's Bash tool has no terminal: `sudo`, `gh auth login`, a key
 * passphrase or `git rebase -i` fail or hang there. Inside the Rex terminal
 * (https://www.superlogical.com/rex) this mod runs those commands in a Rex
 * pane beside the session instead. The person types in the pane; Claude gets
 * the exit code and what the pane showed, as the Bash tool's own result. What
 * the person types at a hidden prompt is never on screen, so it never reaches
 * the model.
 *
 *   session.start  inside Rex: registers the tty_run tool
 *   tool.call      Bash: a command that needs a terminal goes to a pane;
 *                  any other Bash result that says "no terminal" gets a note
 *                  pointing Claude at tty_run
 *   tool.call      mcp__rex-tty__tty_run: Claude's own request for a pane
 *
 * A hook that answers a tool call runs before core's permission dialog, so
 * the mod asks first: `$.tool.check` on the Bash command, and on anything but
 * an allow, a question to the person. A denied command is denied.
 *
 * Outside Rex (no REX_BLOCK) the mod does nothing. Needs Claude Code >=
 * 2.1.316 and the `rex` CLI Rex puts on the PATH of its terminals.
 *
 * Options: commands, skip (comma-separated regex sources), side, ratio,
 * closeOnExit, returnOutput, timeoutMinutes.
 */
import type { ProcessRunInit, ProcessRunResult, Register } from 'claude-code'
import {
  PANE_SCRIPT,
  banner,
  blockOf,
  clamp,
  compile,
  needsTerminal,
  paneOutput,
  quoted,
  saysNoTerminal,
  shellFor,
  shortCommand,
  side,
  strings,
  waited,
} from './detect.ts'

const TAG = '[rex-tty]'
const TOOL = 'tty_run'
const ASK = { pane: 'Run in a Rex pane', here: 'Run without a terminal', no: 'Do not run' } as const

/** What a run needs from the engine, spelled where `$` is. */
type Host = {
  run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>
  /** Runs `rex wait` as a stream, so an interrupted turn kills it; resolves its whole output. */
  wait: (argv: readonly string[]) => Promise<{ stdout: string; stderr: string }>
  cwd: () => Promise<string>
  check: (command: string) => Promise<{ decision: 'allow' | 'ask' | 'deny'; reason?: string; rule?: string }>
  ask: (question: string, labels: readonly string[]) => Promise<string>
  log: (line: string) => void
  status: (line: string | undefined) => void
}

type Rex = { bin: string; anchor: string; shell: string }
type Outcome = { ok: true; stdout: string; context: string } | { ok: false; deny: string }

export const register: Register = (on, options) => {
  const extra = compile(strings(options.commands))
  const skip = compile(strings(options.skip))
  const where = side(options.side)
  const ratio = clamp(options.ratio, 10, 90, 35)
  const closeOnExit = options.closeOnExit !== false
  const returnOutput = options.returnOutput !== false
  const timeoutMinutes = clamp(options.timeoutMinutes, 1, 720, 30)

  let rex: Rex | undefined
  let toolName = ''
  let count = 0
  let isBadReported = false
  /** Calls the person sent to a pane: these never fall through to core, whatever fails. */
  const chosen = new Set<string>()

  /** Decides whether the command may go to a pane: the session's rules first, the person on anything but an allow. */
  async function permit(host: Host, command: string, why: string): Promise<'pane' | 'here' | { deny: string }> {
    const verdict = await host.check(command)
    if (verdict.decision === 'deny') return { deny: verdict.reason ?? 'This command is denied by the session\'s permission rules.' }
    // only a rule the person wrote stands in for their answer: an allow from the
    // mode (bypass, a sandbox's auto-allow) was given for a call core would run
    // its own way, not for a pane outside it
    if (verdict.decision === 'allow' && verdict.rule) return 'pane'
    let answer: string
    try {
      answer = await host.ask(`rex-tty: this command needs a terminal (${why}). Run it in a Rex pane where you can type?\n\n${quoted(command)}`, [ASK.pane, ASK.here, ASK.no])
    } catch {
      // dismissed, or a -p run with no one to ask: as if the mod were not here
      return 'here'
    }
    if (answer === ASK.pane) return 'pane'
    if (answer === ASK.here) return 'here'
    return { deny: answer === ASK.no ? 'The user chose not to run this command.' : `The user did not run this command and said: ${answer}` }
  }

  /** Closes the pane of an interrupted turn and says, truthfully, whether that worked. */
  async function interrupted(host: Host, r: Rex, block: string | undefined): Promise<Outcome> {
    if (!block) return { ok: false, deny: 'The turn was interrupted before this command was sent to a Rex pane; it was not run.' }
    const closed = await host.run([r.bin, 'block', 'close', block]).catch(() => undefined)
    return closed && closed.exitCode === 0
      ? { ok: false, deny: 'The turn was interrupted while this command waited in a Rex pane; the pane was closed.' }
      : { ok: false, deny: `The turn was interrupted while this command waited in a Rex pane, and the pane (${block}) could not be closed: the command may still be running there. Tell the user; do not run it again.` }
  }

  /**
   * `pane` with every failure turned into a refusal: once the person's answer
   * was "a pane", a hook that threw would be skipped and core would run the
   * command in its own shell, a second time if the pane had started it.
   */
  async function inPane(host: Host, r: Rex, command: string, signal: AbortSignal): Promise<Outcome> {
    const opened: { block?: string } = {}
    try {
      return await pane(host, r, command, opened, signal)
    } catch (err) {
      host.status(undefined)
      // the turn was interrupted: the pane goes with it, whatever was running in it
      if (signal.aborted) return interrupted(host, r, opened.block)
      const what = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        deny: opened.block
          ? `rex-tty lost track of this command (${what}). It was started in a Rex pane that is still open and may still be running there: do not run it again; ask the user to look at the pane.`
          : `rex-tty could not open a Rex pane (${what}). The command was not run.`,
      }
    }
  }

  /** Opens the pane, waits for the command and reads what the pane showed. */
  async function pane(host: Host, r: Rex, command: string, opened: { block?: string }, signal: AbortSignal): Promise<Outcome> {
    count += 1
    const label = `tty-${count}`
    const head = banner(command)
    const cwd = await host.cwd().catch(() => '')
    const split = await host.run([
      r.bin, 'split', '-b', r.anchor, '--split', where, '--ratio', String(ratio), '--keep-open', '--focus', '--label', label, '--json',
      ...(cwd ? ['-c', cwd] : []),
      '--', r.shell, '-c', PANE_SCRIPT, r.shell, head, command,
    ])
    const block = split.exitCode === 0 ? blockOf(split.stdout) : null
    if (block) opened.block = block
    if (!block) return { ok: false, deny: `rex-tty could not open a Rex pane (${(split.stderr || split.stdout).trim().split('\n')[0] || `rex split exited ${split.exitCode}`}). The command was not run.` }

    host.status(`${TAG} waiting for you in pane ${label}: ${shortCommand(command, 40)}`)
    const out = await host.wait([r.bin, 'wait', '--for', `${timeoutMinutes}m`, '--json', block])
    const end = waited(out.stdout, out.stderr)
    host.status(undefined)
    // an interrupted turn kills `rex wait`, and its stream may just end rather than throw:
    // the pane goes with the turn whatever closeOnExit says, so nothing runs on unattended
    if (signal.aborted && end.kind !== 'exit') return interrupted(host, r, block)

    const shown = await host.run([r.bin, 'capture', '-b', block, '--trim', '--unwrap']).catch(() => undefined)
    // unread, or cut at the engine's 4 MiB (its end, the part that matters, is what was dropped)
    // (a pane that is gone has nothing to read and nothing to keep: that case says so itself)
    const isLost = returnOutput && end.kind !== 'gone' && (!shown || shown.exitCode !== 0 || shown.isStdoutTruncated)
    const text = shown && shown.exitCode === 0 ? paneOutput(shown.stdout, head) : ''
    const lost = !isLost
      ? ''
      : shown && shown.exitCode === 0
        ? `${TAG} the pane's output is larger than 4 MiB: only its beginning could be read, the end is missing. The pane (${label}) was left open.`
        : `${TAG} the pane's output could not be read (${(shown && (shown.stderr || shown.stdout).trim().split('\n')[0]) || 'rex capture failed'}). The pane (${label}) was left open.`
    const body = !returnOutput ? '(rex-tty withheld the pane\'s output: the returnOutput option is off)' : lost ? `${text}\n\n${lost}`.trim() : text
    const lostNote = lost ? ' Its output is incomplete or missing as the result says; the pane was left open so the user can read it. Say so rather than assuming what it printed.' : ''

    if (end.kind === 'timeout') {
      return {
        ok: true,
        stdout: `${body}\n\n${TAG} still running after ${timeoutMinutes} min in Rex pane ${label}; the pane was left open.`.trim(),
        context: `This command runs in a Rex terminal pane (${label}, ${block}) and had not ended after ${timeoutMinutes} minutes, probably waiting for the user. It was not stopped. Tell the user it is waiting in that pane; do not run it again.`,
      }
    }
    if (closeOnExit && !isLost) await host.run([r.bin, 'block', 'close', block]).catch(() => undefined)
    await host.run([r.bin, 'block', 'focus', r.anchor]).catch(() => undefined)
    if (end.kind === 'gone') {
      return {
        ok: true,
        stdout: `${body}\n\n${TAG} the pane closed before the command reported an exit code.`.trim(),
        context: `This command ran in a Rex terminal pane (${label}) that the user closed, or that went away, before the command ended${end.detail ? ` (${end.detail})` : ''}. Its exit code is unknown; check the effect before relying on it, and ask the user rather than running it again blindly.`,
      }
    }
    host.log(`${TAG} ${label} exited ${end.code}: ${shortCommand(command)}`)
    return {
      ok: true,
      stdout: end.code === 0 ? body : `${body}\n\nExit code ${end.code}`.trim(),
      context: `This command ran in a Rex terminal pane (${label}) where the user could type, not in your shell: exit code ${end.code}. ${returnOutput ? 'The output is what the pane showed; anything the user typed at a hidden prompt (a password, a passphrase) is not in it.' : 'Its output was withheld by the user\'s configuration; only the exit code is known.'} The pane had its own shell with the user's login environment, so variables you exported earlier were not set there.${lostNote}`,
    }
  }

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const anchor = await $.env.get('REX_BLOCK').catch(() => undefined)
    if (!anchor) {
      rex = undefined
      $.ui.log(`${TAG} not inside Rex (REX_BLOCK is unset): nothing to do`, { to: 'debug' })
      return started
    }
    const dir = await $.env.get('REX_BIN_DIR').catch(() => undefined)
    rex = { bin: dir ? `${dir.replace(/\/$/, '')}/rex` : 'rex', anchor, shell: shellFor(await $.env.get('SHELL').catch(() => undefined)) }
    await $.tool
      .register({
        name: TOOL,
        description:
          'Run a shell command in a Rex terminal pane beside this session, where the user can type: a password or passphrase, a yes/no confirmation, an editor, an interactive login. Use it when a Bash command failed because it had no terminal (for example "a terminal is required", "not a tty", "cannot prompt") or plainly needs the user at the keyboard. It waits for the command to end and returns what the pane showed and the exit code; what the user types at a hidden prompt is never returned. Do not use it for commands that need no input.',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The shell command, as you would give it to Bash' },
            reason: { type: 'string', description: 'One short sentence for the user: what they will be asked to type' },
          },
          required: ['command'],
        },
      })
      .then(({ tool }) => void (toolName = tool))
      .catch(err => $.ui.log(`${TAG} could not register ${TOOL}: ${err}`, { to: 'debug' }))
    return started
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const r = rex
    const command = typeof e.command === 'string' ? e.command : ''
    if (!r || !command.trim() || e.run_in_background === true) return next(e)
    if (!isBadReported && (extra.bad.length || skip.bad.length)) {
      isBadReported = true
      $.ui.log(`${TAG} ignored option patterns that are not valid regular expressions: ${[...extra.bad, ...skip.bad].join(', ')}`)
    }

    const why = needsTerminal(command, extra.ok, skip.ok)
    if (!why) {
      // after: a command that failed for lack of a terminal gets a pointer to the tool
      const outcome = await next(e)
      const text = outcome.deny === undefined ? (outcome.text ?? '') : ''
      const isFailure = outcome.deny === undefined && (outcome.isError === true || /\bExit code [1-9]/.test(text))
      if (!toolName || !isFailure || !saysNoTerminal(text)) return outcome
      return {
        ...outcome,
        context: [
          ...(outcome.context ?? []),
          `This command seems to have failed because Bash has no terminal. The ${toolName} tool runs a command in a Rex pane where the user can type; use it for this command if it needs the user's input.`,
        ],
      }
    }

    const host: Host = {
      run: (argv, init) => $.process.run(argv, init),
      wait: async argv => {
        let stdout = ''
        let stderr = ''
        for await (const chunk of $.process.spawn({ argv })) {
          if (chunk.stream === 'stdout') stdout += chunk.text
          else stderr += chunk.text
        }
        return { stdout, stderr }
      },
      cwd: () => $.session.cwd(),
      check: c => $.tool.check({ tool: 'Bash', input: { command: c } }),
      ask: (question, labels) => $.ui.ask(question, { header: 'Terminal', options: labels }),
      log: line => void $.ui.log(line),
      status: line => void $.ui.status(line),
    }
    const go = await permit(host, command, why)
    if (go === 'here') return next(e)
    if (go !== 'pane') return go
    const key = e.tool_use_id ?? command
    chosen.add(key)
    const done = await inPane(host, r, command, next.signal)
    // settled: only a call still in flight needs the .catch below
    chosen.delete(key)
    if (!done.ok) return { deny: done.deny }
    return { result: { stdout: done.stdout, stderr: '', interrupted: false }, context: [done.context] }
  }).catch(async ($, e, next) => {
    // before the person chose a pane nothing ran: core decides as if the mod were absent
    const key = typeof e.command === 'string' ? (e.tool_use_id ?? e.command) : ''
    if (!chosen.delete(key)) return next(e)
    return { deny: `rex-tty failed (${next.error.kind}) after this command was sent to a Rex pane. It may have run there: do not run it again; ask the user to look at the pane.` }
  })

  on('tool.call', async ($, e, next) => {
    if (!toolName || e.tool !== toolName) return next(e)
    const r = rex
    const input = e as unknown as Record<string, unknown>
    const command = typeof input.command === 'string' ? input.command : ''
    if (!command.trim()) return { deny: `${TOOL} needs a command` }
    if (!r) return { deny: `${TOOL} only works when Claude Code runs inside the Rex terminal.` }
    const why = typeof input.reason === 'string' && input.reason.trim() ? `Claude says: ${shortCommand(input.reason, 120)}` : 'Claude asked for a terminal'

    const host: Host = {
      run: (argv, init) => $.process.run(argv, init),
      wait: async argv => {
        let stdout = ''
        let stderr = ''
        for await (const chunk of $.process.spawn({ argv })) {
          if (chunk.stream === 'stdout') stdout += chunk.text
          else stderr += chunk.text
        }
        return { stdout, stderr }
      },
      cwd: () => $.session.cwd(),
      check: c => $.tool.check({ tool: 'Bash', input: { command: c } }),
      ask: (question, labels) => $.ui.ask(question, { header: 'Terminal', options: labels }),
      log: line => void $.ui.log(line),
      status: line => void $.ui.status(line),
    }
    const go = await permit(host, command, why)
    if (go === 'here') return { deny: `The user chose to run this without a terminal: use Bash for it instead of ${TOOL}.` }
    if (go !== 'pane') return go
    const done = await inPane(host, r, command, next.signal)
    if (!done.ok) return { deny: done.deny }
    return { result: done.stdout || '(no output)', context: [done.context] }
  }).catch(async ($, e, next) => {
    if (!toolName || e.tool !== toolName) return next(e)
    return { deny: `rex-tty failed (${next.error.kind}). If a Rex pane opened, the command may have run there: do not run it again; ask the user to look at the pane.` }
  })
}
