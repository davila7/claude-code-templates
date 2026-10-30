// Shared notification sender. The notify mod and the guard and tests ask
// paths send through one platform detection, one rate limit and one chime,
// so an away user hears about every dialog that holds the turn.
import type { UltraApi } from './api'
import { resolveSet, settingsFor } from './sets'
import type { UltraModSettings } from '../../types/index'

type Notifier = 'notify-send' | 'osascript' | 'powershell' | 'toast'

// Detected once per session; a failed detection falls back to a toast.
let detection: Promise<Notifier> | null = null
let lastSent = -1_000_000
let chime: string | null = null

// Test seam: detection and the rate window otherwise live per session.
export function resetNotifier(): void {
  detection = null
  lastSent = -1_000_000
  chime = null
}

export async function notifierSettings(api: UltraApi): Promise<UltraModSettings> {
  try {
    return await settingsFor(api, 'notify')
  } catch {
    return resolveSet(undefined).mods.notify
  }
}

// The notifier a send would use, asked fresh; /ultra doctor reports it.
export async function detectNotifier(api: UltraApi): Promise<Notifier> {
  let os: string | undefined
  let wsl: string | undefined
  try {
    os = await api.env.get('OS')
    wsl = await api.env.get('WSL_DISTRO_NAME')
  } catch {
    os = undefined
  }
  const has = async (name: string) => {
    try {
      const result = await api.process.run(['which', name])
      return result.exitCode === 0
    } catch {
      return false
    }
  }
  if (os === 'Windows_NT' || (wsl !== undefined && wsl !== '')) return 'powershell'
  // OS is only ever set on Windows, so the platform comes from the kernel.
  if ((await kernel(api)) === 'Darwin') return (await has('osascript')) ? 'osascript' : 'toast'
  return (await has('notify-send')) ? 'notify-send' : 'toast'
}

// `uname -s`: Darwin, Linux, and so on. Empty when it cannot be asked.
async function kernel(api: UltraApi): Promise<string> {
  try {
    const result = await api.process.run(['uname', '-s'])
    return result.exitCode === 0 ? result.stdout.trim() : ''
  } catch {
    return ''
  }
}

// Quote-safe argv forms: no shell strings and no inline programs. Both
// platform notifiers run a script shipped in the plugin's scripts folder and
// receive the text as data. AppleScript gets title and body as arguments, so a
// quote or a newline in them is never script source. PowerShell gets the body
// as base64: it treats curly quotes as delimiters, so no escaping of the text
// is safe.
export function scriptPath(root: string, file: string): string {
  const sep = root.includes('\\') ? '\\' : '/'
  return `${root.replace(/[\\/]+$/, '')}${sep}scripts${sep}${file}`
}

// powershell.exe under WSL reads Windows paths, so the script path goes
// through wslpath, also when WSLENV carries OS=Windows_NT over. A failed
// conversion throws and the toast takes over.
async function powerShellScript(api: UltraApi): Promise<string> {
  const script = scriptPath(api.plugin.root, 'notify.ps1')
  const wsl = await api.env.get('WSL_DISTRO_NAME')
  if (wsl === undefined || wsl === '') return script
  const result = await api.process.run(['wslpath', '-w', script])
  const converted = result.stdout.trim()
  if (result.exitCode !== 0 || converted === '') throw new Error('wslpath could not convert the notifier script path')
  return converted
}

function utf8(text: string): number[] {
  const bytes: number[] = []
  for (const ch of text) {
    let code = ch.codePointAt(0) ?? 0xfffd
    // A lone surrogate has no UTF-8 form.
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | code >> 6, 0x80 | code & 0x3f)
    else if (code < 0x10000) bytes.push(0xe0 | code >> 12, 0x80 | code >> 6 & 0x3f, 0x80 | code & 0x3f)
    else bytes.push(0xf0 | code >> 18, 0x80 | code >> 12 & 0x3f, 0x80 | code >> 6 & 0x3f, 0x80 | code & 0x3f)
  }
  return bytes
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: readonly number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    out += B64[a >> 2] ?? ''
    out += B64[(a & 3) << 4 | b >> 4] ?? ''
    out += i + 1 < bytes.length ? B64[(b & 15) << 2 | c >> 6] ?? '' : '='
    out += i + 2 < bytes.length ? B64[c & 63] ?? '' : '='
  }
  return out
}

