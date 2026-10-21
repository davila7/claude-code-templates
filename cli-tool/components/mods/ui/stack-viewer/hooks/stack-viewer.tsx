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

// Anthropic's palette: ivory text, warm grays, one orange accent
const ORANGE = '#d97757'
const IVORY = '#faf9f5'
const GRAY = '#b0aea5'
const DIM = '#87867f'
const LINE = '#5e5d59'

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
    const navW = isWide ? 24 : width
    const mainW = isWide ? width - navW - 2 : width
    const section = sections.find(s => s.kind === selected) ?? sections[0]

    const totals = sections.map(counts).reduce(
      (t, c) => ({ active: t.active + c.active, shadowed: t.shadowed + c.shadowed, off: t.off + c.off }),
      { active: 0, shadowed: 0, off: 0 },
    )

    const top = (
      <Box key="top" flexDirection="column" borderStyle="round" borderColor={LINE} paddingX={1} marginBottom={1}>
        <Text key="t">
          <Text color={ORANGE} bold>{'◆ '}</Text>
          <Text bold color={IVORY}>{'Session stack'}</Text>
          <Text color={DIM}>{sp(fit(`  ${header.version}`, Math.max(1, width - 20)))}</Text>
        </Text>
        <Text key="s" wrap="truncate-end">
          <Text color={DIM}>{sp(`${tail(header.where, Math.max(8, width - 46))}   `)}</Text>
          <Text color={IVORY}>{sp(`${totals.active} active`)}</Text>
          <Text color={totals.shadowed ? ORANGE : DIM}>{sp(` · ${totals.shadowed} shadowed`)}</Text>
          <Text color={DIM}>{sp(` · ${totals.off} off`)}</Text>
        </Text>
      </Box>
    )

    if (error || !section) {
      return (
        <Box flexDirection="column">
          {top}
          <Text color={ORANGE}>{fit(error ?? 'Nothing read yet: run /stack.', width)}</Text>
        </Box>
      )
    }

    const navRow = (i: number) => {
      const k = KINDS[i]!
      const c = counts(sections.find(x => x.kind === k.kind)!)
      const isSel = k.kind === selected
      const labelW = navW - 8 // bar, `1: ` hotkey prefix, count
      return (
        <Box key={`n${k.kind}`} flexDirection="row" width={navW}>
          <Text key="bar" color={ORANGE}>{sp(isSel ? '▌' : ' ')}</Text>
          <Button key={`nav:${k.kind}`} plain hotkey={`${i + 1}`} dimColor={!isSel} label={sp(cell(k.title, labelW))} onPress={noop} />
          <Text key="c" color={isSel ? IVORY : DIM}>{sp(cell(`${c.active}`, 4, 'right'))}</Text>
        </Box>
      )
    }

    const nav = isWide ? (
      <Box key="nav" flexDirection="column" width={navW} flexShrink={0}>
        <Text key="h" color={DIM}>{sp(cell(' COMPONENTS', navW))}</Text>
        {KINDS.map((_, i) => navRow(i))}
        <Box key="legend" flexDirection="column" marginTop={1}>
          <Text key="l1">
            <Text color={IVORY}>{sp(' name  ')}</Text>
            <Text color={DIM}>{'active'}</Text>
          </Text>
          <Text key="l2">
            <Text>{' '}</Text>
            <Text color={GRAY} strikethrough>{'name'}</Text>
            <Text color={DIM}>{sp('  shadowed')}</Text>
          </Text>
          <Text key="l3">
            <Text color={LINE}>{sp(' name  ')}</Text>
            <Text color={DIM}>{'off'}</Text>
          </Text>
          <Text key="l4" color={DIM}>{sp(' ≈     read off files')}</Text>
        </Box>
      </Box>
    ) : (
      <Box key="nav" flexDirection="column" marginBottom={1}>
        {chipRows(width).map((row, r) => (
          <Box key={`cr${r}`} flexDirection="row" columnGap={2}>
            {row.map(i => {
              const k = KINDS[i]!
              const c = counts(sections.find(x => x.kind === k.kind)!)
              return <Button key={`nav:${k.kind}`} plain hotkey={`${i + 1}`} dimColor={k.kind !== selected} label={sp(`${k.title} ${c.active}`)} onPress={noop} />
            })}
          </Box>
        ))}
      </Box>
    )

    const meta = KINDS.find(k => k.kind === section.kind)!
    const c = counts(section)
    const INDENT = 5 // rank, space, fold arrow: items sit under the scope label

    const itemRow = (s: ScopeNode, item: Item, n: number, colW: number) => {
      const rest = mainW - INDENT - 1
      const note = item.isInferred ? `≈ ${item.note ?? 'scope read off files'}` : item.note
      const tail = [item.detail, note].filter(Boolean).join('  ')
      const nameLen = Array.from(item.name).length
      const tailLen = Array.from(tail).length
      // a long name keeps its full width and drops its detail to a line of its own
      // a long built-in list stays one row per item, its descriptions cut
      const isSplit = !!tail && nameLen + tailLen + 1 > rest && s.id !== 'builtin'
      const nameW = !tail || isSplit ? rest : Math.min(Math.max(10, Math.floor(rest * 0.5)), Math.max(10, nameLen, colW))
      const tailW = isSplit ? rest - 2 : Math.max(0, rest - nameW - 1)
      const nameColor = item.isSelected ? ORANGE : item.status === 'active' ? IVORY : item.status === 'shadowed' ? GRAY : LINE
      const tailColor = item.status === 'shadowed' ? ORANGE : item.status === 'off' ? LINE : DIM
      const tailText = (
        <Text key="d" color={tailColor} wrap="truncate-end">
          {sp(` ${fit(tail, tailW)}`)}
        </Text>
      )
      const row = (
        <Box key={`i${n}`} flexDirection="row">
          <Text key="r">{sp(' '.repeat(INDENT))}</Text>
          <Text key="n" color={nameColor} strikethrough={item.status === 'shadowed'} bold={item.isSelected}>
            {sp(fit(item.name, nameW))}
          </Text>
          <Text key="p">{sp(' '.repeat(Math.max(0, nameW - Math.min(nameLen, nameW))))}</Text>
          {!isSplit && tailW > 2 && tail ? tailText : null}
        </Box>
      )
      if (!isSplit) return row
      return (
        <Box key={`i${n}`} flexDirection="column">
          {row}
          <Box key="t" flexDirection="row">
            <Text key="r">{sp(' '.repeat(INDENT + 1))}</Text>
            {tailText}
          </Box>
        </Box>
      )
    }

    const scopeBlock = (s: ScopeNode, rank: number) => {
      const isOpenScope = isExpanded(section.kind, s)
      const empty = s.items.length === 0
      const marker = empty ? ' ' : isOpenScope ? '▾' : '▸'
      const labelW = Math.min(19, Math.max(10, Math.floor(mainW * 0.34)))
      const whereW = Math.max(0, mainW - INDENT - labelW - 6)
      const body: RenderChildren[] = []
      if (isOpenScope && !empty) {
        // names line up in one column per scope, so the details read as a table
        const colW = Math.max(0, ...s.items.map(it => Array.from(it.name).length))
        s.items.forEach((it, i) => body.push(itemRow(s, it, i, colW)))
      } else if (!empty) {
        // a folded scope previews what it holds, so it reads as something to open
        body.push(
          <Text key="peek" wrap="truncate-end">
            <Text color={DIM}>{sp(' '.repeat(INDENT) + peek(s.items.map(it => it.name), mainW - INDENT - 16))}</Text>
            <Text color={ORANGE}>{sp('  click to open')}</Text>
          </Text>,
        )
      }
      if (s.note && (isOpenScope || empty)) {
        body.push(
          <Text key="note" color={DIM} italic>
            {sp(' '.repeat(INDENT) + fit(s.note, mainW - INDENT))}
          </Text>,
        )
      }
      return (
        <Box key={`s${s.id}`} flexDirection="column" marginBottom={empty ? 0 : 1}>
          <Box key="h" flexDirection="row">
            <Text key="n" color={empty ? LINE : ORANGE} bold={!empty}>{sp(cell(`${rank}`, 2, 'right'))}</Text>
            <Text key="g">{' '}</Text>
            <Button key={`scope:${section.kind}:${s.id}`} plain dimColor={empty} label={sp(cell(`${marker} ${SCOPE[s.id].label}`, labelW + 2))} onPress={noop} />
            <Text key="c" color={empty ? LINE : IVORY} bold={!empty}>{sp(cell(empty ? '—' : `${s.items.length}`, 4, 'right'))}</Text>
            <Text key="x">{'  '}</Text>
            {whereW > 4 ? <Text key="w" color={LINE}>{sp(fit(s.where, whereW))}</Text> : null}
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
          <Text color={ORANGE} bold>{sp(meta.title)}</Text>
          <Text color={DIM}>{sp(fit(`   ${summary}`, Math.max(1, mainW - meta.title.length)))}</Text>
        </Text>
        <Text key="rule" color={DIM} italic wrap="wrap">{sp(section.rule)}</Text>
        {section.extra ? <Text key="extra" color={ORANGE} wrap="wrap">{sp(section.extra)}</Text> : null}
        <Box key="gap" height={1} />
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
          <Text key="hint" color={DIM}>{sp(fit('1-9 or click a type · click a scope (▸ ▾) to open or fold it · r reads again', width))}</Text>
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

/** The first names that fit `width`, then how many more: `deploy, pdf-tools +3`. */
function peek(names: string[], width: number): string {
  let out = ''
  for (let i = 0; i < names.length; i++) {
    const more = names.length - i - 1
    const next = (out ? `${out}, ` : '') + names[i]
    const tail = more ? ` +${more}` : ''
    if (Array.from(next + tail).length > width) return out ? `${out} +${names.length - i}` : fit(names[i]!, width)
    out = next
  }
  return out
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
    const w = k.title.length + 7
    if (used && used + w > width) {
      rows.push([])
      used = 0
    }
    rows[rows.length - 1]!.push(i)
    used += w + 2
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
