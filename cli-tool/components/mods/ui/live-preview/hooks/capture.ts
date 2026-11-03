/**
 * live-preview: which edits call for a new capture, and the headless-browser
 * command that takes it. Pure functions, no `$`.
 */

export type Device = 'desktop' | 'mobile'

export const VIEWPORTS: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
}

export const DEFAULT_WATCH = ['tsx', 'jsx', 'ts', 'js', 'mjs', 'css', 'scss', 'sass', 'less', 'html', 'astro', 'vue', 'svelte', 'mdx', 'md', 'json', 'svg']

/**
 * Browsers tried in order when no `browser` option is set: names on PATH, then
 * the standard macOS app locations. Those absolute paths are fixed system
 * install locations, the one exception to the catalog's no-absolute-paths rule.
 */
export const BROWSER_CANDIDATES = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'microsoft-edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

export const SHOT_PATH = '.claude/previews/latest.png'
/** Written before each capture: creates the folder and keeps the captures out of git. */
export const SHOT_DIR_IGNORE = '.claude/previews/.gitignore'

/** The file an edit tool touched, if any. */
export function editedPath(tool: string, input: unknown): string | undefined {
  if (!/^(?:Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return undefined
  const i = input as { file_path?: unknown; notebook_path?: unknown }
  const p = typeof i?.file_path === 'string' ? i.file_path : typeof i?.notebook_path === 'string' ? i.notebook_path : undefined
  return p
}

/** Whether a path is a frontend file worth a new capture. Paths under node_modules, dist and .claude never are. */
export function isWatched(path: string, extensions: readonly string[]): boolean {
  if (/(?:^|\/)(?:node_modules|dist|build|\.next|\.astro|\.claude|\.git)\//.test(path)) return false
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase()
  return ext !== undefined && extensions.includes(ext)
}

/** Only http(s) to a host the person named: a capture never follows a file:// or javascript: URL. */
export function safeUrl(raw: string): string | undefined {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

/** argv for one headless screenshot. No shell: every value is its own argument. */
export function screenshotArgv(browser: string, url: string, device: Device, out: string, extra: readonly string[]): string[] {
  const { width, height } = VIEWPORTS[device]
  return [
    browser,
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--window-size=${width},${height}`,
    '--virtual-time-budget=4000',
    `--screenshot=${out}`,
    ...extra,
    url,
  ]
}

/** Width and height of a PNG from its IHDR chunk, or undefined if the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return undefined
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: v.getUint32(16), height: v.getUint32(20) }
}

/**
 * Cells for an Image of `width`×`height` pixels in a pane `columns` wide,
 * a terminal cell being about twice as tall as it is wide.
 */
export function cellsFor(width: number, height: number, columns: number, maxRows: number): { columns: number; rows: number } {
  const cols = Math.max(10, Math.min(255, columns))
  let rows = Math.round((cols * height) / width / 2)
  let c = cols
  if (rows > maxRows) {
    rows = Math.max(4, maxRows)
    c = Math.max(10, Math.min(cols, Math.round((rows * 2 * width) / height)))
  }
  return { columns: c, rows: Math.max(1, Math.min(255, rows)) }
}

export function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string').map(s => s.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

/** Decodes base64 without Node or atob-dependent helpers being assumed. */
export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
