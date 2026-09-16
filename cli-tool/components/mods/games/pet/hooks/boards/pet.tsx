/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { feeling, level, moodAt, stage, type Pet, type PetEvent, type Stage } from '../games/pet.ts'

// The pet's window. The hooks module owns the pet (it feeds it from tool calls and keeps it in
// $.store) and passes it in props; this board only draws it, blinks, and shows hearts on a click.

type PetProps = { pet?: Pet; now?: number } | undefined
type State = { frame: number; petted: number }

const ART: Record<Stage, string[]> = {
  egg: ['   ____   ', '  /    \\  ', ' |  {e}  | ', '  \\____/  '],
  baby: ['  (\\_/)  ', ' ( {e} ) ', ' (")(")  '],
  kid: ['  /\\_/\\  ', ' ( {e} ) ', '  > ^ <  '],
  adult: ['  /\\_____/\\  ', ' (   {e}   ) ', ' (    w    ) ', '  \\_______/  '],
  legend: ['     \\^^^/     ', '  /\\_____/\\  ', ' (   {e}   ) ', ' (    w    ) ', '  \\_______/  '],
}
const EYES = { happy: '^.^', okay: 'o.o', sad: 'T.T' }
const COLORS = { happy: 'greenBright', okay: 'yellow', sad: 'red' }
const FED_BY: Record<PetEvent, string> = { 'test-pass': 'passing tests', 'test-fail': 'failing tests (ouch)', commit: 'a commit', edit: 'an edit' }

const bar = (value: number) => {
  const filled = Math.round(Math.max(0, Math.min(100, value)) / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}
const ago = (ms: number) => {
  const min = Math.floor(ms / 60_000)
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.floor(min / 60)} h ago` : `${Math.floor(min / 1440)} days ago`
}

export default function PetBoard(props: PetProps, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    surface.setState({ frame: 0, petted: 0 })
    surface.every(200, () => {
      const s = surface.state
      if (s) surface.setState({ frame: s.frame + 1, petted: Math.max(0, s.petted - 1) })
    })
    surface.onPointer(ev => {
      const s = surface.state
      if (s && ev.type === 'down') surface.setState({ ...s, petted: 8 })
    })
  }

  const s = surface.state
  const pet = props?.pet
  if (!pet) return <Text dimColor>pet · waiting for the plugin to load it</Text>

  const now = props?.now ?? pet.at
  const mood = moodAt(pet, now)
  const feel = feeling(mood)
  const lvl = level(pet.xp)
  // a blink for one frame in every five seconds
  const eyes = (s?.frame ?? 1) % 25 === 0 ? '-.-' : EYES[feel]
  const art = ART[stage(pet.xp)].map(line => line.replace('{e}', eyes))
  return (
    <Box flexDirection="row" borderStyle="round" borderColor={COLORS[feel]} paddingX={1}>
      <Box flexDirection="column" marginRight={3}>
        <Text color="magentaBright">{s?.petted ? '   ♥   ♥   ' : ' '}</Text>
        {art.map(line => <Text color={COLORS[feel]}>{line}</Text>)}
      </Box>
      <Box flexDirection="column">
        <Text bold>{`${stage(pet.xp)} · level ${lvl}`}</Text>
        <Text dimColor>{`${pet.xp} xp · next level at ${10 * (lvl + 1) ** 2}`}</Text>
        <Text>{'mood '}<Text color={COLORS[feel]}>{bar(mood)}</Text>{` ${feel}`}</Text>
        <Text dimColor>{`tests passed ${pet.tests} · failed ${pet.fails} · commits ${pet.commits} · edits ${pet.edits}`}</Text>
        <Text dimColor>{pet.last ? `last fed by ${FED_BY[pet.last]}, ${ago(now - pet.at)}` : 'it eats passing tests, commits and edits'}</Text>
        <Text dimColor>{`hatched ${ago(now - pet.born)} · click to pet · /arcade stop closes`}</Text>
      </Box>
    </Box>
  )
}
