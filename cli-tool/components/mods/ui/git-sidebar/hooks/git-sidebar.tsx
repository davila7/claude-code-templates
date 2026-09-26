/**
 * git-sidebar — Claude Mod (EARLY ACCESS)
 *
 * A small lazygit-style pane: every worktree of the repository the session is
 * in, and its local branches, as rows you can click (or Tab to and press
 * Enter). `/git-sidebar` opens it; in the fullscreen layout (`/tui fullscreen`)
 * the engine docks it beside the transcript, floor to ceiling, otherwise it
 * sits above the prompt.
 *
 *   - a worktree row moves the session there, through the engine's own `/cd`
 *   - a branch row shows its last commits and what can be done with it:
 *     `switch` (clean tree only) or `open worktree` when another worktree has it
 *
 * Git runs through `$.process.run` by argv (no shell); every read is in
 * ./git.ts. Nothing here writes to the repository except `git switch`, which
 * the mod refuses while the current worktree has uncommitted changes.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259).
 *
 * Options (pluginConfigs["git-sidebar@skills-dir"].options):
 *   columns: number      width asked for the docked pane (default 44)
 *   maxBranches: number  most recent local branches listed (default 40)
 *   openOnStart: boolean open the pane when the session starts (default false)
 */
import type { ProcessRunResult, Register } from 'claude-code'
import {
  STATUS,
  TOPLEVEL,
  WORKTREES,
  basename,
  branchAction,
  branchesArgv,
  countDirty,
  currentWorktree,
  fit,
  logArgv,
  maxBranches,
  paneColumns,
  parseBranches,
  parseLog,
  parseWorktrees,
  switchArgv,
  trackLabel,
} from './git.ts'
import type { Commit, Snapshot } from './git.ts'

const PANE = 'git'
const COMMAND = 'git-sidebar'
// worktrees whose `git status` is read on each refresh; the rest show no count
const MAX_STATUS_READS = 12

type Run = (argv: readonly string[], cwd?: string) => Promise<ProcessRunResult>

let snap: Snapshot | undefined
let error: string | undefined
let selected: string | undefined
let commits: Commit[] = []
let isOpen = false

const firstLine = (text: string) => text.trim().split('\n')[0] ?? ''

async function readSnapshot(run: Run, branchLimit: number): Promise<void> {
  const top = await run(TOPLEVEL)
  if (top.exitCode !== 0) {
    snap = undefined
    error = firstLine(top.stderr) || 'not a git repository'
    return
  }
  const [wts, refs] = await Promise.all([run(WORKTREES), run(branchesArgv(branchLimit))])
  const worktrees = wts.exitCode === 0 ? parseWorktrees(wts.stdout) : []
  await Promise.all(
    worktrees
      .filter(wt => !wt.bare && !wt.prunable)
      .slice(0, MAX_STATUS_READS)
      .map(async wt => {
        const st = await run(STATUS, wt.path).catch(() => undefined)
        if (st?.exitCode === 0) wt.dirty = countDirty(st.stdout)
      }),
  )
  snap = {
    root: top.stdout.trim(),
    worktrees,
    branches: refs.exitCode === 0 ? parseBranches(refs.stdout) : [],
  }
  error = refs.exitCode === 0 ? undefined : firstLine(refs.stderr)
  if (selected && !snap.branches.some(b => b.name === selected)) {
    selected = undefined
    commits = []
  }
}

function statusText(): string | undefined {
  if (!isOpen) return undefined
  if (!snap) return `git: ${error ?? 'loading'}`
  const here = currentWorktree(snap)
  const where = here?.branch ?? (here?.detached ? `detached ${here.head.slice(0, 7)}` : basename(snap.root))
  const n = snap.worktrees.length
  return `git: ${where} · ${n} worktree${n === 1 ? '' : 's'} · ${snap.branches.length} branches`
}

