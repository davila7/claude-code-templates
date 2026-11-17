/**
 * live-preview — Claude Mod
 *
 * A pane with a real screenshot of the app you are working on, taken by a
 * headless Chrome/Chromium/Edge from your dev server. It is taken again at the
 * end of every turn in which Claude edited a frontend file, so you see what
 * the change did without leaving the terminal. One button switches to a
 * phone-sized viewport, another adds the capture to your prompt as an
 * @-mention so Claude can look at it too.
 *
 * The picture is a terminal `Image` (kitty, Ghostty, iTerm2 3.5+ in
 * fullscreen, tmux with allow-passthrough). Claude Desktop, VS Code and the
 * mobile app have no Image element: there the pane says where the capture is.
 *
 * Needs Claude Code >= 2.1.310 (Image in tmux) or 2.1.305 (Image in iTerm2).
 */
import type { EngineInterface, Register } from 'claude-code'
import {
  BROWSER_CANDIDATES, DEFAULT_WATCH, SHOT_DIR_IGNORE, SHOT_PATH, VIEWPORTS, cellsFor, editedPath, fromBase64, isWatched, list,
  pngSize, safeUrl, screenshotArgv, type Device,
} from './capture.ts'

const PANE = 'live-preview'
const COMMAND = 'preview'

// Theme keys, so the pane reads on light and dark themes; in Claude's own theme `claude` is the Anthropic orange.
const IVORY = 'text'
const GRAY = 'subtle'
const DIM = 'inactive'
const ORANGE = 'claude'

interface Shot { png: string; width: number; height: number; at: number; url: string; device: Device; generation: number }

/** What the pane draws. Module state: a reload starts it over. */
const view = {
  url: 'http://localhost:3000',
  device: 'desktop' as Device,
  isOpen: false,
  dirty: false,
  busy: false,
  shot: undefined as Shot | undefined,
  error: undefined as string | undefined,
  browser: undefined as string | undefined,
  configuredBrowser: '',
  extraArgs: [] as string[],
  generation: 0,
  editsSince: 0,
}

async function findBrowser($: EngineInterface): Promise<string | undefined> {
  if (view.browser) return view.browser
  for (const candidate of view.configuredBrowser ? [view.configuredBrowser] : BROWSER_CANDIDATES) {
    try {
      const r = await $.process.run([candidate, '--version'], { timeoutMs: 5000 })
      if (r.exitCode === 0) return (view.browser = candidate)
    } catch {
      // not installed here: try the next one
    }
  }
  return undefined
}

