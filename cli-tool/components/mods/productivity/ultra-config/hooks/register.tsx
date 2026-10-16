/**
 * ultra-config — Claude Mod
 *
 * A side pane with five profiles (Token saver, Fast flow, Max quality,
 * Guarded, Autopilot) that set Claude Code up for one way of working in one
 * press. Each profile opens to show exactly what it sets, with one button to
 * activate it.
 *
 *   `/ultra-config` opens it · `/ultra-config <profile>` opens that profile ·
 *   `/ultra-config apply <profile>` activates it · `/ultra-config undo`
 *   reverts the last one · `/ultra-config close` closes the pane
 *
 * `/config` rows are written with `$.config.set`, the way the menu writes
 * them; effort, the subagent model, env caps and deny rules (keys with no
 * `/config` row) are written to ~/.claude/settings.json, after a copy of the
 * file is saved beside it as settings.json.ultra-config.bak. Each activated
 * profile is kept in the plugin's store so `undo` puts back exactly what it
 * changed.
 *
 * Needs Claude Code >= 2.1.290 (Text weight and tabular).
 *
 * Options (pluginConfigs["ultra-config@skills-dir"].options):
 *   columns: number   width asked for the docked pane (default 62)
 */
import { atom, read, update } from 'claude-code'
import type { ConfigRow, EngineInterface, Register } from 'claude-code'

import type {
  UltraConfigBackup as Backup,
  UltraConfigEntry,
  UltraConfigSnapshot as Snapshot,
  UltraConfigUi,
} from '../types'
import {
  PROFILES,
  applySettings,
  getPath,
  inSync,
  matchOf,
  nb,
  pad,
  paneColumns,
  planFor,
  profileById,
  restorable,
  revertSettings,
  show,
  userSettingsPath,
} from './profiles.ts'
import type { Json, PlanItem, Profile } from './profiles.ts'

const PANE = 'ultra-config'
const COMMAND = 'ultra-config'
const STORE_HISTORY = 'history'
const KEEP = 20
/** How long a write waits for the engine to reload it, twice at most: 20 × 150 ms. */
const RELOAD_TRIES = 20
const RELOAD_STEP_MS = 150
const INK = '#141414'
const ACCENT = '#d97757'

type Host = EngineInterface

const ui = atom({ plugin: 'ultra-config', key: 'ui' } as const, {
  selected: null,
  notice: null,
  isBusy: false,
} satisfies UltraConfigUi)
const snapshot = atom({ plugin: 'ultra-config', key: 'snapshot' } as const, {
  rows: [],
  user: {},
  path: null,
  error: null,
} satisfies Snapshot)
const history = atom({ plugin: 'ultra-config', key: 'history' } as const, [] as Backup[])

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err))

// This module holds every call on `$`; profiles.ts is pure.

/** Reads the settings file, or says why it can't be trusted for a write. */
async function readUser($: Host, path: string | null): Promise<{ user: Json; text: string | null; error: string | null }> {
  if (path === null) return { user: {}, text: null, error: 'no home directory to find settings.json in' }
  let text: string
  try {
    text = await $.fs.read(path)
  } catch {
    // no file yet is fine; a file the engine reads but we can't is not
    const loaded = await $.settings.read({ source: 'user' }).catch(() => ({}))
    return Object.keys(loaded).length === 0
      ? { user: {}, text: null, error: null }
      : { user: { ...loaded }, text: null, error: `cannot read ${path}` }
  }
  if (text.trim() === '') return { user: {}, text, error: null }
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
      return { user: {}, text, error: 'settings.json is not a JSON object' }
    return { user: parsed as Json, text, error: null }
  } catch (err) {
    return { user: {}, text, error: `settings.json is not valid JSON (${message(err)})` }
  }
}

async function settingsPath($: Host): Promise<string | null> {
  const dir = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  return userSettingsPath(dir, home) ?? null
}

