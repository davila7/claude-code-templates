import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import { bubble, clean, holdFrames, parseClawd, persona, HELP } from './chat'
import { langOf, say, type Lang } from './say'
import { cheer, earned, onTurn, readGot, readStats, shelf, type Stats } from './badges'
import { addLines, candidates, dayKey, dueReminders, hhmm, items, minuteOf, noteLines, pickPrompt, readPicks, resolveAt, summary, takeOn, tick as tickItem, INBOX, NOTES, PICK_SYSTEM, REMINDERS, TODO, WARN_MIN, type Candidate, type NoteAsk } from './notes'
import { ACT_FRAMES, FRAME_MS, frameGrid, frameRows, H, hold, rewardScene, SIXSEVEN_FRAMES, type Mode, type Shown } from './scenes'
import { gridToSvg } from './svg'

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
// (no scene: the show plays on under the bubble)
let reaction: { scene?: string; say?: string; left: number; from: number } | undefined
let asked = 0 // /clawd commands so far: a reply to any but the latest is dropped
const running: { id: string; tool: string }[] = [] // tools in flight, newest last

const REACT_FRAMES = Math.round(6000 / FRAME_MS) // how long a /clawd action plays
const WAIT_FRAMES = Math.round(15_000 / FRAME_MS) // the most Clawd ponders before a reply
const REMIND_CHECK_MS = 30_000 // how often the notebook is read for reminders due
const NUDGE_MS = 30 * 60_000 // the least time between two "next up" bubbles at a turn's start
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
const react = async ($: Engine, scene: string | undefined, say?: string, frames = REACT_FRAMES) => {
  reaction = { scene, say, left: frames, from: (await read($, frame)) + 1 }
  return tick($)
}

/** The notebook: ~/.claude/clawd-notes.md. */
const notesPath = async ($: Engine) => {
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  if (!home) throw new Error('no HOME to keep it in')
  return `${home}/.claude/clawd-notes.md`
}

let notebook: Promise<unknown> = Promise.resolve() // edits one at a time, so none is lost to another
/** Reads the notebook, writes what `change` makes of it (undefined: leave it), and resolves the text it ends with. */
const edit = ($: Engine, change: (md: string) => string | undefined = () => undefined): Promise<string> => {
  const run = notebook.then(async () => {
    const path = await notesPath($)
    // only a missing file reads as empty: a read that fails must not be written over
    const md = (await $.fs.exists(path)) ? String(await $.fs.read(path)) : ''
    const next = change(md)
    if (next !== undefined && next !== md) await $.fs.write(path, next)
    return next ?? md
  })
  notebook = run.catch(() => undefined)
  return run
}

let perks: ReadonlySet<string> = new Set() // the badges earned, which dress Clawd in their rewards
let counting: Promise<unknown> = Promise.resolve() // one count at a time, so none is lost to another
/**
 * Moves the badge counts on by `change` and cheers any badge that earns, in the notebook's
 * language; never awaited by the caller, and a store that fails only misses the count.
 */
const tally = ($: Engine, change: (s: Stats) => Stats) => {
  const run = counting.then(async () => {
    const s = change(readStats(await $.store.get('stats')))
    await $.store.set('stats', s)
    const got = readGot(await $.store.get('badges'))
    const fresh = earned(s, got)
    if (fresh.length) await $.store.set('badges', { ...got, ...Object.fromEntries(fresh.map(b => [b.id, s.day || 'yes'])) })
    perks = new Set([...perks, ...fresh.map(b => b.id)])
    return fresh
  })
  counting = run.catch(() => undefined)
  $.clock.after(1, async () => {
    const fresh = await run.catch(() => [])
    if (!fresh.length) return
    const line = cheer(fresh, langOf(await edit($).catch(() => '')))
    $.ui.toast(`Clawd: ${line}`, { timeoutMs: 15_000 })
    // a badge with a costume shows it off in its scene; any other, under the disco ball
    await react($, fresh.map(b => rewardScene(b.id)).find(Boolean) ?? 'disco', line, holdFrames(line))
  })
}

