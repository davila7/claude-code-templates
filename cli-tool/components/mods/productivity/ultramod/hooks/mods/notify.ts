import type { UltraApi } from '../core/api'
import type { UltraMod } from '../core/mod'
import type { Args, Frozen } from 'claude-code'
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
async function justFinished($: UltraApi): Promise<boolean> {
  try {
    return (await $.clock.now()) - lastFinished < IDLE_GAP_MS
  } catch {
    return Date.now() - lastFinished < IDLE_GAP_MS
  }
}

export const notify: UltraMod = {
  id: 'notify',
  hooks: {
    'turn.complete': [{
      when: e => !e.agentId && !e.isAborted,
      run: async ($, e: Frozen<Args<'turn.complete'>>, next) => {
        const result = await next(e)
        try {
          const settings = await notifierSettings($)
          const threshold = (settings.notifyAfterSeconds ?? 30) * 1000
          if (e.durationMs >= threshold) {
            const body = `${await projectFolder($)} finished in ${fmtDuration(e.durationMs)}`
            // Off the dispatch: the Windows notifier alone sleeps two seconds.
            $.clock.after(0, () => {
              void sendNotification($, body, settings).then((sent) => {
                if (sent !== null) lastFinished = sent
              }, () => undefined)
            })
          }
        } catch {
          // Never throw out of a turn.
        }
        return result
      },
    }],
    'classic.Notification': [{
      run: async ($, e, next) => {
        const result = await next(e)
        try {
          if (!WAITING_NOTIFICATIONS.includes(e.notification_type)) return result
          const settings = await notifierSettings($)
          if (!IDLE_NOTIFICATIONS.includes(e.notification_type) || !(await justFinished($))) {
            const body = `${await projectFolder($)} needs you: ${e.message}`
            // Off the dispatch, like the other send paths: the Windows notifier sleeps and the chime plays.
            $.clock.after(0, () => { void sendNotification($, body, settings).catch(() => undefined) })
          }
        } catch {
          // Never throw out of a notification.
        }
        return result
      },
    }],
  },
}