async function refresh($: Host): Promise<Snapshot> {
  const rows = await $.config.list().catch(() => [] as ConfigRow[])
  const path = await settingsPath($)
  const { user, error } = await readUser($, path)
  const next: Snapshot = { rows: [...rows], user, path, error }
  await update($, snapshot, () => next)
  return next
}

async function notify($: Host, text: string, tone: 'success' | 'warning' | 'error'): Promise<void> {
  await update($, ui, s => ({ ...s, notice: { text, tone } }))
}

async function saveHistory($: Host, list: Backup[]): Promise<void> {
  await update($, history, () => list)
  await $.store.set(STORE_HISTORY, list).catch(err => $.ui.log(`ultra-config: history not saved: ${message(err)}`))
}

/**
 * Writes the settings object, keeping a copy of the file as it was, and
 * resolves once the engine has loaded it (false if it never did).
 *
 * The engine writes /config rows from the settings it holds in memory, so a
 * `$.config.set` before it reloads would put back what this write changed.
 * And it does not reload a write that lands just after one of its own: then
 * the file is written again, once, which it does pick up.
 */
async function writeUser($: Host, path: string, before: string | null, next: Json, paths: string[]): Promise<boolean> {
  if (before !== null) await $.fs.write(`${path}.ultra-config.bak`, before)
  const text = `${JSON.stringify(next, null, 2)}\n`
  for (const body of [text, text.trimEnd()]) {
    await $.fs.write(path, body)
    for (let i = 0; i < RELOAD_TRIES; i++) {
      const loaded = await $.settings.read({ source: 'user' }).catch(() => undefined)
      if (loaded && inSync(loaded, next, paths)) return true
      await $.clock.sleep(RELOAD_STEP_MS)
    }
  }
  $.ui.log(`ultra-config: Claude Code did not reload ${path}`)
  return false
}

const NOT_RELOADED = 'Claude Code did not reload settings.json; restart the session, then apply again'

async function applyProfile($: Host, profile: Profile): Promise<Backup> {
  const snap = await refresh($)
  const plan = planFor(profile, snap.rows, snap.user)
  const entries: UltraConfigEntry[] = []
  const refused: { label: string; reason: string }[] = []
  let isSynced = true

  // settings.json first: the /config writes below then start from it
  const fileSteps = profile.steps.filter(s => s.layer !== 'config')
  if (fileSteps.length > 0) {
    const { user, text, error } = await readUser($, snap.path)
    if (error !== null || snap.path === null) {
      for (const s of fileSteps) refused.push({ label: s.label, reason: error ?? 'settings.json not found' })
    } else {
      const { next, entries: written } = applySettings(user, fileSteps)
      if (written.length > 0) {
        // recorded before the write: a write that fails halfway can still be undone
        entries.push(...written)
        try {
          isSynced = await writeUser($, snap.path, text, next, written.flatMap(w => (w.layer === 'config' ? [] : [w.path])))
        } catch (err) {
          isSynced = false
          for (const w of written) refused.push({ label: w.label, reason: `may not be written: ${message(err)}` })
        }
      }
    }
  }

  for (const step of profile.steps) {
    if (step.layer !== 'config') continue
    const item = plan.find(p => p.id === `config:${step.key}`)!
    if (item.status === 'same') continue
    if (item.status !== 'change') {
      refused.push({ label: item.label, reason: SKIP[item.status] })
      continue
    }
    if (!isSynced) {
      refused.push({ label: item.label, reason: NOT_RELOADED })
      continue
    }
    const row = snap.rows.find(r => r.key === step.key)!
    const r = await $.config.set({ key: step.key, value: step.value }).catch(err => ({ deny: message(err) }))
    if (r.deny !== undefined) refused.push({ label: item.label, reason: r.deny })
    else entries.push({ layer: 'config', key: step.key, label: row.label, previous: restorable(row) })
  }

  const backup: Backup = {
    id: `${Date.now()}`,
    profile: profile.id,
    name: profile.name,
    at: new Date().toISOString(),
    entries,
    refused,
  }
  if (entries.length > 0) await saveHistory($, [backup, ...(await read($, history))].slice(0, KEEP))
  await refresh($)
  return backup
}

