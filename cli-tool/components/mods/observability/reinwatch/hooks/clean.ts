// Makes a text someone else wrote safe to show on one line. The engine refuses a drawn tree whose text holds a control
// character, so one such character in a description would hide the whole pane and band. A newline would let a description
// draw a line of its own, and a direction control would reverse the text around it.
//
// Direction controls go; every run of control characters (C0, DEL, C1) and white space becomes one space; the ends are
// trimmed. What stays: letters of every script, emoji, combining marks, and U+200C and U+200D (the joiner inside an emoji).
// Cleaning a clean text changes nothing.

const DIRECTION = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g
const CONTROL_OR_SPACE = /[\u0000-\u001F\u007F-\u009F\s]+/g

export function clean(text: string): string {
  return text.replace(DIRECTION, '').replace(CONTROL_OR_SPACE, ' ').trim()
}
