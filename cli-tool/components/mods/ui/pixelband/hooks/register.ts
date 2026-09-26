/**
 * pixelband: pixel art above the Claude Code prompt that reacts while Claude works.
 *
 *   /pixelband                        open the menu: pick an image or scene, style, size, crop
 *   /pixelband set <image> [--here]   use an image (drag a file into the terminal for the path);
 *                                     --here makes it this project's banner only
 *   /pixelband scene <name> [--here]  an animated scene instead: city, space, aurora or fire
 *   /pixelband style <name>           original, gameboy, pico8, mono or sepia
 *   /pixelband layout <mode>          banner (full width, cropped), fit (whole image), or auto
 *   /pixelband move <dir> [n]         aim the banner's crop: up, down, left, right
 *   /pixelband zoom <in|out|reset>    crop tighter or wider
 *   /pixelband size <rows>            how tall the band is (2-24 rows, two pixels per row)
 *   /pixelband colors <n>             palette size (2-32) for the original and sepia styles
 *   /pixelband on | off               show or hide it
 *   /pixelband clear [--here]         forget the image
 *   /pixelband demo <mood>            play working, done, error or intro (handy for screenshots)
 *
 * How it hangs together: the band is drawn by hooking `ui.render` for `AbovePrompt` with one Raster
 * element. Turn events set a mood; while something is animating (a mood, or a scene), a clock timer
 * builds the next frame and swaps it into the Raster with `$.ui.blit`, so nothing else redraws. The
 * menu is a pane (`ui.render` for `Pane`) whose controls call the same actions as the commands.
 */
import type { Register, RenderElement } from 'claude-code'
import { decodeAnim, encodeAnim, frameAt, spread, stack, type Anim, type StoredAnim } from './anim'
import { DURATION, FRAME_MS, frame, isOneShot, type Mood } from './effects'
import { cleanPath, loadImage, type Io } from './load'
import { cropRect, DEFAULT_VIEW, downscale, downscaleRegion, fit, shrinkToFit, transparency, TRANSPARENT, type Art, type View } from './pixelate'
import type { Rgba } from './png'
import { to256 } from './palette256'
import { cellsFor, quadCellsFor, rowsFor } from './raster'
import { isScene, makeScene, SCENES, type Renderer, type SceneName } from './scenes'
import { STYLES, stylize, type Style } from './styles'

type Layout = 'auto' | 'banner' | 'fit'
type Scope = 'project' | 'global'
type WhileWorking = 'slim' | 'full' | 'hide'
type ColorMode = 'auto' | 'full' | '256'
/** standard: two pixels per cell (half blocks). fine: four (quadrants), for nearly square cells. */
type Pixels = 'standard' | 'fine'
/** `rows` 0 means auto: about a quarter of the terminal. */
interface Config { rows: number; colors: number; enabled: boolean; style: Style; layout: Layout; animate: boolean; whileWorking: WhileWorking; colorMode: ColorMode
  /** Pixels per character, per terminal app: the right choice depends on that terminal's font. */
  pixelsFor: Record<string, Pixels> }
/**
 * What a scope's slot in the store holds: the image (RGB when fully opaque, a quarter smaller;
 * RGBA otherwise) and/or a scene. A scene wins while set, and keeps the image for switching back.
 */
interface Stored { w?: number; h?: number; rgb?: string; rgba?: string; anim?: StoredAnim; name?: string; scene?: string }

type Source =
  | { kind: 'image'; image: Rgba; name: string; clear: number; anim?: Anim }
  | { kind: 'scene'; scene: SceneName }

const DEFAULTS: Config = { rows: 0, colors: 16, enabled: true, style: 'original', layout: 'auto', animate: true, whileWorking: 'slim', colorMode: 'auto', pixelsFor: {} }
/** How tall the band gets while Claude works, in 'slim' mode: out of the way, still animating. */
const SLIM_ROWS = 3
/** Rows the band grows or shrinks by per frame when it changes height. */
const ROW_STEP = 2
/** Longest side of the copy we keep; wide enough for a full-width banner. The store caps at 4 MiB total. */
const STORED_MAX_SIDE = 320
const MAX_COLS = 250
/** Upper bound on cells per drawing, so a huge terminal can't produce an unreasonably big frame. */
const MAX_CELLS = 6000
/** Images at least this see-through (logos, sprites) default to showing whole instead of cropped. */
const FIT_IF_TRANSPARENT = 0.15
const MOVE_STEP = 0.08
const KEY = 'art'
const MENU = 'pixelband'
const REPO_URL = 'https://github.com/furqan-khan07/pixelband'
const IMAGE_FILE = /\.(png|jpe?g|heic|heif|webp|gif|bmp|tiff?|avif)$/i
const RECENT_DIRS = ['Downloads', 'Desktop', 'Pictures']

/** Where each scene's slim strip looks, as a fraction of its height: windows over the street, the planet... */
const SLIM_FOCUS: Record<SceneName, number> = { city: 0.66, space: 0.58, aurora: 0.5, fire: 0.7, creation: 0.5, matrix: 0.5, aquarium: 0.55 }

export const SCENE_LABELS: Record<SceneName, string> = {
  city: 'rain on a city at night',
  space: 'stars and a ringed planet',
  aurora: 'northern lights',
  fire: 'a wall of fire',
  creation: "Michelangelo's hands and a spark",
  matrix: 'green code rain',
  aquarium: 'fish, bubbles and weed',
}

