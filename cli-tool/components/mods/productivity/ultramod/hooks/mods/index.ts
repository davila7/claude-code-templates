import type { UltraMod } from '../core/mod'
import type { SetsEngine } from '../core/sets'
import { guard } from './guard'
import { secrets } from './secrets'
import { tests } from './tests'
import { tidy } from './tidy'
import { loops } from './loops'
import { receipts } from './receipts'
import { compact } from './compact'
import { notify } from './notify'
import { pins } from './pins'
import { createHud } from './hud'

export function createMods(sets: SetsEngine) {
  const mods: UltraMod[] = [guard, secrets, tests, tidy, loops, receipts, compact, notify, pins]
  const hud = createHud(sets)
  mods.push(hud)
  return { mods, hud }
}
