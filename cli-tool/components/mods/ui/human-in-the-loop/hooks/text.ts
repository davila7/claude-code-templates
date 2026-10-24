/** Collapses runs of whitespace, newlines included, to single spaces. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Cuts `text` to `max` characters, marking the cut with an ellipsis. */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * A label safe to draw: control, format and line-separator characters out
 * (the engine refuses a drawing holding one), whitespace collapsed, and cut
 * to `max`. Titles and reasons are text the model or the user wrote.
 */
export function printable(text: string, max: number): string {
  const spaced = text.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').replace(/\p{Cf}/gu, '')

  return clip(oneLine(spaced), max)
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** `now`, `4m`, `3h`, `2d`: how long ago, at a glance. */
export function ago(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)

  if (minutes < 1) {
    return 'now'
  }

  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)

  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`
}

/** `840 B`, `2.3 KB`. */
export function sizeOf(chars: number): string {
  return chars < 1024 ? `${chars} B` : `${(chars / 1024).toFixed(1)} KB`
}
