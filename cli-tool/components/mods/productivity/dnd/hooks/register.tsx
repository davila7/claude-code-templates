import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register, SessionReceiveOrigin, Timer } from 'claude-code'

import type { Dnd, Held } from '../types'
import { batchText, dropNotice, hold, localZones, messages, senderLabel } from './hold'

// One value, so each change of the end and the held list is a single write.
const dnd = atom({ plugin: 'dnd', key: 'state' } as const, { until: null, held: [] } as Dnd)
const MINUTES = 30
const ARGS = '[minutes | off]'
// Prompts the engine queues from outside, not typed by the operator.
const HELD_PROMPTS: readonly PromptOrigin['kind'][] = ['task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay']

// The one expiry timer; a reload drops it and session.start arms it again.
let timer: Timer | undefined
// The store key of the session a /clear ended; the next load moves its list over.
let clearedKey: string | undefined
// Store writes, run one at a time.
let writes: Promise<unknown> = Promise.resolve()
// The lists of summaries on their way into the session; the store keeps them until they entered.
let sending: (readonly Held[])[] = []

// A stored message whose summary is on its way already: kept there for a reload, not delivered twice.
function isSending(item: Held) {
  return sending.some(list => list.some(held => held.from === item.from && held.at === item.at && held.text === item.text))
}

async function storeKey($: EngineInterface) {
  return `held:${await $.session.id()}`
}

// What the store holds under a key: the state, or a bare held list as an older version wrote it.
function storedState(stored: unknown): Dnd | undefined {
  if (Array.isArray(stored)) {
    return { until: null, held: stored as Held[] }
  }

  return typeof stored === 'object' && stored !== null && Array.isArray((stored as Dnd).held) ? (stored as Dnd) : undefined
}

// Takes the end and the held list back from the store, so DND outlives /clear and a reload.
// Only the session a /clear starts (`afterClear`) takes over the list the cleared one left.
async function load($: EngineInterface, afterClear = false) {
  const key = await storeKey($)
  const cleared = afterClear ? clearedKey : undefined
  const keys = cleared === undefined || cleared === key ? [key] : [cleared, key]
  if (afterClear) {
    clearedKey = undefined
  }
  for (const from of keys) {
    const stored = storedState(await $.store.get(from))
    if (stored !== undefined) {
      const held = stored.held.filter(item => !isSending(item))
      await update($, dnd, state => ({ until: state.until ?? stored.until ?? null, held: held.reduce(hold, state.held) }))
    }
  }
  await persist($)
  if (keys[0] !== key) {
    await $.store.delete(keys[0] ?? key)
  }
  // A list that comes back without an end (an older version's, or a summary a reload cut off) is delivered now.
  const { until, held } = await read($, dnd)
  if (until === null && held.length > 0) {
    await release($, null)
    return
  }
  // An end already past is released by the timer at once.
  await arm($)
  await showStatus($)
}

// Writes the state as it is when its turn comes, so a write from before a later change never lands last.
// A summary still on its way stays in the store with it: a reload before it entered delivers it on load.
async function persist($: EngineInterface) {
  const write = writes.then(async () => {
    const key = await storeKey($)
    const state = await read($, dnd)
    const held = sending.flat().reduce(hold, state.held)
    await (state.until === null && held.length === 0 ? $.store.delete(key) : $.store.set(key, { ...state, held }))
  })
  writes = write.catch(() => undefined)
  await write
}

async function showStatus($: EngineInterface) {
  const { until, held } = await read($, dnd)
  $.ui.status(until === null ? undefined : `🔕 DND · ${held.length} waiting`)
}

async function arm($: EngineInterface) {
  timer?.cancel()
  timer = undefined
  const end = (await read($, dnd)).until
  if (end !== null) {
    timer = $.clock.after(Math.max(0, end - (await $.clock.now())), () => checkExpiry($))
  }
}

async function checkExpiry($: EngineInterface) {
  const end = (await read($, dnd)).until
  if (end !== null && (await $.clock.now()) >= end) {
    tellReleased($, await release($, end))
  } else {
    await arm($)
  }
}

async function enable($: EngineInterface, end: number) {
  await update($, dnd, state => ({ ...state, until: end }))
  await persist($)
  await arm($)
  await showStatus($)
}

// Ends DND and delivers everything held as one message. With `end` (null for a list stored
// without one), only while DND still ends then: a timer that fired before a new /dnd leaves
// the new one alone. Resolves to the count delivered; undefined when nothing ended.
async function release($: EngineInterface, end?: number | null): Promise<number | undefined> {
  // Taken, emptied and switched off in one write, so two releases at once deliver it once
  // and a message kept at the same moment is either in this list or passes on its own.
  let list: Held[] | undefined
  await update($, dnd, state => {
    const ends = end === undefined ? state.until !== null || state.held.length > 0 : state.until === end
    list = ends ? state.held : undefined
    return list === undefined ? state : { until: null, held: [] }
  })
  await arm($)
  if (list === undefined) {
    return undefined
  }
  const batch = list
  if (batch.length > 0) {
    sending = [...sending, batch]
  }
  await persist($)
  await showStatus($)
  if (batch.length > 0) {
    const text = batchText(batch, localZones(await $.env.get('TZ')))
    // Never submitted from the hook itself: a command.run hook holds the turn the submit waits for.
    $.clock.after(0, () => deliver($, text, batch))
  }

  return batch.length
}

