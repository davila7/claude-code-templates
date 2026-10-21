/**
 * stack-viewer — Claude Mod
 *
 * A side pane that maps every component this session runs and where each one
 * is installed from. A sidebar lists the component types (skills, subagents,
 * commands, hooks, MCP servers, plugins and mods, settings, memory, output
 * styles); pick one and the pane draws its scopes as a tree in precedence
 * order (Enterprise, CLI flag, Local, Project, User, Plugin, Built-in…), each
 * with what is installed there and whether it is active, shadowed by a higher
 * scope, or off.
 *
 *   `/stack` opens it (or reads the stack again) · `/stack close` closes it
 *
 * What is loaded comes from the engine (the /context breakdown, the command
 * list, each settings source); where a file sits comes from reading the
 * folders each type installs to. A scope read off files alone is marked `≈`.
 * It only observes: every hook passes its event on unchanged.
 *
 * Needs Claude Code >= 2.1.287.
 *
 * Options (pluginConfigs["stack-viewer@skills-dir"].options):
 *   columns: number   width asked for the docked pane (default 84)
 */
import type { Register, RenderChildren, RenderSurface } from 'claude-code'
import { KINDS, SCOPE, buildStack, cell, counts, fit, scanFiles } from './stack.ts'
import type { Facts, Io, Item, Kind, ScopeNode, Section } from './stack.ts'

const PANE = 'stack-viewer'
const COMMAND = 'stack'
const SOURCES = ['user', 'project', 'local', 'flag', 'policy'] as const
/** Claude Code's fixed managed-settings locations (macOS, Linux/WSL, Windows), not user paths. */
const MANAGED_DIRS = ['/Library/Application Support/ClaudeCode', '/etc/claude-code', 'C:/Program Files/ClaudeCode']

const RAIL = '#5c6370'
const INK = '#d7dae0'
const MUTED = '#7f848e'
const SHADOW = '#e5c07b'
const OFF = '#6b717d'
const SELECT_BG = '#2c313a'
const BADGE_INK = '#16181d'

let sections: Section[] = []
let selected: Kind = 'skills'
let isOpen = false
let error: string | undefined
let header = { version: '', where: '' }
/** Scopes the person folded or unfolded, against the default (open when it has items). */
const toggled = new Set<string>()
/** MCP server → config scope, as the engine reported it on a call. */
const mcpSeen: Record<string, string> = {}
let activeStyle: string | undefined