/** Pixels across for a band `cols` cells wide. */
const pixelCols = (cols: number, pixels: Pixels) => (pixels === 'fine' ? cols * 2 : cols)

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)))
/** Auto height: about a quarter of what the band may take, 4 to 8 rows. */
const autoRows = (maxRows: number) => clampInt(maxRows * 0.28, 4, 8)

/**
 * The engine calls needed outside a hook's own `$`: the animation timer and the menu's buttons run
 * later. A mod may not keep `$` itself, so session.start captures each call as a small function,
 * the way Anthropic's own diff mod does.
 */
interface Host {
  every: (ms: number, fn: () => void) => { cancel: () => void }
  after: (ms: number, fn: () => void) => unknown
  blit: (args: { requestId: string; key: string; cells: string; columns: number; rows: number }) => unknown
  invalidate: () => unknown
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<unknown>
  del: (key: string) => Promise<unknown>
  home: () => Promise<unknown>
  list: (path: string) => Promise<unknown>
  stat: (path: string) => Promise<unknown>
  open: () => Promise<unknown>
  close: () => Promise<unknown>
  panes: () => Promise<unknown>
  io: Io
}

export const register: Register = (on) => {
  let host: Host | null = null
  let root = ''
  let config: Config = { ...DEFAULTS }
  let source: Source | null = null
  let scope: Scope | null = null
  let imageName = '' // the image kept in the slot, even while a scene shows
  let view: View = { ...DEFAULT_VIEW }
  /** Whether the saved state has been looked up yet, so the "no image" hint doesn't flash at startup. */
  let ready = false

  /** The image's art per frame (one entry for a still), for the band size and look in `artKey`. */
  let frameArts = new Map<number, Art>()
  let artKey = ''
  /** A few of an animation's frames stacked, for the palette every frame shares. */
  let animSample: Rgba | null = null
  let animT = 0
  let renderer: Renderer | null = null
  let rendererKey = ''
  let sceneCache: { key: string; art: Art } | null = null
  /** Where the Raster is mounted, so the timer can blit frames into it. `want` is the size asked for. */
  let band: { requestId: string; columns: number; rows: number; want: { rows: number; cols: number } } | null = null

  let mood: Mood = 'idle'
  let ticks = 0
  let working = false
  let timer: { cancel: () => void } | null = null
  let sceneT = 0
  let energy = 0
  /** The band's size limits from its last render, and how many rows it shows right now. */
  let limits: { cols: number; maxRows: number } | null = null
  /** Whether this terminal looks like it only shows 256 colours (macOS Terminal before macOS 26). */
  let only256 = false
  /** Which terminal app this session runs in (TERM_PROGRAM), for settings that depend on it. */
  let terminal = 'unknown'
  const pixelsNow = (): Pixels => config.pixelsFor?.[terminal] ?? 'standard'
  const use256 = () => config.colorMode === '256' || (config.colorMode === 'auto' && only256)
  let shownRows = -1

  // The menu's own state.
  let note = ''
  let recent: { name: string; path: string }[] = []
  let snapshot: { config: Config; slots: [string, unknown][] } | null = null

  const projectKey = () => `image:${root}`
  const slotKey = (s: Scope) => (s === 'project' ? projectKey() : 'image:global')
  const viewKeyFor = (s: Scope) => `view:${s === 'project' ? root : 'global'}`
  const here = (): Scope => scope ?? 'global'

  function encodeImage(img: Rgba, name: string): Stored {
    if (transparency(img) > 0) return { w: img.width, h: img.height, rgba: img.data.toBase64(), name }
    const rgb = new Uint8Array(img.width * img.height * 3)
    for (let i = 0, j = 0; i < img.data.length; i += 4, j += 3) { rgb[j] = img.data[i]; rgb[j + 1] = img.data[i + 1]; rgb[j + 2] = img.data[i + 2] }
    return { w: img.width, h: img.height, rgb: rgb.toBase64(), name }
  }

  function decodeImage(s: Stored | undefined): Rgba | null {
    if (!s || typeof s.w !== 'number' || typeof s.h !== 'number') return null
    if (s.anim) return decodeAnim(s.w, s.h, s.anim).frames[0]
    if (typeof s.rgba === 'string') return { width: s.w, height: s.h, data: Uint8Array.fromBase64(s.rgba) }
    if (typeof s.rgb !== 'string') return null
    const rgb = Uint8Array.fromBase64(s.rgb)
    const data = new Uint8Array(s.w * s.h * 4)
    for (let i = 0, j = 0; j < rgb.length; i += 4, j += 3) { data[i] = rgb[j]; data[i + 1] = rgb[j + 1]; data[i + 2] = rgb[j + 2]; data[i + 3] = 255 }
    return { width: s.w, height: s.h, data }
  }

  async function loadState() {
    if (!host) return
    const c = (await host.get('config')) as Partial<Config> | undefined
    config = { ...DEFAULTS, ...(c ?? {}) }
    const project = (await host.get(projectKey())) as Stored | undefined
    const global = (await host.get('image:global')) as Stored | undefined
    const pick = project ?? global
    scope = project ? 'project' : global ? 'global' : null
    const anim = pick?.anim && pick.w && pick.h ? decodeAnim(pick.w, pick.h, pick.anim) : undefined
    const image = anim ? anim.frames[0] : decodeImage(pick)
    imageName = image ? pick?.name ?? 'image' : ''
    if (pick?.scene && isScene(pick.scene)) source = { kind: 'scene', scene: pick.scene }
    else if (image) source = { kind: 'image', image, name: imageName, clear: transparency(image), anim }
    else source = null
    const v = scope ? ((await host.get(viewKeyFor(scope))) as Partial<View> | undefined) : undefined
    view = { ...DEFAULT_VIEW, ...(v ?? {}) }
    artKey = ''
    sceneCache = null
  }

  const redraw = () => { try { host?.invalidate() } catch { /* not mounted yet */ } }

  const layoutOf = (): 'banner' | 'fit' => {
    if (config.layout !== 'auto') return config.layout
    return source?.kind === 'image' && source.clear >= FIT_IF_TRANSPARENT ? 'fit' : 'banner'
  }

  /**
   * The art for an image in a band `cols` wide and `rows` tall, re-made only when something that
   * shapes it changes. A banner fills the whole width with a crop; fit shows all of it, centred.
   */
  function imageArt(rows: number, cols: number): Art | null {
    if (source?.kind !== 'image') return null
    const layout = layoutOf()
    const key = `${layout}|${cols}x${rows}|${pixelsNow()}|${config.style}|${config.colors}|${view.focusX},${view.focusY},${view.zoom}|${source.name}`
    if (artKey !== key) { artKey = key; frameArts = new Map(); animSample = null }
    const anim = source.anim
    const index = anim ? frameAt(anim, animT) : 0
    const hit = frameArts.get(index)
    if (hit) return hit
    const w = pixelCols(cols, pixelsNow()), h = rows * 2
    const shrink = (img: Rgba): Rgba => {
      if (layout === 'banner') return downscaleRegion(img, cropRect(img.width, img.height, w / h, view), w, h)
      const f = fit(img.width, img.height, rows, w)
      return downscale(img, f.w, f.h)
    }
    if (anim && !animSample) animSample = stack(spread(anim.frames, 6).map(shrink))
    const small = shrink(anim ? anim.frames[index] : source.image)
    const inner = stylize(small, config.style, config.colors, animSample ?? small)
    let made: Art = inner
    if (layout === 'fit') {
      const px = new Uint32Array(w * inner.h).fill(TRANSPARENT)
      const left = Math.floor((w - inner.w) / 2)
      for (let y = 0; y < inner.h; y++) px.set(inner.px.subarray(y * inner.w, (y + 1) * inner.w), y * w + left)
      made = { w, h: inner.h, px }
    }
    frameArts.set(index, made)
    return made
  }

  /**
   * This moment's frame of a scene, run through the style if one is picked. A scene always renders
   * at the band's full height; a shorter band (slim while Claude works) shows the most telling rows.
   */
  function sceneArt(rows: number, cols: number): Art | null {
    if (source?.kind !== 'scene') return null
    const w = pixelCols(cols, pixelsNow()), h = rows * 2
    const fullH = Math.max(h, fullRows() * 2)
    const flash = mood === 'done' ? ticks * FRAME_MS : null
    const key = `${source.scene}|${w}x${h}/${fullH}|${sceneT}|${flash}|${config.style}|${config.colors}`
    if (sceneCache?.key === key) return sceneCache.art
    const rkey = `${source.scene}|${w}x${fullH}`
    if (!renderer || rendererKey !== rkey) { renderer = makeScene(source.scene, w, fullH); rendererKey = rkey }
    const whole = renderer({ t: sceneT, energy, flash })
    const top = Math.min(fullH - h, Math.max(0, Math.round(SLIM_FOCUS[source.scene] * fullH - h / 2)))
    const px = top === 0 && h === fullH ? whole : whole.slice(top * w, (top + h) * w)
    let a: Art = { w, h, px }
    if (config.style !== 'original') {
      const data = new Uint8Array(w * h * 4)
      for (let i = 0; i < px.length; i++) {
        const c = px[i]
        if (c === TRANSPARENT) continue
        data[i * 4] = (c >> 16) & 255; data[i * 4 + 1] = (c >> 8) & 255; data[i * 4 + 2] = c & 255; data[i * 4 + 3] = 255
      }
      a = stylize({ width: w, height: h, data }, config.style, config.colors)
    }
    sceneCache = { key, art: a }
    return a
  }

  function currentCells(): string | null {
    if (!band || !source) return null
    const { rows, cols } = band.want
    const a = source.kind === 'image' ? imageArt(rows, cols) : sceneArt(rows, cols)
    if (!a) return null
    // Scenes show working and done themselves (heavier rain, lightning); intro and error apply to both.
    const m = source.kind === 'scene' && (mood === 'working' || mood === 'done') ? 'idle' : mood
    const px = frame(a, m, ticks * FRAME_MS)
    const shown = use256() ? to256(px) : px
    return pixelsNow() === 'fine' ? quadCellsFor(a, shown) : cellsFor(a, shown)
  }

  function blit() {
    if (!band || !host) return
    const cells = currentCells()
    if (!cells) return
    Promise.resolve(host.blit({ requestId: band.requestId, key: KEY, cells, columns: band.columns, rows: band.rows }))
      .catch(() => { /* band gone or resized: the next render fixes it */ })
  }

  /** The band's full height for the current terminal. */
  const fullRows = () => (limits ? Math.min(config.rows || autoRows(limits.maxRows), limits.maxRows, Math.floor(MAX_CELLS / limits.cols)) : 0)

  /** Rows the band wants: its full height, or slim/hidden while Claude works. */
  function targetRows(): number {
    if (!limits) return 0
    const full = fullRows()
    if (!working || config.whileWorking === 'full') return full
    return config.whileWorking === 'hide' ? 0 : Math.min(SLIM_ROWS, full)
  }

  const resizing = () => limits !== null && config.enabled && shownRows !== targetRows()

  /** A scene or an animated image: something that moves by itself. */
  const moving = () => source?.kind === 'scene' || (source?.kind === 'image' && !!source.anim)

  const animating = () =>
    mood !== 'idle' || resizing() || (moving() && config.enabled && config.animate && band !== null)

  function stopTimer() { timer?.cancel(); timer = null }

  function syncTimer() {
    if (!animating()) stopTimer()
    else if (!timer && host) timer = host.every(FRAME_MS, tick)
  }

  function tick() {
    ticks++
    if (resizing()) {
      const target = targetRows()
      shownRows = shownRows < target ? Math.min(target, shownRows + ROW_STEP) : Math.max(target, shownRows - ROW_STEP)
      redraw() // a new height needs a real render, not a blit
    }
    if (source?.kind === 'scene' && config.animate) {
      sceneT += FRAME_MS
      energy += ((working ? 1 : 0) - energy) * 0.1
    }
    if (source?.kind === 'image' && source.anim && config.animate) animT += FRAME_MS
    if (isOneShot(mood) && ticks * FRAME_MS >= DURATION[mood]) setMood(working ? 'working' : 'idle')
    else blit()
  }

  function setMood(next: Mood) {
    mood = next
    ticks = 0
    syncTimer()
    blit()
  }

  // ---------------------------------------------------------------------------------------------
  // Actions, shared by the commands and the menu. Each returns what to tell the person.

  async function save() {
    await host?.set('config', config)
    artKey = ''; sceneCache = null
    if (limits) shownRows = targetRows() // a size picked by hand applies at once; only turns glide
    redraw(); syncTimer()
  }
  async function saveView() { if (scope) await host?.set(viewKeyFor(scope), view); artKey = ''; redraw() }

  async function writeSlot(s: Scope, value: Stored): Promise<string | null> {
    const put = (await host?.set(slotKey(s), value)) as { deny?: string } | undefined
    return put && put.deny ? put.deny : null
  }

  async function setImage(input: string, s: Scope): Promise<string> {
    if (!host) return 'not ready yet.'
    if (!input.trim()) return 'Usage: /pixelband set <path to an image> [--here]. Tip: drag the file into the terminal.'
    const path = cleanPath(input, (await host.home()) as string | undefined)
    let loaded
    try { loaded = await loadImage(host.io, path) } catch (err: any) { return `${err?.message ?? err}` }
    const name = path.split('/').pop() || path
    const frames = loaded.frames
    const stored: Stored = frames && loaded.delays
      ? { w: frames[0].width, h: frames[0].height, anim: encodeAnim(frames, loaded.delays), name }
      : encodeImage(shrinkToFit(loaded.image, STORED_MAX_SIDE), name)
    const deny = await writeSlot(s, stored)
    if (deny) return `couldn't save it (${deny}). Try /pixelband clear on banners you no longer use.`
    view = { ...DEFAULT_VIEW }
    await host.set(viewKeyFor(s), view)
    await loadState()
    if (!config.enabled) { config.enabled = true; await host.set('config', config) }
    redraw()
    setMood('intro')
    animT = 0
    const what = frames ? `${frames.length} frames, ${loaded.image.width}x${loaded.image.height}` : `${loaded.image.width}x${loaded.image.height}`
    return `${name} is now ${s === 'project' ? "this project's" : 'your'} banner (${what}, read via ${loaded.via}).`
  }

  async function setScene(name: string, s: Scope): Promise<string> {
    if (!host) return 'not ready yet.'
    if (!isScene(name)) return `Scenes: ${SCENES.map((n) => `${n} (${SCENE_LABELS[n]})`).join(', ')}. Use /pixelband scene <name>.`
    const current = ((await host.get(slotKey(s))) as Stored | undefined) ?? {}
    const deny = await writeSlot(s, { ...current, scene: name })
    if (deny) return `couldn't save it (${deny}).`
    await loadState()
    if (!config.enabled) { config.enabled = true; await host.set('config', config) }
    renderer = null
    redraw()
    setMood('intro')
    return `showing ${name}: ${SCENE_LABELS[name]}${s === 'project' ? ' (this project)' : ''}.`
  }

  /** Back from a scene to the image kept in the same slot. */
  async function showImage(): Promise<string> {
    if (!host || !scope) return 'set an image first.'
    const current = ((await host.get(slotKey(scope))) as Stored | undefined) ?? {}
    if (!decodeImage(current)) return 'set an image first.'
    const { scene: _, ...rest } = current
    await writeSlot(scope, rest)
    await loadState()
    redraw()
    setMood('intro')
    return `showing ${imageName}.`
  }

  async function setScope(to: Scope): Promise<string> {
    if (!host || !scope) return 'set an image or scene first.'
    if (to === scope) return to === 'project' ? 'already just for this project.' : 'already shown everywhere.'
    const current = await host.get(slotKey(scope))
    const deny = await writeSlot(to, current as Stored)
    if (deny) return `couldn't save it (${deny}).`
    await host.set(viewKeyFor(to), view)
    if (to === 'global') { await host.del(projectKey()); await host.del(viewKeyFor('project')) }
    await loadState()
    redraw()
    return to === 'project' ? 'now just for this project; other projects keep theirs.' : 'now shown in every project.'
  }

  async function setStyle(name: string): Promise<string> {
    if (!(STYLES as readonly string[]).includes(name)) return `Usage: /pixelband style ${STYLES.join('|')}`
    config.style = name as Style; await save()
    return `style: ${name}.`
  }

  async function setLayout(mode: string): Promise<string> {
    if (!['auto', 'banner', 'fit'].includes(mode)) return 'Usage: /pixelband layout banner|fit|auto'
    config.layout = mode as Layout; await save()
    return `layout: ${mode}${mode === 'auto' ? ` (${layoutOf()} for this image)` : ''}.`
  }

  async function move(dx: number, dy: number): Promise<string> {
    view = { ...view, focusX: Math.min(1, Math.max(0, view.focusX + dx)), focusY: Math.min(1, Math.max(0, view.focusY + dy)) }
    await saveView()
    return `crop centred at ${Math.round(view.focusX * 100)}% across, ${Math.round(view.focusY * 100)}% down.`
  }

  async function zoom(how: string): Promise<string> {
    if (!['in', 'out', 'reset'].includes(how)) return 'Usage: /pixelband zoom in|out|reset'
    const z = how === 'reset' ? 1 : Math.min(4, Math.max(1, view.zoom * (how === 'in' ? 1.25 : 0.8)))
    view = how === 'reset' ? { ...DEFAULT_VIEW } : { ...view, zoom: Math.round(z * 100) / 100 }
    await saveView()
    return `zoom ${view.zoom}x.`
  }

  async function setRows(n: number): Promise<string> {
    config.rows = n <= 0 ? 0 : clampInt(n, 2, 24); await save()
    return config.rows ? `${config.rows} rows tall (${config.rows * 2} pixels), as much as the terminal allows.` : 'auto height: about a quarter of the terminal.'
  }

  const rowsNow = () => config.rows || autoRows(limits?.maxRows ?? 29)

  async function setWhileWorking(mode: string): Promise<string> {
    if (!['slim', 'full', 'hide'].includes(mode)) return 'Usage: /pixelband working slim|full|hide'
    config.whileWorking = mode as WhileWorking; await save()
    return mode === 'slim' ? `while Claude works the band shrinks to ${SLIM_ROWS} rows, then grows back.`
      : mode === 'hide' ? 'while Claude works the band hides, then comes back.' : 'the band stays full size while Claude works.'
  }

  async function setColors(n: number): Promise<string> {
    config.colors = clampInt(n, 2, 32); await save()
    return `${config.colors}-colour palette.`
  }

  async function setEnabled(show: boolean): Promise<string> {
    config.enabled = show; await save()
    return show ? 'on.' : 'off.'
  }

  async function setColorMode(mode: string): Promise<string> {
    if (!['auto', 'full', '256'].includes(mode)) return 'Usage: /pixelband colormode auto|full|256'
    config.colorMode = mode as ColorMode; await save()
    const now = use256() ? '256 colours' : 'full colour'
    return mode === 'auto' ? `colours: auto (${now} in this terminal).` : `colours: ${now}.`
  }

  async function setPixels(mode: string): Promise<string> {
    if (!['standard', 'fine'].includes(mode)) return 'Usage: /pixelband pixels standard|fine'
    config.pixelsFor = { ...(config.pixelsFor ?? {}), [terminal]: mode as Pixels }; await save()
    const where = terminal === 'unknown' ? 'this terminal' : terminal.replace(/\.app$/, '').replace('Apple_Terminal', 'macOS Terminal')
    return mode === 'fine' ? `fine pixels in ${where}: four per character, for fonts with tight line spacing.` : `standard pixels in ${where}: two per character.`
  }

  async function setAnimate(move: boolean): Promise<string> {
    config.animate = move; await save()
    return move ? 'scenes and GIFs animate.' : 'scenes and GIFs hold still.'
  }

  // ---------------------------------------------------------------------------------------------
  // The menu

  /** The few newest images in Downloads, Desktop and Pictures, for one-press picking. */
  async function findRecent() {
    if (!host) return
    const home = String((await host.home()) ?? '').replace(/\/$/, '')
    if (!home) return
    const found: { name: string; path: string; mtime: number }[] = []
    for (const dir of RECENT_DIRS) {
      let entries: { name: string; kind: string }[] = []
      try { entries = ((await host.list(`${home}/${dir}`)) as typeof entries) ?? [] } catch { continue }
      const images = entries.filter((f) => f.kind === 'file' && IMAGE_FILE.test(f.name)).slice(-40)
      for (const f of images) {
        const path = `${home}/${dir}/${f.name}`
        try { found.push({ name: f.name, path, mtime: Number(((await host.stat(path)) as { mtimeMs?: number })?.mtimeMs) || 0 }) } catch { /* gone */ }
      }
    }
    recent = found.sort((a, b) => b.mtime - a.mtime).slice(0, 4).map(({ name, path }) => ({ name, path }))
    redraw()
  }

  async function openMenu() {
    if (!host) return
    const keys = ['config', 'image:global', projectKey(), viewKeyFor('global'), viewKeyFor('project')]
    const slots: [string, unknown][] = []
    for (const k of keys) slots.push([k, await host.get(k)])
    snapshot = { config: { ...config }, slots }
    note = ''
    await host.open()
    findRecent().catch(() => { /* recent images are a nicety */ })
    // The keyboard only goes to a pane when Claude Code can spare it; ask once more a moment later.
    host.after(250, () => {
      Promise.resolve(host?.panes()).then((list) => {
        const pane = ((list as { id: string; isFocused: boolean }[]) ?? []).find((p) => p.id === MENU)
        if (pane && !pane.isFocused) return host?.open()
      }).catch(() => { /* the hint in the menu covers it */ })
    })
  }

  async function revert(): Promise<string> {
    if (!host || !snapshot) return 'nothing to undo.'
    for (const [k, v] of snapshot.slots) {
      if (v === undefined) await host.del(k)
      else await host.set(k, v)
    }
    await loadState()
    renderer = null
    redraw()
    syncTimer()
    return 'back to how it was when you opened the menu.'
  }

  /** Run a menu action, then show its message in the menu. */
  const act = (fn: () => Promise<string>) => () => {
    fn().then((msg) => { note = msg; redraw() }, (err) => { note = `${err?.message ?? err}`; redraw() })
  }

  // ---------------------------------------------------------------------------------------------
  // Hooks

  on('session.start', async ($, e, next) => {
    host = {
      every: (ms, fn) => $.clock.every(ms, fn),
      after: (ms, fn) => $.clock.after(ms, fn),
      blit: (args) => $.ui.blit(args),
      invalidate: () => $.ui.invalidate('ui.render'),
      get: (key) => $.store.get(key),
      set: (key, value) => $.store.set(key, value as any),
      del: (key) => $.store.delete(key),
      home: () => $.env.get('HOME'),
      list: (path) => $.fs.list(path),
      stat: (path) => $.fs.stat(path),
      open: () => $.ui.open({ id: MENU, title: 'pixelband', focus: true, closeOnEscape: true, rows: 18 }),
      close: () => $.ui.close({ id: MENU }),
      panes: () => $.ui.panes(),
      io: {
        readBase64: (path) => $.fs.read(path, { as: 'bytes' }),
        tmpdir: () => $.env.get('TMPDIR'),
        run: (argv) => $.process.run(argv),
      },
    }
    const program = String((await $.env.get('TERM_PROGRAM')) ?? '')
    const colorterm = String((await $.env.get('COLORTERM')) ?? '')
    only256 = program === 'Apple_Terminal' && !/truecolor|24bit/i.test(colorterm)
    terminal = program || 'unknown'
    root = (e as any).cwd ?? ''
    try { root = (await $.session.root()) || root } catch { /* not in a repo: cwd will do */ }
    await loadState()
    ready = true
    redraw()
    await $.command.register({
      name: 'pixelband',
      description: 'Pixel art above your prompt. No arguments opens the menu; or set <image>, scene <name>, style, size, on, off',
      argumentHint: '[set <image> | scene <name> | style <name> | move <dir> | zoom <in|out> | size <rows> | on | off]',
    })
    return next(e)
  })

  on('turn.start', ($, e, next) => {
    if (!(e as any).agentId) { working = true; if (mood !== 'working') setMood('working'); else syncTimer() }
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (!(e as any).agentId) {
      working = false
      const reason = (e as any).reason
      setMood(reason === 'answer' ? 'done' : reason === 'error' || reason === 'refusal' ? 'error' : 'idle')
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const props = (e as any).props
    if (!config.enabled || props.hasSurvey) { band = null; syncTimer(); return next(e) }
    const { Box, Text, Raster } = $.ui.resolve(e) as any
    if (!source) {
      band = null
      if (!ready) return next(e)
      return h(Text, { dimColor: true }, 'pixelband · /pixelband to pick an image or scene') as RenderElement
    }
    const cols = Math.max(1, Math.min(props.bodyColumns ?? 80, MAX_COLS))
    limits = { cols, maxRows: Math.max(1, props.maxRows ?? 24) }
    // Catch up if a turn event was missed.
    if (props.isWorking && !working) { working = true; if (mood === 'idle') setMood('working') }
    if (!props.isWorking && working) { working = false; if (mood === 'working') setMood('idle') }
    if (shownRows < 0) shownRows = targetRows()
    const rows = Math.min(shownRows, limits.maxRows, Math.floor(MAX_CELLS / cols))
    if (rows < 1) { band = null; syncTimer(); return next(e) }

    // A fit image may be shorter than the band; a banner or scene fills it.
    const drawnRows = source.kind === 'image' ? rowsFor(imageArt(rows, cols)?.h ?? rows * 2) : rows
    band = { requestId: (e as any).requestId, columns: cols, rows: drawnRows, want: { rows, cols } }

    syncTimer()

    const cells = currentCells()
    if (!cells) return next(e)
    return h(Box, { flexDirection: 'row' }, h(Raster, { key: KEY, columns: band.columns, rows: band.rows, cells })) as RenderElement
  })

  on('ui.render', { component: 'Pane', requestId: MENU }, ($, e, next) => {
    const { Box, Text, Button, Input, Link } = $.ui.resolve(e) as any
    const ui = $.ui.resolve(e) as any
    const props = (e as any).props
    const width = Math.max(30, props.bodyColumns ?? 80)
    const fitText = (t: string, n: number) => (t.length > n ? `${t.slice(0, Math.max(1, n - 1))}…` : t)
    // Every dropdown option fits the pane after its label: a wrapped row garbles the terminal.
    const Select = ui.Select
    const select = (p: { options: { value: string; label?: string }[] } & Record<string, unknown>) =>
      h(Select, { ...p, options: p.options.map((o) => ({ value: o.value, label: fitText(o.label ?? o.value, width - 12) })) })
    // Every row stays on one line: a row that wraps makes the terminal redraw leave stale copies behind.
    const row = (...kids: unknown[]) => h(Box, { flexDirection: 'row', columnGap: 1 }, ...kids)
    const line = (t: string, style: object = {}) => h(Text, { wrap: 'truncate-end', ...style }, fitText(t, width))
    const s = here()
    const showing = source?.kind === 'scene' ? `scene:${source.scene}` : source ? 'image' : 'none'
    const options = [
      ...(imageName ? [{ value: 'image', label: fitText(`your image (${imageName})`, width - 12) }] : []),
      ...SCENES.map((n) => ({ value: `scene:${n}`, label: fitText(`${n}: ${SCENE_LABELS[n]}`, width - 12) })),
    ]
    if (showing === 'none') options.unshift({ value: 'none', label: 'nothing yet: pick a scene or an image' })

    return h(Box, { flexDirection: 'column' },
      props.isFocused
        ? line('Tab / ↑↓ move · Enter picks · Esc closes · changes show in the band live', { dimColor: true })
        : line('press ctrl+x then tab to use this menu · Esc closes', { color: 'yellow' }),
      select({
        key: 'source', label: 'Show     ', options, value: showing, autoFocus: true,
        onSelect: (v: string) => act(() => (v === 'image' ? showImage() : v.startsWith('scene:') ? setScene(v.slice(6), s) : Promise.resolve('')))(),
      }),
      h(Input, {
        key: 'path', label: 'Image    ', placeholder: 'drag an image here, or type its path', submitLabel: 'use it',
        onSubmit: (v: string) => act(() => setImage(v, s))(),
      }),
      recent.length
        ? select({
          key: 'recent', label: 'Recent   ', value: '',
          options: [{ value: '', label: `${recent.length} newest in Downloads, Desktop, Pictures` }, ...recent.map((f) => ({ value: f.path, label: fitText(f.name, width - 14) }))],
          onSelect: (v: string) => { if (v) act(() => setImage(v, s))() },
        })
        : null,
      select({
        key: 'style', label: 'Style    ', value: config.style,
        options: STYLES.map((v) => ({ value: v })),
        onSelect: (v: string) => act(() => setStyle(v))(),
      }),
      row(
        h(Text, {}, 'Height   '),
        h(Button, { key: 'rows-', label: '-', onPress: act(() => setRows(rowsNow() - 1)) }),
        h(Text, {}, config.rows ? `${config.rows} rows` : `auto (${rowsNow()})`),
        h(Button, { key: 'rows+', label: '+', onPress: act(() => setRows(rowsNow() + 1)) }),
        config.rows ? h(Button, { key: 'rows-auto', label: 'auto', plain: true, dimColor: true, onPress: act(() => setRows(0)) }) : null,
      ),
      select({
        key: 'working', label: 'Working  ', value: config.whileWorking,
        options: [
          { value: 'slim', label: `shrink to ${SLIM_ROWS} rows while Claude works` },
          { value: 'hide', label: 'hide while Claude works' },
          { value: 'full', label: 'stay full size' },
        ],
        onSelect: (v: string) => act(() => setWhileWorking(v))(),
      }),
      select({
        key: 'pixels', label: 'Pixels   ', value: pixelsNow(),
        options: [
          { value: 'standard', label: 'standard: 2 per character (most terminals)' },
          { value: 'fine', label: 'fine: 4 per character, if pixels look wide (this terminal)' },
        ],
        onSelect: (v: string) => act(() => setPixels(v))(),
      }),
      select({
        key: 'colormode', label: 'Colours  ', value: config.colorMode,
        options: [
          { value: 'auto', label: `auto (${only256 ? '256 colours: this looks like macOS Terminal' : 'full colour'})` },
          { value: 'full', label: 'full colour' },
          { value: '256', label: '256 colours (older terminals)' },
        ],
        onSelect: (v: string) => act(() => setColorMode(v))(),
      }),
      source?.kind === 'image'
        ? row(
          h(Text, {}, 'Crop     '),
          h(Button, { key: 'up', hotkey: 'w', plain: true, label: '↑', onPress: act(() => move(0, -MOVE_STEP)) }),
          h(Button, { key: 'left', hotkey: 'a', plain: true, label: '←', onPress: act(() => move(-MOVE_STEP, 0)) }),
          h(Button, { key: 'down', hotkey: 's', plain: true, label: '↓', onPress: act(() => move(0, MOVE_STEP)) }),
          h(Button, { key: 'right', hotkey: 'd', plain: true, label: '→', onPress: act(() => move(MOVE_STEP, 0)) }),
          h(Button, { key: 'zoom-in', hotkey: 'z', plain: true, label: 'in', onPress: act(() => zoom('in')) }),
          h(Button, { key: 'zoom-out', hotkey: 'x', plain: true, label: 'out', onPress: act(() => zoom('out')) }),
          h(Button, { key: 'reset', hotkey: 'r', plain: true, label: 'reset', onPress: act(() => zoom('reset')) }),
        )
        : null,
      moving()
        ? row(h(Text, {}, 'Motion   '), h(Button, { key: 'animate', label: config.animate ? 'pause' : 'animate', onPress: act(() => setAnimate(!config.animate)) }), h(Text, { dimColor: true }, config.animate ? 'moving' : 'paused'))
        : null,
      source
        ? select({
          key: 'scope', label: 'Where    ', value: s,
          options: [{ value: 'global', label: 'every project' }, { value: 'project', label: 'only this project' }],
          onSelect: (v: string) => act(() => setScope(v as Scope))(),
        })
        : null,
      row(
        h(Button, { key: 'done', variant: 'primary', role: 'dismiss', label: 'Done', onPress: () => { Promise.resolve(host?.close()).catch(() => {}) } }),
        h(Button, { key: 'toggle', label: config.enabled ? 'Hide band' : 'Show band', onPress: act(() => setEnabled(!config.enabled)) }),
        h(Button, { key: 'revert', label: 'Undo changes', onPress: act(revert) }),
      ),
      note ? line(note, { dimColor: true }) : null,
      row(h(Text, { dimColor: true }, 'like it? a star helps:'), h(Link, { href: REPO_URL, label: 'github.com/furqan-khan07/pixelband' })),
    ) as RenderElement
  })

  on('command.run', { command: 'pixelband' }, async ($, e, next) => {
    const args = String((e as any).args ?? '').trim()
    const [sub] = args.split(/\s+/)
    const tail = args.slice(sub.length).trim()
    const isHere = /(^|\s)--here$/.test(tail)
    const arg = tail.replace(/(^|\s)--here$/, '').trim()
    const reply = (text: string) => ({ text })

    switch ((sub || '').toLowerCase()) {
      case '':
      case 'menu':
        await openMenu()
        return {}
      case 'set':
        return reply(await setImage(arg, isHere ? 'project' : here()))
      case 'scene':
        return reply(await setScene(arg.toLowerCase(), isHere ? 'project' : here()))
      case 'size': {
        if (arg.toLowerCase() === 'auto') return reply(await setRows(0))
        const n = Number(arg)
        return reply(Number.isFinite(n) && arg ? await setRows(n) : 'Usage: /pixelband size <rows> (2 to 24) or size auto.')
      }
      case 'working':
        return reply(await setWhileWorking(arg.toLowerCase()))
      case 'pixels':
        return reply(await setPixels(arg.toLowerCase()))
      case 'colormode':
      case 'colourmode':
        return reply(await setColorMode(arg.toLowerCase()))
      case 'style':
        return reply(await setStyle(arg.toLowerCase()))
      case 'layout':
        return reply(await setLayout(arg.toLowerCase()))
      case 'move': {
        const [dir, count] = arg.toLowerCase().split(/\s+/)
        const n = Math.max(1, Math.min(10, Number(count) || 1)) * MOVE_STEP
        const d = ({ up: [0, -n], down: [0, n], left: [-n, 0], right: [n, 0] } as Record<string, number[]>)[dir]
        return reply(d ? await move(d[0], d[1]) : 'Usage: /pixelband move up|down|left|right [steps]')
      }
      case 'zoom':
        return reply(await zoom(arg.toLowerCase()))
      case 'colors':
      case 'colours': {
        const n = Number(arg)
        return reply(Number.isFinite(n) && arg ? await setColors(n) : 'Usage: /pixelband colors <n>, from 2 to 32.')
      }
      case 'on':
      case 'off':
        return reply(await setEnabled(sub.toLowerCase() === 'on'))
      case 'animate':
        return reply(['on', 'off'].includes(arg) ? await setAnimate(arg === 'on') : 'Usage: /pixelband animate on|off')
      case 'clear': {
        await $.store.delete(isHere ? projectKey() : 'image:global')
        await loadState(); redraw(); syncTimer()
        return reply(`cleared ${isHere ? "this project's" : 'the global'} banner.`)
      }
      case 'demo': {
        const m = arg.toLowerCase()
        if (!['working', 'done', 'error', 'intro'].includes(m)) return reply('Usage: /pixelband demo working|done|error|intro')
        if (!source) return reply('set an image or scene first.')
        // A demo "working" has no turn to end it, so stop it after a few seconds.
        working = m === 'working'
        setMood(m as Mood)
        if (m === 'working') $.clock.after(4000, () => { if (mood === 'working') { working = false; setMood('idle') } })
        return reply(`playing ${m}.`)
      }
      case 'status':
      case 'help': {
        const where = scope === 'project' ? 'this project' : 'global'
        const status = !source ? 'nothing showing yet'
          : `showing ${source.kind === 'scene' ? `the ${source.scene} scene` : source.name} (${where})${source.kind === 'image' ? `, ${layoutOf()}${source.anim ? `, ${source.anim.frames.length} frames` : ''}` : ''}, ${config.style}, ${config.rows ? `${config.rows} rows` : 'auto height'}${use256() ? ', 256 colours' : ''}, ${config.enabled ? 'on' : 'off'}`
        return reply(`${status}.\n/pixelband opens the menu. Or: set <image> [--here] · scene <${SCENES.join('|')}> · style <${STYLES.join('|')}> · layout <banner|fit|auto> · move <up|down|left|right> · zoom <in|out|reset> · size <rows|auto> · working <slim|full|hide> · colormode <auto|full|256> · pixels <standard|fine> · colors <n> · animate <on|off> · on · off · clear [--here] · demo <working|done|error|intro>`)
      }
      default:
        return reply(`unknown command "${sub}". /pixelband help lists them, or /pixelband alone opens the menu.`)
    }
  })
}
