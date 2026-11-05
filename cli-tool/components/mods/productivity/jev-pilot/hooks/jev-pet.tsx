/**
 * jev-pet — Jev as a companion above the prompt, at the right: Claude the
 * pilot (Claude Code's character in pilot gear), with a speech bubble saying what Jev just
 * decided, so the decisions stay out of the conversation. It also owns
 * `/jev`, the switches for every part of jev-pilot.
 *
 * While a turn runs the pilot shows what Claude is doing, and the bubble says
 * it beside a spinner: thinking (a thought cloud), reading (a book),
 * searching (a magnifier), writing (paper and a pencil), running a command
 * (a terminal), anything else (a subagent) flying, goggles down. With
 * subagents still working in the background after a turn, it cruises,
 * goggles down, until they finish; at max effort the goggles stay down for
 * the turn. Idle, it hovers, its scarf's end dipping every few seconds; it
 * blinks, and every few seconds plays for a moment: jumps rope, waves, looks
 * around. Resting, it redraws only when something moves.
 *
 * The router and the skill module set what it says (pet-art.ts `say`) and ask
 * for a redraw; this module draws it, in the `AbovePrompt` band on the
 * terminal. Nothing draws in `claude -p`, the desktop app or mobile.
 */
import type { Register, Timer } from 'claude-code'
import {
  describeFeatures,
  feature,
  FEATURE_INFO,
  featureOverrides,
  loadFeatureOverrides,
  parseJevCommand,
  setFeature,
} from './features.ts'
import {
  type Act,
  ACT_LABEL,
  actOfTool,
  currentSpeech,
  isBoosted,
  MOOD_COLOR,
  PLAY_FRAMES,
  PLAYS,
  SCARF_CYCLE,
  sceneRows,
  setBoost,
  WORK_ACTS,
} from './pet-art.ts'

const FEATURES_KEY = 'features'
const FLY_MS = 200
// Background subagents still working, no turn running: the pilot cruises,
// goggles down, at a calmer rate; running agents are checked this often.
const CRUISE_MS = 450
const AGENTS_EVERY_MS = 1500
const WIND_MS = 1000
const BLINK_EVERY_MS = 4600
const BLINK_MS = 170
const PLAY_EVERY_MS = 9000
const PLAY_STEP_MS = 180
/** How many loops each idle play runs for: about three seconds each. */
const PLAY_LOOPS = { rope: 4, wave: 4, look: 2 } as const
const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

