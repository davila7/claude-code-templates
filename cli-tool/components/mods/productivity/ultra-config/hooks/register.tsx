/**
 * ultra-config — Claude Mod
 *
 * A designed `/config`: a side pane with five profiles (Token saver, Fast
 * flow, Max quality, Guarded, Autopilot) that set Claude Code up for one way
 * of working in one press, and the whole settings menu as a form grouped by
 * category, with search.
 *
 *   `/ultra-config` opens it · `/ultra-config <profile>` previews one ·
 *   `/ultra-config apply <profile>` applies it · `/ultra-config undo`
 *   reverts the last one · `/ultra-config close` closes the pane
 *
 * Every change shows as a preview first. `/config` rows are written with
 * `$.config.set`, the way the menu writes them; effort, the subagent model,
 * env caps and deny rules (keys with no `/config` row) are written to
 * ~/.claude/settings.json, after a copy of the file is saved beside it as
 * settings.json.ultra-config.bak. Each applied profile is kept in the
 * plugin's store so `undo` puts back exactly what it changed.
 *
 * Needs Claude Code >= 2.1.290 (Text weight and tabular).
 *
 * Options (pluginConfigs["ultra-config@skills-dir"].options):
 *   columns: number   width asked for the docked pane (default 62)
 */
import { atom, read, update } from 'claude-code'
import type { ConfigRow, ConfigValue, EngineInterface, Register } from 'claude-code'

