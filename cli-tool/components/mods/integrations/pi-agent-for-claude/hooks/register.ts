import type { EngineInterface, On, TurnStepChunk, TurnStepResult, TurnUsage } from 'claude-code'

/** How often a running pi's event stream is read for new events. */
const STREAM_POLL_MS = 150

/**
 * How long one step streams pi before handing off to the next. The engine
 * gives a hook call 10 s and, past it, finishes the step with the real model;
 * pi runs detached, so a longer run spans several steps, chained through
 * PROGRESS_TOOL.
 */
const STEP_BUDGET_MS = 7_000

/**
 * The no-op tool a step ends on while pi is still running: its call makes the
 * engine run another step, which carries on streaming the same pi run.
 */
const PROGRESS_TOOL = 'pi_progress'

/** How long a follow-up step waits for its message to reach the transcript. */
const FOLLOW_UP_WAIT_MS = 5_000
const POLL_MS = 200

/**
 * The tool a subagent delivers its final report through, where the session
 * runs the hand-back contract (`CLAUDE_CODE_SENDMESSAGE_HANDBACK`). A report
 * left as plain text is bounced back with `[handback-send-enforce]`.
 */
const HANDBACK_TOOL = 'SubagentHandback'

/** The tool a teammate answers another agent with. */
const SEND_TOOL = 'SendMessage'

/**
 * User messages the engine writes into a subagent's transcript itself. They
 * are not the person's follow-ups, so pi is never sent them.
 */
const ENGINE_PREFIXES = [
  '<system-reminder>',
  '[handback-send-enforce]',
  '[Your previous response had no visible output',
]

/**
 * Registers the `pi` subagent type.
 *
 * The spawn runs as it always does, so the engine starts a real subagent loop
 * with its own id, transcript and entry in `$.agent.list()`; only the model
 * request inside that loop is replaced, by a run of the pi CLI. Each loop gets
 * a pi session named after its agent id, so a follow-up continues the same pi
 * conversation.
 *
 * Which model pi runs and which tools it may use are pi's own settings, not
 * this mod's: it shells out to `pi` and lets pi's config decide.
 *
 * @param on the engine's registrar
 */
