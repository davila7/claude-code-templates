/* @jsx h */
import type { Register } from 'claude-code'
import { feed, level, newPet, petEvent, stage, type Pet } from './games/pet.ts'

// A virtual pet above the Claude Code prompt, split out of cc-arcade (https://github.com/sezaakgun/cc-arcade,
// MIT, by Seza Akgün). It is fed by Claude's actual work: passing tests, commits and edits grant XP and
// mood, failing tests cost mood, idling drains it; it grows egg → baby → kid → adult → legend. `/pet`
// shows it, `/pet stop` hides it. The pet lives in $.store, so sessions side by side feed the same one.

let open = false
let pet: Pet | undefined

const isPet = (value: unknown): value is Pet => typeof value === 'object' && value !== null && typeof (value as Pet).xp === 'number'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const saved = await $.store.get('pet').catch(err => { $.ui.log(`pet: store read failed: ${err}`); return undefined })
    pet = isPet(saved) ? saved : newPet(await $.clock.now())
    if (!isPet(saved)) await $.store.set('pet', pet).catch(err => $.ui.log(`pet: store write failed: ${err}`))
    await $.command.register({
      name: 'pet',
      description: 'A pet above the prompt that grows as Claude tests, commits and edits (stop hides it)',
      argumentHint: '[stop]',
      immediate: true,
    }).catch(err => $.ui.log(`pet: /pet not registered: ${err}`))
    return r
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    open = !(arg === 'stop' || arg === 'close')
    $.ui.invalidate('ui.render')
    if (!open) return { text: 'pet hidden' }
    const p = pet
    return { text: p ? `pet: level ${level(p.xp)}, ${stage(p.xp)} · click it to pet it · /pet stop hides it` : 'pet: click it to pet it' }
  })

  // the pet feeds on work: a test run passing or failing, a commit, an edit. It is re-read from the
  // store first, so sessions running side by side feed the same pet instead of overwriting it.
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    const command = (e as { command?: unknown }).command
    const event = petEvent(e.tool, typeof command === 'string' ? command : undefined, 'deny' in r ? undefined : !r.isError)
    if (!event) return r
    const saved = await $.store.get('pet').catch(() => undefined)
    const now = await $.clock.now()
    const current = isPet(saved) ? saved : pet ?? newPet(now)
    const fed = feed(current, event, now)
    pet = fed
    await $.store.set('pet', fed).catch(err => $.ui.log(`pet: store write failed: ${err}`))
    if (level(fed.xp) > level(current.xp)) {
      const grew = stage(fed.xp) !== stage(current.xp) ? `, and is now ${stage(fed.xp) === 'adult' ? 'an adult' : `a ${stage(fed.xp)}`}` : ''
      $.ui.toast(`pet: reached level ${level(fed.xp)}${grew}`)
    }
    if (open) $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!open || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Button, Client } = $.ui.resolve(e)
    // the band's own width: the transcript column's while a Pane is docked beside it
    const cols = e.props.bodyColumns || (e.viewport?.columns ?? 80)
    // $.clock.now() is a dispatch (a Promise): resolve it before it becomes a prop
    const now = await $.clock.now()
    const close = () => {
      open = false
      $.ui.invalidate('ui.render')
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          <Button key="pet:close" label="close" onPress={close} />
        </Box>
        <Client key="board:pet" module="./boards/pet.tsx" width={cols} props={{ pet, now }} />
        {await next(e)}
      </Box>
    )
  })
}