// Submits a release's summary; once it entered, its messages leave the store. A refused one puts
// them back among the held messages (DND stays off), for /dnd off or the next load to deliver.
async function deliver($: EngineInterface, text: string, batch: readonly Held[]) {
  const entered = await $.prompt.submit({ text }).then(
    result => result.drop === undefined,
    () => false,
  )
  sending = sending.filter(list => list !== batch)
  if (!entered) {
    await update($, dnd, state => ({ ...state, held: batch.reduce(hold, state.held) }))
    $.ui.toast(`DND: the summary was refused, ${messages(batch.length)} kept; /dnd off delivers them`)
  }
  await persist($)
}

// Confirms a release that ran; one that found DND already ended says nothing, so two at once toast once.
function tellReleased($: EngineInterface, delivered: number | undefined) {
  if (delivered !== undefined) {
    $.ui.toast(delivered > 0 ? `DND off, delivering ${messages(delivered)}` : 'DND off, nothing was waiting')
  }
}

// Holds a message while DND is on, checked in the same write; false when it has ended
// meanwhile and the message must go on.
async function keep($: EngineInterface, from: string, text: string) {
  const item: Held = { from, at: await $.clock.now(), text }
  let kept = false
  await update($, dnd, state => {
    kept = state.until !== null
    return kept ? { ...state, held: hold(state.held, item) } : state
  })
  if (kept) {
    await persist($)
    await showStatus($)
  }

  return kept
}

function senderOf(origin: SessionReceiveOrigin) {
  // Named after its kind like every sender, so a teammate called "operator" isn't one. An unverified
  // mailbox entry says so: its name is whatever the writer of the team's inbox file put there.
  if ('teammate' in origin) {
    return `${origin.kind} · ${origin.teammate}${origin.isVerified ? '' : ' (unverified)'}`
  }

  return 'plugin' in origin && origin.plugin !== undefined ? `${origin.kind} (${origin.plugin})` : origin.kind
}

async function runCommand($: EngineInterface, args: string) {
  const arg = args.trim()
  const isOn = (await read($, dnd)).until !== null
  if (arg === 'off' || (arg === '' && isOn)) {
    tellReleased($, await release($))
    return {}
  }
  const minutes = arg === '' ? MINUTES : Number(arg)
  // A length whose end overflows could never run out, and one too small to move the end past now ends at once.
  const now = await $.clock.now()
  const end = now + minutes * 60_000
  if (!(minutes > 0) || !Number.isFinite(end) || end <= now) {
    return { text: `Usage: /dnd ${ARGS}` }
  }
  await enable($, end)
  $.ui.toast(`DND on for ${minutes} min, /dnd turns it off`)

  return {}
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dnd',
      description: 'Do Not Disturb: hold outside messages, deliver them when it ends',
      argumentHint: ARGS,
      immediate: true,
    })
    await load($)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      clearedKey = `held:${e.sessionId}`
    }

    return next(e)
  })

  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') {
      await load($, e.source === 'clear')
    }

    return next(e)
  })

  on('session.receive', async ($, e, next) => {
    // A subagent waits on its messages, and a Remote Control prompt is the operator's own.
    if ((await read($, dnd)).until === null || e.agentId !== undefined || e.origin.kind === 'bridge') {
      return next(e)
    }
    if (!(await keep($, senderOf(e.origin), e.text))) {
      return next(e)
    }

    return { consumed: 'dnd' }
  })

  on('prompt.submit', async ($, e, next) => {
    if ((await read($, dnd)).until === null || !HELD_PROMPTS.includes(e.origin.kind)) {
      return next(e)
    }
    const from = senderLabel(e.origin.kind, e.text)
    if (!(await keep($, from, e.text))) {
      return next(e)
    }

    return { drop: `dnd ${from}` }
  })

  on('session.append', { door: 'notice' }, async ($, e, next) => {
    const [first, ...rest] = e.message.content
    const text = first?.type === 'text' ? first.text : undefined
    const notice = typeof text === 'string' ? dropNotice(text, (await read($, dnd)).held.length) : undefined
    if (notice === undefined) {
      return next(e)
    }

    return next({ ...e, message: { ...e.message, content: [{ type: 'text', text: notice }, ...rest] } })
  })

  on('command.run', { command: 'dnd' }, async ($, e) => runCommand($, e.args))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const { until, held } = await read($, dnd)
    if (e.props.hasSurvey || until === null) {
      return below
    }
    const { Box, Button } = $.ui.resolve(e)
    const waiting = held.length

    return (
      <Box flexDirection="column">
        {below}
        <Button key="dnd" label={`🔕 DND · ${waiting} waiting · deliver`} plain onPress={async () => tellReleased($, await release($))} />
      </Box>
    )
  })
}
