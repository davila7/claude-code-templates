import { describe, expect, mock, test, tier } from 'claude-code/testing'
import { GIFS } from './fixtures/gifs'
import { IMAGES } from './fixtures/images'

tier('user')

const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/work' } as const
const band = (isWorking = false, maxRows = 10) => ({
  plugin: 'pixelband', surface: 'terminal', component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking, maxRows, bodyColumns: 80, scroll: { offset: 0, bodyRows: maxRows }, view: {} },
}) as const

/** Everything beneath the mod: store, env, clock, files, and a record of every frame blitted. */
function world(on: any, files: Record<string, string> = {}, mtimes: Record<string, number> = {}, env: Record<string, string> = {}, saved: Record<string, unknown> = {}) {
  const blits: any[] = []
  const panes: any[] = []
  const closed: any[] = []
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/work' }))
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.blit', ($: any, e: any) => { blits.push(e); return { value: undefined } })
  on('fs.read', ($: any, e: any) => (e.path in files ? { value: { base64: files[e.path] } } : { deny: 'no such file' }))
  on('process.run', () => ({ value: { exitCode: 127, stdout: '', stderr: 'not installed' } }))
  on('fs.list', ($: any, e: any) => {
    const dir = e.path.replace(/\/$/, '') + '/'
    const names = Object.keys(files).filter((p) => p.startsWith(dir) && !p.slice(dir.length).includes('/')).map((p) => p.slice(dir.length))
    return names.length ? { value: names.sort().map((name) => ({ name, kind: 'file', size: 1, isLink: false })) } : { deny: 'no such directory' }
  })
  on('fs.stat', ($: any, e: any) => (e.path in files ? { value: { kind: 'file', size: 1, mtimeMs: mtimes[e.path] ?? 0, isLink: false } } : { deny: 'missing' }))
  on('ui.open', ($: any, e: any) => { panes.push(e); return { value: { isPlaced: true } } })
  on('ui.close', ($: any, e: any) => { closed.push(e); return { value: undefined } })
  on('ui.panes', () => ({ value: panes.map((p) => ({ id: p.id, title: p.id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }))
  // What Claude Code itself draws in the band: nothing, which we stand in for with a marker.
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => { const { Text } = $.ui.resolve(e); return h(Text, {}, 'core') })
  mock.store(on, saved)
  mock.env(on, { HOME: '/Users/me', TMPDIR: '/tmp', ...env })
  const clock = mock.clock(on)
  return { blits, clock, panes, closed }
}

// Only the fields pixelband reads; the engine's other fields don't matter to it.
const pix = (args: string) => ({ command: 'pixelband', args }) as any
const complete = (reason: string) => ({ answer: 'x', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1', reason }) as any

describe('register', () => {
  test('before an image is set, the band says how to set one', async ($, on) => {
    world(on)
    await $.session.start(SESSION)
    const ui = await $.ui.mount(band())
    expect((await ui.find({ type: 'Text', text: /\/pixelband to pick/ }))).toBeDefined()
    await ui.unmount()
  })

  test('/pixelband set loads the image and the band draws it as pixel art', async ($, on) => {
    world(on, { '/Users/me/art.png': IMAGES.rgba8.png! })
    await $.session.start(SESSION)
    const r: any = await $.command.run(pix('set ~/art.png'))
    expect(r.text).toMatch(/^art\.png is now your banner/)  // no 'pixelband:' prefix: Claude Code adds the plugin's name itself
    const ui = await $.ui.mount(band())
    const art = await ui.find({ key: 'art' })
    expect(art?.type).toBe('Raster')
    expect(art?.props.rows).toBe(4)       // auto height: about a quarter of the 10 rows the band may take, at least 4
    expect(art?.props.columns).toBe(80)   // the whole width of the band
    await ui.unmount()
  })

  test('a bad path gets a friendly message', async ($, on) => {
    world(on)
    await $.session.start(SESSION)
    const r: any = await $.command.run(pix('set /nope.png'))
    expect(r.text).toMatch(/couldn't read \/nope\.png/)
  })

  test('the intro plays, then the animation stops by itself', async ($, on) => {
    const w = world(on, { '/a.png': IMAGES.rgba8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /a.png'))
    const ui = await $.ui.mount(band())
    await w.clock.advance(1000)
    const played = w.blits.length
    expect(played).toBeGreaterThan(3)
    await w.clock.advance(2000)
    expect(w.blits.length).toBe(played)   // idle: no timer running, no frames
    await ui.unmount()
  })

  test('turns drive the moods: light sweeps while working, then settles', async ($, on) => {
    const w = world(on, { '/a.png': IMAGES.rgba8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /a.png'))
    const ui = await $.ui.mount(band())
    await w.clock.advance(1000)            // let the intro finish
    const idleCells = w.blits[w.blits.length - 1].cells // the frame the intro settled on: the art itself

    await $.turn.start({ text: 'go', turnId: 't1' })
    const before = w.blits.length
    await w.clock.advance(800)
    const working = w.blits.slice(before)
    expect(working.length).toBeGreaterThan(5)
    expect(working.some((b) => b.cells !== idleCells)).toBe(true)

    await $.turn.complete(complete('answer'))
    const atAnswer = w.blits.length
    await w.clock.advance(200)
    expect(w.blits.slice(atAnswer).some((b) => b.cells !== idleCells && b.cells !== working[working.length - 1].cells),
      'a finished turn plays the done flash').toBe(true)
    await w.clock.advance(1800)
    const settled = w.blits.length
    await w.clock.advance(1000)
    expect(w.blits.length).toBe(settled)
    expect(w.blits[w.blits.length - 1].cells).toBe(idleCells) // back to the art exactly
    await ui.unmount()
  })

  test('an errored turn glitches and still settles back', async ($, on) => {
    const w = world(on, { '/a.png': IMAGES.rgba8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /a.png'))
    const ui = await $.ui.mount(band())
    await w.clock.advance(1000)
    const idleCells = w.blits[w.blits.length - 1].cells
    await $.turn.start({ text: 'go', turnId: 't1' })
    await $.turn.complete(complete('error'))
    const before = w.blits.length
    await w.clock.advance(200)
    expect(w.blits.slice(before).some((b) => b.cells !== idleCells)).toBe(true)
    await w.clock.advance(3000)
    expect(w.blits[w.blits.length - 1].cells).toBe(idleCells)
    await ui.unmount()
  })

  test('size and colours change the art; off hides the band and on brings it back', async ($, on) => {
    world(on, { '/a.png': IMAGES.rgba8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /a.png'))
    expect(((await $.command.run(pix('size 3'))) as any).text).toMatch(/3 rows/)
    let ui = await $.ui.mount(band())
    expect((await ui.find({ key: 'art' }))?.props.rows).toBe(3)
    await ui.unmount()

    await $.command.run(pix('off'))
    ui = await $.ui.mount(band())
    expect(await ui.find({ key: 'art' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'core' })).toBeDefined()
    await ui.unmount()

    await $.command.run(pix('on'))
    ui = await $.ui.mount(band())
    expect(await ui.find({ key: 'art' })).toBeDefined()
    await ui.unmount()
  })

  test('the band never takes more rows than Claude Code gives it', async ($, on) => {
    world(on, { '/a.png': IMAGES.rgba8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /a.png'))
    const ui = await $.ui.mount(band(false, 4))
    expect((await ui.find({ key: 'art' }))?.props.rows).toBeLessThanOrEqual(4)
    await ui.unmount()
  })

  test('--here makes it this project\'s banner; clear forgets it', async ($, on) => {
    world(on, { '/a.png': IMAGES.rgba8.png! })
    await $.session.start(SESSION)
    expect(((await $.command.run(pix('set /a.png --here'))) as any).text).toMatch(/this project's banner/)
    expect(((await $.command.run(pix('status'))) as any).text).toMatch(/showing a\.png \(this project\)/)
    await $.command.run(pix('clear --here'))
    const ui = await $.ui.mount(band())
    expect(await ui.find({ type: 'Text', text: /\/pixelband to pick/ })).toBeDefined()
    await ui.unmount()
  })

  test('status shows what is showing and lists the commands', async ($, on) => {
    world(on)
    await $.session.start(SESSION)
    expect(((await $.command.run(pix('status'))) as any).text).toMatch(/nothing showing yet[\s\S]*set <image>[\s\S]*scene <city/)
  })
})

const cellsOf = (b64: string) => Array.from(new Uint32Array(Uint8Array.fromBase64(b64).buffer))

describe('layout', () => {
  test('an opaque image fills the band as a full-width banner', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await w.clock.advance(1000)            // let the intro finish
    expect(((await $.command.run(pix('status'))) as any).text).toMatch(/, banner, original,/)
    const ui = await $.ui.mount(band())
    const art = await ui.find({ key: 'art' })
    expect([art?.props.columns, art?.props.rows]).toEqual([80, 4])
    const cells = cellsOf(art?.props.cells as string)
    expect(cells[0]).not.toBe(0x20)                               // no empty margin: it starts at the left edge
    await ui.unmount()
  })

  test('a see-through image (logo, sprite) shows whole and centred instead', async ($, on) => {
    world(on, { '/logo.png': IMAGES.rgba8.png! })   // a quarter of its pixels are transparent
    await $.session.start(SESSION)
    await $.command.run(pix('set /logo.png'))
    expect(((await $.command.run(pix('status'))) as any).text).toMatch(/, fit, /)
    const ui = await $.ui.mount(band())
    const cells = cellsOf((await ui.find({ key: 'art' }))?.props.cells as string)
    expect(cells.slice(0, 3)).toEqual([0x20, 0x01000000, 0x01000000]) // empty margin on the left...
    const row = cells.slice(0, 80 * 3)
    expect(row.slice(-3)).toEqual([0x20, 0x01000000, 0x01000000])     // ...and on the right
    await ui.unmount()
  })

  test('layout can be forced either way', async ($, on) => {
    const w = world(on, { '/logo.png': IMAGES.rgba8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /logo.png'))
    await w.clock.advance(1000)            // let the intro finish
    expect(((await $.command.run(pix('layout banner'))) as any).text).toBe('layout: banner.')
    expect(((await $.command.run(pix('layout auto'))) as any).text).toBe('layout: auto (fit for this image).')
    expect(((await $.command.run(pix('layout sideways'))) as any).text).toMatch(/^Usage/)
  })

  test('styles change the art, and an unknown one gets the list', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await w.clock.advance(1000)            // let the intro finish
    const draw = async () => { const ui = await $.ui.mount(band()); const c = (await ui.find({ key: 'art' }))?.props.cells; await ui.unmount(); return c }
    const original = await draw()
    expect(((await $.command.run(pix('style gameboy'))) as any).text).toBe('style: gameboy.')
    expect(await draw()).not.toBe(original)
    expect(((await $.command.run(pix('style vaporwave'))) as any).text).toMatch(/original\|gameboy\|pico8\|mono\|sepia/)
  })

  test('move and zoom aim the crop, and it is remembered', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await w.clock.advance(1000)            // let the intro finish
    const draw = async () => { const ui = await $.ui.mount(band()); const c = (await ui.find({ key: 'art' }))?.props.cells; await ui.unmount(); return c }
    const centred = await draw()
    expect(((await $.command.run(pix('zoom in'))) as any).text).toBe('zoom 1.25x.')
    expect(((await $.command.run(pix('move up 2'))) as any).text).toBe('crop centred at 50% across, 34% down.')
    const aimed = await draw()
    expect(aimed).not.toBe(centred)
    // a fresh session reads the same view back from the store
    await $.session.start(SESSION)
    expect(await draw()).toBe(aimed)
    expect(((await $.command.run(pix('zoom reset'))) as any).text).toBe('zoom 1x.')
    expect(await draw()).toBe(centred)
  })

  test('a huge terminal still gets a sensibly sized drawing', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await w.clock.advance(1000)            // let the intro finish
    await $.command.run(pix('size 24'))
    const ui = await $.ui.mount({ ...band(false, 60), props: { hasSurvey: false, isWorking: false, maxRows: 60, bodyColumns: 400, scroll: { offset: 0, bodyRows: 60 }, view: {} } })
    const art = await ui.find({ key: 'art' })
    expect(art?.props.columns).toBe(250)
    expect((art?.props.columns as number) * (art?.props.rows as number)).toBeLessThanOrEqual(6000)
    await ui.unmount()
  })
})

const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)) }
const PANE = {
  plugin: 'pixelband', surface: 'terminal', component: 'Pane', requestId: 'pixelband',
  props: { title: 'pixelband', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 14 }, view: {} },
} as const
const text = async (r: Promise<unknown>) => ((await r) as any).text as string

describe('scenes', () => {
  test('a scene draws and keeps moving while idle', async ($, on) => {
    const w = world(on)
    await $.session.start(SESSION)
    expect(await text($.command.run(pix('scene city')))).toBe('showing city: rain on a city at night.')
    const ui = await $.ui.mount(band())
    expect((await ui.find({ key: 'art' }))?.props.columns).toBe(80)
    await w.clock.advance(1000)
    const before = w.blits.length
    await w.clock.advance(800)                       // no turn running: the rain still falls
    expect(w.blits.length).toBeGreaterThanOrEqual(before + 9)
    expect(w.blits.at(-1).cells).not.toBe(w.blits.at(-2).cells)
    await ui.unmount()
  })

  test('animate off holds a scene still; unknown scenes get the list', async ($, on) => {
    const w = world(on)
    await $.session.start(SESSION)
    await $.command.run(pix('scene aurora'))
    const ui = await $.ui.mount(band())
    expect(await text($.command.run(pix('animate off')))).toBe('scenes and GIFs hold still.')
    await w.clock.advance(1500)
    const n = w.blits.length
    await w.clock.advance(1500)
    expect(w.blits.length).toBe(n)
    expect(await text($.command.run(pix('scene lava')))).toMatch(/^Scenes: city \(rain on a city at night\), space/)
    await ui.unmount()
  })

  test('a scene keeps the image underneath, and set replaces both', async ($, on) => {
    world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await $.command.run(pix('scene fire'))
    expect(await text($.command.run(pix('status')))).toMatch(/^showing the fire scene \(global\), original/)
    await $.session.start(SESSION)                   // remembered across sessions
    expect(await text($.command.run(pix('status')))).toMatch(/^showing the fire scene/)
    await $.command.run(pix('set /photo.png'))
    expect(await text($.command.run(pix('status')))).toMatch(/^showing photo\.png \(global\), banner/)
  })
})

describe('menu', () => {
  test('/pixelband alone opens the menu pane with the keyboard, and prints nothing', async ($, on) => {
    const w = world(on)
    await $.session.start(SESSION)
    const r: any = await $.command.run(pix(''))
    expect(r.text).toBeUndefined()
    expect(w.panes[0]).toMatchObject({ id: 'pixelband', focus: true, closeOnEscape: true })
  })

  test('picking a scene from the menu shows it in the band', async ($, on) => {
    world(on)
    await $.session.start(SESSION)
    await $.command.run(pix(''))
    const menu = await $.ui.mount(PANE)
    const src = await menu.find({ key: 'source' })
    expect((src?.props.options as any[]).map((o) => o.value)).toEqual(['none', 'scene:city', 'scene:space', 'scene:aurora', 'scene:fire', 'scene:creation', 'scene:matrix', 'scene:aquarium'])
    await menu.select({ key: 'source', value: 'scene:space' })
    await settle()
    expect(await text($.command.run(pix('status')))).toMatch(/^showing the space scene/)
    await menu.redraw()
    expect(await menu.find({ type: 'Text', text: /^showing space: stars/ })).toBeDefined()
    expect((await menu.find({ key: 'source' }))?.props.value).toBe('scene:space')
    expect(await menu.find({ key: 'animate' })).toBeDefined()   // scene controls, not crop ones
    expect(await menu.find({ key: 'up' })).toBeUndefined()
  })

  test('typing or dropping a path in the menu loads the image, then crop buttons appear', async ($, on) => {
    world(on, { '/Users/me/cat.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix(''))
    const menu = await $.ui.mount(PANE)
    await menu.input({ key: 'path', text: "'~/cat.png'" })
    await settle()
    await menu.redraw()
    expect(await menu.find({ type: 'Text', text: /^cat\.png is now your banner/ })).toBeDefined()
    await menu.press({ key: 'up' })
    await settle()
    expect(await text($.command.run(pix('move up')))).toBe('crop centred at 50% across, 34% down.')
  })

  test('recent images: the newest few from Downloads, Desktop and Pictures, one press each', async ($, on) => {
    world(on, {
      '/Users/me/Downloads/old.png': IMAGES.rgb8.png!,
      '/Users/me/Downloads/notes.txt': 'aGk=',
      '/Users/me/Desktop/new.png': IMAGES.rgba8.png!,
    }, { '/Users/me/Downloads/old.png': 100, '/Users/me/Desktop/new.png': 200 })
    await $.session.start(SESSION)
    await $.command.run(pix(''))
    await settle()
    const menu = await $.ui.mount(PANE)
    const recent = await menu.find({ key: 'recent' })
    expect((recent?.props.options as any[]).slice(1).map((o) => o.label)).toEqual(['new.png', 'old.png'])
    await menu.select({ key: 'recent', value: '/Users/me/Downloads/old.png' })
    await settle()
    expect(await text($.command.run(pix('status')))).toMatch(/^showing old\.png/)
  })

  test('undo puts everything back the way it was when the menu opened', async ($, on) => {
    world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await $.command.run(pix(''))
    const menu = await $.ui.mount(PANE)
    await menu.select({ key: 'style', value: 'gameboy' })
    await menu.select({ key: 'source', value: 'scene:city' })
    await menu.press({ key: 'rows+' })
    await settle()
    expect(await text($.command.run(pix('status')))).toMatch(/^showing the city scene \(global\), gameboy, 9 rows/)
    await menu.press({ key: 'revert' })
    await settle()
    expect(await text($.command.run(pix('status')))).toMatch(/^showing photo\.png \(global\), banner, original, auto height/)
  })

  test('where: move the banner to just this project and back', async ($, on) => {
    world(on)
    await $.session.start(SESSION)
    await $.command.run(pix('scene city'))
    await $.command.run(pix(''))
    const menu = await $.ui.mount(PANE)
    await menu.select({ key: 'scope', value: 'project' })
    await settle()
    expect(await text($.command.run(pix('status')))).toMatch(/\(this project\)/)
    await menu.select({ key: 'scope', value: 'global' })
    await settle()
    expect(await text($.command.run(pix('status')))).toMatch(/\(global\)/)
  })

  test('the menu says how to take the keyboard when it does not have it, and asks for it again', async ($, on) => {
    const w = world(on)
    await $.session.start(SESSION)
    await $.command.run(pix(''))
    const menu = await $.ui.mount({ ...PANE, props: { ...PANE.props, isFocused: false } })
    expect(await menu.find({ type: 'Text', text: /ctrl\+x then tab/ })).toBeDefined()
    await menu.redraw({ ...PANE.props, isFocused: true })
    expect(await menu.find({ type: 'Text', text: /Enter picks/ })).toBeDefined()
    await w.clock.advance(300)
    await settle()
    expect(w.panes.length).toBe(2)            // opened, then asked for the keyboard once more
  })

  test('no row is wider than the pane (a wrapped row garbles the terminal)', async ($, on) => {
    world(on, { '/Users/me/Downloads/Screenshot 2026-09-25 at 9.14.07 PM with a very long name indeed.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set "/Users/me/Downloads/Screenshot 2026-09-25 at 9.14.07 PM with a very long name indeed.png"'))
    await $.command.run(pix(''))
    await settle()
    const menu = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 50 } })
    for (const t of await menu.findAll({ type: 'Text' })) expect(String(t.text).length).toBeLessThanOrEqual(50)
    for (const sel of await menu.findAll({ type: 'Select' })) {
      for (const o of sel.props.options as any[]) expect(String(o.label ?? o.value).length + 10).toBeLessThanOrEqual(50)
    }
  })

  test('the menu ends with a quiet link to star the repo', async ($, on) => {
    world(on)
    await $.session.start(SESSION)
    await $.command.run(pix(''))
    const menu = await $.ui.mount(PANE)
    const link = await menu.find({ type: 'Link' })
    expect(link?.props.href).toBe('https://github.com/furqan-khan07/pixelband')
  })

  test('Done closes the pane', async ($, on) => {
    const w = world(on)
    await $.session.start(SESSION)
    await $.command.run(pix(''))
    const menu = await $.ui.mount(PANE)
    await menu.press({ key: 'done' })
    await settle()
    expect(w.closed[0]).toMatchObject({ id: 'pixelband' })
  })
})

describe('height', () => {
  const tall = (isWorking = false) => ({ ...band(isWorking, 29) })
  const rowsOf = async (ui: any) => (await ui.find({ key: 'art' }))?.props.rows

  test('auto height is about a quarter of the terminal', async ($, on) => {
    world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    const ui = await $.ui.mount(tall())
    expect(await rowsOf(ui)).toBe(8)
    expect(await text($.command.run(pix('size 12')))).toMatch(/^12 rows tall/)
    await ui.redraw()
    expect(await rowsOf(ui)).toBe(12)
    expect(await text($.command.run(pix('size auto')))).toBe('auto height: about a quarter of the terminal.')
    await ui.redraw()
    expect(await rowsOf(ui)).toBe(8)
    await ui.unmount()
  })

  test('while Claude works the band slides down to a slim strip, then grows back', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    const ui = await $.ui.mount(tall())
    await w.clock.advance(1000)
    await $.turn.start({ prompt: 'hi', turnId: 't1' } as any)
    await w.clock.advance(80)
    await ui.redraw(tall(true).props)
    expect(await rowsOf(ui)).toBe(6)                 // gliding: two rows a frame
    await w.clock.advance(400)
    await ui.redraw(tall(true).props)
    expect(await rowsOf(ui)).toBe(3)
    await $.turn.complete(complete('answer') as any)
    await w.clock.advance(1500)
    await ui.redraw(tall(false).props)
    expect(await rowsOf(ui)).toBe(8)
    await ui.unmount()
  })

  test('or it can hide while Claude works, or stay full size', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    expect(await text($.command.run(pix('working hide')))).toMatch(/hides/)
    const ui = await $.ui.mount(tall())
    await $.turn.start({ prompt: 'hi', turnId: 't1' } as any)
    await w.clock.advance(1000)
    await ui.redraw(tall(true).props)
    expect(await ui.find({ key: 'art' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'core' })).toBeDefined()
    expect(await text($.command.run(pix('working full')))).toMatch(/stays full size/)
    await ui.redraw(tall(true).props)
    expect(await rowsOf(ui)).toBe(8)
    expect(await text($.command.run(pix('working sideways')))).toMatch(/^Usage/)
    await ui.unmount()
  })
})

describe('256 colours', () => {
  const XTERM = new Set<number>()
  for (const r of [0, 95, 135, 175, 215, 255]) for (const g of [0, 95, 135, 175, 215, 255]) for (const b of [0, 95, 135, 175, 215, 255]) XTERM.add((r << 16) | (g << 8) | b)
  for (let k = 0; k < 24; k++) XTERM.add(((8 + 10 * k) << 16) | ((8 + 10 * k) << 8) | (8 + 10 * k))
  const colorsOf = (cells: string) => cellsOf(cells).filter((_, i) => i % 3 !== 0).filter((c) => c !== 0x01000000)

  test('in macOS Terminal the band uses only colours the terminal can show', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! }, {}, { TERM_PROGRAM: 'Apple_Terminal' })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await w.clock.advance(1000)
    const ui = await $.ui.mount(band())
    const cols = colorsOf((await ui.find({ key: 'art' }))?.props.cells as string)
    expect(cols.length).toBeGreaterThan(0)
    expect(cols.every((c) => XTERM.has(c))).toBe(true)
    expect(await text($.command.run(pix('status')))).toMatch(/256 colours/)
    await ui.unmount()
  })

  test('full-colour terminals are left alone, and the mode can be forced', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await w.clock.advance(1000)
    const ui = await $.ui.mount(band())
    expect(colorsOf((await ui.find({ key: 'art' }))?.props.cells as string).every((c) => XTERM.has(c))).toBe(false)
    expect(await text($.command.run(pix('colormode 256')))).toBe('colours: 256 colours.')
    await ui.redraw()
    expect(colorsOf((await ui.find({ key: 'art' }))?.props.cells as string).every((c) => XTERM.has(c))).toBe(true)
    expect(await text($.command.run(pix('colormode auto')))).toBe('colours: auto (full colour in this terminal).')
    expect(await text($.command.run(pix('colormode 16')))).toMatch(/^Usage/)
    await ui.unmount()
  })
})

describe('scope', () => {
  test('a command changes what this project shows, even when it has its own banner', async ($, on) => {
    world(on)
    await $.session.start(SESSION)
    await $.command.run(pix('scene city --here'))
    expect(await text($.command.run(pix('scene creation')))).toBe("showing creation: Michelangelo's hands and a spark (this project).")
    expect(await text($.command.run(pix('status')))).toMatch(/^showing the creation scene \(this project\)/)
  })
})

describe('fine pixels', () => {
  test('fine pixels draw four pixels per character in the same space', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! })
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await w.clock.advance(1000)
    expect(await text($.command.run(pix('pixels fine')))).toMatch(/^fine pixels in this terminal/)
    const ui = await $.ui.mount(band())
    const art = await ui.find({ key: 'art' })
    expect([art?.props.columns, art?.props.rows]).toEqual([80, 4])
    const glyphs = new Set(cellsOf(art?.props.cells as string).filter((_, i) => i % 3 === 0))
    expect([...glyphs].some((g) => ![0x2580, 0x2584, 0x20].includes(g))).toBe(true)   // side halves and quadrants, which standard never uses
    expect(await text($.command.run(pix('pixels huge')))).toMatch(/^Usage/)
    await ui.unmount()
  })
})

