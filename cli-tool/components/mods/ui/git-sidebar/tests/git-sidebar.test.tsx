// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test ui/git-sidebar
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import {
  branchAction,
  branchesArgv,
  countDirty,
  fit,
  paneColumns,
  parseBranches,
  parseLog,
  parseTrack,
  parseWorktrees,
  trackLabel,
} from '../hooks/git.ts'

const MAIN = '/repo/app'
const FEATURE = '/repo/app-feature'

const WORKTREE_OUT = [
  `worktree ${MAIN}`,
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/main',
  '',
  `worktree ${FEATURE}`,
  'HEAD 2222222222222222222222222222222222222222',
  'branch refs/heads/feature/login',
  'locked',
  '',
  'worktree /repo/app-detached',
  'HEAD 3333333333333333333333333333333333333333',
  'detached',
  'prunable gitdir file points to non-existent location',
  '',
].join('\n')

const BRANCH_OUT = [
  `main\torigin/main\tbehind 2\t2 hours ago\t${MAIN}`,
  `feature/login\torigin/feature/login\tahead 3, behind 1\t1 day ago\t${FEATURE}`,
  'spike\t\t\t3 days ago\t',
  'old\torigin/old\tgone\t2 weeks ago\t',
].join('\n')

describe('git.ts parsers', () => {
  test('worktree list --porcelain', () => {
    const wts = parseWorktrees(WORKTREE_OUT)
    expect(wts.length).toBe(3)
    expect(wts[0]).toEqual(expect.objectContaining({ path: MAIN, branch: 'main', detached: false }))
    expect(wts[1]).toEqual(expect.objectContaining({ branch: 'feature/login', locked: true }))
    expect(wts[2]).toEqual(expect.objectContaining({ detached: true, prunable: true }))
    expect(wts[2].branch).toBeUndefined()
  })

  test('for-each-ref lines and tracking', () => {
    const bs = parseBranches(BRANCH_OUT)
    expect(bs.map(b => b.name)).toEqual(['main', 'feature/login', 'spike', 'old'])
    expect(bs[1]).toEqual(expect.objectContaining({ ahead: 3, behind: 1, worktree: FEATURE }))
    expect(bs[2].upstream).toBeUndefined()
    expect(bs[2].worktree).toBeUndefined()
    expect(parseTrack('gone').gone).toBe(true)
    expect(trackLabel(bs[0])).toBe('↓2')
    expect(trackLabel(bs[1])).toBe('↑3 ↓1')
    expect(trackLabel(bs[2])).toBe('')
    expect(trackLabel(bs[3])).toBe('gone')
    expect(trackLabel({ ahead: 0, behind: 0, gone: false, upstream: 'origin/x' })).toBe('✓')
  })

  test('branch actions depend on where the branch is checked out', () => {
    const snap = { root: `${MAIN}/`, worktrees: parseWorktrees(WORKTREE_OUT), branches: parseBranches(BRANCH_OUT) }
    expect(branchAction(snap, snap.branches[0])).toEqual({ kind: 'current' })
    expect(branchAction(snap, snap.branches[1])).toEqual({ kind: 'open', path: FEATURE })
    expect(branchAction(snap, snap.branches[2])).toEqual({ kind: 'switch' })
  })

  test('small helpers', () => {
    expect(countDirty(' M a.ts\n?? b.ts\n')).toBe(2)
    expect(countDirty('')).toBe(0)
    expect(parseLog('abc1234\tfix: x\t2 days ago\n')).toEqual([{ sha: 'abc1234', subject: 'fix: x', date: '2 days ago' }])
    expect(fit('feature/very-long-name', 8)).toBe('feature…')
    expect(fit('main', 8)).toBe('main')
    expect(paneColumns(undefined)).toBe(44)
    expect(paneColumns(500)).toBe(120)
    expect(branchesArgv(5)).toContain('--count=5')
  })
})

// A fake git beneath the plugin: answers $.process.run by argv, records switches and /cd runs.
type Calls = { cd: string[]; switched: string[]; toasts: string[]; dirty: boolean }

function fakeGit(on: On, calls: Calls) {
  on('process.run', async ($, e) => {
    const argv = e.argv.join(' ')
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '' } })
    if (argv === 'git rev-parse --show-toplevel') return ok(`${MAIN}\n`)
    if (argv === 'git worktree list --porcelain') return ok(WORKTREE_OUT)
    if (argv.startsWith('git for-each-ref')) return ok(BRANCH_OUT)
    if (argv === 'git status --porcelain') return ok(calls.dirty && !e.init?.cwd ? ' M x.ts\n' : '')
    if (argv.startsWith('git log')) return ok('abc1234\tadd spike\t3 days ago\n')
    if (argv.startsWith('git switch')) {
      calls.switched.push(e.argv[e.argv.length - 1])
      return ok('')
    }
    return { value: { exitCode: 1, stdout: '', stderr: `unexpected ${argv}` } }
  })
  // the display calls the engine serves: answered here, since a test draws no screen
  on('ui.open', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    calls.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('command.run', { command: 'cd' }, async ($, e) => {
    calls.cd.push(e.args)
    return { text: `moved to ${e.args}` }
  })
}

const PANE_PROPS = {
  title: 'git',
  isFocused: true,
  bodyColumns: 44,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

async function openSidebar($: Engine) {
  return $.command.run({
    command: 'git-sidebar',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 200 },
  })
}

describe('the pane', () => {
  test('lists worktrees and branches, and a worktree click runs /cd', async ($, on) => {
    const calls: Calls = { cd: [], switched: [], toasts: [], dirty: false }
    fakeGit(on, calls)
    const opened = await openSidebar($)
    expect(opened.text).toContain('3 worktrees, 4 branches')

    const ui = await $.ui.mount({ plugin: 'git-sidebar', surface: 'terminal', component: 'Pane', requestId: 'git', props: PANE_PROPS })
    expect(await ui.find({ key: 'wt:1' })).toBeDefined()
    expect((await ui.find({ key: 'br:1' }))?.text).toContain('feature/login')
    expect(await ui.find({ type: 'Text', text: /↑3 ↓1/ })).toBeDefined()

    await ui.press({ key: 'wt:1' })
    expect(calls.cd).toEqual([FEATURE])
    await ui.unmount()
  })

  test('a branch click shows its commits; switch runs only on a clean tree', async ($, on) => {
    const calls: Calls = { cd: [], switched: [], toasts: [], dirty: true }
    fakeGit(on, calls)
    await openSidebar($)
    const ui = await $.ui.mount({ plugin: 'git-sidebar', surface: 'terminal', component: 'Pane', requestId: 'git', props: PANE_PROPS })

    await ui.press({ key: 'br:2' })
    await ui.redraw()
    expect(await ui.find({ type: 'Text', text: /add spike/ })).toBeDefined()
    expect(await ui.find({ key: 'switch' })).toBeDefined()

    await ui.press({ key: 'switch' })
    expect(calls.switched).toEqual([])
    expect(calls.toasts.at(-1)).toContain('uncommitted changes')

    calls.dirty = false
    await ui.press({ key: 'switch' })
    expect(calls.switched).toEqual(['spike'])

    await ui.press({ key: 'br:1' })
    await ui.redraw()
    expect(await ui.find({ key: 'open' })).toBeDefined()
    await ui.press({ key: 'open' })
    expect(calls.cd).toEqual([FEATURE])
    await ui.unmount()
  })
})