async function undoLast($: Host): Promise<{ text: string; tone: 'success' | 'warning' | 'error' }> {
  const [last, ...rest] = await read($, history)
  if (!last) return { text: 'Nothing to undo', tone: 'warning' }
  const failed: string[] = []
  let isSynced = true
  // settings.json first, as when applying
  const fileEntries = last.entries.filter(e => e.layer !== 'config')
  if (fileEntries.length > 0) {
    const path = await settingsPath($)
    const { user, text, error } = await readUser($, path)
    if (error !== null || path === null) failed.push(`settings.json (${error ?? 'not found'})`)
    else
      isSynced = await writeUser($, path, text, revertSettings(user, fileEntries), fileEntries.map(f => f.path)).catch(err => {
        failed.push(`settings.json (${message(err)})`)
        return true
      })
  }
  for (const entry of [...last.entries].reverse()) {
    if (entry.layer !== 'config') continue
    if (!isSynced) {
      failed.push(`${entry.label} (${NOT_RELOADED})`)
      continue
    }
    const r = await $.config.set({ key: entry.key, value: entry.previous }).catch(err => ({ deny: message(err) }))
    if (r.deny !== undefined) failed.push(`${entry.label} (${r.deny})`)
  }
  // a settings.json that could not be restored keeps the entry, so undo can be tried again
  const fileFailed = failed.some(f => f.startsWith('settings.json'))
  if (!fileFailed) await saveHistory($, rest)
  await refresh($)
  if (fileFailed) return { text: `Not undone: ${failed.join(', ')}. Fix it and run /ultra-config undo again`, tone: 'error' }
  return failed.length === 0
    ? { text: `Undid ${last.name}: ${last.entries.length} settings restored`, tone: 'success' }
    : { text: `Undid ${last.name}, except ${failed.join(', ')}`, tone: 'warning' }
}

const SKIP: Record<'locked' | 'missing' | 'invalid', string> = {
  locked: 'locked by your organization',
  missing: 'not in this Claude Code version',
  invalid: 'value not offered here',
}

const summary = (b: Backup): string => {
  const n = b.entries.length
  const head = n === 0 ? `${b.name}: already in place` : `${b.name} activated: ${n} setting${n === 1 ? '' : 's'} changed`
  return b.refused.length === 0 ? head : `${head}, ${b.refused.length} skipped`
}

function planText(profile: Profile, plan: PlanItem[]): string {
  const lines = [`${profile.icon} ${profile.name}: ${profile.tagline}`]
  for (const p of plan) {
    const mark = p.status === 'change' ? '●' : p.status === 'same' ? '✓' : '⊘'
    const tail = p.status === 'change' ? `${p.from} → ${p.to}  (${p.why})` : p.status === 'same' ? p.to : SKIP[p.status]
    lines.push(`  ${mark} ${p.label}: ${tail}`)
  }
  lines.push(`/ultra-config apply ${profile.id} to apply`)
  return lines.join('\n')
}

