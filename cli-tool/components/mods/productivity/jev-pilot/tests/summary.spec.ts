import { expect, test } from 'bun:test'
import { clearSkillNotes, noteSkill, takeSkill, turnLine } from '../hooks/summary.ts'

const base = { answered: true, confidence: 0.99, applied: null, current: 'high', wanted: 'high', jevMs: 700, skill: null, advised: null }

test('one line says what the turn got, with the skill and the time', () => {
  expect(turnLine({ ...base, applied: 'low', wanted: 'low', skill: { skill: null, ms: 600 } })).toBe('jev · low (99% sure) · no skill · 1.3s')
  expect(
    turnLine({ ...base, confidence: 0.88, applied: 'xhigh', skill: { skill: 'systematic-debugging', ms: 700 }, advised: 'parallel' }),
  ).toBe('jev · xhigh (88% sure) · skill /systematic-debugging · parallel advised · 1.4s')
})

test('a turn left as it was says why', () => {
  expect(turnLine({ ...base, confidence: 0.42, wanted: 'low' })).toBe('jev · high kept (wanted low, 42% sure) · 0.7s')
  expect(turnLine({ ...base })).toBe('jev · high (99% sure) · 0.7s')
  expect(turnLine({ ...base, answered: false, jevMs: null })).toBe('jev · no answer, turn left as built')
})

test('a skill note is read once, and a new session forgets them all', () => {
  noteSkill('fix it', { skill: 'debug', ms: 10 })
  expect(takeSkill('fix it')?.skill).toBe('debug')
  expect(takeSkill('fix it')).toBeNull()
  noteSkill('a', { skill: null, ms: null })
  clearSkillNotes()
  expect(takeSkill('a')).toBeNull()
  expect(takeSkill(null)).toBeNull()
})

test('the notes stay bounded however many prompts never start a turn', () => {
  for (let i = 0; i < 100; i++) noteSkill(`p${i}`, { skill: null, ms: 1 })
  expect(takeSkill('p0')).toBeNull()
  expect(takeSkill('p99')).not.toBeNull()
  clearSkillNotes()
})