export function register(on: On) {
  const seeds = new Map<string, string>()
  const consumed = new Map<string, number>()
  // Loops whose last step delivered pi's answer through a tool call, with the
  // text the step after it ends on.
  const delivered = new Map<string, string>()
  // This process's teammate key when it runs as a pi teammate (`claude
  // --agent-type pi-agent-for-claude:pi` in its own pane): then its main loop is pi's.
  let teammate: string | undefined
  // PROGRESS_TOOL's full name as the engine registered it, `mcp__<plugin>__…`.
  let progressTool = ''
  const lastAnswers = new Map<string, string>()
  const runs = new Map<string, Run>()
  // The pi model each loop asked for with a `pi-model:` line; it holds for
  // that loop's later messages until another such line names a new one.
  const models = new Map<string, string>()

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    teammate = await teammateOf($)
    ;({ tool: progressTool } = await $.tool.register({
      name: PROGRESS_TOOL,
      description: 'Internal to pi subagents: marks a pi run still in progress. Never call it.',
    }))
    return started
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool !== progressTool) return next(e)
    const key = e.agentId ?? teammate
    if (key === undefined || !runs.has(key)) {
      return { deny: `${PROGRESS_TOOL} is internal to pi subagents.` }
    }
    return { result: 'pi is still working.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (isPi(e.subagentType) && started.agentId) {
      seeds.set(started.agentId, e.prompt)
    }
    return started
  })

  on('turn.step', async function* ($, e, next) {
    // A pi subagent's loop, keyed by its id, or this process's main loop when
    // it is a pi teammate; any other loop is left to the model.
    const seed = e.agentId === undefined ? undefined : seeds.get(e.agentId)
    const agentId = e.agentId === undefined ? teammate : seed === undefined ? undefined : e.agentId
    if (agentId === undefined) {
      return yield* next(e)
    }
    const deadline = (await $.clock.now()) + STEP_BUDGET_MS

    // The step after a delivery is that tool's result coming back: the answer
    // is delivered, so the loop ends here without asking pi again. It ends on
    // visible text, since an empty response is bounced back as one.
    const done = delivered.get(agentId)
    if (done !== undefined) {
      delivered.delete(agentId)
      return yield* respond(e, [
        { kind: 'text', index: 0, text: done },
        { kind: 'stop', stopReason: 'end_turn', usage: null },
      ], done, [])
    }

    let run = runs.get(agentId)
    if (run === undefined) {
      const already = consumed.get(agentId) ?? 0
      const { prompt, count, handback, bounced, replyTo } = seed === undefined
        ? { ...(await teammatePromptOf($, already)), handback: false, bounced: false }
        : { ...(await promptOf($, agentId, seed, already)), replyTo: undefined }
      consumed.set(agentId, count)
      if (bounced || prompt === undefined) {
        // A bounce is the engine refusing a plain-text report: hand back the
        // answer pi already gave rather than asking it again.
        const text = bounced
          ? lastAnswers.get(agentId) ?? ''
          : "pi agent: no new message reached this agent's transcript."
        return yield* finish(e, agentId, text, text, 1, handback || bounced, undefined, [{ kind: 'text', index: 0, text }])
      }
      const asked = modelOf(prompt)
      if (asked.model) models.set(agentId, asked.model)
      run = await start($, agentId, asked.prompt, count, handback, models.get(agentId))
      run.replyTo = replyTo
      runs.set(agentId, run)
    }

    const { shown, blocks, lastKind } = yield* pump($, run, deadline, next.signal)
    if (!run.ended) {
      const input = {}
      return yield* respond(e, [
        { kind: 'tool', index: blocks, id: `toolu_pi_${agentId}_${run.id}_${run.steps++}`, name: progressTool },
        { kind: 'input', index: blocks, json: JSON.stringify(input) },
        { kind: 'stop', stopReason: 'tool_use', usage: takeUsage(run) },
      ], shown, [{ name: progressTool, input }])
    }

    runs.delete(agentId)
    // The hand-back reminder can reach the transcript after the run's first
    // step read it; checking again now saves a bounce.
    const handback = seed !== undefined && (run.handback || (await transcriptOf($, agentId)).handback)
    const answer = run.report.trim() || run.shown
    // Named from pi's own events: a model asked what it is often answers
    // wrongly, and the parent has nothing else to check it by.
    const report = run.model ? `${answer}\n\n— answered by pi, ${run.model}` : answer
    // A run spanning several steps streamed its answer across them; the last
    // step carries the whole of it, since that step is what the parent reads.
    // The parent reads the last text block, so it must hold the whole answer.
    // A run this step only finished gets the answer again as its own block; one
    // whose answer streamed whole here gets just the model line, onto that
    // same block, not alone in a new one.
    const whole = run.steps > 0 && !shown.includes(answer)
    const extra = whole ? report : report.slice(answer.length)
    const into = !whole && lastKind === 'text' ? blocks - 1 : blocks
    const tail: TurnStepChunk[] = extra ? [{ kind: 'text', index: into, text: extra }] : []
    return yield* finish(e, agentId, shown + extra, report, into + (extra ? 1 : 0), handback, run.replyTo, tail, takeUsage(run))
  })

  /**
   * Ends a step on pi's answer: plain text, or text then the tool call that
   * delivers it - HANDBACK_TOOL where the session runs the hand-back contract,
   * or, in a pi teammate, SendMessage to whoever sent the message pi answered.
   */
  async function* finish(
    e: { turnId: string; index: number },
    agentId: string,
    shown: string,
    report: string,
    blocks: number,
    handback: boolean,
    replyTo: string | undefined,
    chunks: TurnStepChunk[],
    usage: TurnUsage | null = null,
  ) {
    lastAnswers.set(agentId, report)
    const delivery = handback
      ? { name: HANDBACK_TOOL, input: { message: report }, done: 'Report delivered.' }
      : replyTo !== undefined
        ? { name: SEND_TOOL, input: { to: replyTo, message: report }, done: `Sent to ${replyTo}.` }
        : undefined
    if (delivery === undefined) {
      return yield* respond(e, [...chunks, { kind: 'stop', stopReason: 'end_turn', usage }], shown, [])
    }
    delivered.set(agentId, delivery.done)
    const id = `toolu_pi_${agentId.replace(/[^A-Za-z0-9_]/g, '_')}_${delivery.name}_${consumed.get(agentId) ?? 0}`
    return yield* respond(e, [
      ...chunks,
      { kind: 'tool', index: blocks, id, name: delivery.name },
      { kind: 'input', index: blocks, json: JSON.stringify(delivery.input) },
      { kind: 'stop', stopReason: 'tool_use', usage },
    ], shown, [{ name: delivery.name, input: delivery.input }])
  }
}

