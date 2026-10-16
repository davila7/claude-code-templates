import type { PeerReport } from './envelope'
import { LIMITS } from './limits'
import { peerKey, sanitize } from './text'

/**
 * The start of a listing row, `  name [ref]`, where the engine's `·` fields begin. The name runs to the last
 * ` [ref]` that a `·` follows, so a session name that holds ` [ref] · ` stays whole and cannot place a field.
 * The fields after it are split on `·`, not matched by a repeated group, so a hostile row cannot make the
 * match backtrack across its fields.
 */
const HEAD = /^\s+(\S.*) \[[0-9a-z]+\](?=\s+·)/i
/** A state word as the engine writes one: a letter, then letters, spaces, and hyphens. */
const STATE_WORD = new RegExp(`^[a-z][a-z -]{0,${LIMITS.stateChars - 1}}$`, 'i')

/** Peer states from a ListAgents listing, and how many lines looked like rows. */
export function parseListing(listing: string): { reports: PeerReport[]; rowCount: number } {
  const rows = sanitize(listing)
    .split('\n')
    .filter(line => /^\s+\S/.test(line))
  const reports: PeerReport[] = []
  for (const row of rows) {
    const head = HEAD.exec(row)
    if (head === null) continue
    const peer = peerKey(head[1] ?? '')
    // The text before the first `·` is the space after the ref; the fields keep their places, so an empty one stays empty.
    const state = row.slice(head[0].length).split('·')[2]?.trim()
    if (peer !== '' && state !== undefined && STATE_WORD.test(state)) reports.push({ peer, state })
  }
  return { reports, rowCount: rows.length }
}

/** Structured rows take precedence; duplicate names cannot establish one peer's state. */
export function parseStructuredListing(result: unknown): { reports: PeerReport[]; rowCount: number } | undefined {
  if (typeof result !== 'object' || result === null || !('sections' in result) || !Array.isArray(result.sections)) return undefined
  const states = new Map<string, string | undefined>()
  let rowCount = 0
  for (const section of result.sections) {
    if (typeof section !== 'object' || section === null || !Array.isArray(section.rows)) continue
    for (const row of section.rows) {
      rowCount++
      if (typeof row !== 'object' || row === null || typeof row.name !== 'string') continue
      const peer = peerKey(row.name)
      if (peer === '') continue
      const state = typeof row.status === 'string' ? sanitize(row.status).trim() : ''
      states.set(peer, states.has(peer) || !STATE_WORD.test(state) ? undefined : state)
    }
  }
  return {
    reports: [...states].flatMap(([peer, state]) => state === undefined ? [] : [{ peer, state, source: 'structured listing' }]),
    rowCount,
  }
}
