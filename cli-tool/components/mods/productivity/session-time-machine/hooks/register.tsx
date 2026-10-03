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
  mainChain,
  forkMessage,
  planFork,
  newSessionId,
  parseArgs,
  parseRows,
  transcriptPath,
  type Point,
  type Row,
} from './transcript.ts'
import { MUTATING, loadSnapshots, openInTerminal, restoreWorktree, snapshotFor, takeSnapshot, type Run } from './snapshots.ts'

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
let isExpanded = false
let forkResult: string | undefined
let snaps = new Map<string, string>()
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
  const isSnapshotting = options.snapshots !== false
  const isOpening = options.openTerminal !== false

  /** What a helper needs from `$`, as plain values and closures: the engine refuses `$` itself passed to a function. */
  type Ctx = {
    cwd: string
    sid: string
    dir: string
    run: Run
    read: (path: string) => Promise<string>
    write: (path: string, text: string) => Promise<void>
    copy: (text: string) => Promise<boolean>
    repaint: () => void
  }

  const reread = async (c: Ctx) => {
    await c.read(transcriptPath(c.dir, c.cwd, c.sid)).then(ingest, fail)
    snaps = await loadSnapshots(c.run, c.cwd, c.sid)
  }
  const snapshot = async (c: Ctx, key: string) => {
    if (!isSnapshotting) return
    const id = await takeSnapshot(c.run, c.cwd, c.sid, key)
    if (id) snaps.set(key, id)
  }

  /** Forks at point `n`: restores the files into a git worktree when a snapshot exists, writes the cut session, opens it. */
  const forkAt = async (c: Ctx, n: number, instruction: string): Promise<string> => {
    const { cwd, dir, run } = c
    const newId = newSessionId()
    const commit = snapshotFor(points, n, snaps)
    const tree = commit ? await restoreWorktree(run, cwd, commit, newId.slice(0, 8)) : undefined
    const note = tree
      ? `Time machine: this session was forked at point ${n}. The project files were restored to that moment in the git worktree ${tree.path} (branch ${tree.branch}); the original checkout is ${cwd}. Work in the worktree, not in the original.`
      : ''
    const plan = planFork(chain, points, n, [note, instruction].filter(Boolean).join('\n\n'), tree?.path ?? cwd, dir, newId)
    if ('error' in plan) {
      if (tree) await run(['git', 'worktree', 'remove', '--force', tree.path], { cwd }).catch(() => undefined)
      return `time machine: ${plan.error}`
    }
    await c.write(plan.file, plan.body)
    armed = undefined
    c.repaint()
    const opened = isOpening && (await openInTerminal(run, plan.command))
    const copied = !opened && isCopying ? await c.copy(plan.command).catch(() => false) : false
    return [
      `Forked at point ${plan.n} (${plan.label}): ${plan.kept} rows kept.`,
      tree ? `Files restored in worktree ${tree.path} (branch ${tree.branch}); your checkout is untouched.` : commit === undefined ? 'No file snapshot for this point (not a git project, or taken before the mod was loaded): conversation only.' : 'Could not create the worktree: conversation only.',
      opened ? 'Opened in a new Terminal window.' : `New session ${plan.newId}${copied ? ', resume command copied' : ''}. In a new terminal:\n${plan.command}`,
    ].join('\n')
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'timemachine',
      description: 'Timeline of this session; fork it from any point with a new instruction',
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (isSnapshotting && !e.text.trimStart().startsWith('/')) {
      const c: Ctx = {
        cwd: await $.session.cwd(),
        sid: await $.session.id(),
        dir: (await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`,
        run: (argv, init) => $.process.run(argv, init),
        read: path => $.fs.read(path),
        write: (path, text) => $.fs.write(path, text),
        copy: async text => (await $.ui.copy({ text })).isCopied === true,
        repaint: () => $.ui.invalidate('ui.render'),
      }
      await reread(c)
      await snapshot(c, `prompt-${points.filter(p => p.kind === 'prompt').length + 1}`)
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (isSnapshotting && e.agentId === undefined && MUTATING.test(String(e.tool)) && e.tool_use_id) {
      const c: Ctx = {
        cwd: await $.session.cwd(),
        sid: await $.session.id(),
        dir: (await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`,
        run: (argv, init) => $.process.run(argv, init),
        read: path => $.fs.read(path),
        write: (path, text) => $.fs.write(path, text),
        copy: async text => (await $.ui.copy({ text })).isCopied === true,
        repaint: () => $.ui.invalidate('ui.render'),
      }
      await snapshot(c, `tool-${e.tool_use_id}`)
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const c: Ctx = {
        cwd: await $.session.cwd(),
        sid: await $.session.id(),
        dir: (await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`,
        run: (argv, init) => $.process.run(argv, init),
        read: path => $.fs.read(path),
        write: (path, text) => $.fs.write(path, text),
        copy: async text => (await $.ui.copy({ text })).isCopied === true,
        repaint: () => $.ui.invalidate('ui.render'),
      }
      await reread(c)
      await snapshot(c, `turn-${points.filter(p => p.kind === 'prompt').length}`)
      $.ui.status(points.length > 0 ? `⏱ ${points.length} points · /timemachine` : undefined)
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('command.run', { command: 'timemachine' }, async ($, e) => {
    const args = parseArgs(e.args)
    if (args.kind === 'error') return { text: args.text }
    const c: Ctx = {
        cwd: await $.session.cwd(),
        sid: await $.session.id(),
        dir: (await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`,
        run: (argv, init) => $.process.run(argv, init),
        read: path => $.fs.read(path),
        write: (path, text) => $.fs.write(path, text),
        copy: async text => (await $.ui.copy({ text })).isCopied === true,
        repaint: () => $.ui.invalidate('ui.render'),
      }
    await reread(c)
    if (problem) return { text: `time machine: ${problem}` }

    if (args.kind === 'open') {
      await $.ui.open({ id: PANE, title: 'Time machine', focus: true })
      return { text: `Time machine: ${points.length} points. Press one to arm a fork, or /timemachine fork <n> <instruction>.` }
    }
    if (args.kind === 'list') {
      return { text: points.map(p => `${String(p.n).padStart(3)}  ${p.label}`).join('\n') || 'No points yet.' }
    }
    return { text: await forkAt(c, args.n, args.instruction) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    // header, count chips, rule, footer bar and the paging row take 9 of the pane's rows
    const room = Math.max(3, Math.floor(((e.viewport?.rows ?? 24) - 9) / (isExpanded ? 2 : 1)))
    const last = Math.max(0, points.length - room)
    const start = Math.min(Math.max(offset, 0), last)
    const shown = points.slice(start, start + room)
    // the pane's own width: viewport.columns is the whole surface (95 reported for a 150-column terminal)
    const cols = e.props.bodyColumns || (e.viewport?.columns ?? 60)
    const wide = Math.max(16, cols - 12)
    const turns = points.filter(p => p.kind === 'prompt').length
    const tools = points.filter(p => p.kind === 'tool').length
    const pick = points.find(p => p.n === armed)
    const repaint = () => $.ui.invalidate('ui.render')
    const files = pick ? (snapshotFor(points, pick.n, snaps) ? 'Files: restored from a git snapshot into a new worktree.' : 'Files: no snapshot for this point, so the fork is conversation only.') : ''
    const preview = (
    <Box key="foot" flexDirection="column" marginTop={1} borderStyle="round" borderColor={pick ? C.accent : C.rail} paddingX={1}>
      {pick ? (
        <Box key="armed" flexDirection="column">
          <Text bold color={C.accent}>{`Fork from #${pick.n}`}</Text>
          <Text dimColor>{`${pick.kind === 'prompt' ? 'The session is cut before this prompt' : pick.kind === 'turn' ? 'The session is cut after this turn' : `The session is cut after this ${pick.tool ?? 'tool'} call`}:`}</Text>
          <Text color={C.ink} wrap="wrap">{clip(pick.full, 900)}</Text>
          <Text dimColor wrap="wrap">{files}</Text>
          <Box key="forkrow" flexDirection="row" marginTop={1}>
            <Button
              key="forknow"
              variant="primary"
              onPress={async () => {
                forkResult = 'Forking…'
                repaint()
                forkResult = await forkAt({
                  cwd: await $.session.cwd(),
                  sid: await $.session.id(),
                  dir: (await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`,
                  run: (argv, init) => $.process.run(argv, init),
                  read: path => $.fs.read(path),
                  write: (path, text) => $.fs.write(path, text),
                  copy: async text => (await $.ui.copy({ text })).isCopied === true,
                  repaint,
                }, pick.n, '')
                repaint()
              }}
            >
              ⎇ Fork here
            </Button>
          </Box>
          <Text dimColor>{`Fork here opens the new session for you; or type /timemachine fork ${pick.n} <instruction> to start it with a message`}</Text>
        </Box>
      ) : (
        <Text dimColor>Press any point to fork the session from there with a new instruction.</Text>
      )}
    </Box>
    )
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
        <Text color={C.rail}>{'─'.repeat(Math.max(10, cols - 2))}</Text>
        {forkResult && (
          <Box key="result" flexDirection="column" marginTop={1} borderStyle="round" borderColor={C.tool.Bash} paddingX={1}>
            <Text wrap="wrap" color={C.ink}>{forkResult}</Text>
            <Button
              key="dismiss"
              hover={{ color: C.bad }}
              onPress={() => {
                forkResult = undefined
                repaint()
              }}
            >
              ✕ dismiss
            </Button>
          </Box>
        )}
        {pick && preview}
        {problem && <Text color={C.bad}>{problem}</Text>}
        {points.length === 0 && !problem && <Text dimColor>Nothing recorded yet: send a prompt, then reload.</Text>}
        {shown.map(p => {
          const isArmed = armed === p.n
          const tint = p.kind === 'prompt' ? C.prompt : p.kind === 'turn' ? C.turn : toolColor(p.tool)
          const rail = p.kind === 'prompt' ? '┏' : p.kind === 'turn' ? '┗' : '┃'
          const glyph = p.kind === 'prompt' ? '●' : p.kind === 'turn' ? '■' : '◆'
          const kind = p.kind === 'prompt' ? `prompt ${p.turn}` : p.kind === 'turn' ? 'turn end' : (p.tool ?? 'tool')
          return (
            <Box key={`r${p.n}`} flexDirection="column" backgroundColor={isArmed ? C.armed : undefined}>
              <Box flexDirection="row">
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
              {isExpanded && (
                <Box key={`d${p.n}`} flexDirection="row">
                  <Text>{'      '}</Text>
                  <Text color={C.rail}>{p.kind === 'tool' ? '┃ ' : '  '}</Text>
                  <Text dimColor wrap="wrap">{clip(p.full, wide * 3)}</Text>
                </Box>
              )}
            </Box>
          )
        })}
        {!pick && preview}
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
            key="expand"
            hover={{ color: C.accent }}
            onPress={() => {
              isExpanded = !isExpanded
              repaint()
            }}
          >
            {isExpanded ? '⤡ collapse' : '⤢ expand'}
          </Button>
          <Text>{'   '}</Text>
          <Button
            key="reload"
            hover={{ color: C.accent }}
            onPress={async () => {
              await reread({
                cwd: await $.session.cwd(),
                sid: await $.session.id(),
                dir: (await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) ?? '~'}/.claude`,
                run: (argv, init) => $.process.run(argv, init),
                read: path => $.fs.read(path),
                write: (path, text) => $.fs.write(path, text),
                copy: async text => (await $.ui.copy({ text })).isCopied === true,
                repaint: () => $.ui.invalidate('ui.render'),
              })
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
