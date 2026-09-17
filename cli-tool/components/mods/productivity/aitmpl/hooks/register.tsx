/* @jsx h */
/**
 * aitmpl — Claude Mod (EARLY ACCESS)
 *
 * `/aitmpl [query]` opens a component browser above the prompt: the catalog
 * of aitmpl.com (agents, commands, MCPs, settings, hooks, skills, loops,
 * mods) read live from the site's public JSON through `$.http.fetch`. Pick
 * a type or a trending component, filter, page through the list, open a
 * component, and install it from there (`$.process.run` with the CLI's
 * argv, no shell), drop its install command into the prompt for Claude
 * (`$.prompt.fill`) or open its page in the browser.
 *
 * Three hooks: `session.start` registers the command, `command.run` opens or
 * closes the browser, `ui.render` on AbovePrompt draws it from the surface's
 * own element table (Box, Text, Button, Input) with digit and letter
 * hotkeys; the fetches run from the hooks' own closures. Browsing costs no
 * tokens: nothing here enters the transcript.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   siteUrl:  string   the site whose catalog is browsed (default "https://www.aitmpl.com")
 *   pageSize: number   rows per page, at most what the band allows (default 8)
 */
import type { Register, RenderElement } from 'claude-code'
import {
  TYPES,
  filterItems,
  formatCount,
  installArgv,
  installCommandFor,
  padRight,
  pageOf,
  parseCounts,
  parseItems,
  parseTrending,
  sortByDownloads,
  truncate,
  typeByKey,
  webUrlFor,
  type GlobalStats,
  type Item,
  type Trending,
  type TypeInfo,
  type TypeKey,
} from './catalog.ts'

type View =
  | { kind: 'home' }
  | { kind: 'list'; type: TypeInfo; query: string; page: number }
  | { kind: 'detail'; type: TypeInfo; item: Item; query: string; page: number }
  // a trending row pressed before its type's catalog is in the cache
  | { kind: 'pending'; type: TypeInfo; name: string }

let open = false
let view: View = { kind: 'home' }
let counts: Record<string, number> | undefined
let trending: { rows: Trending[]; stats: GlobalStats } | undefined
const cache = new Map<TypeKey, Item[]>()
const loading = new Set<string>()
// a fetch that failed is not retried by a repaint: only refresh (or a new /aitmpl) clears it
const failed = new Set<string>()
let error: string | undefined
// what the last action did (install, open), drawn under the detail
let notice: { text: string; tone: 'info' | 'ok' | 'bad' } | undefined
let installing = false

const singular = (type: TypeInfo) => type.label.toLowerCase().replace(/s$/, '')

