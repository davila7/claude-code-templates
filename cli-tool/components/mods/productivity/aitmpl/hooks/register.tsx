/* @jsx h */
/**
 * aitmpl — Claude Mod (EARLY ACCESS)
 *
 * `/aitmpl [query | type | stop]` opens a side pane laid out like VS Code's
 * Extensions view: a search box, quick filters for the component types of
 * aitmpl.com, an Installed section (what is already under `.claude/` and
 * `~/.claude/`), and a Popular / Results section. Every row carries its
 * download count and a button that opens the component's page in the
 * browser; a row's name opens its detail, with install, put-the-command-in-
 * the-prompt and open-on-aitmpl.com.
 *
 * The catalog is read live from the site's public JSON (`trending-data.json`,
 * `components/{type}.json`) through `$.http.fetch` and cached for the session;
 * `downloads` is the per-component total the catalog generator publishes. In
 * the fullscreen terminal layout the engine docks the pane beside the
 * transcript, otherwise it sits above the prompt; Claude Desktop and VS Code
 * draw it in their own pane. Browsing costs no tokens.
 *
 * Installed detection reads agents (`agents/*.md`), commands (`commands/**.md`),
 * skills and mods (`skills/{name}/`; a directory holding
 * `.claude-plugin/plugin.json` is a mod) in `.claude/` and `~/.claude/`. Hooks,
 * settings, MCPs and loops are merged into JSON files, so they are not listed.
 *
 * Layout: every cell that must line up is a fixed-width Box and every run of
 * spaces inside a label is a no-break space off the terminal, since HTML
 * surfaces size a cell to its text and collapse spaces.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   siteUrl:  string   the site whose catalog is browsed (default "https://www.aitmpl.com")
 *   pageSize: number   rows shown per section before "show more" (default 8)
 *   columns:  number   width asked for the docked pane (default 48)
 */
import type { Register, RenderElement } from 'claude-code'
import {
  TYPES,
  catalogItemFor,
  dedupeInstalled,
  filterInstalled,
  formatCount,
  installArgv,
  installCommandFor,
  isInstalled,
  itemKey,
  nbsp,
  parseItems,
  parseTrending,
  searchEntries,
  sortByDownloads,
  stripExt,
  truncate,
  typeByKey,
  webUrlFor,
  type GlobalStats,
  type Installed,
  type Item,
  type Scope,
  type TypeInfo,
  type TypeKey,
} from './catalog.ts'

const PANE = 'aitmpl'

type View = { kind: 'browse' } | { kind: 'detail'; type: TypeInfo; item: Item }
type Entry = { name: string; kind: 'file' | 'dir' | 'other' }

let isOpen = false
let view: View = { kind: 'browse' }
let filter: TypeKey | 'all' = 'all'
let query = ''
let installed: Installed[] = []
let stats: GlobalStats | undefined
const cache = new Map<TypeKey, Item[]>()
const loading = new Set<string>()
// a fetch that failed is not retried by a repaint: only refresh (or a new /aitmpl) clears it
const failed = new Set<string>()
let error: string | undefined
// what the last action did (install, open), drawn under the header
let notice: { text: string; tone: 'info' | 'ok' | 'bad' } | undefined
let installing = false
let homeDir: string | undefined
const collapsed = { installed: false, list: false }
let shown = 0

const singular = (type: TypeInfo) => type.label.toLowerCase().replace(/s$/, '')
const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

// What is under `.claude/` of the project and of the user, by argv-free file listing.
async function scanInstalled(
  list: (path: string) => Promise<Entry[]>,
  exists: (path: string) => Promise<boolean>,
  home: string | undefined,
): Promise<Installed[]> {
  const roots: { root: string; scope: Scope }[] = [{ root: '.claude', scope: 'project' }]
  if (home) roots.push({ root: `${home.replace(/[\\/]+$/, '')}/.claude`, scope: 'user' })
  const out: Installed[] = []
  const safe = (path: string) => list(path).catch((): Entry[] => [])

  for (const { root, scope } of roots) {
    // agents and commands are `.md` files, possibly one directory deep (commands/{category}/x.md)
    for (const kind of ['agents', 'commands'] as const) {
      const dir = `${root}/${kind}`
      for (const entry of await safe(dir)) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) out.push({ type: kind, name: stripExt(entry.name), scope })
        else if (entry.kind === 'dir') {
          for (const inner of await safe(`${dir}/${entry.name}`)) {
            if (inner.kind === 'file' && inner.name.endsWith('.md')) out.push({ type: kind, name: stripExt(inner.name), scope })
          }
        }
      }
    }
    // skills and mods share `skills/`: a plugin manifest makes it a mod
    for (const entry of await safe(`${root}/skills`)) {
      if (entry.kind === 'file') continue
      const isMod = await exists(`${root}/skills/${entry.name}/.claude-plugin/plugin.json`).catch(() => false)
      out.push({ type: isMod ? 'mods' : 'skills', name: entry.name, scope })
    }
  }
  return dedupeInstalled(out)
}

