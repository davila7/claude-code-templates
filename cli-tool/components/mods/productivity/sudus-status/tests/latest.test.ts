import { expect, test } from 'bun:test'
import { latest } from '../hooks/latest.ts'

const tick = () => new Promise<void>(r => setTimeout(r, 1))

test('overlapping requests run one job at a time, and the newest runs last', async () => {
  const trigger = latest()
  let active = 0, most = 0
  const ran: number[] = []
  const job = (n: number) => async () => {
    active++; most = Math.max(most, active)
    await tick(); await tick()
    ran.push(n); active--
  }
  const settled = [trigger(job(1)), trigger(job(2)), trigger(job(3)), trigger(job(4))]
  await Promise.all(settled)
  expect(most).toBe(1)
  expect(ran[0]).toBe(1)
  expect(ran.at(-1)).toBe(4)
  expect(ran).not.toContain(2)
  expect(ran).not.toContain(3)
})

test('a request made while the newest job runs gets its own run after it', async () => {
  const trigger = latest()
  const ran: string[] = []
  const first = trigger(async () => { await tick(); ran.push('a'); void trigger(async () => { ran.push('b') }) })
  await first
  expect(ran).toEqual(['a', 'b'])
})

test('a failing job does not stop the next one', async () => {
  const trigger = latest()
  const ran: string[] = []
  void trigger(async () => { await tick(); throw new Error('boom') })
  await trigger(async () => { ran.push('after') })
  expect(ran).toEqual(['after'])
})