/**
 * The tokens a run used since the last step reported them, as this step's
 * usage under the model pi named; null before pi named one. Resets the count.
 */
export function takeUsage(run: Run | undefined): TurnUsage | null {
  if (!run?.model) return null
  const { i, o, cr, cw } = run.usage
  run.usage = { i: 0, o: 0, cr: 0, cw: 0 }
  return {
    model: run.model,
    input_tokens: i,
    output_tokens: o,
    cache_read_input_tokens: cr,
    cache_creation_input_tokens: cw,
  }
}

/**
 * This process's teammate key, when it is a pi teammate: a teammate runs as
 * its own `claude --agent-id <id> --agent-type <type>` process, and a hooks
 * module has no API for its process's arguments, so this reads them with `ps`.
 * The key names the teammate's pi session; undefined in any other process.
 */
export async function teammateOf($: EngineInterface) {
  const { stdout } = await $.process.run(['sh', '-c', 'ps -o command= -p "$PPID"'])
  const type = stdout.match(/--agent-type\s+(\S+)/)?.[1]
  const id = stdout.match(/--agent-id\s+(\S+)/)?.[1]
  if (type === undefined || id === undefined || !isPi(type)) return undefined
  return id.replace(/[^A-Za-z0-9_-]/g, '-')
}

/**
 * Waits for a message past the first `already` in a pi teammate's own
 * transcript - its main loop, so `$.session.messages()` reads it - and returns
 * the newest as pi's prompt, with who sent it when another agent did.
 *
 * A message from another agent arrives wrapped as `<teammate-message
 * teammate_id="team-lead">…</teammate-message>`; one typed into the pane is
 * plain, and is answered in the pane rather than sent anywhere.
 */
export async function teammatePromptOf($: EngineInterface, already: number) {
  for (let waited = 0; ; waited += POLL_MS) {
    const texts = (await $.session.messages())
      .filter((m) => m.role === 'user')
      .map((m) => m.text.trim())
      .filter((text) => text && !ENGINE_PREFIXES.some((prefix) => text.startsWith(prefix)))
    if (texts.length > already) {
      const text = texts.at(-1) as string
      const replyTo = text.match(/<teammate-message teammate_id="([^"]+)"/)?.[1]
      const prompt = text
        .replace(/<teammate-message teammate_id="([^"]+)"[^>]*>/g, 'Message from $1:\n')
        .replace(/<\/teammate-message>/g, '')
        .trim()
      return { prompt, count: texts.length, replyTo }
    }
    if (waited >= FOLLOW_UP_WAIT_MS) return { prompt: undefined, count: already, replyTo: undefined }
    await $.clock.sleep(POLL_MS)
  }
}

/**
 * Takes a `pi-model: <pattern>` line out of a prompt: the way a caller picks
 * the model pi runs, since the Agent tool's own `model` names Claude models
 * only. The pattern is anything `pi --model` takes (`openrouter/<id>`, a
 * fuzzy `*sonnet*`); only the first such line counts.
 */