export const register: Register = (on, options) => {
  const columns = paneColumns(options.columns)

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Map of every component this session runs and the scope it is installed from (close|refresh)',
        argumentHint: '[close|refresh]',
        immediate: true,
      })
      .catch(err => $.ui.log(`stack-viewer: /${COMMAND} not registered: ${err}`))
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'close' || arg === 'stop') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      return { text: 'stack-viewer closed' }
    }
    const isRefresh = arg === 'refresh'
    try {
      const [usage, commands, cwd, root, version, home, profile, configDir] = await Promise.all([
        $.session.usage({ breakdown: 'summary' }).catch(() => undefined),
        $.command.list().catch(() => []),
        $.session.cwd(),
        $.session.root().catch(() => ''),
        $.session.version().catch(() => undefined),
        $.env.get('HOME'),
        $.env.get('USERPROFILE'),
        $.env.get('CLAUDE_CONFIG_DIR'),
      ])
      const settings: Facts['settings'] = {}
      for (const source of SOURCES) {
        settings[source] = ((await $.settings.read({ source }).catch(() => ({}))) ?? {}) as Record<string, unknown>
      }
      const io: Io = {
        read: path => $.fs.read(path).then(t => (typeof t === 'string' ? t : undefined), () => undefined),
        list: path => $.fs.list(path).then(l => l.map(x => ({ name: x.name, kind: x.kind })), () => []),
      }
      const homeDir = (home ?? profile ?? '').replace(/\\/g, '/')
      const cfg = (configDir ?? `${homeDir}/.claude`).replace(/\\/g, '/')
      const files = await scanFiles(io, {
        configDir: cfg,
        claudeJson: configDir ? `${cfg}/.claude.json` : `${homeDir}/.claude.json`,
        cwd,
        root: root || cwd,
        managedDirs: MANAGED_DIRS,
        selfRoot: $.plugin.root,
        home: homeDir,
      })
      const b = usage?.context.breakdown
      const skills = b?.skills
      sections = buildStack(files, {
        skills: skills?.skillFrontmatter ?? [],
        agents: b?.agents ?? [],
        commands,
        mcpTools: b?.mcpTools ?? [],
        memory: b?.memoryFiles ?? [],
        settings,
        activeStyle,
        mcpSeen,
        skillsOverBudget: skills ? Math.max(0, skills.totalSkills - skills.includedSkills) : undefined,
        home: homeDir,
        configDir: configDir ? cfg : undefined,
        cwd,
      })
      header = {
        version: version ? `Claude Code ${version.version}` : '',
        where: cwd.startsWith(homeDir + '/') && homeDir ? `~/${cwd.slice(homeDir.length + 1)}` : cwd,
      }
      error = undefined
    } catch (err) {
      error = `could not read the stack: ${err}`
    }
    if (!isRefresh || !isOpen) {
      try {
        await $.ui.open({ id: PANE, title: 'stack', focus: true, columns })
      } catch (err) {
        isOpen = false
        return { text: `stack-viewer: pane not opened: ${err}` }
      }
      isOpen = true
    }
    $.ui.invalidate('ui.render')
    if (isRefresh) return {}
    const total = sections.reduce((n, s) => n + counts(s).active, 0)
    const hint = e.presentation.isFullscreen
      ? 'click a type, or focus the pane (ctrl+x tab) and press 1-9'
      : 'drawn above the prompt; /tui fullscreen docks it beside the transcript'
    return { text: `${total} components across ${sections.length} types · ${hint} · /${COMMAND} close` }
  })

  // the output style the engine actually sends, for a style a plugin forces
  on('prompt.compose', async ($, e, next) => {
    if (e.outputStyle) activeStyle = e.outputStyle.name
    return next(e)
  })

  // the engine names an MCP server's config scope on each of its tool calls
  on('classic.PostToolUse', async ($, e, next) => {
    const s = e.mcp_server
    if (s && mcpSeen[s.name] !== s.source) {
      mcpSeen[s.name] = s.source
    }
    return next(e)
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    const r = await next(e)
    isOpen = false
    return r
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    const r = await next(e)
    const key = e.element
    if (key === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return r
    }
    if (key === 'refresh') {
      await $.command.run({ command: COMMAND, args: 'refresh' }).catch(() => undefined)
      return r
    }
    if (key === 'fold') {
      const section = sections.find(s => s.kind === selected)
      for (const s of section?.scopes ?? []) {
        const id = `${selected}:${s.id}`
        if (isExpanded(selected, s)) toggled.has(id) ? toggled.delete(id) : toggled.add(id)
      }
    } else if (key.startsWith('nav:')) {
      selected = key.slice(4) as Kind
    } else if (key.startsWith('scope:')) {
      const id = key.slice(6)
      toggled.has(id) ? toggled.delete(id) : toggled.add(id)
    }
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(36, e.props.bodyColumns - 1)
    const sp = spacer(e.surface)
    const noop = () => {}
    const isWide = width >= 72
    const navW = isWide ? 26 : width
    const mainW = isWide ? width - navW - 2 : width
    const section = sections.find(s => s.kind === selected) ?? sections[0]

    const totals = sections.map(counts).reduce(
      (t, c) => ({ active: t.active + c.active, shadowed: t.shadowed + c.shadowed, off: t.off + c.off }),
      { active: 0, shadowed: 0, off: 0 },
    )

    const top = (
      <Box key="top" flexDirection="column" borderStyle="round" borderColor={RAIL} paddingX={1} marginBottom={1}>
        <Text key="t">
          <Text color="#d97757" bold>{'◆ '}</Text>
          <Text bold color={INK}>{'Session stack'}</Text>
          <Text color={MUTED}>{sp(fit(`  ${header.version}`, Math.max(1, width - 20)))}</Text>
        </Text>
        <Text key="s" wrap="truncate-end">
          <Text color={MUTED}>{sp(`${tail(header.where, Math.max(8, width - 46))}  `)}</Text>
          <Text color="#98c379">{sp(`● ${totals.active} active  `)}</Text>
          <Text color={SHADOW}>{sp(`⊘ ${totals.shadowed} shadowed  `)}</Text>
          <Text color={OFF}>{sp(`○ ${totals.off} off`)}</Text>
        </Text>
      </Box>
    )

    if (error || !section) {
      return (
        <Box flexDirection="column">
          {top}
          <Text color="red">{fit(error ?? 'Nothing read yet: run /stack.', width)}</Text>
        </Box>
      )
    }

    const navRow = (i: number) => {
      const k = KINDS[i]!
      const s = sections.find(x => x.kind === k.kind)!
      const c = counts(s)
      const isSel = k.kind === selected
      const n = `${c.active}`
      const sh = c.shadowed ? `⊘${c.shadowed}` : ''
      const labelW = navW - 12 // `1: ` hotkey prefix, icon, bar, counts
      return (
        <Box key={`n${k.kind}`} flexDirection="row" width={navW}>
          <Text key="bar" color={k.color} backgroundColor={isSel ? SELECT_BG : undefined}>
            {sp(isSel ? '▌' : ' ')}
          </Text>
          <Text key="i" color={k.color} backgroundColor={isSel ? SELECT_BG : undefined} bold>
            {sp(`${k.icon} `)}
          </Text>
          <Button key={`nav:${k.kind}`} plain hotkey={`${i + 1}`} dimColor={!isSel} label={sp(cell(k.title, labelW))} onPress={noop} />
          <Text key="c" color={isSel ? INK : MUTED} backgroundColor={isSel ? SELECT_BG : undefined}>
            {sp(cell(n, 3, 'right'))}
          </Text>
          <Text key="sh" color={SHADOW} backgroundColor={isSel ? SELECT_BG : undefined}>
            {sp(cell(sh ? ` ${sh}` : '', 3))}
          </Text>
        </Box>
      )
    }

    const nav = isWide ? (
      <Box key="nav" flexDirection="column" width={navW} flexShrink={0}>
        <Text key="h" color={MUTED} bold>{sp(cell(' COMPONENTS', navW))}</Text>
        {KINDS.map((_, i) => navRow(i))}
        <Box key="legend" flexDirection="column" marginTop={1}>
          <Text key="l1" color={MUTED}>{sp(' ● active')}</Text>
          <Text key="l2" color={SHADOW}>{sp(' ⊘ shadowed')}</Text>
          <Text key="l3" color={OFF}>{sp(' ○ off')}</Text>
          <Text key="l4" color={MUTED}>{sp(' ≈ scope read off files')}</Text>
          <Text key="l5">
            <Text color={BADGE_INK} backgroundColor={MUTED}>{' 1 '}</Text>
            <Text color={MUTED}>{sp(' highest precedence')}</Text>
          </Text>
        </Box>
      </Box>
    ) : (
      <Box key="nav" flexDirection="column" marginBottom={1}>
        {chipRows(width).map((row, r) => (
          <Box key={`cr${r}`} flexDirection="row" columnGap={1}>
            {row.map(i => {
              const k = KINDS[i]!
              const c = counts(sections.find(x => x.kind === k.kind)!)
              return (
                <Box key={`chip${k.kind}`} flexDirection="row">
                  <Text key="i" color={k.color} bold>{sp(`${k.icon} `)}</Text>
                  <Button key={`nav:${k.kind}`} plain hotkey={`${i + 1}`} dimColor={k.kind !== selected} label={sp(`${k.title} ${c.active}`)} onPress={noop} />
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    )

    const meta = KINDS.find(k => k.kind === section.kind)!
    const c = counts(section)

    /** One bar cell per item, colored by scope, so the mix reads at a glance. */
    const mixBar = () => {
      const all = section.scopes.map(s => ({ id: s.id, n: s.items.length })).filter(s => s.n > 0)
      const total = all.reduce((t, s) => t + s.n, 0)
      if (!total) return <Text key="mix" color={RAIL}>{'░'.repeat(mainW)}</Text>
      let used = 0
      const segs = all.map((s, i) => {
        const w = i === all.length - 1 ? mainW - used : Math.max(1, Math.round((s.n / total) * mainW))
        used += w
        return { ...s, w: Math.max(0, w) }
      })
      return (
        <Text key="mix">
          {segs.map(s => (
            <Text key={`m${s.id}`} color={SCOPE[s.id].color}>{'█'.repeat(s.w)}</Text>
          ))}
        </Text>
      )
    }

    const mixLegend = () => {
      const parts = section.scopes.filter(s => s.items.length).map(s => ({ id: s.id, text: `${SCOPE[s.id].label} ${s.items.length}` }))
      if (!parts.length) return <Text key="ml" color={MUTED}>{sp('nothing installed for this type')}</Text>
      return (
        <Text key="ml" wrap="wrap">
          {parts.map(p => (
            <Text key={`l${p.id}`}>
              <Text color={SCOPE[p.id].color}>{'■'}</Text>
              <Text color={MUTED}>{sp(` ${p.text}   `)}</Text>
            </Text>
          ))}
        </Text>
      )
    }

    const itemRow = (s: ScopeNode, item: Item, isLast: boolean, n: number, colW: number) => {
      const color = SCOPE[s.id].color
      const glyph = item.isSelected ? '★' : item.status === 'active' ? '●' : item.status === 'shadowed' ? '⊘' : '○'
      const glyphColor = item.isSelected ? '#ffd166' : item.status === 'active' ? color : item.status === 'shadowed' ? SHADOW : OFF
      const branch = isLast ? '└─ ' : '├─ '
      const rest = mainW - 8 // `│ ├─ ● `
      const note = item.isInferred ? `≈ ${item.note ?? 'scope read off files'}` : item.note
      const tail = [item.detail, note].filter(Boolean).join('  ')
      const nameLen = Array.from(item.name).length
      const tailLen = Array.from(tail).length
      // a long name keeps its full width and drops its detail to a line of its own
      // a long built-in list stays one row per item, its descriptions cut
      const isSplit = !!tail && nameLen + tailLen + 1 > rest && s.id !== 'builtin'
      const nameW = !tail || isSplit ? rest : Math.min(Math.max(10, Math.floor(rest * 0.5)), Math.max(10, nameLen, colW))
      const tailW = isSplit ? rest - 1 : Math.max(0, rest - nameW - 1)
      const tailColor = item.status === 'shadowed' ? SHADOW : MUTED
      const tailText = (
        <Text key="d" color={tailColor} dimColor={item.status !== 'shadowed'} wrap="truncate-end">
          {sp(` ${fit(tail, tailW)}`)}
        </Text>
      )
      const row = (
        <Box key={`i${n}`} flexDirection="row">
          <Text key="r" color={color} dimColor>{sp(`│ ${branch}`)}</Text>
          <Text key="g" color={glyphColor}>{`${glyph} `}</Text>
          <Text
            key="n"
            color={item.status === 'active' ? INK : item.status === 'shadowed' ? SHADOW : OFF}
            strikethrough={item.status === 'shadowed'}
            bold={item.isSelected}
          >
            {sp(cell(item.name, nameW))}
          </Text>
          {!isSplit && tailW > 2 && tail ? tailText : null}
        </Box>
      )
      if (!isSplit) return row
      return (
        <Box key={`i${n}`} flexDirection="column">
          {row}
          <Box key="t" flexDirection="row">
            <Text key="r" color={color} dimColor>{sp(isLast ? '│      ' : '│ │    ')}</Text>
            {tailText}
          </Box>
        </Box>
      )
    }

    const scopeBlock = (s: ScopeNode, rank: number) => {
      const meta2 = SCOPE[s.id]
      const isOpenScope = isExpanded(section.kind, s)
      const empty = s.items.length === 0
      const marker = empty ? '·' : isOpenScope ? '▾' : '▸'
      const num = ` ${rank} `
      const labelW = Math.min(19, Math.max(10, Math.floor(mainW * 0.34)))
      const countText = empty ? '—' : `${s.items.length}`
      const whereW = Math.max(0, mainW - labelW - 16)
      const shadowed = s.items.filter(i => i.status === 'shadowed').length
      const body: RenderChildren[] = []
      if (isOpenScope && !empty) {
        // names line up in one column per scope, so the details read as a table
        const colW = Math.max(0, ...s.items.map(it => Array.from(it.name).length))
        s.items.forEach((it, i) => body.push(itemRow(s, it, i === s.items.length - 1, i, colW)))
      }
      if (s.note && (isOpenScope || empty)) {
        body.push(
          <Text key="note">
            <Text color={RAIL}>{sp('│   ')}</Text>
            <Text color={MUTED} italic>{sp(fit(s.note, mainW - 4))}</Text>
          </Text>,
        )
      }
      return (
        <Box key={`s${s.id}`} flexDirection="column">
          <Box key="h" flexDirection="row">
            <Text key="m" color={empty ? RAIL : meta2.color}>{sp(`${marker} `)}</Text>
            <Text key="n" color={empty ? MUTED : BADGE_INK} backgroundColor={empty ? SELECT_BG : meta2.color} bold={!empty}>
              {sp(num)}
            </Text>
            <Text key="g">{' '}</Text>
            <Button
              key={`scope:${section.kind}:${s.id}`}
              plain
              dimColor={empty}
              label={sp(cell(meta2.label, labelW))}
              onPress={noop}
            />
            <Text key="c" color={empty ? RAIL : INK} bold={!empty}>{sp(cell(countText, 4, 'right'))}</Text>
            <Text key="x" color={SHADOW}>{sp(cell(shadowed ? ` ⊘${shadowed}` : '', 4))}</Text>
            {whereW > 4 ? <Text key="w" color={RAIL}>{sp(fit(s.where, whereW))}</Text> : null}
          </Box>
          {body}
        </Box>
      )
    }

    const summary = [`${c.active} ${section.noun}`, c.shadowed ? `${c.shadowed} shadowed` : '', c.off ? `${c.off} off` : '']
      .filter(Boolean)
      .join(' · ')

    const main = (
      <Box key="main" flexDirection="column" width={mainW} flexShrink={0}>
        <Text key="title">
          <Text color={meta.color} bold>{sp(`${meta.icon} ${meta.title}`)}</Text>
          <Text color={MUTED}>{sp(fit(`   ${summary}`, Math.max(1, mainW - meta.title.length - 2)))}</Text>
        </Text>
        <Text key="rule" color={MUTED} italic wrap="wrap">{sp(section.rule)}</Text>
        {section.extra ? <Text key="extra" color="#ffd166" wrap="wrap">{sp(section.extra)}</Text> : null}
        <Box key="mixbox" flexDirection="column" marginTop={1} marginBottom={1}>
          {mixBar()}
          {mixLegend()}
        </Box>
        {section.scopes.map((s, i) => scopeBlock(s, i + 1))}
      </Box>
    )

    return (
      <Box flexDirection="column">
        {top}
        {isWide ? (
          <Box key="cols" flexDirection="row" columnGap={2}>
            {nav}
            {main}
          </Box>
        ) : (
          <Box key="cols" flexDirection="column">
            {nav}
            {main}
          </Box>
        )}
        <Box key="foot" marginTop={1} flexDirection="column">
          <Box key="toolbar" flexDirection="row" columnGap={1}>
            <Button key="refresh" label="refresh" hotkey="r" onPress={noop} />
            <Button key="fold" label="fold all" onPress={noop} />
            <Button key="close" label="close" onPress={noop} />
          </Box>
          <Text key="hint" color={MUTED}>{sp(fit('1-9 or click a type · click a scope to fold it · r reads the stack again', width))}</Text>
        </Box>
      </Box>
    )
  })
}

/** The end of a path, cut at the front: `…/scratchpad/demo`. */
function tail(path: string, width: number): string {
  const chars = Array.from(path)
  return chars.length <= width ? path : '…' + chars.slice(chars.length - width + 1).join('')
}

/** A scope starts open when it has something to show, except the long built-in lists. */
function isExpanded(kind: Kind, s: ScopeNode): boolean {
  const byDefault = s.items.length > 0 && !(s.id === 'builtin' && s.items.length > 8)
  return toggled.has(`${kind}:${s.id}`) ? !byDefault : byDefault
}

/** The type chips for a narrow pane, packed into rows `width` wide. */
function chipRows(width: number): number[][] {
  const rows: number[][] = [[]]
  let used = 0
  KINDS.forEach((k, i) => {
    const w = k.title.length + 6
    if (used && used + w > width) {
      rows.push([])
      used = 0
    }
    rows[rows.length - 1]!.push(i)
    used += w + 1
  })
  return rows
}

function paneColumns(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 84
  return Math.min(140, Math.max(40, n))
}

/** Desktop and the remote surfaces collapse runs of spaces; keep them. */
function spacer(surface: RenderSurface): (s: string) => string {
  return surface === 'terminal' ? s => s : s => s.replace(/ /g, '\u00a0')
}
