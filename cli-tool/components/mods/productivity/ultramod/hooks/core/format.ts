export function fmtTokens(tokens: number): string {
  if (tokens < 1_000) return String(Math.round(tokens))
  // 999,500 rounds to 1000k, so the million form starts where the thousands round up to it.
  const thousands = Math.round(tokens / 1_000)
  if (thousands < 1_000) return `${thousands}k`
  return `${Number((tokens / 1_000_000).toFixed(1))}m`
}

// Elapsed time for the turn timer, receipts and finished-turn notices:
// seconds stay visible under an hour, then two units per band.
export function fmtDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1_000))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor(seconds / 3_600) % 24
  const minutes = Math.floor(seconds / 60) % 60
  const rest = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days) return `${days}d${hours}h`
  if (hours) return `${hours}h${pad(minutes)}m`
  if (minutes) return `${minutes}m${pad(rest)}s`
  return `${rest}s`
}

// Time until a rate-limit reset or since a snapshot: one unit per band under
// a day, so an age reads short ("41m", "7h50m").
export function fmtCountdown(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1_000))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor(seconds / 3_600) % 24
  const minutes = Math.floor(seconds / 60) % 60
  const rest = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days) return `${days}d${hours}h`
  if (hours) return `${hours}h${pad(minutes)}m`
  if (minutes) return `${minutes}m`
  return `${rest}s`
}

export const fmtUsd = (usd: number) => `$${usd.toFixed(2)}`

export function fmtModel(model: string): string {
  const id = model.replace(/^claude-/, '')
  const known = /^(opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(id)
  if (!known) return id
  const name = known[1] ?? ''
  return `${name[0]?.toUpperCase()}${name.slice(1)} ${known[2]}${known[3] ? `.${known[3]}` : ''}`
}
