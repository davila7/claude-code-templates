/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, isSpace, statusLine, type Base, type Props } from './common.tsx'
import { BASE, build, enemyPos, H, isPath, KINDS, newDefense, spawn, step, TOWER_COST, UPGRADE_COST, W, type DefenseGame, type Pt } from '../games/defense.ts'

// Tool calls arrive as props: the hooks module keeps the last few with a running number, and the
// board spawns every one it has not seen yet, so a redraw never doubles an enemy.
type Call = { seq: number; tool: string }
type DefenseProps = (Props & { calls?: Call[]; working?: boolean }) | undefined
type State = Base & { game: DefenseGame; seenSeq: number; note?: string; noteTtl: number }

const TICK_MS = 125
const LEVEL_GLYPH = ['', '▲▲', '◆◆', '★★'] as const
const LEVEL_COLOR = ['', 'cyan', 'blueBright', 'yellowBright'] as const

export default function Defense(props: DefenseProps, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    surface.setState({ ...base(props), playing: true, game: newDefense(), seenSeq: props?.calls?.at(-1)?.seq ?? 0, noteTtl: 0 })
    surface.every(TICK_MS, () => {
      const s = surface.state
      if (!s || !s.playing || s.game.over) return
      const game = step(s.game)
      if (game.over) surface.post({ game: 'tool-defense', score: game.score })
      surface.setState({ ...s, game, noteTtl: Math.max(0, s.noteTtl - 1) })
    })
    surface.onPointer(ev => {
      const s = surface.state
      if (!s || ev.type !== 'down') return
      // the border takes the first row and column; each cell is two columns wide
      const cell: Pt = [Math.floor((ev.x - 1) / 2), ev.y - 1]
      const { game, note } = build(s.game, cell)
      surface.setState({ ...s, game, note, noteTtl: 20, banner: false })
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      const k = key.toLowerCase()
      if (k === 'r') surface.setState({ ...s, game: newDefense(), playing: true, banner: false, note: undefined })
      else if (isSpace(k) || k === 'p') surface.setState({ ...s, playing: !s.playing, banner: false })
    })
  }
  // Claude finishing a turn is news here, not a pause: the enemies stop coming on their own
  claudeDone(props, surface, false)

  // spawn the tool calls that arrived since the last draw
  const s0 = surface.state
  if (s0) {
    const fresh = (props?.calls ?? []).filter(c => c.seq > s0.seenSeq)
    if (fresh.length > 0) {
      let game = s0.game
      for (const c of fresh) game = spawn(game, c.tool)
      if (game.over) surface.post({ game: 'tool-defense', score: game.score })
      surface.setState({ ...s0, game, seenSeq: fresh[fresh.length - 1]!.seq })
    }
  }

  const s = surface.state
  const g = s?.game ?? newDefense()
  const towers = new Map<number, 1 | 2 | 3>()
  for (const t of g.towers) towers.set(t.pos[1] * W + t.pos[0], t.level)
  const enemies = new Map<number, { glyph: string; color: string }>()
  for (const e of g.enemies) {
    const p = enemyPos(e)
    const k = KINDS[e.kind]
    enemies.set(p[1] * W + p[0], { glyph: e.hp < e.maxHp / 2 ? k.glyph.slice(0, 1) + ' ' : k.glyph, color: k.color })
  }
  const hits = new Set(g.shots.map(sh => sh.to[1] * W + sh.to[0]))
  const rows = grid(Text, W, H, (x, y) => {
    const k = y * W + x
    const enemy = enemies.get(k)
    if (enemy) return hits.has(k) ? [enemy.glyph, enemy.color, 'white'] : [enemy.glyph, enemy.color]
    if (x === BASE[0] && y === BASE[1]) return ['▐▌', g.lives > 3 ? 'yellow' : 'red']
    const level = towers.get(k)
    if (level) return [LEVEL_GLYPH[level], LEVEL_COLOR[level]]
    if (isPath([x, y])) return ['░░', 'gray']
    return ['  ']
  })
  const note = s && s.noteTtl > 0 && s.note ? ` · ${s.note}` : ''
  const last = g.enemies[g.enemies.length - 1]
  const text = g.over ? `tool defense · the base fell · score ${g.score}, ${g.kills} kills · r plays again`
    : !s?.playing ? `tool defense · paused · space resumes`
    : `tool defense · gold ${g.gold} · ♥${g.lives} · score ${g.score}${note || (last ? ` · incoming: ${last.tool}` : props?.working ? ' · Claude is working: every tool call is an enemy' : ' · quiet: click a cell to build (25), a tower to upgrade')}`
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g.over ? 'red' : g.lives <= 3 ? 'yellow' : 'cyan'} width={W * 2 + 2}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${props?.best ?? 0}`)}
      <Text dimColor wrap="truncate-end">{`▶▶ Bash  ██ Edit/Write  ◢◣ web & MCP  ▓▓ Agent  ▪▪ other · tower ${TOWER_COST}, upgrades ${UPGRADE_COST[1]}/${UPGRADE_COST[2]}`}</Text>
    </Box>
  )
}