export const register: Register = (on, options) => {
  const columns = paneColumns(options.columns)

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Setting profiles: token saver, fast flow, max quality, guarded, autopilot',
        argumentHint: '[profile | apply <profile> | undo | close]',
      })
      .catch(err => $.ui.log(`ultra-config: /${COMMAND} not registered: ${message(err)}`))
    const stored = await $.store.get(STORE_HISTORY).catch(() => undefined)
    if (Array.isArray(stored)) await update($, history, () => stored as Backup[])
    return r
  })

  // keep the cards in step with changes made in /config itself
  on('config.set', async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined) await refresh($).catch(() => undefined)
    return r
  }).catch(($, e, next) => next(e))

  on('command.run', { command: COMMAND }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().split(/\s+/)
    const word = verb.toLowerCase()
    if (word === 'close' || word === 'stop') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return { text: 'ultra-config closed' }
    }
    if (word === 'undo') {
      const { text, tone } = await undoLast($)
      await notify($, text, tone)
      return { text }
    }
    if (word === 'apply') {
      const profile = profileById(arg)
      if (!profile) return { text: `Unknown profile "${arg}". Profiles: ${PROFILES.map(p => p.id).join(', ')}` }
      const b = await applyProfile($, profile)
      const text = summary(b)
      await notify($, text, b.refused.length === 0 ? 'success' : 'warning')
      const skipped = b.refused.map(x => `\n  ⊘ ${x.label}: ${x.reason}`).join('')
      return { text: `${text}${skipped}\n/ultra-config undo reverts it` }
    }
    const profile = word === '' ? undefined : profileById(word)
    if (word !== '' && !profile)
      return { text: `Unknown argument "${word}". Try a profile (${PROFILES.map(p => p.id).join(', ')}), apply, undo or close.` }
    const snap = await refresh($)
    await update($, ui, s => ({
      ...s,
      selected: profile ? profile.id : s.selected,
      notice: null,
    }))
    let placed = true
    try {
      placed = (await $.ui.open({ id: PANE, title: 'ultra config', focus: true, columns })).isPlaced
    } catch (err) {
      placed = false
      $.ui.log(`ultra-config: pane not opened: ${message(err)}`)
    }
    if (profile) {
      const plan = planFor(profile, snap.rows, snap.user)
      if (!placed) return { text: planText(profile, plan) }
      const n = plan.filter(p => p.status === 'change').length
      return { text: `${profile.icon} ${profile.name}: ${n} change${n === 1 ? '' : 's'}, shown in the pane · /ultra-config apply ${profile.id}` }
    }
    if (!placed) return { text: PROFILES.map(p => `${p.icon} ${p.id}: ${p.tagline}`).join('\n') }
    return {
      text: e.presentation?.isFullscreen
        ? 'ultra-config opened · press a profile to see what it sets · /ultra-config close'
        : 'ultra-config drawn above the prompt; /tui fullscreen docks it beside the transcript',
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const W = Math.max(40, (e.props.bodyColumns ?? columns) - 1)
    const state = await read($, ui)
    const snap = await read($, snapshot)
    const set = (patch: Partial<UltraConfigUi>) => update($, ui, s => ({ ...s, ...patch }))

    const effort = getPath(snap.user, 'effortLevel')
    const model = snap.rows.find(r => r.key === 'model')
    const mode = snap.rows.find(r => r.key === 'permissionMode')
    const facts = [show(model?.value).replace(/ \(.*\)$/, '').toLowerCase(), `${effort === undefined ? 'default' : show(effort)} effort`, `${show(mode?.value)} mode`]

    // one profile is always open; the first until another is pressed
    const open = (state.selected ? profileById(state.selected) : undefined) ?? PROFILES[0]!
    const labelW = Math.min(27, Math.max(14, Math.floor(W * 0.44)))

    const activate = async (p: (typeof PROFILES)[number]) => {
      if ((await read($, ui)).isBusy) return
      await set({ isBusy: true })
      try {
        const b = await applyProfile($, p)
        await set({ notice: { text: `${summary(b)} · /ultra-config undo reverts it`, tone: b.refused.length === 0 ? 'success' : 'warning' } })
        $.ui.toast(`${p.icon} ${summary(b)}`)
      } catch (err) {
        await set({ notice: { text: `Not activated: ${message(err)}`, tone: 'error' } })
      } finally {
        await set({ isBusy: false })
      }
    }

    const detail = (p: (typeof PROFILES)[number]) => {
      const plan = planFor(p, snap.rows, snap.user)
      const changes = plan.filter(x => x.status === 'change').length
      // every step, so Activate never applies one that was not shown; the pane scrolls
      const lines = []
      for (const x of plan) {
        if (x.status === 'change')
          lines.push(
            <Box key={`chg:${x.id}`} flexDirection="column">
              <Text wrap="truncate-end">
                <Text color={p.color}>● </Text>
                <Text>{pad(x.label, labelW)}</Text>
                <Text dimColor strikethrough>{x.from}</Text>
                <Text dimColor>{nb(' → ')}</Text>
                <Text color={p.color} weight="bold">{x.to}</Text>
              </Text>
              <Text color="#8a8a8a" wrap="truncate-end">{nb(`  ${x.why}`)}</Text>
            </Box>,
          )
        else if (x.status === 'same')
          lines.push(
            <Text key={`same:${x.id}`} wrap="truncate-end">
              <Text color="success">✓ </Text>
              <Text dimColor>{pad(x.label, labelW)}{x.to}</Text>
            </Text>,
          )
        else
          lines.push(
            <Text key={`skip:${x.id}`} color="warning" wrap="truncate-end">
              ⊘ <Text dimColor>{`${x.label}: ${SKIP[x.status]}`}</Text>
            </Text>,
          )
      }
      return (
        <Box key={`detail:${p.id}`} flexDirection="column" borderStyle="round" borderColor={p.color} paddingX={1} width={W}>
          {lines}
          <Box flexDirection="row" marginTop={1}>
            {changes > 0 ? (
              <Button
                key={`activate:${p.id}`}
                variant="primary"
                hotkey="a"
                autoFocus
                label={state.isBusy ? 'Activating…' : `Activate ${p.name}`}
                onPress={() => activate(p)}
              />
            ) : (
              <Text color="success" weight="bold">✓ Active: nothing to change</Text>
            )}
          </Box>
        </Box>
      )
    }

    const cards = PROFILES.map(p => {
      const plan = planFor(p, snap.rows, snap.user)
      const { same, of } = matchOf(plan)
      const isActive = of > 0 && same === of
      const isOpen = p.id === open.id
      const meter = 10
      const lit = of === 0 ? 0 : Math.round((same / of) * meter)
      return (
        <Box key={`card:${p.id}`} flexDirection="column" width={W}>
          <Box flexDirection="row" justifyContent="space-between" width={W}>
            <Button key={`pick:${p.id}`} plain onPress={() => set({ selected: p.id, notice: null })}>
              <Text color={isOpen ? p.color : '#5a5a5a'}>{isOpen ? '▾ ' : '▸ '}</Text>
              <Text backgroundColor={p.color} color={INK} weight="bold">{nb(` ${p.icon} `)}</Text>
              <Text color={p.color} weight="bold">{nb(` ${p.name}`)}</Text>
            </Button>
            <Text>
              <Text color={p.color}>{'■'.repeat(lit)}</Text>
              <Text color="#3a3a3a">{'■'.repeat(meter - lit)}</Text>
              <Text color={isActive ? 'success' : undefined} dimColor={!isActive} tabular>
                {nb(isActive ? '  ✓ active' : ` ${String(same).padStart(2)}/${of}`.padEnd(10))}
              </Text>
            </Text>
          </Box>
          <Text dimColor wrap="truncate-end">{nb(`      ${p.tagline}`)}</Text>
          {isOpen && detail(p)}
        </Box>
      )
    })

    return (
      <Box flexDirection="column" width={W} gap={1}>
        <Box key="head" flexDirection="column" width={W}>
          <Box flexDirection="row" justifyContent="space-between" width={W}>
            <Text>
              <Text backgroundColor={ACCENT} color={INK} weight="bold">{nb(' ⚙ ULTRA ')}</Text>
              <Text backgroundColor="#3a2a24" color="#f4ece6" weight="bold">{nb(' CONFIG ')}</Text>
            </Text>
            <Text dimColor>{nb(facts.join(' · '))}</Text>
          </Box>
          <Text color="#3a3a3a">{'─'.repeat(W)}</Text>
          {state.notice && (
            <Text color={state.notice.tone}>{state.notice.tone === 'success' ? '✓ ' : '! '}{state.notice.text}</Text>
          )}
          {snap.error && <Text color="warning">! {snap.error}: effort, env and deny rules are left alone</Text>}
        </Box>
        {cards}
      </Box>
    )
  })
}
