/**
 * Getting an image off disk and into RGBA.
 *
 * PNG, BMP and GIF (animated too) decode right here in the mod. Everything else people actually have
 * (JPEG, HEIC from an iPhone, WebP) goes through the OS: `sips` ships with every Mac, ImageMagick is common on
 * Linux. They also shrink the photo on the way, so we never pull a 12-megapixel image into the mod.
 */
import { decodeBmp, isBmp } from './bmp'
import { countGifFrames, decodeGif, isGif } from './gif'
import { downscale } from './pixelate'
import { decodePng, isPng, type Rgba } from './png'

/** How big an image we decode ourselves before handing it to the OS tool to shrink first. */
const MAX_DIRECT_PIXELS = 1024 * 1024
/** Longest side we ask the OS tool for. The band is tiny; this is plenty. */
const TOOL_MAX_SIDE = 256

/** An image, plus its frames and their delays (ms) when it's animated. */
export interface Loaded { image: Rgba; via: string; frames?: Rgba[]; delays?: number[] }

/** Most frames we keep: longer GIFs keep every 2nd, 3rd... frame, with the timing added up. */
export const MAX_FRAMES = 120
/** Pixels across all kept frames, so an animation fits the store with room to spare. */
const ANIM_BUDGET = 1_200_000
const ANIM_MAX_SIDE = 240
const STILL_MAX_SIDE = 320
const MAX_GIF_BYTES = 30 * 1024 * 1024

/** Decode a GIF, shrinking each frame as it comes so a big one never sits in memory whole. */
export function loadGif(bytes: Uint8Array): Loaded {
  if (bytes.length > MAX_GIF_BYTES) throw new Error(`that GIF is ${Math.round(bytes.length / 1048576)} MB; up to 30 MB works`)
  const count = countGifFrames(bytes)
  const step = Math.max(1, Math.ceil(count / MAX_FRAMES))
  const kept = Math.ceil(count / step)
  const w = bytes[6] | (bytes[7] << 8), h = bytes[8] | (bytes[9] << 8)
  const scale = Math.min(1, (count > 1 ? ANIM_MAX_SIDE : STILL_MAX_SIDE) / Math.max(w, h), count > 1 ? Math.sqrt(ANIM_BUDGET / (kept * w * h)) : 1)
  const tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale))
  const frames: Rgba[] = [], delays: number[] = []
  decodeGif(bytes, (canvas, delay, i) => {
    if (i % step === 0) { frames.push(scale === 1 ? { width: w, height: h, data: canvas.data.slice() } : downscale(canvas, tw, th)); delays.push(delay) }
    else delays[delays.length - 1] += delay
  })
  return frames.length > 1 ? { image: frames[0], via: 'gif', frames, delays } : { image: frames[0], via: 'gif' }
}

/**
 * What loading needs from Claude Code. Passed as plain functions because a mod may not hand `$`
 * around: every engine call is written out as `$.noun.event(...)` where it happens (register.ts).
 */
export interface Io {
  readBase64: (path: string) => Promise<unknown>
  tmpdir: () => Promise<unknown>
  run: (argv: string[]) => Promise<unknown>
}

/**
 * Tidy up a path the way people actually give it: quoted, with backslash-escaped spaces from
 * dragging a file into the terminal, or starting with `~`.
 */
export function cleanPath(input: string, home?: string): string {
  let p = input.trim()
  if (p.length > 1 && ((p[0] === '"' && p.endsWith('"')) || (p[0] === "'" && p.endsWith("'")))) p = p.slice(1, -1)
  p = p.replace(/\\(.)/g, '$1')
  if (home && (p === '~' || p.startsWith('~/'))) p = home.replace(/\/$/, '') + p.slice(1)
  return p
}

async function readBytes(io: Io, path: string): Promise<Uint8Array> {
  const r = (await io.readBase64(path)) as { base64?: unknown } | undefined
  if (r && typeof r === 'object' && typeof r.base64 === 'string') return Uint8Array.fromBase64(r.base64)
  throw new Error(`unexpected read result: ${JSON.stringify(r)?.slice(0, 120)}`)
}

function pngPixels(b: Uint8Array): number {
  const u32 = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
  return u32(16) * u32(20)
}

/** Ask sips, then ImageMagick, to turn `path` into a small BMP we can read. */
async function viaTool(io: Io, path: string): Promise<Loaded> {
  const tmp = String((await io.tmpdir()) || '/tmp').replace(/\/$/, '')
  const out = `${tmp}/pixelband-${Math.random().toString(36).slice(2)}.bmp`
  const attempts: [string, string[]][] = [
    ['sips', ['sips', '-s', 'format', 'bmp', '--resampleHeightWidthMax', String(TOOL_MAX_SIDE), path, '--out', out]],
    ['magick', ['magick', path, '-resize', `${TOOL_MAX_SIDE}x${TOOL_MAX_SIDE}>`, `BMP3:${out}`]],
    ['convert', ['convert', path, '-resize', `${TOOL_MAX_SIDE}x${TOOL_MAX_SIDE}>`, `BMP3:${out}`]],
  ]
  for (const [name, argv] of attempts) {
    try {
      const res = (await io.run(argv)) as { exitCode?: number } | undefined
      if (!res || res.exitCode !== 0) continue
      return { image: decodeBmp(await readBytes(io, out)), via: name }
    } catch {
      continue
    } finally {
      try { await io.run(['rm', '-f', out]) } catch { /* best effort */ }
    }
  }
  throw new Error("I can read PNG and BMP myself; for other formats I need macOS's sips or ImageMagick, and neither worked. Try a PNG?")
}

/** Photo formats go straight to the OS tool: no point pulling a 20 MB HEIC through the mod. */
const TOOL_FIRST = /\.(jpe?g|heic|heif|webp|tiff?|avif|icns|psd)$/i

/** Load any image we can into RGBA. */
export async function loadImage(io: Io, path: string): Promise<Loaded> {
  let toolError: unknown = null
  if (TOOL_FIRST.test(path)) {
    try { return await viaTool(io, path) } catch (err) { toolError = err } // maybe it's a mislabelled PNG
  }
  let bytes: Uint8Array
  try {
    bytes = await readBytes(io, path)
  } catch (err: any) {
    const why = err?.message ?? String(err)
    throw new Error(`couldn't read ${path}${why ? ` (${why})` : ''}`)
  }
  if (isPng(bytes)) {
    // Small PNGs decode here; huge ones get shrunk by the OS tool first when there is one.
    if (pngPixels(bytes) <= MAX_DIRECT_PIXELS) {
      try { return { image: decodePng(bytes), via: 'png' } } catch { /* e.g. interlaced: try the tool */ }
    }
    try { return await viaTool(io, path) } catch { return { image: decodePng(bytes), via: 'png' } }
  }
  if (isGif(bytes)) {
    try { return loadGif(bytes) } catch (err: any) {
      if (/MB; up to/.test(err?.message ?? '')) throw err
      // an odd GIF: let the OS tool have a go at its first frame
    }
  }
  if (isBmp(bytes)) {
    try { return { image: decodeBmp(bytes), via: 'bmp' } } catch { /* odd BMP: try the tool */ }
  }
  if (toolError) throw toolError
  return viaTool(io, path)
}
