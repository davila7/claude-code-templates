/* @jsx h */
import type { Register } from 'claude-code'

import { EXPRESSIONS, SUDUS_SVG, type Expression } from './faces.ts'
import { latest } from './latest.ts'
import { rasterOf, type Raster } from './raster.ts'
import { changesVerdict, expressionOf, parseWake, statusTextOf, type Verdict } from './verdict.ts'

// Sudus, the referee for agent-led software development, in front of the person: what `sudus wake`
// names next, as a status line under the prompt, a pane beside the transcript, or both, with a
// blobatar face whose expression follows the verdict. Everything is set in settings.json
// (pluginConfigs["sudus-status"].options); there is no command. Zero tokens: the mod runs
// `sudus wake` itself after every turn and every sudus, cairn or git command, and never asks the
// model anything. A hook never waits on wake: it asks for a refresh and returns, and one wake
// runs at a time with the newest request always landing. Needs the sudus command (the
// install-sudus skill) and function hooks (early access).

const PANE_ID = 'sudus'
const TITLE = 'Sudus'
const FACE_COLUMNS = 12
const FACE_ROWS = 6
const FACE_PX = 96
const SVG_PX = 72
const WAKE_TIMEOUT_MS = 20000
const BLOBATAR = 'https://blobatar.dev/avatar/'

type View = 'status-line' | 'pane' | 'both' | 'off'

const VIEWS: readonly View[] = ['status-line', 'pane', 'both', 'off']

const viewOf = (value: unknown): View => (VIEWS as readonly unknown[]).includes(value) ? (value as View) : 'status-line'

let view: View = 'status-line'
let command = 'sudus'
let withAsciiFace = true
let seed = 'sudus'
let verdict: Verdict = { kind: 'missing', detail: 'sudus wake has not run yet' }
let isTurnRunning = false
let isPaneClosedByPerson = false
let svgs: Record<Expression, string> = { ...SUDUS_SVG }
const rasters = new Map<Expression, Raster>()
const refreshes = latest()

// Bound at session.start over that dispatch's `$`, as the diff mod binds its host: the other
// hooks ask for a paint or a refresh without handing `$` to anything.
let paint: () => void = () => undefined
let refresh: () => void = () => undefined

const showsStatus = () => view === 'status-line' || view === 'both'
const showsPane = () => view === 'pane' || view === 'both'

const colorOf = (v: Verdict): string =>
  v.kind !== 'verdict' ? 'red' : v.verdict === 'Done' ? 'cyan' : v.verdict === 'Waiting' ? 'yellow' : 'green'

const rasterFor = (x: Expression): Raster => {
  let r = rasters.get(x)
  if (!r) { r = rasterOf(svgs[x], FACE_PX); rasters.set(x, r) }
  return r
}