/** Reads the badges earned from the store, for the costumes they bring; none when the store will not say. */
const loadPerks = async ($: Engine) => {
  try {
    perks = new Set(Object.keys(readGot(await $.store.get('badges'))))
  } catch {
    // no store: Clawd goes without its rewards this session
  }
}

/** What /clawd badges shows: the badges earned and the closest one to go. */
const showBadges = async ($: Engine) => {
  const lang = langOf(await edit($).catch(() => ''))
  let line: string
  try {
    line = shelf(readStats(await $.store.get('stats')), readGot(await $.store.get('badges')), lang)
  } catch {
    line = lang === 'zh' ? '徽章櫃打不開，等等再試。' : 'My badge shelf is stuck. Try again soon?'
  }
  await react($, 'juggle', line, holdFrames(line))
}

let turnStartedAt = 0 // for the marathon badge: lost on a reload, so a reloaded turn does not count

let suggested: Candidate[] = [] // what the last /clawd plan offered, for /clawd plan ok

/** Asks Haiku which of the open todos to take on today, and offers them in the bubble. */
const suggest = async ($: Engine, now: Date, id: number, lang: Lang) => {
  const day = dayKey(now)
  const md = await edit($)
  const cands = candidates(md, day)
  if (!cands.length) {
    suggested = []
    return say(lang).nothingWaiting
  }
  const reminders = items(md, day, REMINDERS).filter(it => !it.isDone).map(it => it.text)
  let answer = ''
  try {
    const prompt = pickPrompt(cands, day, hhmm(minuteOf(now)), reminders)
    const r = await $.model.complete({ model: 'haiku', system: PICK_SYSTEM, prompt, maxTokens: 150, timeoutMs: 15_000 })
    if (r.isAnswered) answer = r.text
  } catch {
    // the model would not answer: the oldest ones are picked instead
  }
  if (id !== asked) return undefined // a newer /clawd took the stage meanwhile
  const { picks, why } = readPicks(answer, cands.length)
  suggested = picks.map(i => cands[i]!)
  return say(lang).offer(suggested.map((c, i) => `${i + 1}. ${c.text}`).join(' '), clean(why))
}

const USAGE = { note: 'usageNote', todo: 'usageTodo', plan: 'usagePlan', done: 'usageDone', remind: 'usageRemind' } as const

/** The language Clawd answers a note command in: its text's, or the notebook's when it has none. */
const langFor = async ($: Engine, ask: NoteAsk) => {
  const text = ask.kind === 'plan' ? ask.items.join(' ') : 'text' in ask ? ask.text : ''
  return langOf(text || (await edit($).catch(() => '')))
}