/** An `Image` holds at most 2 MiB of decoded PNG. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

async function capture($: EngineInterface): Promise<void> {
  if (view.busy) return
  view.busy = true
  view.dirty = false
  // The picture is labelled with what it was taken of, even if the URL or device changes while the browser runs.
  const url = view.url
  const device = view.device
  if (view.isOpen) $.ui.invalidate('ui.render')
  try {
    const exe = await findBrowser($)
    if (!exe) {
      view.error = 'No Chrome, Chromium or Edge found. Set the `browser` option to its path.'
      return
    }
    // Chrome does not create the folder, and exits 0 when it cannot write: make it, and check the file is new.
    await $.fs.write(SHOT_DIR_IGNORE, '*\n')
    // The file must be newer than the one before this run (or new): Chrome exits 0 when it cannot write.
    const before = await $.fs.stat(SHOT_PATH).then(st => st.mtimeMs, () => undefined)
    const r = await $.process.run(screenshotArgv(exe, url, device, SHOT_PATH, view.extraArgs), { timeoutMs: 30000 })
    const stat = await $.fs.stat(SHOT_PATH).catch(() => undefined)
    if (r.exitCode === 0 && (!stat || (before !== undefined && stat.mtimeMs <= before))) {
      view.error = `The browser did not write ${SHOT_PATH}: ${(r.stderr || r.stdout).trim().split('\n').slice(-1)[0] ?? ''}`
      return
    }
    if (r.exitCode !== 0) {
      view.error = `The browser exited with ${r.exitCode}: ${(r.stderr || r.stdout).trim().split('\n').slice(-1)[0] ?? ''}`
      return
    }
    const { base64 } = await $.fs.read(SHOT_PATH, { as: 'bytes' })
    const size = pngSize(fromBase64(base64)) ?? VIEWPORTS[device]
    view.shot = { png: base64, width: size.width, height: size.height, at: Date.now(), url, device, generation: ++view.generation }
    view.error = undefined
    view.editsSince = 0
  } catch (err) {
    view.error = `Capture failed: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    view.busy = false
    if (view.isOpen) $.ui.invalidate('ui.render')
  }
  // A change made while the browser ran was skipped by the busy check: take it now.
  if (view.isOpen && (view.url !== url || view.device !== device)) await capture($)
}

export const register: Register = (on, options) => {
  view.url = safeUrl(typeof options.url === 'string' && options.url ? options.url : 'http://localhost:3000') ?? 'http://localhost:3000'
  const watch = list(options.watch).length > 0 ? list(options.watch).map(s => s.replace(/^\./, '').toLowerCase()) : DEFAULT_WATCH
  view.extraArgs = list(options.browserArgs)
  view.configuredBrowser = typeof options.browser === 'string' ? options.browser.trim() : ''

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({ name: COMMAND, description: 'Live screenshot of your dev server in a pane (url | mobile | desktop | stop)', argumentHint: '[url|mobile|desktop|stop]' })
      .catch(err => $.ui.log(`live-preview: /${COMMAND} not registered: ${err}`))
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'stop' || arg === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      view.isOpen = false
      return { text: 'live-preview closed' }
    }
    if (arg === 'mobile' || arg === 'desktop') view.device = arg
    else if (arg) {
      const u = safeUrl(arg)
      if (!u) return { text: `live-preview: "${arg}" is not an http(s) URL` }
      view.url = u
    }
    try {
      await $.ui.open({ id: PANE, title: 'Preview' })
    } catch (err) {
      return { text: `live-preview: pane not opened: ${err}` }
    }
    view.isOpen = true
    void capture($)
    return { text: `live-preview: ${view.url} · ${view.device} · updates after each turn that edits the frontend` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) view.isOpen = false
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    const path = editedPath(e.tool, (e as { input?: unknown }).input ?? e)
    // Only an edit that ran changes the page: a denied or failed one does not.
    const ran = r.deny === undefined && r.isError !== true
    if (ran && path && isWatched(path, watch)) { view.dirty = true; view.editsSince++ }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (view.isOpen && view.dirty) void capture($)
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const columns = Math.max(20, e.props.bodyColumns - 1)
    const bodyRows = e.props.scroll?.bodyRows ?? 24
    const age = view.shot ? Math.max(0, Math.round((Date.now() - view.shot.at) / 1000)) : 0
    const when = !view.shot ? '' : age < 60 ? `${age} s ago` : `${Math.round(age / 60)} min ago`

    const header = (
      <Box flexDirection="row" justifyContent="space-between">
        <Text weight="semibold" color={IVORY}>Preview</Text>
        <Text color={DIM}>{view.busy ? 'capturing…' : when}</Text>
      </Box>
    )
    const controls = (
      <Box flexDirection="row" gap="sm">
        <Button label="↻ Refresh" onPress={() => { void capture($) }} />
        <Button label={view.device === 'desktop' ? 'Mobile 390' : 'Desktop 1280'} onPress={() => { view.device = view.device === 'desktop' ? 'mobile' : 'desktop'; void capture($) }} />
        <Button label="Attach to prompt →" onPress={() => { void $.prompt.fill({ text: `@${SHOT_PATH} `, mode: 'append' }) }} />
      </Box>
    )
    const meta = <Text color={GRAY} wrap="truncate-middle">{view.url} · {view.device}{view.editsSince > 0 ? ` · ${view.editsSince} edits since` : ''}</Text>

    let picture
    if (view.error) picture = <Text color={ORANGE}>{view.error}</Text>
    else if (!view.shot) picture = <Text color={GRAY}>{view.busy ? 'Taking the first capture…' : 'No capture yet. Press Refresh, or wait for Claude to edit a frontend file.'}</Text>
    else if (e.surface === 'terminal' && view.shot.png.length * 3 / 4 > MAX_IMAGE_BYTES) {
      picture = <Text color={GRAY}>The capture ({view.shot.width}×{view.shot.height}) is over the 2 MiB a pane image may hold. It is at {SHOT_PATH}.</Text>
    } else if (e.surface === 'terminal') {
      const { Image } = $.ui.resolve(e)
      const cells = cellsFor(view.shot.width, view.shot.height, columns, Math.max(6, bodyRows - 6))
      picture = <Image key="shot" source={{ png: view.shot.png }} columns={cells.columns} rows={cells.rows} alt={`Screenshot of ${view.shot.url} (${view.shot.width}×${view.shot.height}). This terminal cannot draw images: see ${SHOT_PATH}`} />
    } else {
      picture = <Text color={GRAY}>This app draws no terminal images. The capture ({view.shot.width}×{view.shot.height}) is at {SHOT_PATH}.</Text>
    }

    return (
      <Box flexDirection="column" gap="sm">
        {header}
        {picture}
        {controls}
        {meta}
      </Box>
    )
  })
}
