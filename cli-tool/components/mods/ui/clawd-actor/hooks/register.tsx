import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import { bubble, clean, holdFrames, parseClawd, persona, HELP } from './chat'
import { ACT_FRAMES, FRAME_MS, frameRows, H, hold, type Mode, type Shown } from './scenes'

const MAX_STAGE = 60 // widest the wander roams, however wide the terminal
const frame = atom({ plugin: 'clawd-actor', key: 'frame' } as const, 0)
// The turn's show, kept in $.state too: a hot reload (/reload-plugins) loses module variables, not state
const show = atom({ plugin: 'clawd-actor', key: 'show' } as const, { isTurnRunning: false, turnBase: 0, seed: -1, played: 0 })

// The spinner's word, read while it draws. State cannot be written during a render,
// so it lives here; the frame timer's redraws pick it up.
let word = 'Thinking'
let mode: Mode = 'thinking'
let isTurnRunning = false
let turnBase = 0 // the frame the turn started on: acts count from it
let seed = 0 // shuffles the session's rotation of scenes
let played = 0 // rotation acts earlier turns got through
let shown: Shown | undefined // the scene on stage, held for its act
// What /clawd set going: a scene played over the show from frame `from`, and what Clawd says, for `left` more frames
let reaction: { scene: string; say?: string; left: number; from: number } | undefined
let asked = 0 // /clawd commands so far: a reply to any but the latest is dropped
const running: { id: string; tool: string }[] = [] // tools in flight, newest last

const REACT_FRAMES = Math.round(6000 / FRAME_MS) // how long a /clawd action plays
const WAIT_FRAMES = Math.round(15_000 / FRAME_MS) // the most Clawd ponders before a reply
const UPDATE_CHECK_MS = 2000 // after start-up settles, so the toast is seen
const LATEST = 'https://raw.githubusercontent.com/BrianHuang813/clawd-actor/main/.claude-plugin/plugin.json'
const RELEASES = 'https://github.com/BrianHuang813/clawd-actor/releases'
const RELEASE_API = 'https://api.github.com/repos/BrianHuang813/clawd-actor/releases/tags/v'

/** Whether dotted version `a` is past `b`, part by part (1.10.0 is past 1.9.2). */
export const isNewer = (a: string, b: string) => {
  const [x, y] = [a, b].map(v => v.split('.').map(Number))
  const i = x.findIndex((n, k) => n !== (y[k] ?? 0))
  return i >= 0 && x[i] > (y[i] ?? 0)
}

/** A release's headline, "lighter frames" from "clawd-actor 0.5.1 — lighter frames"; '' when GitHub cannot say. */
const headline = async ($: Engine, version: string) => {
  try {
    const res = await $.http.fetch(RELEASE_API + version)
    return (res.ok && String(JSON.parse(res.text).name ?? '').split(' — ')[1]) || ''
  } catch {
    return ''
  }
}

/**
 * Once a session: the first one after an update says what is new; any other, if main carries a
 * newer version than this install, says so and how to update.
 */
const checkForUpdate = async ($: Engine) => {
  try {
    const mine = JSON.parse(String(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))).version
    const seen = await $.store.get('version') // the version the last session ran
    if (seen !== mine) await $.store.set('version', mine)
    if (typeof seen === 'string' && isNewer(mine, seen)) {
      const what = await headline($, mine)
      $.ui.toast(`clawd-actor updated to ${mine}${what ? `: ${what}` : ''}. What's new: ${RELEASES}`, { timeoutMs: 15_000 })
      return
    }
    const res = await $.http.fetch(LATEST)
    const latest = res.ok ? JSON.parse(res.text).version : undefined
    if (latest && isNewer(latest, mine))
      $.ui.toast(`clawd-actor ${latest} is out (you have ${mine}): run /clawd-actor:update`, { timeoutMs: 15_000 })
  } catch {
    // offline, or the fetch is refused by policy: the check is a courtesy, the next session tries again
  }
}

/** Writes the turn's show through to $.state, for the module a reload brings in. */
const keep = ($: Engine) => update($, show, () => ({ isTurnRunning, turnBase, seed, played }))

/** Moves the show on a frame, which redraws the band. */
const tick = ($: Engine) => update($, frame, f => f + 1)

/** Plays `scene` from its start over the show for `frames` frames, Clawd saying `say`; redraws at once, even between turns. */
const react = async ($: Engine, scene: string, say?: string, frames = REACT_FRAMES) => {
  reaction = { scene, say, left: frames, from: (await read($, frame)) + 1 }
  return tick($)
}

/** What Claude is up to, for Clawd's system prompt. */
const status = () => {
  if (!isTurnRunning) return 'Claude is idle, waiting for the user.'
  const tool = running[running.length - 1]?.tool
  return `Claude is working (the spinner says "${word}"${tool ? `, the ${tool} tool is running` : ''}); you are acting out the "${shown?.scene ?? 'think'}" scene.`
}