import type {
  UltraConfigBackup as Backup,
  UltraConfigCategory,
  UltraConfigEntry,
  UltraConfigSnapshot as Snapshot,
  UltraConfigUi,
} from '../types'
import {
  CATEGORIES,
  EXTRAS,
  PROFILES,
  applySettings,
  categoryOf,
  order,
  cycle,
  getPath,
  inSync,
  matchOf,
  nb,
  nextValue,
  pad,
  paneColumns,
  planFor,
  profileById,
  restorable,
  revertSettings,
  show,
  userSettingsPath,
} from './profiles.ts'
import type { Json, PlanItem, Profile, Row } from './profiles.ts'

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
  view: 'profiles',
  selected: null,
  category: 'model',
  query: '',
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
  const head = n === 0 ? `${b.name}: already in place` : `${b.name} applied: ${n} setting${n === 1 ? '' : 's'} changed`
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
        description: 'Profiles and a designed settings form (token saver, fast flow, max quality, guarded, autopilot)',
        argumentHint: '[profile | apply <profile> | undo | close]',
      })
      .catch(err => $.ui.log(`ultra-config: /${COMMAND} not registered: ${message(err)}`))
    const stored = await $.store.get(STORE_HISTORY).catch(() => undefined)
    if (Array.isArray(stored)) await update($, history, () => stored as Backup[])
    return r
  })

  // keep the form in step with changes made in /config itself
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
    if (word !== '' && !profile && !['profiles', 'settings', 'history'].includes(word))
      return { text: `Unknown argument "${word}". Try a profile (${PROFILES.map(p => p.id).join(', ')}), apply, undo or close.` }
    const snap = await refresh($)
    await update($, ui, s => ({
      ...s,
      view: profile ? 'profiles' : word === 'settings' || word === 'history' ? word : s.view,
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
      return { text: `${profile.icon} ${profile.name}: ${n} change${n === 1 ? '' : 's'} previewed in the pane · /ultra-config apply ${profile.id}` }
    }
    if (!placed) return { text: PROFILES.map(p => `${p.icon} ${p.id}: ${p.tagline}`).join('\n') }
    return {
      text: e.presentation?.isFullscreen
        ? 'ultra-config opened · pick a profile to preview it · /ultra-config close'
        : 'ultra-config drawn above the prompt; /tui fullscreen docks it beside the transcript',
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const W = Math.max(40, (e.props.bodyColumns ?? columns) - 1)
    const H = Math.max(16, e.viewport?.rows ?? 40)
    const state = await read($, ui)
    const snap = await read($, snapshot)
    const backups = await read($, history)
    const set = (patch: Partial<UltraConfigUi>) => update($, ui, s => ({ ...s, ...patch }))

    const effort = getPath(snap.user, 'effortLevel')
    const model = snap.rows.find(r => r.key === 'model')
    const mode = snap.rows.find(r => r.key === 'permissionMode')
    const facts = [show(model?.value).replace(/ \(.*\)$/, '').toLowerCase(), `${effort === undefined ? 'default' : show(effort)} effort`, `${show(mode?.value)} mode`]

    const header = (
      <Box key="head" flexDirection="column" width={W}>
        <Box flexDirection="row" justifyContent="space-between" width={W}>
          <Text>
            <Text backgroundColor={ACCENT} color={INK} weight="bold">{nb(' ⚙ ULTRA ')}</Text>
            <Text backgroundColor="#3a2a24" color="#f4ece6" weight="bold">{nb(' CONFIG ')}</Text>
          </Text>
          <Text dimColor>{nb(facts.join(' · '))}</Text>
        </Box>
        <Box flexDirection="row" gap={1} marginTop={1}>
          {(
            [
              ['profiles', '◆ Profiles', '1'],
              ['settings', '☰ Settings', '2'],
              ['history', '↺ History', '3'],
            ] as const
          ).map(([id, label, key]) => {
            const active = state.view === id
            return (
              <Button key={`tab:${id}`} plain hotkey={key} onPress={() => set({ view: id, notice: null })}>
                <Text backgroundColor={active ? ACCENT : undefined} color={active ? INK : undefined} dimColor={!active} weight={active ? 'bold' : 'regular'}>
                  {nb(` ${label}${id === 'history' && backups.length > 0 ? ` ${backups.length}` : ''} `)}
                </Text>
              </Button>
            )
          })}
        </Box>
        <Text color="#3a3a3a">{'─'.repeat(W)}</Text>
        {state.notice && (
          <Text color={state.notice.tone}>{state.notice.tone === 'success' ? '✓ ' : '! '}{state.notice.text}</Text>
        )}
        {snap.error && <Text color="warning">! {snap.error}: effort, env and deny rules are left alone</Text>}
      </Box>
    )

    // ---------------------------------------------------------------- profiles
    const profilesView = () => {
      const selected = state.selected ? profileById(state.selected) : undefined
      const cards = PROFILES.map(p => {
        const plan = planFor(p, snap.rows, snap.user)
        const { same, of } = matchOf(plan)
        const isActive = of > 0 && same === of
        const isSel = selected?.id === p.id
        const meter = 10
        const lit = of === 0 ? 0 : Math.round((same / of) * meter)
        return (
          <Box key={`card:${p.id}`} flexDirection="column" width={W}>
            <Box flexDirection="row" justifyContent="space-between" width={W}>
              <Button key={`pick:${p.id}`} plain onPress={() => set({ selected: isSel ? null : p.id, notice: null })}>
                <Text color={isSel ? p.color : '#3a3a3a'}>{isSel ? '▌' : '│'}</Text>
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
            <Text dimColor wrap="truncate-end">
              {nb(`${isSel ? ' ' : ' '}     ${p.tagline}`)}
            </Text>
          </Box>
        )
      })

      if (!selected) {
        return (
          <Box key="profiles" flexDirection="column" gap={1} width={W}>
            {cards}
            <Text dimColor>Pick a profile to see exactly what it changes before anything is written.</Text>
          </Box>
        )
      }

      const plan = planFor(selected, snap.rows, snap.user)
      const changes = plan.filter(p => p.status === 'change')
      const same = plan.filter(p => p.status === 'same')
      const skipped = plan.filter(p => p.status !== 'change' && p.status !== 'same')
      const labelW = Math.min(24, Math.max(14, Math.floor(W * 0.36)))
      // cards (2 rows + gap each), header, preview chrome and buttons
      const room = Math.max(3, H - 5 * 3 - 12)
      const shown = changes.slice(0, room)
      const preview = (
        <Box
          key={`preview:${selected.id}`}
          flexDirection="column"
          borderStyle="round"
          borderColor={selected.color}
          paddingX={1}
          width={W}
        >
          <Text>
            <Text color={selected.color} weight="bold">{selected.icon} {selected.name}</Text>
            <Text dimColor>
              {nb(` · ${changes.length === 0 ? 'already in place' : `${changes.length} change${changes.length === 1 ? '' : 's'}`}`)}
            </Text>
          </Text>
          {shown.map(p => (
            <Box key={`chg:${p.id}`} flexDirection="column">
              <Text wrap="truncate-end">
                <Text color={selected.color}>● </Text>
                <Text>{pad(p.label, labelW)}</Text>
                <Text dimColor strikethrough>{p.from}</Text>
                <Text dimColor>{nb(' → ')}</Text>
                <Text color={selected.color} weight="bold">{p.to}</Text>
                {p.layer !== 'config' && <Text color="#7a7a7a">{nb('  settings.json')}</Text>}
              </Text>
              <Text color="#8a8a8a" wrap="truncate-end">{nb(`  ${p.why}`)}</Text>
            </Box>
          ))}
          {changes.length > shown.length && <Text dimColor>{`  +${changes.length - shown.length} more`}</Text>}
          {same.length > 0 && (
            <Text color="success" wrap="truncate-end">
              ✓ <Text dimColor>{`${same.length} already set: ${same.map(p => p.label).join(', ')}`}</Text>
            </Text>
          )}
          {skipped.map(p => (
            <Text key={`skip:${p.id}`} color="warning" wrap="truncate-end">
              ⊘ <Text dimColor>{`${p.label}: ${SKIP[p.status as keyof typeof SKIP]}`}</Text>
            </Text>
          ))}
          <Box flexDirection="row" gap={1} marginTop={1}>
            {changes.length > 0 && (
              <Button
                key={`apply:${selected.id}`}
                variant="primary"
                hotkey="a"
                autoFocus
                label={`Apply ${changes.length} change${changes.length === 1 ? '' : 's'}`}
                onPress={async () => {
                  if ((await read($, ui)).isBusy) return
                  await set({ isBusy: true })
                  try {
                    const b = await applyProfile($, selected)
                    await set({ notice: { text: summary(b), tone: b.refused.length === 0 ? 'success' : 'warning' } })
                    $.ui.toast(`${selected.icon} ${summary(b)} · undo in History`)
                  } catch (err) {
                    await set({ notice: { text: `Not applied: ${message(err)}`, tone: 'error' } })
                  } finally {
                    await set({ isBusy: false })
                  }
                }}
              />
            )}
            <Button key="cancel" hotkey="c" label="Close preview" onPress={() => set({ selected: null })} />
          </Box>
        </Box>
      )
      return (
        <Box key="profiles" flexDirection="column" gap={1} width={W}>
          {cards}
          {preview}
        </Box>
      )
    }

    // ---------------------------------------------------------------- settings form
    const settingsView = () => {
      const q = state.query.trim().toLowerCase()
      const rows = snap.rows
        .filter(r =>
          q ? r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q) : categoryOf(r.key) === state.category,
        )
        .sort((a, b) => order(a.key) - order(b.key))
      const extras = EXTRAS.filter(x =>
        q ? x.label.toLowerCase().includes(q) || x.path.toLowerCase().includes(q) : state.category === 'model',
      )
      const counts = new Map<string, number>()
      for (const r of snap.rows) counts.set(categoryOf(r.key), (counts.get(categoryOf(r.key)) ?? 0) + 1)
      counts.set('model', (counts.get('model') ?? 0) + EXTRAS.length)
      const valueW = Math.min(22, Math.max(12, Math.floor(W * 0.34)))
      const labelW = W - valueW - 3
      const cat = CATEGORIES.find(c => c.id === state.category) ?? CATEGORIES[0]!
      const tint = q ? ACCENT : cat.color

      const control = (r: Row) => {
        if (r.isLocked) return <Text color="warning" dimColor>{pad('⊘ locked', valueW)}</Text>
        const nextV = nextValue(r.kind, r.value, r.options)
        let face
        if (r.kind === 'boolean')
          face = r.value === true ? <Text color="success" weight="bold">{pad('● on', valueW)}</Text> : <Text dimColor>{pad('○ off', valueW)}</Text>
        else if (r.kind === 'choice') face = <Text color={tint}>{pad(`‹ ${show(r.value)} ›`, valueW)}</Text>
        else face = <Text dimColor>{pad(show(r.value), valueW)}</Text>
        if (nextV === undefined) return face
        return (
          <Button
            key={`set:${r.key}`}
            plain
            onPress={async () => {
              const res = await $.config.set({ key: r.key, value: nextV as ConfigValue }).catch(err => ({ deny: message(err) }))
              if (res.deny !== undefined) await notify($, `${r.label}: ${res.deny}`, 'warning')
              else await update($, ui, s => ({ ...s, notice: null }))
              await refresh($)
            }}
          >
            {face}
          </Button>
        )
      }

      const extraControl = (x: (typeof EXTRAS)[number]) => {
        const current = getPath(snap.user, x.path)
        const value = typeof current === 'string' ? current : ''
        const face = <Text color={tint}>{pad(`‹ ${show(value)} ›`, valueW)}</Text>
        if (snap.error !== null || snap.path === null) return <Text dimColor>{pad(show(value), valueW)}</Text>
        return (
          <Button
            key={`extra:${x.path}`}
            plain
            onPress={async () => {
              const path = snap.path!
              const { user, text, error } = await readUser($, path)
              if (error !== null) return notify($, error, 'error')
              const now = getPath(user, x.path)
              const to = cycle(x.options, typeof now === 'string' ? now : '')
              const { next } = applySettings(user, [
                { layer: 'settings', path: x.path, label: x.label, value: to === '' ? null : to, why: '' },
              ])
              await writeUser($, path, text, next, [x.path]).catch(err => notify($, `${x.label}: ${message(err)}`, 'error'))
              await refresh($)
            }}
          >
            {face}
          </Button>
        )
      }

      const line = (key: string, label: string, ctl: unknown, tag?: string) => (
        <Box key={`row:${key}`} flexDirection="row" width={W}>
          <Text wrap="truncate-end">
            <Text color={tint}>{'▏'}</Text>
            <Text>{pad(` ${label}`, labelW - (tag ? tag.length + 1 : 0))}</Text>
            {tag && <Text color="#7a7a7a">{nb(`${tag} `)}</Text>}
          </Text>
          {ctl as never}
        </Box>
      )

      const chips = (
        <Box key="chips" flexDirection="row" flexWrap="wrap" columnGap={1} width={W}>
          {CATEGORIES.filter(c => (counts.get(c.id) ?? 0) > 0).map(c => {
            const active = !q && c.id === state.category
            return (
              <Button key={`cat:${c.id}`} plain onPress={() => set({ category: c.id as UltraConfigCategory, query: '' })}>
                <Text backgroundColor={active ? c.color : undefined} color={active ? INK : c.color} weight={active ? 'bold' : 'regular'}>
                  {nb(` ${c.icon} ${c.name} `)}
                </Text>
                <Text dimColor>{nb(`${counts.get(c.id)} `)}</Text>
              </Button>
            )
          })}
        </Box>
      )

      let search = null
      if (e.surface !== 'mobile') {
        const { Input } = $.ui.resolve(e)
        search = (
          <Box key="search" width={W}>
            <Input
              key="ultra-config:search"
              placeholder="⌕ Search settings…"
              value={state.query}
              submitLabel="search"
              onInput={value => void set({ query: value })}
              onSubmit={value => void set({ query: value.trim() })}
            />
          </Box>
        )
      }

      const list = [
        ...rows.map(r => line(r.key, r.label, control(r))),
        ...extras.map(x => line(x.path, x.label, extraControl(x), 'json')),
      ]
      const room = Math.max(4, H - 12)
      return (
        <Box key="settings" flexDirection="column" gap={1} width={W}>
          {search}
          {chips}
          <Box key="rows" flexDirection="column" width={W}>
            <Text color={tint} weight="bold">
              {q ? `⌕ ${list.length} match${list.length === 1 ? '' : 'es'} for "${state.query.trim()}"` : `${cat.icon} ${cat.name}`}
            </Text>
            {list.length === 0 && <Text dimColor>Nothing matches.</Text>}
            {list.slice(0, room)}
            {list.length > room && <Text dimColor>{`+${list.length - room} more · search to narrow`}</Text>}
          </Box>
          <Text dimColor wrap="truncate-end">
            {nb('Press a value to change it, as /config would. "json" rows live in settings.json.')}
          </Text>
        </Box>
      )
    }

    // ---------------------------------------------------------------- history
    const historyView = () => {
      if (backups.length === 0)
        return (
          <Box key="history" flexDirection="column" width={W}>
            <Text dimColor>No profile applied yet. Each one you apply is kept here so it can be undone.</Text>
          </Box>
        )
      return (
        <Box key="history" flexDirection="column" gap={1} width={W}>
          {backups.slice(0, Math.max(1, Math.floor((H - 10) / 3))).map((b, i) => {
            const p = profileById(b.profile)
            const when = b.at.replace('T', ' ').slice(0, 16)
            return (
              <Box key={`bk:${b.id}`} flexDirection="column" width={W}>
                <Box flexDirection="row" justifyContent="space-between" width={W}>
                  <Text>
                    <Text backgroundColor={p?.color ?? ACCENT} color={INK} weight="bold">{nb(` ${p?.icon ?? '◆'} `)}</Text>
                    <Text color={p?.color} weight="bold">{nb(` ${b.name}`)}</Text>
                    <Text dimColor>{nb(`  ${when} UTC`)}</Text>
                  </Text>
                  {i === 0 && (
                    <Button
                      key="undo"
                      hotkey="u"
                      label="Undo"
                      onPress={async () => {
                        const r = await undoLast($)
                        await set({ notice: r })
                      }}
                    />
                  )}
                </Box>
                <Text dimColor wrap="truncate-end">
                  {nb(`      ${b.entries.length} changed: ${b.entries.map(x => x.label).join(', ') || '—'}`)}
                </Text>
                {b.refused.length > 0 && (
                  <Text color="warning" dimColor wrap="truncate-end">
                    {nb(`      ⊘ ${b.refused.map(x => x.label).join(', ')}`)}
                  </Text>
                )}
              </Box>
            )
          })}
          <Text dimColor wrap="truncate-end">
            {nb('Undo goes newest first. Before each write settings.json is copied to settings.json.ultra-config.bak.')}
          </Text>
        </Box>
      )
    }

    const body = state.view === 'settings' ? settingsView() : state.view === 'history' ? historyView() : profilesView()
    return (
      <Box flexDirection="column" width={W} gap={1}>
        {header}
        {body}
        {state.isBusy && <Text color={ACCENT}>applying…</Text>}
      </Box>
    )
  })
}