/** Does what a note command asks and says so in Clawd's bubble. */
const keepNotes = async ($: Engine, ask: NoteAsk) => {
  const id = ++asked // a chat reply still on its way no longer takes the bubble
  const lang = await langFor($, ask)
  const s = say(lang)
  if (ask.kind === 'usage') return react($, 'wave', s[USAGE[ask.of]], holdFrames(s[USAGE[ask.of]]))
  const now = new Date(await $.clock.now())
  const day = dayKey(now)
  let scene = 'sketch'
  let line = ''
  try {
    const texts = ask.kind === 'plan' ? ask.items.map(clean) : 'text' in ask ? [clean(ask.text)] : []
    if (texts.some(t => !t)) [scene, line] = ['wave', s.empty]
    else if (ask.kind === 'note') {
      await edit($, md => addLines(md, day, NOTES, [`- ${hhmm(minuteOf(now))} ${clean(ask.text)}`]))
      line = s.noted
      tally($, st => ({ ...st, notes: st.notes + 1 }))
    } else if (ask.kind === 'todo') {
      await edit($, md => addLines(md, INBOX, TODO, [`- [ ] ${clean(ask.text)}`]))
      line = s.savedLater
    } else if (ask.kind === 'suggest') {
      await react($, 'ponder', '· · ·', WAIT_FRAMES)
      const offer = await suggest($, now, id, lang)
      if (offer === undefined) return
      ;[scene, line] = [suggested.length ? 'chalk' : 'wave', offer]
    } else if (ask.kind === 'accept') {
      const taken = ask.picks ? ask.picks.map(n => suggested[n - 1]).filter(c => c !== undefined) : suggested
      if (!taken.length) [scene, line] = ['wave', suggested.length ? s.badPicks : s.askFirst]
      else {
        let count = 0
        await edit($, md => {
          const r = takeOn(md, day, taken)
          count = r.count
          return r.md
        })
        suggested = suggested.filter(c => !taken.includes(c))
        ;[scene, line] = count ? ['chalk', s.taken(count)] : ['wave', s.takenAlready]
      }
    } else if (ask.kind === 'plan') {
      await edit($, md => addLines(md, day, TODO, ask.items.map(i => `- [ ] ${clean(i)}`)))
      ;[scene, line] = ['chalk', s.planned(ask.items.length)]
    } else if (ask.kind === 'remind') {
      const at = resolveAt(ask.when, now)
      if (typeof at === 'string') [scene, line] = ['wave', at === 'notTime' || at === 'passed' ? s[at](ask.when) : s[at]]
      else {
        await edit($, md => addLines(md, day, REMINDERS, [`- [ ] ${hhmm(at)} ${clean(ask.text)}`]))
        // set inside the warning window: just said, so only the call when due is left
        if (at - minuteOf(now) <= WARN_MIN) warned.add(`${day} ${at} ${clean(ask.text)}`)
        tally($, st => ({ ...st, reminders: st.reminders + 1 }))
        ;[scene, line] = ['type', s.remindSet(hhmm(at), clean(ask.text))]
      }
    } else if (ask.kind === 'done') {
      let [isTicked, isCleared] = [false, false]
      await edit($, md => {
        const todo = items(md, day, TODO)
        const n = ask.n ? ask.n - 1 : todo.findIndex(t => !t.isDone)
        if (!todo[n]) return void ([scene, line] = ['wave', ask.n ? s.noTodo(ask.n) : s.nothingLeft])
        if (todo[n].isDone) return void ([scene, line] = ['wave', s.already(todo[n].text)])
        const left = todo.filter(t => !t.isDone).length - 1
        ;[scene, line] = left ? ['dance', s.doneLeft(todo[n].text, left)] : ['disco', s.allDone]
        isCleared = !left && todo.length >= 3
        isTicked = true
        return tickItem(md, day, TODO, n)
      })
      if (isTicked) tally($, st => ({ ...st, todosDone: st.todosDone + 1, clearDays: st.clearDays + (isCleared ? 1 : 0) }))
    } else if (ask.kind === 'notes') {
      const notes = noteLines(await edit($), day)
      ;[scene, line] = ['think', notes.length ? s.notes(notes.join(' · ')) : s.noNotes]
    } else [scene, line] = ['think', summary(await edit($), day, lang)]
  } catch (err) {
    ;[scene, line] = ['wave', s.noNotebook(err instanceof Error ? err.message : String(err))]
  }
  return react($, scene, line, holdFrames(line))
}

const warned = new Set<string>() // reminders called out ahead already
/** Calls out the reminders coming up or due, ticking the due ones off so no session calls them twice. */
const remind = async ($: Engine) => {
  const now = new Date(await $.clock.now())
  const day = dayKey(now)
  const min = minuteOf(now)
  const calls: string[] = []
  try {
    await edit($, md => {
      let out = md
      for (const due of dueReminders(md, day, min)) {
        const key = `${day} ${due.at} ${due.text}`
        const s = say(langOf(due.text))
        if (due.isNow) {
          out = tickItem(out, day, REMINDERS, due.n) ?? out
          // one missed while Claude Code was closed says when it was
          calls.push(min - due.at > 1 ? s.missed(hhmm(due.at), due.text) : s.now(due.text))
        } else if (!warned.has(key)) {
          warned.add(key)
          calls.push(s.inMin(due.at - min, due.text))
        }
      }
      return out
    })
  } catch {
    return // no notebook to read: nothing to call out, the next check tries again
  }
  if (!calls.length) return
  const call = calls.join(' · ')
  $.ui.toast(`Clawd: ${call}`, { timeoutMs: 15_000 })
  await react($, 'honk', call, holdFrames(call))
}

