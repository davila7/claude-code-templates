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

// Test seam: detection and the rate window otherwise live per session.
export function resetNotifier(): void {
  detection = null
  lastSent = -1_000_000
}

export async function notifierSettings($: UltraApi): Promise<UltraModSettings> {
  try {
    return await settingsFor($, 'notify')
  } catch {
    return resolveSet(undefined).mods.notify
  }
}

async function detect($: UltraApi): Promise<Notifier> {
  let os: string | undefined
  let wsl: string | undefined
  try {
    os = await $.env.get('OS')
    wsl = await $.env.get('WSL_DISTRO_NAME')
  } catch {
    os = undefined
  }
  const has = async (name: string) => {
    try {
      const result = await $.process.run(['which', name])
      return result.exitCode === 0
    } catch {
      return false
    }
  }
  if (os === 'Windows_NT' || (wsl !== undefined && wsl !== '')) return 'powershell'
  // OS is only ever set on Windows, so the platform comes from the kernel.
  if ((await kernel($)) === 'Darwin') return (await has('osascript')) ? 'osascript' : 'toast'
  return (await has('notify-send')) ? 'notify-send' : 'toast'
}

// `uname -s`: Darwin, Linux, and so on. Empty when it cannot be asked.
async function kernel($: UltraApi): Promise<string> {
  try {
    const result = await $.process.run(['uname', '-s'])
    return result.exitCode === 0 ? result.stdout.trim() : ''
  } catch {
    return ''
  }
}

// Quote-safe argv forms: no shell strings anywhere, quotes escaped for the
// two script interpreters that parse text.
function appleScript(body: string): string {
  const safe = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `display notification "${safe}" with title "Claude Code"`
}

function powerShell(body: string): string {
  const safe = body.replace(/'/g, "''")
  return `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(5000, 'Claude Code', '${safe}', 'Info'); Start-Sleep -Seconds 2; $n.Dispose()`
}

async function clockNow($: UltraApi): Promise<number> {
  try {
    return await $.clock.now()
  } catch {
    return Date.now()
  }
}

// The folder name a notification body leads with.
export async function projectFolder($: UltraApi): Promise<string> {
  try {
    const root = await $.session.root()
    const parts = root.split(/[\\/]/).filter(part => part !== '')
    return parts.length > 0 ? (parts[parts.length - 1] ?? root) : root
  } catch {
    return 'Claude Code'
  }
}

// Returns the time the notification went out, or null when it did not send.
export async function sendNotification($: UltraApi, body: string, settings: UltraModSettings): Promise<number | null> {
  const now = await clockNow($)
  if (now - lastSent < 10_000) return null
  lastSent = now
  try {
    detection ??= detect($)
    const notifier = await detection.catch(() => 'toast' as Notifier)
    if (notifier === 'notify-send') await $.process.run(['notify-send', 'Claude Code', body])
    else if (notifier === 'osascript') await $.process.run(['osascript', '-e', appleScript(body)])
    else if (notifier === 'powershell') await $.process.run(['powershell.exe', '-NoProfile', '-Command', powerShell(body)])
    else $.ui.toast(body)
  } catch {
    try {
      $.ui.toast(body)
    } catch {
      // Nothing left to try; a notification must never throw.
    }
  }
  if (settings.chime === true && settings.sound !== false) {
    try {
      await $.audio.play({ asset: 'assets/chime.wav' })
    } catch {
      // A missing chime must never fail the notification.
    }
  }
  return now
}

// The "needs you" notification guard and tests raise while their dialog
// waits: title Claude Code, body "<project folder> needs you: <short
// reason>". Sent off the dispatch so the dialog itself is never delayed,
// and only while the notify mod is on; the chime follows the sound option.
export function needsYou($: UltraApi, reason: string): void {
  try {
    $.clock.after(0, () => { void deliverNeedsYou($, reason) })
  } catch {
    // A notification must never throw out of the caller's hook.
  }
}

async function deliverNeedsYou($: UltraApi, reason: string): Promise<void> {
  try {
    const settings = await notifierSettings($)
    if (!settings.enabled) return
    await sendNotification($, `${await projectFolder($)} needs you: ${reason}`, settings)
  } catch {
    // The caller's own work is done by now; never throw behind it.
  }
}
