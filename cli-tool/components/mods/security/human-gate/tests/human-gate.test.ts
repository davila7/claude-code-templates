// Run with: claude plugin test security/human-gate
import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { gateFor, configFrom, segments, pushTargets } from '../hooks/rules.ts'

type Verdict = { decision: 'allow' | 'ask' | 'deny'; reason?: string; rule?: string }

function engine(on: On, verdict: Verdict, branch = 'feature/x') {
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: `${branch}\n`, stderr: '' } }))
  on('tool.check', () => verdict as never)
}

const check = async ($: { tool: { check: (a: never) => Promise<unknown> } }, tool: string, input: unknown, extra: Record<string, unknown> = {}) =>
  (await $.tool.check({ tool, input, approver: 'person', ...extra } as never)) as Verdict

describe('human-gate: irreversible calls', () => {
  test('npm publish is held for a person even when a rule allows it', async ($, on) => {
    engine(on, { decision: 'allow', rule: 'Bash(npm:*)' })
    const r = await check($, 'Bash', { command: 'cd cli-tool && npm publish --ignore-scripts=false' })
    expect(r.decision).toBe('ask')
    expect(r.reason).toContain('Only a person can approve this')
    expect(r.reason).toContain('publish')
  })

  test('a deny from settings stands', async ($, on) => {
    engine(on, { decision: 'deny', reason: 'denied by rule' })
    const r = await check($, 'Bash', { command: 'npm publish' })
    expect(r.decision).toBe('deny')
  })

  test('a bare git push on main is held; on a feature branch it is not', async ($, on) => {
    engine(on, { decision: 'allow' }, 'main')
    expect((await check($, 'Bash', { command: 'git push' })).decision).toBe('ask')
  })

  test('a bare git push on a feature branch passes', async ($, on) => {
    engine(on, { decision: 'allow' }, 'claude/thread')
    expect((await check($, 'Bash', { command: 'git push -u origin' })).decision).toBe('allow')
  })

  test('a Stripe refund is held, a Stripe list is not', async ($, on) => {
    engine(on, { decision: 'allow' })
    expect((await check($, 'mcp__stripe__create_refund', { amount: 9900 })).decision).toBe('ask')
    expect((await check($, 'mcp__stripe__list_prices', {})).decision).toBe('allow')
  })

  test('sending an email is held', async ($, on) => {
    engine(on, { decision: 'allow' })
    expect((await check($, 'mcp__Gmail__send_message', { to: 'x' })).decision).toBe('ask')
  })

  test('where nobody can be asked the reason says it is refused', async ($, on) => {
    engine(on, { decision: 'allow' })
    const r = await check($, 'Bash', { command: 'wrangler pages deploy dist' }, { approver: undefined })
    expect(r.decision).toBe('ask')
    expect(r.reason).toContain('refused')
  })
})

describe('human-gate: read-only fast lane', () => {
  test('a read-only call the engine would ask about is allowed', async ($, on) => {
    engine(on, { decision: 'ask' })
    const r = await check($, 'Read', { file_path: 'a.ts' }, { isReadOnly: true })
    expect(r.decision).toBe('allow')
  })

  test('an ask from a rule the person wrote stays an ask', async ($, on) => {
    engine(on, { decision: 'ask', rule: 'Read(./secrets/**)' })
    const r = await check($, 'Read', { file_path: 'secrets/a' }, { isReadOnly: true })
    expect(r.decision).toBe('ask')
  })

  test('WebFetch never takes the fast lane', async ($, on) => {
    engine(on, { decision: 'ask' })
    expect((await check($, 'WebFetch', { url: 'https://x' }, { isReadOnly: true })).decision).toBe('ask')
  })

  test('MCP reads stay asks unless trusted', async ($, on) => {
    engine(on, { decision: 'ask' })
    expect((await check($, 'mcp__linear__list_issues', {}, { isReadOnly: true })).decision).toBe('ask')
  })

  test('MCP reads pass when trustMcpReadOnly is on', { options: { trustMcpReadOnly: true } }, async ($, on) => {
    engine(on, { decision: 'ask' })
    expect((await check($, 'mcp__linear__list_issues', {}, { isReadOnly: true })).decision).toBe('allow')
  })

  test('a write is never fast-laned', async ($, on) => {
    engine(on, { decision: 'ask' })
    expect((await check($, 'Edit', { file_path: 'a.ts' })).decision).toBe('ask')
  })
})