describe('animated GIFs', () => {
  test('a GIF plays in the band, keeps playing while idle, and is remembered', async ($, on) => {
    const w = world(on, { '/Users/me/loop.gif': GIFS.bounce.gif })
    await $.session.start(SESSION)
    expect(await text($.command.run(pix('set ~/loop.gif')))).toBe('loop.gif is now your banner (6 frames, 24x16, read via gif).')
    const ui = await $.ui.mount(band())
    await w.clock.advance(1000)
    const seen = new Set<string>()
    const from = w.blits.length
    await w.clock.advance(700)
    for (const b of w.blits.slice(from)) seen.add(b.cells)
    expect(seen.size).toBeGreaterThanOrEqual(3)          // the ball moves
    expect(await text($.command.run(pix('status')))).toMatch(/^showing loop\.gif \(global\), banner, 6 frames/)
    await $.session.start(SESSION)
    expect(await text($.command.run(pix('status')))).toMatch(/6 frames/)
    await ui.unmount()
  })

  test('pausing holds the frame; the menu offers both crop and motion', async ($, on) => {
    const w = world(on, { '/loop.gif': GIFS.bounce.gif })
    await $.session.start(SESSION)
    await $.command.run(pix('set /loop.gif'))
    const ui = await $.ui.mount(band())
    await $.command.run(pix('animate off'))
    await w.clock.advance(1500)
    const n = w.blits.length
    await w.clock.advance(1000)
    expect(w.blits.length).toBe(n)
    await ui.unmount()
    await $.command.run(pix(''))
    const menu = await $.ui.mount(PANE)
    expect(await menu.find({ key: 'up' })).toBeDefined()
    expect(await menu.find({ key: 'animate' })).toBeDefined()
  })
})