export const register: Register = (on, options) => {
  const siteUrl = typeof options.siteUrl === 'string' && options.siteUrl ? options.siteUrl : 'https://www.aitmpl.com'
  const pageSize = typeof options.pageSize === 'number' && options.pageSize > 0 ? Math.floor(options.pageSize) : 8
  const dataUrl = (file: string) => `${siteUrl.replace(/\/+$/, '')}/${file}`

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: 'aitmpl',
        description: 'Browse and install aitmpl.com components above the prompt (stop closes)',
        argumentHint: '[query | type | stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`aitmpl: /aitmpl not registered: ${err}`))
    return r
  })

  on('command.run', { command: 'aitmpl' }, async ($, e) => {
    const arg = e.args.trim()
    if (/^(stop|close|quit)$/i.test(arg)) {
      open = false
      $.ui.invalidate('ui.render')
      return { text: 'aitmpl browser closed' }
    }
    open = true
    error = undefined
    notice = undefined
    failed.clear()
    const type = arg ? typeByKey(arg.toLowerCase()) : undefined
    if (type) view = { kind: 'list', type, query: '', page: 0 }
    else if (arg) view = { kind: 'list', type: TYPES[0]!, query: arg, page: 0 }
    else view = { kind: 'home' }
    $.ui.invalidate('ui.render')
    return {
      text: 'aitmpl.com browser open above the prompt · digits and letters are hotkeys from an empty composer · /aitmpl stop closes',
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // a survey owns the band; the mobile surface has no Input element yet
    if (!open || e.props.hasSurvey || e.surface === 'mobile') return next(e)
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const cols = e.props.bodyColumns || (e.viewport?.columns ?? 80)
    // the rows the band grants: a tree taller than this scrolls and loses its bare-digit hotkeys,
    // so every view sizes its variable part to what is left after its fixed rows
    const maxRows = Math.max(1, e.props.maxRows)
    const repaint = () => $.ui.invalidate('ui.render')

    // --- data: fetched from the hook's own closures, once per file, cached for the session
    const loadCounts = () => {
      if (counts || loading.has('counts') || failed.has('counts')) return
      loading.add('counts')
      $.http
        .fetch(dataUrl('counts.json'))
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          counts = parseCounts(res.text)
        })
        .catch(err => {
          failed.add('counts')
          error = `counts.json: ${err instanceof Error ? err.message : String(err)} · refresh retries`
        })
        .finally(() => {
          loading.delete('counts')
          repaint()
        })
    }
    const loadTrending = () => {
      if (trending || loading.has('trending') || failed.has('trending')) return
      loading.add('trending')
      $.http
        .fetch(dataUrl('trending-data.json'))
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          trending = parseTrending(res.text, 6)
        })
        .catch(err => {
          // the home stands without its trending column
          $.ui.log(`aitmpl: trending-data.json: ${err instanceof Error ? err.message : String(err)}`)
          failed.add('trending')
          trending = { rows: [], stats: {} }
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
          error = undefined
        })
        .catch(err => {
          failed.add(type.key)
          error = `${type.key}.json: ${err instanceof Error ? err.message : String(err)} · refresh retries`
        })
        .finally(() => {
          loading.delete(type.key)
          repaint()
        })
    }

    // --- navigation
    const close = () => {
      open = false
      repaint()
    }
    const goHome = () => {
      view = { kind: 'home' }
      notice = undefined
      repaint()
    }
    const goList = (type: TypeInfo, query = '', page = 0) => {
      view = { kind: 'list', type, query, page }
      notice = undefined
      loadType(type)
      repaint()
    }

    // --- the frame every view shares: one header row, a dim context row, the body, a dim help row
    const frameRows = 3 + (error ? 1 : 0)
    const beneath = await next(e)
    const badge = (
      <Box flexShrink={0}>
        <Text bold inverse color="cyan">{' aitmpl.com '}</Text>
      </Box>
    )
    const frame = (args: { title: string; context?: string; nav: RenderElement[]; body: RenderElement; help: string }) => (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          {badge}
          <Box flexGrow={1} flexShrink={1}>
            <Text bold wrap="truncate-end">{args.title}</Text>
          </Box>
          <Box flexShrink={0} flexDirection="row" columnGap={1}>
            {args.nav}
          </Box>
        </Box>
        {args.context !== undefined ? <Text dimColor wrap="truncate-end">{truncate(args.context, cols)}</Text> : null}
        {error ? <Text color="red" wrap="truncate-end">{truncate(`⚠ ${error}`, cols)}</Text> : null}
        {args.body}
        <Text dimColor wrap="truncate-end">{truncate(args.help, cols)}</Text>
        {beneath}
      </Box>
    )
    const navClose = <Button key="aitmpl:close" label="close" hotkey="q" dimColor onPress={close} />
    const navHome = <Button key="aitmpl:home" label="home" hotkey="h" dimColor onPress={goHome} />

    // ---------------------------------------------------------------- home
    if (view.kind === 'home') {
      loadCounts()
      loadTrending()
      const stats = trending?.stats ?? {}
      const total = stats.totalComponents ?? (counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined)
      const facts = [
        total !== undefined ? `${formatCount(total)} components` : undefined,
        stats.totalDownloads !== undefined ? `${formatCount(stats.totalDownloads)} downloads` : undefined,
        stats.weeklyDownloads !== undefined ? `${formatCount(stats.weeklyDownloads)} this week` : undefined,
        stats.totalCountries !== undefined ? `${stats.totalCountries} countries` : undefined,
      ].filter((f): f is string => f !== undefined)
      const twoColumns = cols >= 78
      const leftWidth = 22
      const rightWidth = twoColumns ? cols - leftWidth - 3 : cols
      // fixed body rows: the Browse title, the 8 types, the search field; trending sits beside them in two
      // columns and is only stacked beneath when the band has the rows for it
      const homeRows = frameRows + 1 + TYPES.length + 1
      const spare = maxRows - homeRows
      const trendRows = (trending?.rows ?? []).slice(0, twoColumns ? TYPES.length : Math.max(0, spare - 1))
      const showTrending = twoColumns || trendRows.length > 0

      const typesColumn = (
        <Box flexDirection="column" width={leftWidth}>
          <Text bold>Browse</Text>
          {TYPES.map(t => {
            const n = counts?.[t.key]
            return (
              <Button
                key={`aitmpl:type:${t.key}`}
                label={`${padRight(t.label, 10)}${n !== undefined ? String(n).padStart(5) : '    …'}`}
                hotkey={t.hotkey}
                plain
                onPress={() => goList(t)}
              />
            )
          })}
        </Box>
      )
      const nameWidth = Math.max(12, Math.min(28, rightWidth - 20))
      const trendingColumn = (
        <Box flexDirection="column" width={rightWidth}>
          <Box flexDirection="row" columnGap={1}>
            <Text bold>Trending this week</Text>
            <Text dimColor>{loading.has('trending') ? 'loading…' : trendRows.length === 0 && trending ? 'unavailable' : ''}</Text>
          </Box>
          {trendRows.map((row, i) => (
            <Button
              key={`aitmpl:trend:${i}`}
              label={truncate(`${padRight(row.name, nameWidth)} ${padRight(singular(row.type), 7)} ${formatCount(row.downloadsWeek).padStart(5)}↓`, rightWidth - 4)}
              dimColor
              onPress={() => {
                view = { kind: 'pending', type: row.type, name: row.name }
                loadType(row.type)
                repaint()
              }}
            />
          ))}
        </Box>
      )

      return frame({
        title: 'Component catalog',
        context: facts.join(' · ') || (loading.has('counts') ? 'loading…' : ''),
        nav: [
          <Button key="aitmpl:refresh" label="refresh" hotkey="r" dimColor onPress={() => {
            counts = undefined
            trending = undefined
            cache.clear()
            failed.clear()
            error = undefined
            loadCounts()
            loadTrending()
            repaint()
          }} />,
          navClose,
        ],
        body: (
          <Box flexDirection="column">
            {twoColumns ? (
              <Box flexDirection="row" columnGap={3}>
                {typesColumn}
                {trendingColumn}
              </Box>
            ) : (
              <Box flexDirection="column">
                {typesColumn}
                {showTrending ? trendingColumn : null}
              </Box>
            )}
            <Input
              key="aitmpl:search-all"
              label="search"
              placeholder="a name, a category, words of a description"
              submitLabel="search"
              onSubmit={value => {
                const q = value.trim()
                if (q) goList(TYPES[0]!, q)
              }}
            />
          </Box>
        ),
        help: '1-8 open a type · click a trending row · Tab / Enter move and press · q closes',
      })
    }

    // ------------------------------------------------------------- pending
    if (view.kind === 'pending') {
      const { type, name } = view
      const items = cache.get(type.key)
      if (items) {
        const item = items.find(it => it.name === name || it.path?.replace(/\.(md|json)$/, '') === name)
        view = item ? { kind: 'detail', type, item, query: '', page: 0 } : { kind: 'list', type, query: name, page: 0 }
        repaint()
      } else if (failed.has(type.key)) {
        view = { kind: 'list', type, query: name, page: 0 }
        repaint()
      } else if (!loading.has(type.key)) {
        loadType(type)
      }
      return frame({
        title: name,
        context: `loading ${type.label.toLowerCase()}…`,
        nav: [navHome, navClose],
        body: <Box />,
        help: 'h home · q closes',
      })
    }

    // ---------------------------------------------------------------- list
    if (view.kind === 'list') {
      const { type, query } = view
      const items = cache.get(type.key)
      if (!items) loadType(type)
      // fixed body rows: the type row, the filter field, the table header (+ the empty-match line)
      const listRows = frameRows + 3
      const size = Math.max(1, Math.min(pageSize, maxRows - listRows))
      const matches = items ? filterItems(items, query) : []
      const { slice, page, pages } = pageOf(matches, view.page, size)
      const current = view
      const nameWidth = Math.max(14, Math.min(30, Math.floor(cols / 4)))
      const catWidth = cols >= 100 ? 16 : 0
      const descWidth = Math.max(8, cols - 4 - nameWidth - (catWidth ? catWidth + 2 : 0) - 8 - 2)

      const typeRow = (
        <Box flexDirection="row" columnGap={1} flexWrap="wrap">
          {TYPES.map(t => (
            <Button
              key={`aitmpl:type:${t.key}`}
              label={t.key === type.key ? `[${t.label.toLowerCase()}]` : t.label.toLowerCase()}
              dimColor={t.key !== type.key}
              onPress={() => goList(t, query)}
            />
          ))}
        </Box>
      )
      const tableHead = (
        <Text dimColor wrap="truncate-end">
          {`   ${padRight('name', nameWidth)}  ${catWidth ? padRight('category', catWidth) + '  ' : ''}${'↓'.padStart(6)}  description`}
        </Text>
      )
      const tableRows = slice.map((item, i) => {
        const n = page * size + i + 1
        const label = `${padRight(item.name, nameWidth)}  ${catWidth ? padRight(item.category, catWidth) + '  ' : ''}${formatCount(item.downloads).padStart(6)}  ${truncate(item.description, descWidth)}`
        return (
          <Button
            key={`aitmpl:item:${n}`}
            label={label}
            hotkey={i < 9 ? String(i + 1) : undefined}
            plain
            onPress={() => {
              view = { kind: 'detail', type, item, query, page }
              notice = undefined
              repaint()
            }}
          />
        )
      })

      return frame({
        title: type.label,
        context: items
          ? `${matches.length}${query ? ` of ${items.length} match "${query}"` : ' components'} · sorted by downloads · page ${page + 1}/${pages}`
          : loading.has(type.key)
            ? 'loading…'
            : '',
        nav: [
          <Button key="aitmpl:refresh" label="refresh" hotkey="r" dimColor onPress={() => {
            cache.delete(type.key)
            failed.delete(type.key)
            error = undefined
            loadType(type)
            repaint()
          }} />,
          <Button key="aitmpl:prev" label="◀ prev" hotkey="p" dimColor onPress={() => {
            view = { ...current, page: Math.max(0, page - 1) }
            repaint()
          }} />,
          <Button key="aitmpl:next" label="next ▶" hotkey="n" dimColor onPress={() => {
            view = { ...current, page: Math.min(pages - 1, page + 1) }
            repaint()
          }} />,
          navHome,
          navClose,
        ],
        body: (
          <Box flexDirection="column">
            {typeRow}
            <Input
              key="aitmpl:search"
              label="filter"
              placeholder="a name, a category, words of a description"
              value={query}
              submitLabel="filter"
              onSubmit={value => {
                view = { ...current, query: value.trim(), page: 0 }
                repaint()
              }}
            />
            {tableHead}
            {items && matches.length === 0 ? <Text dimColor>{`   nothing matches "${query}"`}</Text> : null}
            {tableRows}
          </Box>
        ),
        help: '1-9 open a row · p / n page · click a type to switch · r reloads the type · h home · q closes',
      })
    }

    // -------------------------------------------------------------- detail
    const { type, item, query, page } = view
    // the catalog is live data: the argv is the fixed CLI with a validated path, the URL http(s) only
    const argv = installArgv(item, type)
    const command = installCommandFor(item, type)
    const url = webUrlFor(siteUrl, item, type)
    const back = () => goList(type, query, page)
    const say = (text: string, tone: 'info' | 'ok' | 'bad') => {
      notice = { text, tone }
      repaint()
    }

    const install = () => {
      if (installing) return
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
          } else {
            const tail = (res.stderr || res.stdout).trim().split('\n').pop() ?? ''
            say(`✗ install failed (exit ${res.exitCode}) ${tail}`, 'bad')
          }
        })
        .catch(err => say(`✗ install failed: ${err instanceof Error ? err.message : String(err)}`, 'bad'))
        .finally(() => {
          installing = false
          $.ui.status(undefined)
          repaint()
        })
    }
    const toPrompt = () => {
      $.prompt
        .fill({ text: `Install the ${singular(type)} "${item.name}" from aitmpl.com by running: ${command}` })
        .then(r => say(r.isFilled ? '✓ install request written into the prompt: Enter sends it' : 'the prompt box is busy, try again', r.isFilled ? 'ok' : 'bad'))
        .catch(err => say(`✗ prompt.fill failed: ${err instanceof Error ? err.message : String(err)}`, 'bad'))
    }
    // the platform's URL opener, each an argv without a shell: `explorer.exe` on Windows (by its OS
    // variable), else `open` (macOS) then `xdg-open` (Linux); the URL was validated as http(s) above
    const openInBrowser = () => {
      if (!url) return say('✗ this component has no valid page URL', 'bad')
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
        .catch(err => say(`✗ could not open a browser (${err instanceof Error ? err.message : String(err)}) · ${url}`, 'bad'))
    }

    const tone = notice?.tone === 'ok' ? 'green' : notice?.tone === 'bad' ? 'red' : 'yellow'
    return frame({
      title: item.name,
      context: `${singular(type)} · ${item.category || 'uncategorized'} · ${formatCount(item.downloads)} downloads${url ? ` · ${url}` : ''}`,
      nav: [<Button key="aitmpl:back" label="◀ back" hotkey="b" dimColor onPress={back} />, navHome, navClose],
      body: (
        <Box flexDirection="column">
          <Box borderStyle="round" borderDimColor paddingX={1} width={Math.max(24, cols - 2)}>
            <Text wrap="wrap">{item.description || 'no description'}</Text>
          </Box>
          <Box flexDirection="row" columnGap={1}>
            <Text dimColor>$</Text>
            <Text color="green" wrap="truncate-end">{command}</Text>
          </Box>
          <Box flexDirection="row" columnGap={2}>
            <Button key="aitmpl:install" label={installing ? 'installing…' : 'install here'} hotkey="i" onPress={install} />
            <Button key="aitmpl:prompt" label="put command in prompt" hotkey="c" onPress={toPrompt} />
            {url ? <Button key="aitmpl:open" label="open on aitmpl.com" hotkey="o" onPress={openInBrowser} /> : null}
          </Box>
          {notice ? <Text color={tone} wrap="truncate-end">{truncate(notice.text, cols)}</Text> : null}
        </Box>
      ),
      help: 'i installs into this project · c writes the install request into the prompt · o opens the page in your browser · b back · q closes',
    })
  })
}
