import type { Register } from 'claude-code'

// Any pane that does not pick a background of its own gets none, so the
// terminal's background (Ghostty's) shows through its body.
export const register: Register = on => {
  on('ui.open', ($, e, next) => next({ ...e, backgroundColor: e.backgroundColor ?? 'transparent' }))
}