describe('per-terminal pixels', () => {
  const glyphsOf = async (ui: any) => new Set(cellsOf((await ui.find({ key: 'art' }))?.props.cells as string).filter((_, i) => i % 3 === 0))
  const saved = { config: { pixelsFor: { Apple_Terminal: 'fine' } } }

  test('fine pixels saved for macOS Terminal are used there', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! }, {}, { TERM_PROGRAM: 'Apple_Terminal' }, saved)
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await w.clock.advance(1000)
    const ui = await $.ui.mount(band())
    expect([...(await glyphsOf(ui))].some((g) => ![0x2580, 0x2584, 0x20].includes(g))).toBe(true)
    await ui.unmount()
  })

  test('...and another terminal app keeps standard pixels', async ($, on) => {
    const w = world(on, { '/photo.png': IMAGES.rgb8.png! }, {}, { TERM_PROGRAM: 'vscode' }, saved)
    await $.session.start(SESSION)
    await $.command.run(pix('set /photo.png'))
    await w.clock.advance(1000)
    const ui = await $.ui.mount(band())
    expect([...(await glyphsOf(ui))].every((g) => [0x2580, 0x2584, 0x20].includes(g))).toBe(true)
    expect(await text($.command.run(pix('pixels fine')))).toBe('fine pixels in vscode: four per character, for fonts with tight line spacing.')
    await ui.unmount()
  })
})

describe('review fixes', () => {
  test('"only this project" moves the banner: it stops showing everywhere else', async ($, on) => {
    world(on)
    await $.session.start(SESSION)
    await $.command.run(pix('scene city'))
    await $.command.run(pix(''))
    const menu = await $.ui.mount(PANE)
    await menu.select({ key: 'scope', value: 'project' })
    await settle()
    expect(await text($.command.run(pix('status')))).toMatch(/\(this project\)/)
    // Clearing this project's banner now leaves nothing: there's no global copy left behind.
    await $.command.run(pix('clear --here'))
    expect(await text($.command.run(pix('status')))).toMatch(/^nothing showing yet/)
  })

  test('clear clears what is showing, even when it is this project\'s own banner', async ($, on) => {
    world(on)
    await $.session.start(SESSION)
    await $.command.run(pix('scene city --here'))
    expect(await text($.command.run(pix('clear')))).toBe("cleared this project's banner.")
    expect(await text($.command.run(pix('status')))).toMatch(/^nothing showing yet/)
  })
})