let nudgedAt = -Infinity
/** At a turn's start, now and then, says the next open todo over the show. */
const nudge = async ($: Engine) => {
  const now = await $.clock.now()
  if (now - nudgedAt < NUDGE_MS) return
  nudgedAt = now // read the notebook at most every NUDGE_MS, todos or not
  let md: string
  try {
    md = await edit($)
  } catch {
    return
  }
  const next = items(md, dayKey(new Date(now)), TODO).find(t => !t.isDone)
  if (!next || reaction) return // nothing to do, or a /clawd reaction holds the stage
  await react($, undefined, say(langOf(next.text)).nextUp(next.text))
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
    $.clock.every(REMIND_CHECK_MS, () => remind($))
    $.clock.after(1, () => loadPerks($))
    $.clock.every(FRAME_MS, () => {
      const isReacting = reaction !== undefined
      if (reaction && --reaction.left <= 0) reaction = undefined
      // a reaction redraws between turns too, one last time as it ends so the stage goes
      return isTurnRunning || isReacting ? tick($) : undefined
    })
    // last, so the timers run whatever happens here; immediate: /clawd runs mid-turn instead of waiting
    await $.command.register({ name: 'clawd', description: 'Pet, feed or wave at Clawd, or say something to it', argumentHint: '[pet|feed|wave|dance|shift|67|note|notes|todo|plan|done|list|remind|message]', immediate: true })
    return r
  })

  // Answers in Clawd's bubble only: no transcript line, so nothing of it reaches Claude
  on('command.run', { command: 'clawd' }, async ($, e) => {
    const id = ++asked
    const ask = parseClawd(e.args)
    const action = 'action' in ask ? ask.action : ''
    tally($, s => ({ ...s, hellos: s.hellos + 1, pets: s.pets + (action === 'pet' ? 1 : 0), feeds: s.feeds + (action === 'feed' ? 1 : 0) }))
    if ('help' in ask) await react($, 'wave', HELP)
    else if ('badges' in ask) $.clock.after(1, () => showBadges($))
    else if ('action' in ask) await react($, ask.action, undefined, ask.action === 'sixseven' ? SIXSEVEN_FRAMES : undefined) // 67 runs through all its gears
    else if ('notes' in ask) $.clock.after(1, () => keepNotes($, ask.notes)) // on a timer: the prompt never waits on the file
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
    $.clock.after(1, () => nudge($))
    if (!e.agentId) {
      // the main loop's turns only: a subagent's would count one job many times
      const now = await $.clock.now()
      turnStartedAt = now
      tally($, s => onTurn(s, dayKey(new Date(now)), new Date(now).getHours()))
    }
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
    if (turnStartedAt) {
      const minutes = Math.floor(((await $.clock.now()) - turnStartedAt) / 60_000)
      turnStartedAt = 0
      tally($, s => ({ ...s, longestTurnMin: Math.max(s.longestTurnMin, minutes) }))
    }
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
    // maxRows is read-only: the engine stacks each plugin's row itself (AbovePromptList)
    const below = await next(e)

    const { Box, Text } = $.ui.resolve(e)
    // resolved again where e.surface is narrowed: only the terminal's table lacks Svg
    const Svg = e.surface === 'terminal' ? null : $.ui.resolve(e).Svg
    shown = hold(shown, turnBase, { word, mode, tick: t - turnBase, seed, played, tool: running[running.length - 1]?.tool })
    // a reaction counts its own frames, so a move like shift opens on its first one
    const at = reaction?.scene ? Math.max(0, t - reaction.from) : t
    const scene = reaction?.scene ?? shown.scene
    return (
      <Box flexDirection="column">
        {said.map(line => (
          <Text mono color="white">{line}</Text>
        ))}
        {Svg ? (
          // Desktop, VS Code, mobile: text there is proportional with line gaps, so the stage is drawn as rects
          <Svg source={gridToSvg(frameGrid(word, mode, at, width, scene, true, perks))} alt="Clawd" />
        ) : (
          <Box flexDirection="column" height={H}>
            {frameRows(word, mode, at, width, scene, true, perks).map(runs => (
              <Text>
                {runs.map(r => (r.color ? <Text color={r.color} backgroundColor={r.bg}>{r.text}</Text> : r.text))}
              </Text>
            ))}
          </Box>
        )}
        {below}
      </Box>
    )
  })
}
