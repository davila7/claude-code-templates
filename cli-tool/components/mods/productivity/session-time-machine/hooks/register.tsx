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
const C = {
  accent: '#58a6ff',
  prompt: '#5eb1ff',
  turn: '#b392f0',
  ink: '#e6edf3',
  chip: '#2a313c',
  rail: '#4b5563',
  armed: '#1f3a5f',
  hover: '#2d3b52',
  bad: '#f85149',
  tool: { Bash: '#7ee787', Edit: '#f2cc60', Read: '#6cb6c9', Web: '#ff9d5c', Agent: '#f778ba', Mcp: '#d2a8ff', Other: '#8b949e' },
}

const toolColor = (name = ''): string =>
  /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(name) ? C.tool.Edit
  : name === 'Bash' ? C.tool.Bash
  : /^(Read|Grep|Glob|LS)$/.test(name) ? C.tool.Read
  : /^Web/.test(name) ? C.tool.Web
  : /^(Agent|Task)$/.test(name) ? C.tool.Agent
  : name.startsWith('mcp__') ? C.tool.Mcp
  : C.tool.Other

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
    // header, count chips, rule, footer bar and the paging row take 9 of the pane's rows
    const room = Math.max(3, (e.viewport?.rows ?? 24) - 9)
    const last = Math.max(0, points.length - room)
    const start = Math.min(Math.max(offset, 0), last)
    const shown = points.slice(start, start + room)
    const wide = Math.max(16, (e.viewport?.columns ?? 60) - 16)
    const turns = points.filter(p => p.kind === 'prompt').length
    const tools = points.filter(p => p.kind === 'tool').length
    const pick = points.find(p => p.n === armed)
    const repaint = () => $.ui.invalidate('ui.render')
    return (
      <Box key="tm" flexDirection="column">
        <Box key="head" flexDirection="row">
          <Text bold color={C.accent}>
            {'⏱ Time machine'}
          </Text>
        </Box>
        <Box key="chips" flexDirection="row" marginTop={1}>
          <Text color={C.ink} backgroundColor={C.chip}>{` ${points.length} points `}</Text>
          <Text>{' '}</Text>
          <Text color={C.prompt} backgroundColor={C.chip}>{` ${turns} prompts `}</Text>
          <Text>{' '}</Text>
          <Text color={C.tool.Bash} backgroundColor={C.chip}>{` ${tools} calls `}</Text>
        </Box>
        <Text color={C.rail}>{'─'.repeat(Math.max(10, (e.viewport?.columns ?? 60) - 6))}</Text>
        {problem && <Text color={C.bad}>{problem}</Text>}
        {points.length === 0 && !problem && <Text dimColor>Nothing recorded yet: send a prompt, then reload.</Text>}
        {shown.map(p => {
          const isArmed = armed === p.n
          const tint = p.kind === 'prompt' ? C.prompt : p.kind === 'turn' ? C.turn : toolColor(p.tool)
          const rail = p.kind === 'prompt' ? '┏' : p.kind === 'turn' ? '┗' : '┃'
          const glyph = p.kind === 'prompt' ? '●' : p.kind === 'turn' ? '■' : '◆'
          const kind = p.kind === 'prompt' ? `prompt ${p.turn}` : p.kind === 'turn' ? 'turn end' : (p.tool ?? 'tool')
          return (
            <Box key={`r${p.n}`} flexDirection="row" backgroundColor={isArmed ? C.armed : undefined}>
              <Text dimColor>{String(p.n).padStart(3)} </Text>
              <Text color={C.rail}>{rail}</Text>
              <Text bold color={tint}>{` ${glyph} `}</Text>
              <Button
                key={`p${p.n}`}
                plain
                hover={{ backgroundColor: C.hover, bold: true }}
                onPress={() => {
                  armed = p.n
                  repaint()
                  void $.prompt.fill({ text: `/timemachine fork ${p.n} ` }).catch(() => undefined)
                }}
              >
                {clip(`${kind}  ${p.detail}`, wide)}
              </Button>
            </Box>
          )
        })}
        <Box key="foot" flexDirection="column" marginTop={1} borderStyle="round" borderColor={pick ? C.accent : C.rail} paddingX={1}>
          {pick ? (
            <Box key="armed" flexDirection="column">
              <Text bold color={C.accent}>{`Fork from #${pick.n}`}</Text>
              <Text dimColor wrap="truncate-end">{`${pick.kind === 'prompt' ? 'before' : 'after'}: ${clip(pick.detail, wide)}`}</Text>
              <Text color={C.ink}>{`Type the new instruction after /timemachine fork ${pick.n} and press Enter.`}</Text>
            </Box>
          ) : (
            <Text dimColor>Press any point to fork the session from there with a new instruction.</Text>
          )}
        </Box>
        <Box key="nav" flexDirection="row" marginTop={1}>
          <Button
            key="older"
            hover={{ color: C.accent }}
            onPress={() => {
              offset = Math.max(0, start - room)
              repaint()
            }}
          >
            ↑ older
          </Button>
          <Text>{'   '}</Text>
          <Button
            key="newer"
            hover={{ color: C.accent }}
            onPress={() => {
              offset = Math.min(last, start + room)
              repaint()
            }}
          >
            ↓ newer
          </Button>
          <Text>{'   '}</Text>
          <Button
            key="reload"
            hover={{ color: C.accent }}
            onPress={async () => {
              await $.fs
                .read(transcriptPath((await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`, await $.session.cwd(), await $.session.id()))
                .then(ingest, fail)
              repaint()
            }}
          >
            ⟳ reload
          </Button>
          {pick && (
            <Button
              key="clear"
              hover={{ color: C.bad }}
              onPress={() => {
                armed = undefined
                repaint()
              }}
            >
              {'   ✕ clear'}
            </Button>
          )}
        </Box>
      </Box>
    )
  })
}