export const register: Register = (on) => {
  let act: Act = 'rest'
  let frame = 0
  let blink = false
  let workingTurn: string | null = null
  let flying: Timer | null = null
  let blinker: Timer | null = null
  let player: Timer | null = null
  let playing: Timer | null = null
  let plays = 0
  let wind = 0
  let breeze: Timer | null = null
  let cruising: Timer | null = null
  let watcher: Timer | null = null
  // The main loop's tool calls in flight, each with the act it shows.
  const running = new Map<string, Act>()
  let calls = 0

  const stopPlay = () => {
    playing?.cancel()
    playing = null
  }
  const stopCruise = () => {
    cruising?.cancel()
    cruising = null
  }

  // Session setup: the saved switches, the /jev command, the blink. (Under a
  // match-all matcher: the router hooks session.start too, one unmatched
  // registration per plugin.)
  on('session.start', { cwd: /(?:)/ }, async ($, e, next) => {
    const result = await next(e)
    loadFeatureOverrides(await $.store.get(FEATURES_KEY).catch(() => undefined))
    await $.command
      .register({
        name: 'jev',
        description: 'jev-pilot switches: /jev shows them, /jev <effort|raise|subagents|skills|strategy|model|pet> on|off',
        argumentHint: '[<feature> on|off | all on|off | reset]',
        immediate: true,
      })
      .catch((error) => $.ui.log(`[jev-pilot] /jev not registered: ${String(error)}`))
    blinker?.cancel()
    blinker = $.clock.every(BLINK_EVERY_MS, () => {
      if (!feature('pet') || workingTurn || playing || cruising) return
      blink = true
      $.ui.invalidate('ui.render')
      $.clock.after(BLINK_MS, () => {
        blink = false
        $.ui.invalidate('ui.render')
      })
    })
    // The scarf's end dips in the wind, one step in SCARF_CYCLE. (Working or
    // playing, the frame timer redraws anyway; resting, only a dip and its
    // return redraw.)
    breeze?.cancel()
    breeze = $.clock.every(WIND_MS, () => {
      if (!feature('pet')) return
      wind++
      const step = wind % SCARF_CYCLE
      if (!workingTurn && !playing && !cruising && (step === SCARF_CYCLE - 1 || step === 0)) $.ui.invalidate('ui.render')
    })
    // Idle play: every few seconds one of the plays, in turn, for a moment.
    player?.cancel()
    player = $.clock.every(PLAY_EVERY_MS, () => {
      if (!feature('pet') || workingTurn || playing || cruising) return
      const play = PLAYS[plays++ % PLAYS.length] as (typeof PLAYS)[number]
      const steps = PLAY_FRAMES[play] * PLAY_LOOPS[play]
      act = play
      frame = 0
      playing = $.clock.every(PLAY_STEP_MS, () => {
        frame++
        if (frame >= steps) {
          stopPlay()
          act = 'rest'
          frame = 0
        }
        $.ui.invalidate('ui.render')
      })
      $.ui.invalidate('ui.render')
    })
    // Subagents working in the background, with no turn running: the pilot
    // cruises until they are all done. Asked of the engine every few seconds,
    // so one that was stopped or failed never leaves it flying.
    watcher?.cancel()
    watcher = $.clock.every(AGENTS_EVERY_MS, async () => {
      if (!feature('pet')) return
      let busy = false
      try {
        busy = (await $.agent.list()).some((agent) => agent.status === 'running')
      } catch {
        busy = false
      }
      if (busy && !workingTurn && !cruising) {
        stopPlay()
        act = 'fly'
        frame = 0
        cruising = $.clock.every(CRUISE_MS, () => {
          frame++
          $.ui.invalidate('ui.render')
        })
      } else if (!busy && cruising) {
        stopCruise()
        if (!workingTurn) {
          act = 'rest'
          frame = 0
          $.ui.invalidate('ui.render')
        }
      }
    })
    return result
  })

  // A new session in this worker (/clear, resume): the old timers stop.
  on('session.end', { reason: /(?:)/ }, async ($, e, next) => {
    flying?.cancel()
    flying = null
    stopPlay()
    stopCruise()
    setBoost(false)
    act = 'rest'
    workingTurn = null
    running.clear()
    return next(e)
  })

  on('command.run', { command: 'jev' }, async ($, e) => {
    const command = parseJevCommand(e.args)
    if (command.kind === 'unknown') {
      return { text: `jev-pilot: unknown "${command.text}".\n${describeFeatures()}` }
    }
    if (command.kind === 'reset') loadFeatureOverrides({})
    if (command.kind === 'set') for (const name of command.features) setFeature(name, command.on)
    if (command.kind !== 'status') {
      await $.store.set(FEATURES_KEY, featureOverrides()).catch((error) => $.ui.log(`[jev-pilot] switches not saved: ${String(error)}`))
      $.ui.invalidate('ui.render')
    }
    if (command.kind === 'set' && command.features.length === 1) {
      const name = command.features[0] as keyof typeof FEATURE_INFO
      return { text: `jev-pilot: ${name} ${command.on ? 'on' : 'off'} (${FEATURE_INFO[name]}) · /jev ${name} ${command.on ? 'off' : 'on'} undoes it` }
    }
    return { text: describeFeatures() }
  })

  // While a turn runs, the pilot shows what Claude is doing: thinking first.
  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    workingTurn = e.turnId
    flying?.cancel()
    stopPlay()
    stopCruise()
    setBoost(false)
    running.clear()
    act = 'think'
    frame = 0
    flying = $.clock.every(FLY_MS, () => {
      if (!feature('pet')) return
      frame++
      $.ui.invalidate('ui.render')
    })
    return result
  })

  // The model's response as it streams: thinking shows as thinking, the
  // answer's text as writing. Observed only: every chunk passes on as it came.
  on('turn.step', { turnId: /(?:)/ }, async function* ($, e, next) {
    if (e.agentId || e.turnId !== workingTurn) return yield* next(e)
    if (running.size === 0) act = 'think'
    for await (const chunk of next(e)) {
      if (running.size === 0) {
        if (chunk.kind === 'thinking') act = 'think'
        else if (chunk.kind === 'text') act = 'write'
      }
      yield chunk
    }
  })

  // A main-loop tool call shows what the tool does: reading, searching,
  // editing, running a command; anything else (a subagent) flies. When it is
  // done, the next call still running shows, or thinking.
  on('tool.call', { tool: /(?:)/ }, async ($, e, next) => {
    if (e.agentId || !workingTurn) return next(e)
    const id = e.tool_use_id ?? `call-${++calls}`
    act = actOfTool(e.tool)
    running.set(id, act)
    try {
      return await next(e)
    } finally {
      running.delete(id)
      if (workingTurn) act = [...running.values()].at(-1) ?? 'think'
    }
  })

  on('turn.complete', { turnId: /(?:)/ }, async ($, e, next) => {
    const result = await next(e)
    if (e.turnId === workingTurn) {
      running.clear()
      workingTurn = null
      flying?.cancel()
      flying = null
      setBoost(false)
      act = 'rest'
      frame = 0
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!feature('pet') || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    // The band's own width: the transcript column's while a Pane is docked.
    const columns = e.props.bodyColumns || (e.viewport?.columns ?? 80)
    const speech = currentSpeech()
    const color = MOOD_COLOR[speech.mood]
    // Goggles down when flying, and at full power (effort raised to max).
    const rows = sceneRows(act, frame, blink, wind, act === 'fly' || isBoosted())
    const working = (WORK_ACTS as readonly Act[]).includes(act)
    const text = working ? `${SPINNER[frame % SPINNER.length]} ${ACT_LABEL[act as (typeof WORK_ACTS)[number]]} · ${speech.text}` : speech.text
    return (
      <Box flexDirection="column">
        <Box key="jev:pet" flexDirection="row" justifyContent="flex-end" alignItems="center" columnGap={1} width={columns} paddingRight={4}>
          <Box key="jev:bubble" borderStyle="round" borderColor={color} paddingX={1}>
            <Text key="jev:say" color={color} wrap="truncate-end">
              {text}
            </Text>
          </Box>
          <Box key="jev:sprite" flexDirection="column">
            {rows.map((row, y) => (
              <Text key={`jev:row${y}`}>
                {row.map((cell, x) => (
                  <Text key={`jev:${y}:${x}`} color={cell.fg} backgroundColor={cell.bg}>
                    {cell.ch}
                  </Text>
                ))}
              </Text>
            ))}
          </Box>
        </Box>
        {await next(e)}
      </Box>
    )
  })
}