export const register: Register = (on, options) => {
  view = viewOf(options.view)
  command = typeof options.command === 'string' && options.command.trim() ? options.command.trim() : 'sudus'
  withAsciiFace = options.asciiFace !== false
  seed = typeof options.face === 'string' && options.face.trim() ? options.face.trim() : 'sudus'

  if (view === 'off') return

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    paint = () => {
      try {
        if (showsStatus()) $.ui.status(statusTextOf(verdict, isTurnRunning, withAsciiFace))
        if (showsPane() && !isPaneClosedByPerson) $.ui.invalidate('ui.render')
      } catch (err) {
        $.ui.log(`sudus-status: not drawn: ${err}`)
      }
    }
    refresh = () => {
      void refreshes(async () => {
        try {
          const cwd = await $.session.cwd()
          const run = await $.process.run([command, 'wake'], { cwd, timeoutMs: WAKE_TIMEOUT_MS })
          verdict = parseWake(run.stdout, run.exitCode)
        } catch (err) {
          verdict = { kind: 'missing', detail: `${command} did not run (${String(err).split('\n')[0]}); the install-sudus skill sets it up` }
        }
        paint()
      })
    }
    if (seed !== 'sudus') {
      // Another face: its six expressions fetched once; a fetch that fails keeps the sudus face.
      const fetched: Partial<Record<Expression, string>> = {}
      for (const x of EXPRESSIONS) {
        try {
          const { ok, text } = await $.http.fetch(`${BLOBATAR}${encodeURIComponent(seed)}?background=squircle&expression=${x}`)
          if (ok && text.startsWith('<svg')) fetched[x] = text
        } catch (err) {
          $.ui.log(`sudus-status: face ${seed} not fetched (${x}): ${err}`)
        }
      }
      if (EXPRESSIONS.every(x => fetched[x] !== undefined)) { svgs = fetched as Record<Expression, string>; rasters.clear() }
    }
    if (showsPane()) await $.ui.open({ id: PANE_ID, title: TITLE }).catch(err => $.ui.log(`sudus-status: pane not opened: ${err}`))
    refresh()
    return r
  })

  // A subagent's run raises no turn.start, so every one here is the main loop's.
  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    paint()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) return r
    isTurnRunning = false
    paint()
    refresh()
    return r
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const r = await next(e)
    const cmd = (e as { command?: unknown }).command
    if (typeof cmd === 'string' && changesVerdict(cmd)) refresh()
    return r
  })

  on('ui.close', { id: PANE_ID }, ($, e, next) => {
    if (e.origin.kind === 'person') isPaneClosedByPerson = true
    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e)
    const expression = expressionOf(verdict, isTurnRunning)
    const color = colorOf(verdict)
    const lines = paneLines(verdict, isTurnRunning)
    if (e.surface === 'terminal') {
      const { Box, Text, Image } = $.ui.resolve(e)
      const face = rasterFor(expression)
      return (
        <Box flexDirection="column" paddingTop={1} paddingLeft={1}>
          <Box flexDirection="row" columnGap={2}>
            <Image key="face" source={{ rgba: face.rgba, width: face.width, height: face.height }} columns={FACE_COLUMNS} rows={FACE_ROWS} alt={`Sudus is ${expression}`} />
            <Box flexDirection="column">
              <Text bold color={color}>{lines.headline}</Text>
              {lines.body.map((l, i) => <Text key={`b${i}`} wrap="wrap">{l}</Text>)}
            </Box>
          </Box>
          {lines.notes.map((l, i) => <Text key={`n${i}`} dimColor wrap="wrap">{l}</Text>)}
        </Box>
      )
    }
    const { Box, Text, Svg } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" paddingTop={1} paddingLeft={1}>
        <Box flexDirection="row" columnGap={2}>
          <Svg source={svgs[expression]} alt={`Sudus is ${expression}`} width={SVG_PX} height={SVG_PX} />
          <Box flexDirection="column">
            <Text bold color={color}>{lines.headline}</Text>
            {lines.body.map((l, i) => <Text key={`b${i}`} wrap="wrap">{l}</Text>)}
          </Box>
        </Box>
        {lines.notes.map((l, i) => <Text key={`n${i}`} dimColor wrap="wrap">{l}</Text>)}
      </Box>
    )
  })
}

function paneLines(v: Verdict, isTurnRunning: boolean): { headline: string; body: string[]; notes: string[] } {
  const turn = isTurnRunning ? ' (a turn is running)' : ''
  if (v.kind === 'missing') return { headline: 'Sudus is not reachable' + turn, body: [v.detail], notes: [] }
  if (v.kind === 'line') return { headline: (v.exit === 3 ? 'Repair' : 'Sudus') + turn, body: [v.line], notes: [] }
  const notes = [`predicate: ${v.predicate}`]
  if (v.layout) notes.push(v.layout)
  if (v.verdict === 'Done') return { headline: (v.target ? `Done: ${v.target}` : 'Done') + turn, body: [v.reason], notes }
  if (v.verdict === 'Waiting') return { headline: `Waiting for the ${v.party ?? 'developer'}` + turn, body: v.question ? [v.question, v.reason] : [v.reason], notes }
  return { headline: `${v.action ?? ''} ${v.target ?? ''}`.trim() + turn, body: [v.reason], notes }
}
