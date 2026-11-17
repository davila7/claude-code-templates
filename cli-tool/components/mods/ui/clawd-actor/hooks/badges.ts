// Badges: what earns them, the counts kept toward them, and how /clawd badges words them.
// Pure, like scenes.ts. The counts live in $.store, so they are the same in every project.

import type { Lang } from './say.ts'

export type Stats = {
  hellos: number // /clawd commands of any kind
  pets: number
  feeds: number
  notes: number
  todosDone: number
  reminders: number
  clearDays: number // days every todo got done, three or more of them
  longestTurnMin: number
  lateTurns: number // turns started between midnight and 4 a.m.
  day: string // the last day a turn ran, YYYY-MM-DD
  dayTurns: number // turns on that day
  bestDayTurns: number
  streak: number // days in a row with a turn, up to `day`
  bestStreak: number
}

export const EMPTY: Stats = {
  hellos: 0, pets: 0, feeds: 0, notes: 0, todosDone: 0, reminders: 0, clearDays: 0,
  longestTurnMin: 0, lateTurns: 0, day: '', dayTurns: 0, bestDayTurns: 0, streak: 0, bestStreak: 0,
}

/** Stats from what the store held: each field of the right type kept, anything else from EMPTY. */
export const readStats = (raw: unknown): Stats => {
  const held = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const fields = Object.entries(EMPTY).map(([k, v]) => {
    const x = held[k]
    const isKept = typeof v === 'number' ? typeof x === 'number' && Number.isFinite(x) && x >= 0 : typeof x === 'string'
    return [k, isKept ? x : v]
  })
  return Object.fromEntries(fields) as Stats
}

/** Whether day `b` is the day after `a`, both YYYY-MM-DD. */
const isNextDay = (a: string, b: string) => {
  const t = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
  return a !== '' && t(b) - t(a) === 86_400_000
}

/** The stats after a turn starts on `day` at `hour` (local). */
export const onTurn = (s: Stats, day: string, hour: number): Stats => {
  const isSameDay = s.day === day
  const dayTurns = isSameDay ? s.dayTurns + 1 : 1
  const streak = isSameDay ? s.streak : isNextDay(s.day, day) ? s.streak + 1 : 1
  return {
    ...s,
    day,
    dayTurns,
    streak,
    bestDayTurns: Math.max(s.bestDayTurns, dayTurns),
    bestStreak: Math.max(s.bestStreak, streak),
    lateTurns: s.lateTurns + (hour < 4 ? 1 : 0),
  }
}

export type Badge = { id: string; goal: number; count: (s: Stats) => number; en: [string, string]; zh: [string, string] }

// [name, how it is earned], in each language
export const BADGES: Badge[] = [
  { id: 'hello', goal: 1, count: s => s.hellos, en: ['Hello there', 'say anything to Clawd'], zh: ['初次見面', '跟 Clawd 打聲招呼'] },
  { id: 'petLover', goal: 100, count: s => s.pets, en: ['Best friends', 'pet Clawd 100 times'], zh: ['好朋友', '摸摸 Clawd 100 次'] },
  { id: 'foodie', goal: 50, count: s => s.feeds, en: ['Cookie monster', 'feed Clawd 50 cookies'], zh: ['餅乾怪獸', '餵 Clawd 50 片餅乾'] },
  { id: 'scribe', goal: 20, count: s => s.notes, en: ['Scribe', 'write 20 notes'], zh: ['筆記達人', '寫 20 則筆記'] },
  { id: 'finisher', goal: 50, count: s => s.todosDone, en: ['Finisher', 'tick off 50 todos'], zh: ['執行力', '完成 50 項待辦'] },
  { id: 'cleanSlate', goal: 1, count: s => s.clearDays, en: ['Clean slate', "finish all of a day's todos, 3 or more"], zh: ['清空清單', '一天完成全部待辦（至少 3 項）'] },
  { id: 'onTime', goal: 10, count: s => s.reminders, en: ['On time', 'set 10 reminders'], zh: ['準時', '設 10 個提醒'] },
  { id: 'marathon', goal: 10, count: s => s.longestTurnMin, en: ['Marathon', 'a turn of 10 minutes'], zh: ['馬拉松', '一個 turn 跑滿 10 分鐘'] },
  { id: 'busyBee', goal: 50, count: s => s.bestDayTurns, en: ['Busy bee', '50 turns in a day'], zh: ['忙碌的一天', '一天 50 個 turn'] },
  { id: 'regular', goal: 7, count: s => s.bestStreak, en: ['Regular', '7 days in a row'], zh: ['天天見', '連續 7 天'] },
  { id: 'nightOwl', goal: 1, count: s => s.lateTurns, en: ['Night owl', 'a turn between midnight and 4 a.m.'], zh: ['夜貓子', '半夜 12 點到 4 點跑一個 turn'] },
]

/** The badges `s` earns that `got` (id → the day it was earned) does not hold yet. */
export const earned = (s: Stats, got: Record<string, string>): Badge[] => BADGES.filter(b => !got[b.id] && b.count(s) >= b.goal)

/** Badges the store held, as id → day: anything not a known id with a string day is dropped. */
export const readGot = (raw: unknown): Record<string, string> => {
  const held = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Object.fromEntries(BADGES.flatMap(b => (typeof held[b.id] === 'string' ? [[b.id, held[b.id] as string]] : [])))
}

/** What Clawd says as `fresh` badges are earned. */
export const cheer = (fresh: Badge[], lang: Lang) =>
  (lang === 'zh' ? '解鎖徽章：' : 'Badge unlocked: ') + fresh.map(b => `★ ${b[lang][0]}`).join(', ')

/** What /clawd badges says: how many are earned, which, and the closest one still to go. */
export const shelf = (s: Stats, got: Record<string, string>, lang: Lang) => {
  const mine = BADGES.filter(b => got[b.id])
  const next = BADGES.filter(b => !got[b.id]).sort((a, b) => b.count(s) / b.goal - a.count(s) / a.goal)[0]
  const zh = lang === 'zh'
  const have = mine.length ? mine.map(b => b[lang][0]).join(', ') : zh ? '還沒有' : 'none yet'
  const toGo = next ? ` · ${zh ? '下一個' : 'Next'}: ${next[lang][0]}, ${next[lang][1]} (${Math.min(next.count(s), next.goal)}/${next.goal})` : ''
  return `★ ${mine.length}/${BADGES.length}: ${have}${toGo}`
}