describe('human-gate: rules', () => {
  const all = configFrom({})
  const none = async () => undefined

  test('compound commands are split', () => {
    expect(segments('cd x && npm publish; echo ok')).toEqual(['cd x', 'npm publish', 'echo ok'])
  })

  test('push targets', () => {
    expect(pushTargets('git push origin HEAD:main')).toEqual({ refs: ['main'], current: false })
    expect(pushTargets('git push origin feature')).toEqual({ refs: ['feature'], current: false })
    expect(pushTargets('git push origin')).toEqual({ refs: [], current: true })
    expect(pushTargets('git push origin HEAD')).toEqual({ refs: [], current: true })
    expect(pushTargets('git push --mirror')).toEqual({ all: true })
    expect(pushTargets('git -C app push origin main')).toEqual({ refs: ['main'], current: false, dir: 'app' })
    expect(pushTargets('git push origin "HEAD:main"')).toEqual({ refs: ['main'], current: false })
    expect(pushTargets("git push origin 'main'")).toEqual({ refs: ['main'], current: false })
  })

  test('a quoted separator stays inside its segment', () => {
    expect(segments('git commit -m "npm publish && done" && echo ok')).toEqual(['git commit -m "npm publish && done"', 'echo ok'])
  })

  test('a push resolves its branch in the directory it runs in', async () => {
    const asked: (string | undefined)[] = []
    const mainIn = (where: string) => async (dir?: string) => { asked.push(dir); return dir === where ? 'main' : 'feature' }
    expect((await gateFor('Bash', { command: 'git -C app push' }, all, mainIn('app')))?.what).toBe('push to main')
    expect((await gateFor('Bash', { command: 'cd app && git push' }, all, mainIn('app')))?.what).toBe('push to main')
    expect((await gateFor('Bash', { command: 'cd app && git -C web push' }, all, mainIn('app/web')))?.what).toBe('push to main')
    expect(await gateFor('Bash', { command: 'git push' }, all, mainIn('app'))).toBe(undefined)
    expect(asked).toEqual(['app', 'app', 'app/web', undefined])
    // a directory the shell would expand cannot be resolved here: hold
    for (const command of ['cd ~/repo && git push', 'git -C "$REPO" push', 'cd - && git push']) {
      expect((await gateFor('Bash', { command }, all, mainIn('nowhere')))?.category).toBe('push-main')
    }
  })

  test('a quoted destination is still a destination', async () => {
    const onFeature = async () => 'feature'
    for (const command of ['git push origin "HEAD:main"', "git push origin 'main'", 'git push origin HEAD:"main"']) {
      expect((await gateFor('Bash', { command }, all, onFeature))?.what).toBe('push to main')
    }
  })

  test('review round 2: option values, aliases, continuations, camelCase and compound names', async () => {
    const onFeature = async () => 'feature'
    expect(pushTargets('git push --repo=origin main')).toEqual({ refs: ['main'], current: false })
    expect(pushTargets('git push --repo origin main')).toEqual({ refs: ['main'], current: false })
    expect(pushTargets('git push -o ci.skip origin feature')).toEqual({ refs: ['feature'], current: false })
    expect((await gateFor('Bash', { command: 'git push --repo=origin main' }, all, onFeature))?.what).toBe('push to main')
    expect((await gateFor('Bash', { command: 'npm \\\npublish' }, all, none))?.category).toBe('publish')
    expect(await gateFor('Bash', { command: "echo 'npm publish; echo ok'" }, all, none)).toBe(undefined)
    expect((await gateFor('mcp__Neon__run_sql', { sql: 'UPDATE users AS u SET admin = true' }, all, none))?.category).toBe('data')
    expect((await gateFor('mcp__Neon__run_sql', { sql: 'UPDATE ONLY users u SET admin = true' }, all, none))?.category).toBe('data')
    expect(await gateFor('mcp__Neon__run_sql', { sql: 'UPDATE users AS u SET admin = true WHERE u.id = 1' }, all, none)).toBe(undefined)
    expect((await gateFor('mcp__slack__sendMessage', {}, all, none))?.category).toBe('outbound')
    expect((await gateFor('mcp__github__addIssueComment', {}, all, none))?.category).toBe('outbound')
    expect((await gateFor('mcp__paypal__create_invoice', {}, all, none))?.category).toBe('money')
    expect((await gateFor('mcp__stripe__get_or_create_customer', {}, all, none))?.category).toBe('money')
    expect(await gateFor('mcp__stripe__list_invoices', {}, all, none)).toBe(undefined)
  })

  test('WHERE inside a SQL string or comment is no filter', async () => {
    for (const sql of ["UPDATE users SET bio = 'WHERE'", 'DELETE FROM users -- WHERE id = 1', 'UPDATE users SET bio = $$ WHERE $$', 'DELETE FROM t /* WHERE */']) {
      expect((await gateFor('mcp__Neon__run_sql', { sql }, all, none))?.category).toBe('data')
    }
    expect((await gateFor('Bash', { command: `psql -c "UPDATE users SET bio = 'WHERE'"` }, all, none))?.category).toBe('data')
    for (const sql of ['UPDATE users SET "where" = 1', 'DELETE FROM users # WHERE id = 1', 'DELETE FROM `where`', 'UPDATE t SET a = 1 /* WHERE */', '/*!DELETE FROM users*/', 'DELETE FROM "a;b WHERE"', "UPDATE users SET bio = E'foo\\' WHERE'", "UPDATE users SET bio = 'it\\'s WHERE'"]) {
      expect((await gateFor('mcp__mysql__query', { sql }, all, none))?.category).toBe('data')
    }
    expect(await gateFor('mcp__mysql__query', { sql: 'DELETE FROM `users` WHERE `id` = 1' }, all, none)).toBe(undefined)
    expect(await gateFor('mcp__Neon__run_sql', { sql: "UPDATE users SET bio = 'x' WHERE id = 1" }, all, none)).toBe(undefined)
    expect(await gateFor('Bash', { command: `psql -c "DELETE FROM users WHERE name = 'a;b'"` }, all, none)).toBe(undefined)
  })

  test('pushes to a protected branch the review found missing are held', async () => {
    const onMain = async () => 'main'
    for (const command of ['git push origin HEAD', 'git push --all', 'git -C dir push origin main', 'git push origin @']) {
      expect((await gateFor('Bash', { command }, all, onMain))?.category).toBe('push-main')
    }
  })

  test('an unknown branch holds a bare push (fail closed)', async () => {
    expect((await gateFor('Bash', { command: 'git push' }, all, none))?.category).toBe('push-main')
  })

  test('flags before the verb do not hide it', async () => {
    for (const command of ['terraform -chdir=infra apply', 'kubectl -n prod apply -f a.yaml', 'pnpm -r publish', 'wrangler versions deploy', 'npm --workspace cli publish']) {
      expect(await gateFor('Bash', { command }, all, none)).not.toBe(undefined)
    }
  })

  test('quoted text is not a command, but SQL quoted for a client is SQL', async () => {
    for (const command of ['git commit -m "explain npm publish"', 'grep -rn "DELETE FROM" src', 'gh release create v1 --notes "try --dry-run first"']) {
      const g = await gateFor('Bash', { command }, all, none)
      expect(command.startsWith('gh release') ? g?.category : g).toBe(command.startsWith('gh release') ? 'publish' : undefined)
    }
    expect((await gateFor('Bash', { command: 'psql -c "UPDATE users SET admin = true"' }, all, none))?.category).toBe('data')
    expect((await gateFor('Bash', { command: 'kubectl apply --dry-run=none -f a.yaml' }, all, none))?.category).toBe('deploy')
  })

  test('real MCP tool names', async () => {
    expect((await gateFor('mcp__claude_ai_Stripe__create_customer', {}, all, none))?.category).toBe('money')
    expect(await gateFor('mcp__stripe__list_charges', {}, all, none)).toBe(undefined)
    expect((await gateFor('mcp__slack__slack_send_message', {}, all, none))?.category).toBe('outbound')
    expect((await gateFor('mcp__github__add_issue_comment', {}, all, none))?.category).toBe('outbound')
    expect((await gateFor('mcp__Neon__run_sql', { sql: 'SELECT 1;\nDROP TABLE users' }, all, none))?.category).toBe('data')
  })

  test('a category typo keeps every category held', () => {
    const c = configFrom({ categories: 'deploys' })
    expect(c.categories.size).toBe(6)
    expect(c.unknownCategories).toEqual(['deploys'])
  })

  test('safe commands pass', async () => {
    for (const command of ['npm test', 'npm run build', 'git status', 'vercel env ls', 'DELETE FROM t WHERE id = 1']) {
      expect(await gateFor('Bash', { command }, all, none)).toBe(undefined)
    }
  })

  test('a --dry-run is not held, the real command in the same line is', async () => {
    expect(await gateFor('Bash', { command: 'npm publish --dry-run' }, all, none)).toBe(undefined)
    expect(await gateFor('Bash', { command: 'kubectl apply --dry-run=client -f a.yaml' }, all, none)).toBe(undefined)
    expect((await gateFor('Bash', { command: 'npm publish --dry-run && npm publish' }, all, none))?.category).toBe('publish')
  })

  test('a disabled category is not held', async () => {
    const only = configFrom({ categories: 'money' })
    expect(await gateFor('Bash', { command: 'npm publish' }, only, none)).toBe(undefined)
  })

  test('destructive SQL through an MCP tool is held', async () => {
    const g = await gateFor('mcp__Neon__run_sql', { sql: 'DROP TABLE sponsored_ads' }, all, none)
    expect(g?.category).toBe('data')
  })
})
