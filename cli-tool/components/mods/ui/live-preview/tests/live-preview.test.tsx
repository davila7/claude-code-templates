// Run with: claude plugin test ui/live-preview
import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { cellsFor, editedPath, isWatched, pngSize, safeUrl, screenshotArgv, DEFAULT_WATCH, fromBase64 } from '../hooks/capture.ts'

// A 2x1 PNG: signature + IHDR (width 2, height 1).
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZGBgAQ6QF+0rLB+YAAAAASUVORK5CYII='

const PANE = {
  plugin: 'live-preview', component: 'Pane', requestId: 'live-preview',
  props: { title: 'Preview', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

function engine(on: On, w: { argv: string[][] }, exit = 0, mtime?: number) {
  on('command.register', () => ({ value: { command: 'preview' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('process.run', (_, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    w.argv.push(argv)
    const failing = exit !== 0 && argv.some(x => x.startsWith('--screenshot='))
    return { value: { exitCode: failing ? exit : 0, stdout: '', stderr: failing ? 'net::ERR_CONNECTION_REFUSED' : '' } }
  })
  on('fs.read', () => ({ value: { base64: PNG } }))
  on('fs.write', () => ({ value: undefined }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 70, mtimeMs: mtime ?? Date.now(), isLink: false } }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: '' }))
}

const settle = () => new Promise(r => setTimeout(r, 20))

describe('capture rules', () => {
  test('edits to frontend files count, generated and dependency files do not', () => {
    expect(isWatched('src/components/Grid.tsx', DEFAULT_WATCH)).toBe(true)
    expect(isWatched('src/styles/a.css', DEFAULT_WATCH)).toBe(true)
    expect(isWatched('node_modules\\x\\index.js', ['js'])).toBe(false)
    expect(isWatched('node_modules/x/index.js', DEFAULT_WATCH)).toBe(false)
    expect(isWatched('dist/app.js', DEFAULT_WATCH)).toBe(false)
    expect(isWatched('server/main.go', DEFAULT_WATCH)).toBe(false)
    expect(editedPath('Edit', { file_path: 'a.tsx' })).toBe('a.tsx')
    expect(editedPath('Read', { file_path: 'a.tsx' })).toBe(undefined)
  })

  test('only http(s) URLs are captured', () => {
    expect(safeUrl('http://localhost:4321')).toBe('http://localhost:4321/')
    expect(safeUrl('file:///etc/passwd')).toBe(undefined)
    expect(safeUrl('javascript:alert(1)')).toBe(undefined)
    expect(safeUrl('--remote-debugging-port=9222')).toBe(undefined)
  })

  test('the argv puts the URL last and sizes the window by device', () => {
    const argv = screenshotArgv('chromium', 'http://localhost:3000/', 'mobile', '.claude/previews/latest.png', ['--no-sandbox'])
    expect(argv[0]).toBe('chromium')
    expect(argv).toContain('--window-size=390,844')
    expect(argv).toContain('--no-sandbox')
    expect(argv[argv.length - 1]).toBe('http://localhost:3000/')
  })

  test('PNG size and cell box', () => {
    expect(pngSize(fromBase64(PNG))).toEqual({ width: 2, height: 1 })
    expect(cellsFor(1280, 800, 60, 40)).toEqual({ columns: 60, rows: 19 })
    expect(cellsFor(390, 844, 60, 20)).toEqual({ columns: 18, rows: 20 })
  })
})

describe('the pane', () => {
  test('a browser that exits 0 without writing the file is an error, not an old picture', { options: { browser: 'chromium' } }, async ($, on) => {
    const w = { argv: [] as string[][] }
    engine(on, w, 0, 0)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)
    await $.command.run({ command: 'preview', args: '' } as never)
    await settle()
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
    expect((await ui.find({ type: 'Text', text: /did not write/ }))?.text).toContain('latest.png')
    await ui.unmount()
  })

  test('/preview opens the pane, captures, and draws an Image in the terminal', { options: { browser: 'chromium' } }, async ($, on) => {
    const w = { argv: [] as string[][] }
    engine(on, w)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)
    await $.command.run({ command: 'preview', args: 'http://localhost:4321' } as never)
    await settle()
    const shot = w.argv.find(a => a.some(x => x.startsWith('--screenshot=')))
    expect(shot?.[shot.length - 1]).toBe('http://localhost:4321/')
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
    expect(await ui.find({ type: 'Image' })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /localhost:4321/ }))?.text).toContain('desktop')
    await ui.unmount()
  })

  test('an edit to a .tsx file takes a new capture at the end of the turn; a .go edit does not', { options: { browser: 'chromium' } }, async ($, on) => {
    const w = { argv: [] as string[][] }
    engine(on, w)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)
    await $.command.run({ command: 'preview', args: '' } as never)
    await settle()
    const before = w.argv.filter(a => a.some(x => x.startsWith('--screenshot='))).length
    await $.tool.call({ tool: 'Edit', file_path: 'server/main.go', old_string: 'a', new_string: 'b' } as never)
    await $.turn.complete({ answer: 'done' } as never)
    await settle()
    expect(w.argv.filter(a => a.some(x => x.startsWith('--screenshot='))).length).toBe(before)
    await $.tool.call({ tool: 'Edit', file_path: 'src/App.tsx', old_string: 'a', new_string: 'b' } as never)
    await $.turn.complete({ answer: 'done' } as never)
    await settle()
    expect(w.argv.filter(a => a.some(x => x.startsWith('--screenshot='))).length).toBe(before + 1)
  })

  test('a browser error is shown in the pane', { options: { browser: 'chromium' } }, async ($, on) => {
    const w = { argv: [] as string[][] }
    engine(on, w, 1)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)
    await $.command.run({ command: 'preview', args: '' } as never)
    await settle()
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
    expect((await ui.find({ type: 'Text', text: /exited/ }))?.text).toContain('ERR_CONNECTION_REFUSED')
    await ui.unmount()
  })

  test('surfaces without Image say where the capture is', { options: { browser: 'chromium' } }, async ($, on) => {
    const w = { argv: [] as string[][] }
    engine(on, w)
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as never)
    await $.command.run({ command: 'preview', args: '' } as never)
    await settle()
    for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface } as never)
      expect((await ui.find({ type: 'Text', text: /latest\.png/ }))?.text).toContain('.claude/previews/latest.png')
      await ui.unmount()
    }
  })
})