export function modelOf(text: string): { prompt: string; model?: string } {
  const line = text.match(/^[ \t]*pi-model:[ \t]*([A-Za-z0-9_.:\/*~@+-]+)[ \t]*$/im)
  if (!line) return { prompt: text }
  return { prompt: text.replace(line[0], '').trim(), model: line[1] }
}

/** Whether a spawn names this plugin's type, plain or plugin-qualified. */
export function isPi(subagentType: string) {
  return subagentType === 'pi' || subagentType.endsWith(':pi')
}

/**
 * Yields a step's chunks and returns the result the engine expects of it.
 *
 * @param e the step being answered
 * @param chunks what the person watches stream, in order
 * @param answer the step's visible text
 * @param toolUses the tool calls the chunks made
 */
export async function* respond(
  e: { turnId: string; index: number },
  chunks: TurnStepChunk[],
  answer: string,
  toolUses: TurnStepResult['toolUses'],
): AsyncGenerator<TurnStepChunk, TurnStepResult> {
  for (const chunk of chunks) yield chunk
  const stop = chunks.at(-1)
  const stopReason = stop?.kind === 'stop' ? stop.stopReason : 'end_turn'
  const usage = stop?.kind === 'stop' ? stop.usage : null
  return { turnId: e.turnId, index: e.index, answer, toolUses, stopReason, usage }
}

/**
 * Rewrites pi's `--mode json` event stream as one small JSON line per thing a
 * step shows: `{k:"msg"}` when an assistant message starts, `{k:"text"|
 * "thinking", t}` per delta, `{k:"tool", t}` per tool pi starts, `{k:"usage",
 * i, o, cr, cw}` per finished assistant message, `{k:"end"}`. `msg` carries
 * the `provider/model` pi sent the request to.
 *
 * pi's own events carry whole tool outputs and transcripts, and
 * `$.process.run` cuts a child's stdout at its output limit, so the step
 * never reads them raw.
 */
const FILTER = String.raw`
const rl = require('readline').createInterface({ input: process.stdin })
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n')
rl.on('line', (line) => {
  let e
  try { e = JSON.parse(line) } catch { return }
  const d = e.type === 'message_update' ? e.assistantMessageEvent : undefined
  if (e.type === 'message_start' && e.message?.role === 'assistant') out({ k: 'msg', model: e.message.provider + '/' + e.message.model })
  else if (e.type === 'message_end' && e.message?.role === 'assistant') {
    const u = e.message.usage ?? {}
    out({ k: 'usage', i: u.input ?? 0, o: u.output ?? 0, cr: u.cacheRead ?? 0, cw: u.cacheWrite ?? 0 })
  }
  else if (d?.type === 'text_delta') out({ k: 'text', t: d.delta })
  else if (d?.type === 'thinking_delta') out({ k: 'thinking', t: d.delta })
  else if (e.type === 'tool_execution_start') {
    const a = JSON.stringify(e.args ?? {})
    out({ k: 'tool', t: '\n▸ ' + e.toolName + ': ' + (a.length > 100 ? a.slice(0, 100) + '…' : a) + '\n' })
  } else if (e.type === 'agent_end') out({ k: 'end' })
})
`

/** One pi run, as it streams across the steps it spans. */
export type Run = {
  /** The detached pipeline's pid. */
  pid: string
  /** pi's session, `pi-<agentId>`, which also names its process for a kill. */
  session: string
  /** The file FILTER writes pi's events to. */
  events: string
  /** This run's number for the agent, which keeps tool call ids unique. */
  id: number
  /** How many event lines have been read. */
  read: number
  /** Every piece of text shown so far, across steps. */
  shown: string
  /** The text of pi's latest assistant message: its answer once it ends. */
  report: string
  /** Whether pi has ended. */
  ended: boolean
  /** Whether the answer must be handed back through HANDBACK_TOOL. */
  handback: boolean
  /** In a pi teammate, who sent the message pi is answering. */
  replyTo?: string
  /** How many steps have handed off to the next through PROGRESS_TOOL. */
  steps: number
  /** The `provider/model` pi reported for its latest message. */
  model: string
  /** Tokens pi used since the last step reported them. */
  usage: { i: number; o: number; cr: number; cw: number }
}

/**
 * Starts pi detached in `agentId`'s pi session, piped through FILTER into a
 * file the steps read: `$.process.run` only returns once its child exits, so
 * it cannot stream a child it waits on.
 *
 * @param prompt what to send pi
 * @param id this run's number for the agent
 * @param handback whether pi's answer must be handed back
 * @param model a pi `--model` pattern; absent, pi's own default
 */
export async function start(
  $: EngineInterface,
  agentId: string,
  prompt: string,
  id: number,
  handback: boolean,
  model: string | undefined,
): Promise<Run> {
  const session = `pi-${agentId}`
  const events = `/tmp/pi-agent-for-claude-${agentId}-${id}.jsonl`
  const cwd = await $.session.cwd()
  const started = await $.process.run([
    'sh',
    '-c',
    'nohup sh -c \'pi -p --mode json --session-id "$1" $5 -- "$2" </dev/null 2>"$3.err" | node -e "$4" >"$3"\' sh "$1" "$2" "$3" "$4" "$5" >/dev/null 2>&1 & echo $!',
    'sh',
    session,
    prompt,
    events,
    FILTER,
    // Unquoted in the script so an absent model adds no argument; a pattern
    // is one word (`openrouter/moonshotai/kimi-k2`), which modelOf enforces.
    model ? `--model ${model}` : '',
  ], { cwd })
  return {
    pid: started.stdout.trim(),
    session,
    events,
    id,
    read: 0,
    shown: '',
    report: '',
    ended: false,
    handback,
    steps: 0,
    model: '',
    usage: { i: 0, o: 0, cr: 0, cw: 0 },
  }
}

/**
 * Streams a pi run's new output as this step's chunks, until pi ends or the
 * step's `deadline` passes: pi's text as text, its thinking as thinking, and
 * each tool it starts as a one-line `▸ tool: args` note in the text.
 *
 * Never throws: a throw here would hand the step to the model beneath, a
 * Claude subagent with Claude's tools, so a failure ends the run as text. An
 * aborted step kills pi, since a detached pi would outlive it.
 *
 * ponytail: no run time limit; pi runs until it ends or a step is aborted. A
 * subagent stopped between two steps leaves its pi to finish on its own.
 *
 * @param deadline when this step must stop streaming, in `$.clock` ms
 * @param signal the step's abort signal
 * @returns the text this step showed, how many content blocks it used, and
 *   the kind of the last one
 */
export async function* pump(
  $: EngineInterface,
  run: Run,
  deadline: number,
  signal: AbortSignal,
): AsyncGenerator<TurnStepChunk, { shown: string; blocks: number; lastKind?: 'text' | 'thinking' }> {
  let shown = ''
  let index = -1
  let kind: 'text' | 'thinking' | undefined
  let failure = ''
  let finished = false

  try {
    while (!run.ended && !signal.aborted && (await $.clock.now()) < deadline) {
      const { stdout } = await $.process.run([
        'sh',
        '-c',
        // Liveness first: once pi is gone the tail after it has every event.
        'kill -0 "$3" 2>/dev/null; alive=$?; tail -n +"$2" "$1" 2>/dev/null; [ $alive = 0 ] || printf "\\n{\\"k\\":\\"exited\\"}\\n"',
        'sh',
        run.events,
        String(run.read + 1),
        run.pid,
      ])
      const lines = stdout.split('\n')
      lines.pop() // the line still being written, or '' after a complete one
      for (const line of lines) {
        run.read += 1
        let event: { k: string; t?: string; model?: string; i?: number; o?: number; cr?: number; cw?: number }
        try {
          event = JSON.parse(line)
        } catch {
          continue
        }
        if (event.k === 'end' || event.k === 'exited') {
          run.ended = true
          continue
        }
        if (event.k === 'msg') {
          run.report = ''
          if (event.model) run.model = event.model
          continue
        }
        if (event.k === 'usage') {
          run.usage.i += event.i ?? 0
          run.usage.o += event.o ?? 0
          run.usage.cr += event.cr ?? 0
          run.usage.cw += event.cw ?? 0
          continue
        }
        const pieceKind = event.k === 'thinking' ? 'thinking' : 'text'
        const text = event.t ?? ''
        if (pieceKind !== kind) {
          kind = pieceKind
          index += 1
        }
        if (event.k === 'text') run.report += text
        if (pieceKind === 'text') shown += text
        yield { kind: pieceKind, index, text }
      }
      if (!run.ended) await $.clock.sleep(STREAM_POLL_MS)
    }
    finished = true
  } catch (err) {
    failure = `pi agent: the pi run failed: ${String(err)}`
    finished = true
  } finally {
    // Closed by the engine, or aborted: pi must not outlive the subagent.
    if (!run.ended && (!finished || signal.aborted)) {
      run.ended = true
      await $.process.run(['sh', '-c', 'pkill -f -- "--session-id $1 "; rm -f "$2" "$2.err"', 'sh', run.session, run.events])
        .catch(() => undefined)
    }
  }
  if (failure) run.ended = true

  if (run.ended) {
    if (!failure && !(run.shown + shown).trim()) {
      const { stdout: err } = await $.process.run(['sh', '-c', 'cat "$1.err" 2>/dev/null', 'sh', run.events])
        .catch(() => ({ stdout: '' }))
      // pi colours its errors; the escapes would show as noise in a transcript.
      const plain = err.replace(/\u001b\[[0-9;]*m/g, '').trim()
      failure = `pi ended with no answer.\n${plain || '(no stderr)'}`
    }
    if (failure) {
      shown += failure
      run.report = failure
      index += 1
      yield { kind: 'text', index, text: failure }
    }
    await $.process.run(['rm', '-f', run.events, `${run.events}.err`]).catch(() => undefined)
  }
  run.shown += shown
  return { shown, blocks: index + 1, lastKind: kind }
}

/**
 * Decides what to send pi this step, and whether its answer must be handed
 * back through HANDBACK_TOOL.
 *
 * The first step sends the spawn's prompt. A later one waits for a person's
 * message past the first `already` in `agentId`'s own transcript and sends the
 * newest. A follow-up (SendMessage, or typed into the agent's view) is only
 * found in `subagents/agent-<id>.jsonl` - `$.session.messages()` reads the main
 * loop's - and the engine can start the step before it writes the message
 * there, so this polls briefly.
 *
 * ponytail: finds the file by name under ~/.claude/projects; the id is unique,
 * but it leans on Claude Code's on-disk layout, not an API. Polls for up to
 * FOLLOW_UP_WAIT_MS; raise it if a slow disk drops follow-ups.
 *
 * @param seed the prompt the spawn was given
 * @param already how many of the person's messages pi has been sent
 */
export async function promptOf($: EngineInterface, agentId: string, seed: string, already: number) {
  for (let waited = 0; ; waited += POLL_MS) {
    const { texts, handback, bounced } = await transcriptOf($, agentId)
    if (already === 0) return { prompt: seed, count: Math.max(texts.length, 1), handback, bounced: false }
    if (texts.length > already) return { prompt: texts.at(-1), count: texts.length, handback, bounced: false }
    if (bounced) return { prompt: undefined, count: already, handback: true, bounced }
    if (waited >= FOLLOW_UP_WAIT_MS) return { prompt: undefined, count: already, handback, bounced }
    await $.clock.sleep(POLL_MS)
  }
}

/**
 * Reads `agentId`'s transcript: the text of every message the person (or the
 * spawn) sent it, oldest first; whether the engine asked it to hand its
 * report back through HANDBACK_TOOL; and whether the newest message is the
 * engine bouncing a report that was not.
 */
export async function transcriptOf($: EngineInterface, agentId: string) {
  const { stdout } = await $.process.run([
    'sh',
    '-c',
    'f=$(find "$HOME/.claude/projects" -name "agent-$1.jsonl" -print -quit) && [ -n "$f" ] && cat "$f"',
    'sh',
    agentId,
  ])
  const all = stdout
    .split('\n')
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return [] // the line Claude Code is still writing
      }
    })
    .filter((entry) => entry.type === 'user')
    .map((entry) => textOf(entry.message?.content))
    .filter(Boolean)
  return {
    texts: all.filter((text) => !ENGINE_PREFIXES.some((prefix) => text.startsWith(prefix))),
    handback: all.some((text) => text.includes(HANDBACK_TOOL)),
    bounced: all.at(-1)?.startsWith('[handback-send-enforce]') ?? false,
  }
}

/** Joins a message's text: a plain string, or the text blocks of a block list. */
export function textOf(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}
