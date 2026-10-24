import type { UltraApi } from '../core/api'
import type { UltraMod } from '../core/mod'
import { fmtDuration } from '../core/format'
import { notifierSettings, projectFolder, resetNotifier, sendNotification } from '../core/notifier'

let lastFinished = Number.NEGATIVE_INFINITY

// Notification types that wait for the user. Anything else (auth_success,
// elicitation_complete and the like) is information and stays silent.
const WAITING_NOTIFICATIONS: readonly string[] = ['permission_prompt', 'elicitation_dialog', 'idle_prompt']
// The engine's idle nudge, which says nothing new right after a finished turn.
const IDLE_NOTIFICATIONS: readonly string[] = ['idle_prompt']
const IDLE_GAP_MS = 5 * 60_000

// Test seam: the notifier's detection and rate window, and the idle gap,
// otherwise live per session.
export function resetNotify(): void {
  resetNotifier()
  lastFinished = Number.NEGATIVE_INFINITY
}

// True while an idle nudge would only repeat a finished turn's toast.
async function justFinished(api: UltraApi): Promise<boolean> {
  try {
    return (await api.clock.now()) - lastFinished < IDLE_GAP_MS
  } catch {
    return Date.now() - lastFinished < IDLE_GAP_MS
  }
}

// Off the dispatch: the Windows notifier alone sleeps two seconds.
async function sendFinished(api: UltraApi, body: string, settings: Awaited<ReturnType<typeof notifierSettings>>): Promise<void> {
  try {
    const sent = await sendNotification(api, body, settings)
    if (sent !== null) lastFinished = sent
  } catch {
    // A lost notification never reaches the turn.
  }
}

async function sendWaiting(api: UltraApi, body: string, settings: Awaited<ReturnType<typeof notifierSettings>>): Promise<void> {
  try {
    await sendNotification(api, body, settings)
  } catch {
    // A lost notification never reaches the turn.
  }
}

export const notify: UltraMod = {
  id: 'notify',
  turnComplete: {
    when: e => !e.agentId && !e.isAborted,
    run: async (api, e) => {
      try {
        const settings = await notifierSettings(api)
        const threshold = (settings.notifyAfterSeconds ?? 30) * 1000
        if (e.durationMs >= threshold) {
          const body = `${await projectFolder(api)} finished in ${fmtDuration(e.durationMs)}`
          api.clock.after(0, () => { void sendFinished(api, body, settings) })
        }
      } catch {
        // Never throw out of a turn.
      }
      return null
    },
  },
  notification: {
    run: async (api, e) => {
      try {
        if (!WAITING_NOTIFICATIONS.includes(e.notification_type)) return
        const settings = await notifierSettings(api)
        if (!IDLE_NOTIFICATIONS.includes(e.notification_type) || !(await justFinished(api))) {
          const body = `${await projectFolder(api)} needs you: ${e.message}`
          // Off the dispatch, like the other send paths: the Windows notifier sleeps and the chime plays.
          api.clock.after(0, () => { void sendWaiting(api, body, settings) })
        }
      } catch {
        // Never throw out of a notification.
      }
    },
  },
}