/** Asks Haiku for Clawd's answer and puts it in the bubble; Claude's own conversation never sees either side. */
const reply = async ($: Engine, text: string, now: string, id: number) => {
  let say = 'Hmm, my words got lost on the way. Try again?'
  try {
    const r = await $.model.complete({ model: 'haiku', system: persona(now), prompt: text, maxTokens: 150, timeoutMs: 15_000 })
    if (r.isAnswered && clean(r.text)) say = clean(r.text)
  } catch {
    // the engine would not send it (a blocked model, say): Clawd still answers, with the line above
  }
  if (id === asked) await react($, 'say', say, holdFrames(say)) // else a newer /clawd took the stage meanwhile
}

export const register: Register = on => {
  // A timer must start where work may outlive the dispatch: session.start (fires again on reload).
  // It ticks all session long but only writes, and so redraws, while a turn runs.
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    // a reload mid-turn picks the show up where it was; a new session starts one
    ;({ isTurnRunning, turnBase, seed, played } = await read($, show))
    if (seed < 0) {
      seed = Math.floor(await $.clock.now()) % 9973
      await keep($)
    }
    $.clock.after(UPDATE_CHECK_MS, () => checkForUpdate($)) // on a timer: the session never waits on the network
    $.clock.every(FRAME_MS, () => {
      const isReacting = reaction !== undefined
      if (reaction && --reaction.left <= 0) reaction = undefined
      // a reaction redraws between turns too, one last time as it ends so the stage goes
      return isTurnRunning || isReacting ? tick($) : undefined
    })
    // last, so the timers run whatever happens here; immediate: /clawd runs mid-turn instead of waiting
    await $.command.register({ name: 'clawd', description: 'Pet, feed or wave at Clawd, or say something to it', argumentHint: '[pet|feed|wave|dance|shift|message]', immediate: true })
    return r
  })

  // Answers in Clawd's bubble only: no transcript line, so nothing of it reaches Claude
  on('command.run', { command: 'clawd' }, async ($, e) => {
    const id = ++asked
    const ask = parseClawd(e.args)
    if ('help' in ask) await react($, 'wave', HELP)
    else if ('action' in ask) await react($, ask.action)
    else {
      await react($, 'ponder', '· · ·', WAIT_FRAMES)
      const now = status()
      $.clock.after(1, () => reply($, ask.chat, now, id)) // on a timer: the prompt never waits on the model
    }
    return {}
  })

  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    turnBase = await read($, frame)
    running.length = 0
    await keep($)
    return next(e)
  })

  // While a tool runs Clawd acts it out; back to the rotation once it returns
  on('tool.call', async ($, e, next) => {
    running.push({ id: e.tool_use_id, tool: e.tool })
    try {
      return await next(e)
    } finally {
      const i = running.findIndex(r => r.id === e.tool_use_id)
      if (i >= 0) running.splice(i, 1)
    }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e) // a subagent's turn (a workflow's agents too): the main turn runs on
    isTurnRunning = false
    played += Math.floor(((await read($, frame)) - turnBase) / ACT_FRAMES) // acts after the opener
    await keep($)
    return next(e)
  })

  // Observe only: remember what the spinner says, let the engine draw it as usual
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    word = e.props.message ?? e.props.word
    mode = e.props.mode
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // read before any early return: the engine tracks the atoms a render reads and redelivers on
    // their writes — a gated return that reads nothing unregisters the frame dependency, and the
    // band would never redraw on its own again (the whole-turn blackout)
    const t = await read($, frame)
    // isWorking is the engine's own word on whether a turn runs — but not the turn itself: a
    // command's busy blink (a /reload-plugins, a plugin hot-reload's repaint) turns it on with no
    // turn started, and the band would flash Clawd for the one frame before the command ends.
    // isTurnRunning follows the turn; a /clawd reaction plays past both.
    if (e.props.hasSurvey || ((!e.props.isWorking || !isTurnRunning) && !reaction) || e.props.maxRows < H) return next(e)

    const width = Math.min(e.props.bodyColumns, MAX_STAGE)
    // the bubble needs its two border rows besides the text: left out when the band has no room for one line
    const room = Math.min(3, e.props.maxRows - H - 2)
    const said = reaction?.say && room > 0 ? bubble(reaction.say, width, room) : []
    // keep whatever other band mods draw here, in the rows Clawd leaves them
    const below = await next({ ...e, props: { ...e.props, maxRows: e.props.maxRows - H - said.length } })

    const { Box, Text } = $.ui.resolve(e)
    shown = hold(shown, turnBase, { word, mode, tick: t - turnBase, seed, played, tool: running[running.length - 1]?.tool })
    // a reaction counts its own frames, so a move like shift opens on its first one
    const rows = reaction ? frameRows(word, mode, Math.max(0, t - reaction.from), width, reaction.scene) : frameRows(word, mode, t, width, shown.scene)

    return (
      <Box flexDirection="column">
        {said.map(line => (
          <Text color="white">{line}</Text>
        ))}
        <Box flexDirection="column" height={H}>
          {rows.map(runs => (
            <Text>
              {runs.map(r => (r.color ? <Text color={r.color} backgroundColor={r.bg}>{r.text}</Text> : r.text))}
            </Text>
          ))}
        </Box>
        {below}
      </Box>
    )
  })
}