// The chime is built here instead of shipped as a file: a binary asset does
// not survive an installer that copies files as text. Two soft notes, the
// second a fifth above the first, each fading out over about a second.
function chimeClip(): { base64: string; mime: string } {
  if (chime === null) {
    const rate = 11_025
    const count = rate
    const samples: number[] = []
    const note = (t: number, start: number, hz: number, gain: number): number => {
      const age = t - start
      if (age < 0) return 0
      const attack = Math.min(1, age / 0.008)
      const tone = Math.sin(2 * Math.PI * hz * age) + 0.15 * Math.sin(4 * Math.PI * hz * age)
      return gain * attack * Math.exp(-age / 0.22) * tone
    }
    for (let i = 0; i < count; i++) {
      const t = i / rate
      const fade = Math.min(1, (count - i) / 200)
      const level = (note(t, 0, 660, 0.32) + note(t, 0.1, 990, 0.24)) * fade
      const value = Math.max(-1, Math.min(1, level)) * 32767 | 0
      samples.push(value & 0xff, value >> 8 & 0xff)
    }
    const le = (value: number, size: number): number[] => Array.from({ length: size }, (_, k) => value >> 8 * k & 0xff)
    const ascii = (text: string): number[] => Array.from(text, ch => ch.charCodeAt(0))
    const header = [
      ...ascii('RIFF'), ...le(36 + samples.length, 4), ...ascii('WAVEfmt '), ...le(16, 4), ...le(1, 2), ...le(1, 2),
      ...le(rate, 4), ...le(rate * 2, 4), ...le(2, 2), ...le(16, 2), ...ascii('data'), ...le(samples.length, 4),
    ]
    chime = base64([...header, ...samples])
  }
  return { base64: chime, mime: 'audio/wav' }
}

// A notifier that exits nonzero did not show anything: let the toast take over.
async function runNotifier(api: UltraApi, argv: string[]): Promise<void> {
  const result = await api.process.run(argv)
  if (result.exitCode !== 0) throw new Error(`${argv[0] ?? 'notifier'} exited with ${result.exitCode}`)
}

async function clockNow(api: UltraApi): Promise<number> {
  try {
    return await api.clock.now()
  } catch {
    return Date.now()
  }
}

// The folder name a notification body leads with.
export async function projectFolder(api: UltraApi): Promise<string> {
  try {
    const root = await api.session.root()
    const parts = root.split(/[\\/]/).filter(part => part !== '')
    return parts.length > 0 ? (parts[parts.length - 1] ?? root) : root
  } catch {
    return 'Claude Code'
  }
}

// Returns the time the notification went out, or null when it did not send.
export async function sendNotification(api: UltraApi, body: string, settings: UltraModSettings): Promise<number | null> {
  const now = await clockNow(api)
  if (now - lastSent < 10_000) return null
  lastSent = now
  try {
    detection ??= detectNotifier(api)
    const notifier = await detection.catch(() => 'toast' as Notifier)
    if (notifier === 'notify-send') await runNotifier(api, ['notify-send', 'Claude Code', body])
    else if (notifier === 'osascript') await runNotifier(api, ['osascript', scriptPath(api.plugin.root, 'notify.applescript'), 'Claude Code', body])
    else if (notifier === 'powershell') await runNotifier(api, ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', await powerShellScript(api), '-BodyBase64', base64(utf8(body))])
    else api.ui.toast(body)
  } catch {
    try {
      api.ui.toast(body)
    } catch {
      // Nothing left to try; a notification must never throw.
    }
  }
  if (settings.chime === true && settings.sound !== false) {
    try {
      await api.audio.play(chimeClip())
    } catch {
      // A missing chime must never fail the notification.
    }
  }
  return now
}

// The "needs you" notification guard and tests raise while their dialog
// waits: title Claude Code, body "<project folder> needs you: <short
// reason>". Started and not awaited: the caller's dialog holds its own hook
// open, and clock.after would only run after that hook resolved, which is
// after the user has answered. Only while the notify mod is on; the chime
// follows the sound option.
export function needsYou(api: UltraApi, reason: string): void {
  void deliverNeedsYou(api, reason)
}

async function deliverNeedsYou(api: UltraApi, reason: string): Promise<void> {
  try {
    const settings = await notifierSettings(api)
    if (!settings.enabled) return
    await sendNotification(api, `${await projectFolder(api)} needs you: ${reason}`, settings)
  } catch {
    // The caller's own work is done by now; never throw behind it.
  }
}
