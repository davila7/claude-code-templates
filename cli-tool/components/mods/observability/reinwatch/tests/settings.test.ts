import { expect, test } from 'claude-code/testing'
import { readSettings } from '../hooks/settings'

test('defaults match plugin.json', () => {
  expect(readSettings({})).toEqual({ activeMs: 1_800_000, tokenLimit: 1_000_000, repeatCount: 5, failStreak: 5,
    burstCount: 10, burstWindowMs: 120_000, notify: true, openPaneOnWarning: false, redact: true, muted: new Set(), price: null })
})

test('the token warning defaults to one million new tokens', () => {
  expect(readSettings({}).tokenLimit).toBe(1_000_000)
})

test('bad numbers fall back; counts are whole and at least 2', () => {
  const s = readSettings({ activeMinutes: -1, tokenMillions: 0, repeatCount: 1, failStreak: 3.7, burstCount: Number.NaN, burstMinutes: 0.5 })
  expect([s.activeMs, s.tokenLimit, s.repeatCount, s.failStreak, s.burstCount, s.burstWindowMs])
    .toEqual([1_800_000, 1_000_000, 2, 3, 10, 30_000])
})

test('valid values are used; booleans only when they are booleans', () => {
  const s = readSettings({ activeMinutes: 10, tokenMillions: 2.5, repeatCount: 7, burstCount: 20, burstMinutes: Infinity, notify: false, openPaneOnWarning: true, redact: 'no' })
  expect([s.activeMs, s.tokenLimit, s.repeatCount, s.burstCount, s.burstWindowMs, s.notify, s.openPaneOnWarning, s.redact])
    .toEqual([600_000, 2_500_000, 7, 20, 120_000, false, true, true])
})

test('a value too small to scale falls back', () => {
  expect(readSettings({ activeMinutes: 1e-12 }).activeMs).toBe(1_800_000)
})

test('mute lists the kinds to silence: case-insensitive, spaces allowed, unknown words ignored', () => {
  expect([...readSettings({ mute: 'Burst, run' }).muted].sort()).toEqual(['burst', 'run'])
  expect([...readSettings({}).muted]).toEqual([])
  expect([...readSettings({ mute: 'nope' }).muted]).toEqual([])
  expect([...readSettings({ mute: 7 }).muted]).toEqual([])
})

test('price is set only when both prices are above 0; the currency defaults to $', () => {
  expect(readSettings({ priceInput: 3, priceOutput: 15 }).price).toEqual({ input: 3, output: 15, currency: '$' })
  expect(readSettings({ priceInput: 3 }).price).toBeNull()
  expect(readSettings({ priceOutput: 15 }).price).toBeNull()
  expect(readSettings({ priceInput: 0, priceOutput: 15 }).price).toBeNull()
  expect(readSettings({ priceInput: '3', priceOutput: 15 }).price).toBeNull()
  expect(readSettings({ priceInput: 3, priceOutput: 15, currency: '¥' }).price?.currency).toBe('¥')
  expect(readSettings({ priceInput: 3, priceOutput: 15, currency: '' }).price?.currency).toBe('$')
  expect(readSettings({ priceInput: 3, priceOutput: 15, currency: 7 }).price?.currency).toBe('$')
  expect(readSettings({ priceInput: 3, priceOutput: 15, currency: '€\u0007' }).price?.currency).toBe('€')
  expect(readSettings({ priceInput: 3, priceOutput: 15, currency: '\u0007' }).price?.currency).toBe('$')
})
