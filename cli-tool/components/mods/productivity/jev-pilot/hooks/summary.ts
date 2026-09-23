/**
 * jev-pilot — the one line each turn gets in the transcript, and the note the
 * skill module leaves for it.
 *
 * Both modules run in the plugin's one worker, so this module is shared: the
 * skill module notes its pick per prompt at `prompt.submit`, and the router
 * reads it when the turn starts and writes a single line for both, instead
 * of each module logging every step (that detail is `verboseLog`).
 */

import { sure } from './pet-art.ts'

/** What the skill module decided for one prompt. */
export interface SkillNote {
  /** The skill attached, or null for none. */
  skill: string | null
  /** How long its requests took, ms; null when none was made. */
  ms: number | null
}

const notes = new Map<string, SkillNote>()
const MAX_NOTES = 32

/** Records the skill module's pick for `prompt`, bounded to the last few. */
export function noteSkill(prompt: string, note: SkillNote): void {
  notes.delete(prompt)
  notes.set(prompt, note)
  while (notes.size > MAX_NOTES) notes.delete(notes.keys().next().value as string)
}

/** The pick noted for `prompt`, removed as it is read; null when none. */
export function takeSkill(prompt: string | null): SkillNote | null {
  if (prompt === null) return null
  const note = notes.get(prompt) ?? null
  notes.delete(prompt)
  return note
}

/** A new session: no pick carries over. */
export function clearSkillNotes(): void {
  notes.clear()
}

/** What the turn line says. */
export interface TurnFacts {
  /** Whether the decision model answered for this turn. */
  answered: boolean
  /** How sure the decision model was of the effort it picked. */
  confidence: number | null
  /** The effort this turn was set to, or null when left as built. */
  applied: string | null
  /** The effort the engine built the turn with. */
  current: string | null
  /** The level the decision model's answer pointed to. */
  wanted: string | null
  /** The router's request time, ms. */
  jevMs: number | null
  skill: SkillNote | null
  /** The strategy advised to the model, if any. */
  advised: string | null
}

/**
 * One line for a turn, the effort with how sure the decision model was of it:
 *   jev · low (93% sure) · no skill · 1.3s
 *   jev · xhigh (88% sure) · skill /systematic-debugging · parallel advised · 1.4s
 *   jev · high kept (wanted low, 42% sure) · no skill · 1.2s
 */
export function turnLine(facts: TurnFacts): string {
  const parts = ['jev']
  if (!facts.answered) {
    parts.push('no answer, turn left as built')
  } else {
    const read = facts.confidence === null ? '' : sure(facts.confidence)
    if (facts.applied) {
      parts.push(`${facts.applied}${read ? ` (${read})` : ''}`)
    } else if (facts.wanted && facts.current && facts.wanted !== facts.current) {
      parts.push(`${facts.current} kept (wanted ${facts.wanted}${read ? `, ${read}` : ''})`)
    } else {
      parts.push(`${facts.current ?? 'default effort'}${read ? ` (${read})` : ''}`)
    }
  }
  if (facts.skill) parts.push(facts.skill.skill ? `skill /${facts.skill.skill}` : 'no skill')
  if (facts.advised) parts.push(`${facts.advised} advised`)
  const ms = (facts.jevMs ?? 0) + (facts.skill?.ms ?? 0)
  if (ms > 0) parts.push(`${(ms / 1000).toFixed(1)}s`)
  return parts.join(' · ')
}