export const register: Register = (on, options) => {
  const siteUrl = typeof options.siteUrl === 'string' && options.siteUrl ? options.siteUrl : 'https://www.aitmpl.com'
  const pageSize = typeof options.pageSize === 'number' && options.pageSize > 0 ? Math.floor(options.pageSize) : 8
  const columns =
    typeof options.columns === 'number' && options.columns >= 28 && options.columns <= 120 ? Math.floor(options.columns) : 48
  const dataUrl = (file: string) => `${siteUrl.replace(/\/+$/, '')}/${file}`

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: 'aitmpl',
        description: 'aitmpl.com components in a side pane: search, filter by type, installed, downloads (stop closes)',
        argumentHint: '[query | type | stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`aitmpl: /aitmpl not registered: ${err}`))
    return r
  })

  on('command.run', { command: 'aitmpl' }, async ($, e) => {
    const arg = e.args.trim()
    if (/^(stop|close|quit)$/i.test(arg)) {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      return { text: 'aitmpl pane closed' }
    }
    isOpen = true
    error = undefined
    notice = undefined
    failed.clear()
    view = { kind: 'browse' }
    shown = 0
    const type = arg ? typeByKey(arg.toLowerCase()) : undefined
    filter = type ? type.key : 'all'
    query = arg && !type ? arg : ''
    homeDir = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
    installed = await scanInstalled(
      path => $.fs.list(path),
      path => $.fs.exists(path),
      homeDir,
    ).catch(() => [])
    await $.ui.open({ id: PANE, title: 'aitmpl.com', focus: true, columns })
    $.ui.invalidate('ui.render')
    return {
      text: e.presentation.isFullscreen
        ? 'aitmpl.com pane open beside the transcript · click a row, or Tab and Enter · /aitmpl stop closes'
        : 'aitmpl.com pane open above the prompt; /tui fullscreen docks it beside the transcript · /aitmpl stop closes',
    }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    const r = await next(e)
    isOpen = false
    return r
  })

  // Claude may have installed something during the turn
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!isOpen || e.agentId) return r
    installed = await scanInstalled(
      path => $.fs.list(path),
      path => $.fs.exists(path),
      homeDir,
    ).catch(() => installed)
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    // the mobile surface has no Input element yet
    if (e.surface === 'mobile') return next(e)
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const W = Math.max(24, e.props.bodyColumns - 1)
    const pad = (text: string) => nbsp(text, e.surface)
    const repaint = () => $.ui.invalidate('ui.render')

    // --- data: fetched from the hook's own closures, once per file, cached for the session
    const loadTrending = () => {
      if (stats || loading.has('trending') || failed.has('trending')) return
      loading.add('trending')
      $.http
        .fetch(dataUrl('trending-data.json'))
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          stats = parseTrending(res.text, 0).stats
        })
        .catch(err => {
          // the header stands without its totals
          $.ui.log(`aitmpl: trending-data.json: ${message(err)}`)
          failed.add('trending')
          stats = {}
        })
        .finally(() => {
          loading.delete('trending')
          repaint()
        })
    }
    const loadType = (type: TypeInfo) => {
      if (cache.has(type.key) || loading.has(type.key) || failed.has(type.key)) return
      loading.add(type.key)
      $.http
        .fetch(dataUrl(`components/${type.key}.json`))
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          cache.set(type.key, sortByDownloads(parseItems(res.text)))
        })
        .catch(err => {
          failed.add(type.key)
          error = `${type.key}.json: ${message(err)} · refresh retries`
        })
        .finally(() => {
          loading.delete(type.key)
          repaint()
        })
    }
    const rescan = () =>
      scanInstalled(
        path => $.fs.list(path),
        path => $.fs.exists(path),
        homeDir,
      )
        .then(rows => {
          installed = rows
        })
        .catch(() => undefined)
        .finally(repaint)
    const say = (text: string, tone: 'info' | 'ok' | 'bad') => {
      notice = { text, tone }
      repaint()
    }

    // --- actions
    const install = (type: TypeInfo, item: Item) => {
      if (installing) return
      const argv = installArgv(item, type)
      if (!argv) return say('✗ this component has an unsafe path in the catalog; not installing it', 'bad')
      installing = true
      say(`installing ${item.name}…`, 'info')
      $.ui.status(`aitmpl: installing ${item.name}…`)
      $.process
        .run(argv, { timeoutMs: 180_000 })
        .then(res => {
          if (res.exitCode === 0) {
            say(`✓ installed ${item.name} into this project`, 'ok')
            $.ui.toast(`aitmpl: installed ${item.name}`)
            return rescan()
          }
          const tail = (res.stderr || res.stdout).trim().split('\n').pop() ?? ''
          say(`✗ install failed (exit ${res.exitCode}) ${tail}`, 'bad')
        })
        .catch(err => say(`✗ install failed: ${message(err)}`, 'bad'))
        .finally(() => {
          installing = false
          $.ui.status(undefined)
          repaint()
        })
    }
    // the platform's URL opener, each an argv without a shell: `explorer.exe` on Windows (by its OS
    // variable), else `open` (macOS) then `xdg-open` (Linux); the URL was validated as http(s)
    const openUrl = (url: string) => {
      say('opening in the browser…', 'info')
      $.env
        .get('OS')
        .then(os => {
          const openers: string[][] = /windows/i.test(os ?? '') ? [['explorer.exe', url]] : [['open', url], ['xdg-open', url]]
          return openers.reduce<Promise<void>>(
            (chain, argv) =>
              chain.catch(() =>
                $.process.run(argv, { timeoutMs: 10_000 }).then(r => {
                  if (r.exitCode !== 0) throw new Error(`${argv[0]} exited ${r.exitCode}`)
                }),
              ),
            Promise.reject(new Error('no opener')),
          )
        })
        .then(() => say(`✓ opened ${url}`, 'ok'))
        .catch(err => say(`✗ could not open a browser (${message(err)}) · ${url}`, 'bad'))
    }
    const toPrompt = (type: TypeInfo, item: Item) => {
      $.prompt
        .fill({ text: `Install the ${singular(type)} "${item.name}" from aitmpl.com by running: ${installCommandFor(item, type)}` })
        .then(r => say(r.isFilled ? '✓ install request written into the prompt: Enter sends it' : 'the prompt box is busy, try again', r.isFilled ? 'ok' : 'bad'))
        .catch(err => say(`✗ prompt.fill failed: ${message(err)}`, 'bad'))
    }
    const refresh = () => {
      stats = undefined
      cache.clear()
      failed.clear()
      error = undefined
      notice = undefined
      loadTrending()
      void rescan()
      repaint()
    }
    const setFilter = (to: TypeKey | 'all') => {
      filter = to
      shown = 0
      repaint()
    }

    // --- header: title, totals, refresh / close
    const facts = [
      stats?.totalComponents !== undefined ? `${formatCount(stats.totalComponents)} components` : undefined,
      stats?.totalDownloads !== undefined ? `${formatCount(stats.totalDownloads)} downloads` : undefined,
    ].filter((f): f is string => f !== undefined)
    loadTrending()
    const header = (
      <Box key="header" flexDirection="column" width={W}>
        <Box key="title-row" flexDirection="row" width={W}>
          <Box key="title" flexGrow={1} flexShrink={1}>
            <Text bold wrap="truncate-end">{'aitmpl.com'}</Text>
          </Box>
          <Box key="tools" flexShrink={0} flexDirection="row" columnGap={1}>
            <Button key="aitmpl:refresh" label="refresh" hotkey="r" dimColor onPress={refresh} />
            <Button key="aitmpl:close" label="close" dimColor onPress={() => void $.ui.close({ id: PANE })} />
          </Box>
        </Box>
        {facts.length > 0 ? <Text dimColor wrap="truncate-end">{truncate(facts.join(' · '), W)}</Text> : null}
        {error ? <Text color="red" wrap="truncate-end">{truncate(`⚠ ${error}`, W)}</Text> : null}
        {notice ? (
          <Text color={notice.tone === 'ok' ? 'green' : notice.tone === 'bad' ? 'red' : 'yellow'} wrap="wrap">
            {notice.text}
          </Text>
        ) : null}
      </Box>
    )

    // ------------------------------------------------------------- detail
    if (view.kind === 'detail') {
      const { type, item } = view
      const url = webUrlFor(siteUrl, item, type)
      const isHere = isInstalled(installed, type, item)
      return (
        <Box flexDirection="column" width={W}>
          {header}
          <Box key="back" marginTop={1}>
            <Button key="aitmpl:back" label="◀ back" hotkey="b" dimColor onPress={() => {
              view = { kind: 'browse' }
              notice = undefined
              repaint()
            }} />
          </Box>
          <Box key="name" marginTop={1} width={W}>
            <Text bold wrap="wrap">{item.name}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">
            {truncate(`${singular(type)} · ${item.category || 'uncategorized'} · ↓ ${formatCount(item.downloads)}${isHere ? ' · ✓ installed' : ''}`, W)}
          </Text>
          <Box key="desc" marginTop={1} borderStyle="round" borderDimColor paddingX={1} width={W}>
            <Text wrap="wrap">{item.description || 'no description'}</Text>
          </Box>
          <Box key="cmd" marginTop={1} flexDirection="row" columnGap={1} width={W}>
            <Box key="cmd-prompt" flexShrink={0} width={1}>
              <Text dimColor>{'$'}</Text>
            </Box>
            <Box key="cmd-text" flexGrow={1} flexShrink={1}>
              <Text color="green" wrap="wrap">{installCommandFor(item, type)}</Text>
            </Box>
          </Box>
          <Box key="actions" marginTop={1} flexDirection="column" rowGap={0}>
            <Button key="aitmpl:install" label={installing ? 'installing…' : isHere ? 'reinstall here' : 'install here'} hotkey="i" onPress={() => install(type, item)} />
            {url ? <Button key="aitmpl:open" label="open on aitmpl.com ↗" hotkey="o" onPress={() => openUrl(url)} /> : null}
            <Button key="aitmpl:prompt" label="put command in prompt" hotkey="c" onPress={() => toPrompt(type, item)} />
          </Box>
        </Box>
      )
    }

    // ------------------------------------------------------------- browse
    const activeTypes = filter === 'all' ? TYPES : [typeByKey(filter) ?? TYPES[0]!]
    // the catalogs behind the list, and behind the names found on disk
    for (const t of activeTypes) loadType(t)
    for (const row of installed) {
      const t = typeByKey(row.type)
      if (t) loadType(t)
    }
    const pending = activeTypes.filter(t => loading.has(t.key)).length

    const installedRows = filterInstalled(installed, filter, query)
    const entries = searchEntries(cache, activeTypes, query)
    const visible = entries.slice(0, shown || pageSize)

    const chips = (
      <Box key="chips" flexDirection="row" flexWrap="wrap" columnGap={1} width={W}>
        {[{ key: 'all' as const, label: 'All' }, ...TYPES.map(t => ({ key: t.key, label: t.label }))].map(c => (
          <Button
            key={`aitmpl:chip:${c.key}`}
            label={filter === c.key ? `[${c.label}]` : c.label}
            dimColor={filter !== c.key}
            onPress={() => setFilter(c.key)}
          />
        ))}
      </Box>
    )

    // One component, three lines, every cell a fixed-width Box so the desktop lines them up too.
    const row = (section: string, type: TypeInfo, name: string, item: Item | undefined, scope?: Scope) => {
      const id = `${section}:${type.key}:${name}`
      const isHere = scope !== undefined || (item ? isInstalled(installed, type, item) : false)
      const url = item ? webUrlFor(siteUrl, item, type) : undefined
      const open = () => {
        if (!item) return
        view = { kind: 'detail', type, item }
        notice = undefined
        repaint()
      }
      const meta = item
        ? `↓ ${formatCount(item.downloads)}${item.category ? ` · ${item.category}` : ''}`
        : `${scope ?? 'local'} · not in the catalog`
      return (
        <Box key={`row:${id}`} flexDirection="column" width={W} marginTop={1}>
          <Box key="l1" flexDirection="row" width={W}>
            <Box key="name" flexGrow={1} flexShrink={1}>
              {item ? (
                <Button key={`aitmpl:open:${id}`} plain label={pad(truncate(name, W - 10))} onPress={open} />
              ) : (
                <Text bold wrap="truncate-end">{truncate(name, W - 10)}</Text>
              )}
            </Box>
            <Box key="type" flexShrink={0} width={9} justifyContent="flex-end">
              <Text dimColor>{singular(type)}</Text>
            </Box>
          </Box>
          {item && item.description ? (
            <Box key="l2" width={W}>
              <Text dimColor wrap="truncate-end">{truncate(item.description, W)}</Text>
            </Box>
          ) : null}
          <Box key="l3" flexDirection="row" width={W} columnGap={1}>
            <Box key="meta" flexGrow={1} flexShrink={1}>
              <Text dimColor wrap="truncate-end">{truncate(meta, W - 16)}</Text>
            </Box>
            <Box key="act" flexShrink={0} flexDirection="row" columnGap={1}>
              {url ? <Button key={`aitmpl:view:${id}`} label="view ↗" dimColor onPress={() => openUrl(url)} /> : null}
              {isHere ? (
                <Text color="green">{'✓'}</Text>
              ) : item ? (
                <Button key={`aitmpl:install:${id}`} label={installing ? '…' : 'install'} onPress={() => install(type, item)} />
              ) : null}
            </Box>
          </Box>
        </Box>
      )
    }

    const section = (key: 'installed' | 'list', title: string, count: number, body: RenderElement[]) => (
      <Box key={`sec:${key}`} flexDirection="column" width={W} marginTop={1}>
        <Box key="head" flexDirection="row" width={W}>
          <Box key="title" flexGrow={1} flexShrink={1}>
            <Button
              key={`aitmpl:sec:${key}`}
              plain
              label={pad(`${collapsed[key] ? '▸' : '▾'} ${title}`)}
              onPress={() => {
                collapsed[key] = !collapsed[key]
                repaint()
              }}
            />
          </Box>
          <Box key="count" flexShrink={0} minWidth={4} justifyContent="flex-end">
            <Text bold color="cyan">{String(count)}</Text>
          </Box>
        </Box>
        {collapsed[key] ? null : body}
      </Box>
    )

    const installedBody = installedRows.map(r => {
      const type = typeByKey(r.type)!
      return row('inst', type, r.name, catalogItemFor(cache.get(r.type), r), r.scope)
    })
    const listBody: RenderElement[] = visible.map(en => row('list', en.type, en.item.name, en.item))
    if (entries.length > visible.length) {
      listBody.push(
        <Box key="more" marginTop={1}>
          <Button
            key="aitmpl:more"
            label={`show ${Math.min(pageSize, entries.length - visible.length)} more of ${entries.length - visible.length}`}
            dimColor
            onPress={() => {
              shown = (shown || pageSize) + pageSize
              repaint()
            }}
          />
        </Box>,
      )
    }
    if (entries.length === 0) {
      listBody.push(
        <Box key="none" marginTop={1}>
          <Text dimColor>{pending > 0 ? 'loading…' : query ? `nothing matches "${query}"` : 'nothing to show'}</Text>
        </Box>,
      )
    }

    return (
      <Box flexDirection="column" width={W}>
        {header}
        <Box key="search" marginTop={1} width={W}>
          <Input
            key="aitmpl:search"
            placeholder="Search components on aitmpl.com"
            value={query}
            autoFocus
            submitLabel="search"
            onInput={value => {
              query = value
              shown = 0
              repaint()
            }}
            onSubmit={value => {
              query = value.trim()
              shown = 0
              repaint()
            }}
          />
        </Box>
        <Box key="chips-wrap" marginTop={1}>
          {chips}
        </Box>
        {section('installed', 'Installed', installedRows.length, installedBody)}
        {section('list', query ? 'Results' : 'Popular', entries.length, listBody)}
        <Box key="foot" marginTop={1} width={W}>
          <Text dimColor wrap="wrap">
            {'Installed lists agents, commands, skills and mods found in .claude/ and ~/.claude/. ↓ is total downloads.'}
          </Text>
        </Box>
      </Box>
    )
  })
}
