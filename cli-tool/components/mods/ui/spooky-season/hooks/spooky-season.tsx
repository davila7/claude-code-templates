import type { Register } from 'claude-code'

const DONE = ['Haunted', 'Brewed', 'Conjured', 'Summoned', 'Carved', 'Cursed', 'Hexed', 'Exhumed']

/** Same seed, same word: a redraw of one line never changes its word. */
export const pick = (list: readonly string[], seed: string): string => {
  let n = 0
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) >>> 0
  return list[n % list.length] ?? list[0] ?? ''
}

// A solid edge with drops of different lengths hanging under it.
const DRIP = '▀▀█▀▀▀▀▀▄▀▀▀█▀▀▀▀▀▀▀▀▄▀▀█▀▀▀▀▀▀▀█▀▀▀▀▄▀▀▀▀▀▀█▀▀▀▀▀▄▀▀'

export const drip = (columns: number): string =>
  DRIP.repeat(Math.ceil(columns / DRIP.length)).slice(0, Math.max(0, columns))

const BLOOD = '#a30d0d'
const PUMPKIN = '#ff7518'
const BONE = '#e8dfcc'
const ASH = '#8f8597'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'halloween',
      description: 'Show or hide the Halloween band and turn words (on | off)',
    })

    return next(e)
  })

  on('command.run', { command: 'halloween' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const isOff = (await $.store.get('off')) === true
    const turnOn = arg === 'on' ? true : arg === 'off' ? false : isOff
    await $.store.set('off', !turnOn)

    return {
      text: turnOn
        ? 'Halloween on 🎃 For the colors, install the appearance/halloween-theme setting.'
        : 'Halloween off. The colors stay until you pick another theme in /theme.',
    }
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if ('waitingFor' in e.props || (await $.store.get('off')) === true) return next(e)

    return next({ ...e, props: { ...e.props, word: pick(DONE, `${e.requestId}:${e.props.word}`) } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey || e.props.maxRows < 3 || (await $.store.get('off')) === true) return below

    const { Box, Text } = $.ui.resolve(e)
    const width = Math.max(10, Math.min(e.props.bodyColumns || 80, 120))

    return (
      <Box flexDirection="column">
        <Text color={BLOOD}>{drip(width)}</Text>
        <Box>
          <Text color={PUMPKIN}>{'🎃 '}</Text>
          <Text color={BONE} bold>
            {'spooky season'}
          </Text>
          <Text color={ASH}>{'  ☠  /halloween off'}</Text>
        </Box>
        {below}
      </Box>
    )
  })
}
