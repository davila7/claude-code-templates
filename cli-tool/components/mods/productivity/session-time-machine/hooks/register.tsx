/* @jsx h */
/**
 * session-time-machine — Claude Mod (EARLY ACCESS)
 *
 * `/timemachine` opens a pane with the session's timeline: every prompt, tool
 * call and turn end, read from the session's own transcript. Press a point
 * (or run `/timemachine fork <n> <instruction>`) and the mod writes a copy of
 * the transcript cut at that point under a new session id, with the
 * `claude --resume <id> "<instruction>"` command that continues it, copied to
 * the clipboard. The original session is not touched.
 *
 * The mod API has no call that forks the live session, so the fork is a new
 * session you open yourself; see the README.
 *
 * Hooks: `session.start` registers the command, `command.run` opens the pane,
 * lists or forks, `turn.complete` re-reads the transcript,
 * `ui.render` on Pane draws it.
 *
 * Options:
 *   copyCommand: boolean  copy the resume command to the clipboard (default true)
 */
import type { Register } from 'claude-code'
import {
  buildTimeline,
  clip,
  forkTranscript,
  mainChain,
  newSessionId,
  parseArgs,
  parseRows,
  resumeCommand,
  transcriptPath,
  type Point,
  type Row,
} from './transcript.ts'

const PANE = 'time-machine'
const MARK: Record<Point['kind'], string> = { prompt: '▸', tool: '·', turn: '■' }

let chain: Row[] = []
let points: Point[] = []
let armed: number | undefined
let offset = 0
let problem: string | undefined

const ingest = (text: string) => {
  problem = undefined
  chain = mainChain(parseRows(text))
  points = buildTimeline(chain)
  offset = Math.max(0, points.length - 12)
}

const fail = (err: unknown) => {
  problem = `cannot read the transcript (${err instanceof Error ? err.message : String(err)}); the read limit is 4 MiB`
}

export const register: Register = (on, options) => {
  const isCopying = options.copyCommand !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'timemachine',
      description: 'Timeline of this session; fork it from any point with a new instruction',
    })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await $.fs
        .read(transcriptPath((await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`, await $.session.cwd(), await $.session.id()))
        .then(ingest, fail)
      $.ui.status(points.length > 0 ? `⏱ ${points.length} points · /timemachine` : undefined)
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('command.run', { command: 'timemachine' }, async ($, e) => {
    const args = parseArgs(e.args)
    if (args.kind === 'error') return { text: args.text }
    const cwd = await $.session.cwd()
    const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`
    await $.fs.read(transcriptPath(dir, cwd, await $.session.id())).then(ingest, fail)
    if (problem) return { text: `time machine: ${problem}` }

    if (args.kind === 'open') {
      await $.ui.open({ id: PANE, title: 'Time machine', focus: true })
      return { text: `Time machine: ${points.length} points. Press one to arm a fork, or /timemachine fork <n> <instruction>.` }
    }
    if (args.kind === 'list') {
      return { text: points.map(p => `${String(p.n).padStart(3)}  ${p.label}`).join('\n') || 'No points yet.' }
    }

    const point = points.find(p => p.n === args.n)
    if (!point) return { text: `time machine: no point ${args.n} (1-${points.length}); /timemachine list shows them` }
    const newId = newSessionId()
    const body = forkTranscript(chain, point.keep, newId)
    const kept = body ? body.trimEnd().split('\n').length : 0
    if (kept === 0) return { text: 'time machine: nothing before that point to fork from' }
    const file = transcriptPath(dir, cwd, newId)
    await $.fs.write(file, body)
    const command = resumeCommand(cwd, newId, args.instruction)
    armed = undefined
    $.ui.invalidate('ui.render')
    let copied = false
    if (isCopying) copied = (await $.ui.copy({ text: command }).catch(() => ({ isCopied: false }))).isCopied === true
    return {
      text: [
        `Forked at point ${point.n} (${clip(point.label, 60)}): ${kept} rows kept.`,
        `New session ${newId}${copied ? ', resume command copied' : ''}. In a new terminal:`,
        command,
      ].join('\n'),
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const room = Math.max(3, (e.viewport?.rows ?? 24) - 6)
    const last = Math.max(0, points.length - room)
    const start = Math.min(Math.max(offset, 0), last)
    const shown = points.slice(start, start + room)
    const wide = Math.max(20, (e.viewport?.columns ?? 60) - 10)
    return (
      <Box flexDirection="column">
        <Text dimColor>
          {points.length} points · press one to fork from it ({armed ? `armed #${armed}` : 'none armed'})
        </Text>
        {problem && <Text color="red">{problem}</Text>}
        {points.length === 0 && !problem && <Text dimColor>Nothing recorded yet.</Text>}
        {shown.map(p => (
          <Button
            key={`p${p.n}`}
            plain
            onPress={() => {
              armed = p.n
              $.ui.invalidate('ui.render')
              void $.prompt.fill({ text: `/timemachine fork ${p.n} ` })
            }}
          >
            {`${armed === p.n ? '>' : ' '} ${String(p.n).padStart(3)} ${MARK[p.kind]} ${clip(p.label, wide)}`}
          </Button>
        ))}
        <Box>
          <Button
            key="older"
            onPress={() => {
              offset = Math.max(0, start - room)
              $.ui.invalidate('ui.render')
            }}
          >
            older
          </Button>
          <Button
            key="newer"
            onPress={() => {
              offset = Math.min(last, start + room)
              $.ui.invalidate('ui.render')
            }}
          >
            newer
          </Button>
          <Button
            key="reload"
            onPress={async () => {
              await $.fs
                .read(transcriptPath((await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`, await $.session.cwd(), await $.session.id()))
                .then(ingest, fail)
              $.ui.invalidate('ui.render')
            }}
          >
            reload
          </Button>
        </Box>
      </Box>
    )
  })
}