export const register: Register = (on, options) => {
  const columns = paneColumns(options.columns)
  const branchLimit = maxBranches(options.maxBranches)
  const openOnStart = options.openOnStart === true

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Worktrees and branches in a side pane; click one to go there (stop closes)',
        argumentHint: '[stop|refresh]',
        immediate: true,
      })
      .catch(err => $.ui.log(`git-sidebar: /${COMMAND} not registered: ${err}`))
    $.ui.log(`git-sidebar loaded: /${COMMAND} opens the pane`, { to: 'debug' })
    if (openOnStart) {
      await readSnapshot((argv, cwd) => $.process.run(argv, { cwd }), branchLimit).catch(err => {
        error = String(err)
      })
      isOpen = true
      // unasked, the engine keeps it undrawn below 144 columns until the person opens it
      await $.ui.open({ id: PANE, title: 'git', columns }).catch(err => {
        isOpen = false
        $.ui.log(`git-sidebar: pane not opened: ${err}`)
      })
      $.ui.status(statusText())
    }
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stop' || arg === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      $.ui.status(undefined)
      return { text: 'git-sidebar closed' }
    }
    await readSnapshot((argv, cwd) => $.process.run(argv, { cwd }), branchLimit).catch(err => {
      error = String(err)
    })
    isOpen = true
    await $.ui.open({ id: PANE, title: 'git', focus: true, columns })
    $.ui.status(statusText())
    $.ui.invalidate('ui.render')
    const hint = e.presentation.isFullscreen
      ? 'click a row, or Tab and Enter'
      : 'drawn above the prompt; /tui fullscreen docks it beside the transcript'
    const found = snap ? `${snap.worktrees.length} worktrees, ${snap.branches.length} branches` : error
    return { text: `${found} · ${hint} · /${COMMAND} stop closes` }
  })

  // the session moved (a row of ours, or the person's own /cd): read the new worktree
  on('command.run', { command: 'cd' }, async ($, e, next) => {
    const r = await next(e)
    if (!isOpen) return r
    await readSnapshot((argv, cwd) => $.process.run(argv, { cwd }), branchLimit).catch(err => {
      error = String(err)
    })
    $.ui.status(statusText())
    $.ui.invalidate('ui.render')
    return r
  })

  // Claude may have made a branch or a worktree during the turn
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!isOpen || e.agentId) return r
    await readSnapshot((argv, cwd) => $.process.run(argv, { cwd }), branchLimit).catch(err => {
      error = String(err)
    })
    $.ui.status(statusText())
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    const r = await next(e)
    isOpen = false
    $.ui.status(undefined)
    return r
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    const r = await next(e)
    const key = e.element
    const s = snap

    if (key === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return r
    }
    if (key === 'refresh') {
      await readSnapshot((argv, cwd) => $.process.run(argv, { cwd }), branchLimit).catch(err => {
        error = String(err)
      })
    } else if (s && key.startsWith('wt:')) {
      const wt = s.worktrees[Number(key.slice(3))]
      if (wt && wt.path === currentWorktree(s)?.path) $.ui.toast('git-sidebar: already in this worktree')
      else if (wt) {
        await $.command
          .run({ command: 'cd', args: wt.path })
          .catch(err => $.ui.toast(`git-sidebar: /cd failed: ${err}`))
      }
    } else if (s && key.startsWith('br:')) {
      const branch = s.branches[Number(key.slice(3))]
      if (branch && selected === branch.name) {
        selected = undefined
        commits = []
      } else if (branch) {
        selected = branch.name
        const log = await $.process.run(logArgv(branch.name)).catch(() => undefined)
        commits = log?.exitCode === 0 ? parseLog(log.stdout) : []
      }
    } else if (s && selected && key === 'open') {
      const branch = s.branches.find(b => b.name === selected)
      if (branch?.worktree) {
        await $.command
          .run({ command: 'cd', args: branch.worktree })
          .catch(err => $.ui.toast(`git-sidebar: /cd failed: ${err}`))
      }
    } else if (s && selected && key === 'switch') {
      const target = selected
      const st = await $.process.run(STATUS)
      if (st.exitCode !== 0 || countDirty(st.stdout) > 0) {
        $.ui.toast(`git-sidebar: uncommitted changes here; commit or stash before switching to ${target}`)
      } else {
        const sw = await $.process.run(switchArgv(target))
        if (sw.exitCode === 0) $.ui.toast(`git-sidebar: switched to ${target}`)
        else $.ui.toast(`git-sidebar: ${firstLine(sw.stderr) || 'git switch failed'}`)
        await readSnapshot((argv, cwd) => $.process.run(argv, { cwd }), branchLimit).catch(err => {
          error = String(err)
        })
      }
    }
    $.ui.status(statusText())
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(20, e.props.bodyColumns - 1)
    const noop = () => {}
    const toolbar = (
      <Box key="toolbar" flexDirection="row" columnGap={1}>
        <Button key="refresh" label="refresh" hotkey="r" onPress={noop} />
        <Button key="close" label="close" onPress={noop} />
      </Box>
    )

    if (!snap) {
      return (
        <Box flexDirection="column">
          <Text color="red">{fit(error ?? 'reading the repository…', width)}</Text>
          {toolbar}
        </Box>
      )
    }

    const s = snap
    const here = currentWorktree(s)
    const chosen = selected ? s.branches.find(b => b.name === selected) : undefined
    const action = chosen ? branchAction(s, chosen) : undefined

    return (
      <Box flexDirection="column">
        <Text bold>{fit(basename(s.worktrees[0]?.path ?? s.root), width)}</Text>
        {error ? <Text color="red">{fit(error, width)}</Text> : null}

        <Box key="wt-head" marginTop={1}>
          <Text bold color="cyan">{`Worktrees (${s.worktrees.length})`}</Text>
        </Box>
        {s.worktrees.map((wt, i) => {
          const isHere = wt === here
          const name = wt.branch ?? (wt.bare ? '(bare)' : `(${wt.head.slice(0, 7)})`)
          const dirty = wt.dirty ? ` ~${wt.dirty}` : ''
          const flags = `${wt.locked ? ' locked' : ''}${wt.prunable ? ' prunable' : ''}`
          const room = width - 2 - dirty.length - flags.length
          return (
            <Box key={`wt-row:${i}`} flexDirection="row">
              <Text color="green">{isHere ? '● ' : '  '}</Text>
              <Button
                key={`wt:${i}`}
                plain
                dimColor={!isHere}
                label={fit(`${basename(wt.path)}  ${name}`, room)}
                onPress={noop}
              />
              {dirty ? <Text color="yellow">{dirty}</Text> : null}
              {flags ? <Text color="red">{flags}</Text> : null}
            </Box>
          )
        })}

        <Box key="br-head" marginTop={1}>
          <Text bold color="cyan">{`Branches (${s.branches.length})`}</Text>
        </Box>
        {s.branches.map((b, i) => {
          const isHere = here?.branch === b.name
          const marker = isHere ? '* ' : b.worktree ? '+ ' : '  '
          const track = trackLabel(b)
          const room = width - 2 - (track ? track.length + 1 : 0)
          return (
            <Box key={`br-row:${i}`} flexDirection="row">
              <Text color={isHere ? 'green' : 'blue'}>{marker}</Text>
              <Button
                key={`br:${i}`}
                plain
                dimColor={!isHere && selected !== b.name}
                label={fit(b.name, room)}
                onPress={noop}
              />
              {track ? <Text color={b.gone ? 'red' : 'magenta'}>{` ${track}`}</Text> : null}
            </Box>
          )
        })}

        {chosen ? (
          <Box key="detail" flexDirection="column" marginTop={1} borderStyle="round" borderDimColor paddingX={1}>
            <Text bold>{fit(chosen.name, width - 4)}</Text>
            <Text dimColor>
              {fit(`${chosen.upstream ?? 'no upstream'} · ${chosen.date}`, width - 4)}
            </Text>
            {commits.map((c, i) => (
              <Text key={`c:${i}`} wrap="truncate-end">
                <Text color="yellow">{c.sha}</Text>
                {` ${c.subject}`}
              </Text>
            ))}
            {action?.kind === 'switch' ? (
              <Button key="switch" label="switch" hotkey="s" onPress={noop} />
            ) : action?.kind === 'open' ? (
              <Button key="open" label="open worktree" hotkey="o" onPress={noop} />
            ) : (
              <Text dimColor>checked out here</Text>
            )}
          </Box>
        ) : null}

        <Box key="foot" marginTop={1} flexDirection="column">
          {toolbar}
          <Text dimColor>{fit('● here  * current  + other worktree', width)}</Text>
        </Box>
      </Box>
    )
  })
}
