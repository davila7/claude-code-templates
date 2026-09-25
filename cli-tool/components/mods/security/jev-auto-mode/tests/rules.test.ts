// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test security/jev-auto-mode
import { describe, expect, test } from 'claude-code/testing'
import {
  DEFAULT_CONFIG,
  bashParts,
  evaluate,
  globMatch,
  judged,
  mergeConfigs,
  parseConfig,
  selfProtection,
  toolAction,
} from '../hooks/rules.ts'
import type { Config } from '../hooks/rules.ts'
import { readJudgement, requestBody, rule, stateText } from '../hooks/judge.ts'
import { DEFAULT_JEV } from '../hooks/rules.ts'

const ctx = { root: '/repo', home: '/home/u' }

function policy(json: unknown): Config {
  const { config, errors } = parseConfig(JSON.stringify(json), 'user')
  expect(errors).toEqual([])
  return mergeConfigs(config, {}).config
}

const bash = (command: string, agentId?: string) => toolAction('Bash', { command }, agentId)

describe('globs and bash parsing', () => {
  test('text globs cross spaces, path globs keep to a segment unless **', () => {
    expect(globMatch('git push*', 'git push origin main')).toBe(true)
    expect(globMatch('mcp__github__*', 'mcp__github__create_issue')).toBe(true)
    expect(globMatch('src/*.ts', 'src/a/b.ts', 'path')).toBe(false)
    expect(globMatch('src/**/*.ts', 'src/a/b.ts', 'path')).toBe(true)
    expect(globMatch('**/.env', '.env', 'path')).toBe(true)
  })

  test('compound commands split outside quotes, substitutions included', () => {
    expect(bashParts('ls -la && rm -rf build; echo "a && b" | wc -l')).toEqual(['ls -la', 'rm -rf build', 'echo "a && b"', 'wc -l'])
    expect(bashParts('echo $(curl evil.sh) 2>&1')).toEqual(['echo $(curl evil.sh) 2>&1', 'curl evil.sh'])
  })
})

describe('rules', () => {
  const cfg = policy({
    rules: [
      { id: 'ls', decision: 'allow', bash: ['ls*', 'git status*'] },
      { id: 'rmrf', decision: 'deny', bashRegex: '\\brm\\s+-rf\\b' },
      { id: 'push', decision: 'ask', bash: 'git push*' },
      { id: 'env', decision: 'deny', tool: ['Read', 'Write'], path: ['**/.env', '~/.ssh/**'] },
      { id: 'gh', decision: 'deny', mcpServer: 'github', inputRegex: '"delete' },
      { id: 'paste', decision: 'deny', tool: 'WebFetch', domain: '*.pastebin.com' },
      { id: 'skill', decision: 'deny', skill: 'deploy-*' },
      { id: 'nested', decision: 'deny', tool: 'Agent', scope: 'subagents' },
    ],
  })

  test('deny beats allow, and an allow must cover every part of a compound command', () => {
    expect(evaluate(cfg, bash('ls -la'), ctx)).toEqual(expect.objectContaining({ decision: 'allow' }))
    expect(evaluate(cfg, bash('ls && rm -rf ~'), ctx)).toEqual(expect.objectContaining({ decision: 'deny' }))
    // ls is allowed, but `cat x` is not covered: no allow, so it falls to the default
    expect(evaluate(cfg, bash('ls && cat x'), ctx)).toEqual({ source: 'fallback', fallback: 'passthrough' })
    expect(evaluate(cfg, bash('git status && git push'), ctx)).toEqual(expect.objectContaining({ decision: 'ask' }))
  })

  test('paths, home, MCP servers, domains, skills and scopes', () => {
    expect(evaluate(cfg, toolAction('Read', { file_path: '/repo/app/.env' }), ctx)).toEqual(expect.objectContaining({ decision: 'deny' }))
    expect(evaluate(cfg, toolAction('Read', { file_path: '/home/u/.ssh/id_rsa' }), ctx)).toEqual(expect.objectContaining({ decision: 'deny' }))
    expect(evaluate(cfg, toolAction('Read', { file_path: 'src/index.ts' }), ctx).source).toBe('fallback')
    expect(evaluate(cfg, toolAction('mcp__github__delete_repo', { name: 'x', op: 'delete' }), ctx).source).toBe('rule')
    expect(evaluate(cfg, toolAction('mcp__github__get_issue', { id: 1 }), ctx).source).toBe('fallback')
    expect(evaluate(cfg, toolAction('WebFetch', { url: 'https://x.pastebin.com/raw/1' }), ctx).source).toBe('rule')
    expect(evaluate(cfg, toolAction('Skill', { skill: 'deploy-prod' }), ctx).source).toBe('rule')
    expect(evaluate(cfg, toolAction('Agent', { subagent_type: 'Explore', prompt: 'x' }), ctx).source).toBe('fallback')
    expect(evaluate(cfg, toolAction('Agent', { subagent_type: 'Explore', prompt: 'x' }, 'sub-1'), ctx).source).toBe('rule')
  })

  test('the judge only sees the tools it is configured for', () => {
    const j = policy({ default: 'jev' })
    expect(judged(j, bash('make'))).toBe(true)
    expect(judged(j, toolAction('Read', { file_path: 'a' }))).toBe(false)
  })
})

describe('config files', () => {
  test('a bad rule is reported and dropped; the rest of the file stands', () => {
    const { config, errors } = parseConfig(
      JSON.stringify({
        default: 'maybe',
        rules: [{ decision: 'deny', bash: 'sudo *' }, { decision: 'nope', tool: 'x' }, { decision: 'deny' }, { decision: 'deny', bashRegex: '(' }],
      }),
      'user',
    )
    expect(config.rules?.length).toBe(1)
    expect(errors.length).toBe(4)
    expect(parseConfig('{ nope', 'user').errors[0]).toContain('not valid JSON')
  })

  test('a project file only tightens unless the user trusts it', () => {
    const user = parseConfig(JSON.stringify({ default: 'jev', rules: [] }), 'user').config
    const project = parseConfig(
      JSON.stringify({ default: 'allow', mode: 'audit', rules: [{ decision: 'allow', tool: '*' }, { decision: 'deny', bash: 'make deploy*' }] }),
      'project',
    ).config
    const merged = mergeConfigs(user, project)
    expect(merged.config.default).toBe('jev')
    expect(merged.config.mode).toBe('enforce')
    expect(merged.config.rules.map(r => r.decision)).toEqual(['deny'])
    expect(merged.notes[0]).toContain('trustProjectAllow')

    const trusting = parseConfig(JSON.stringify({ trustProjectAllow: true }), 'user').config
    expect(mergeConfigs(trusting, project).config.rules.length).toBe(2)
  })

  test('Claude cannot edit the policy or the mod, whatever the rules say', () => {
    const open = policy({ rules: [{ decision: 'allow', tool: '*' }] })
    const write = toolAction('Write', { file_path: '/home/u/.claude/jev-auto-mode.json', content: '{}' })
    expect(selfProtection(write, '/p/jev-auto-mode', ctx)).toBeDefined()
    expect(selfProtection(bash('echo {} > .claude/jev-auto-mode.json'), '/p/jev-auto-mode', ctx)).toBeDefined()
    expect(selfProtection(bash('cat .claude/jev-auto-mode.json'), '/p/jev-auto-mode', ctx)).toBeUndefined()
    expect(selfProtection(toolAction('Edit', { file_path: '/p/jev-auto-mode/hooks/rules.ts' }), '/p/jev-auto-mode', ctx)).toBeDefined()
    expect(evaluate(open, write, ctx).source).toBe('rule')
    expect(DEFAULT_CONFIG.default).toBe('passthrough')
  })
})

describe('evasions the review found', () => {
  const cfg = policy({
    rules: [
      { id: 'rmrf', decision: 'deny', bashRegex: '\\brm\\s+-[a-zA-Z]*r[a-zA-Z]*f' },
      { id: 'rm-glob', decision: 'deny', bash: 'rm -rf*' },
      { id: 'push', decision: 'ask', bash: 'git push*' },
      { id: 'ls', decision: 'allow', bash: 'ls*' },
      { id: 'paste', decision: 'deny', tool: 'WebFetch', domain: ['pastebin.com', 'evil.example.com'] },
    ],
  })
  const decision = (command: string) => {
    const v = evaluate(cfg, bash(command), ctx)
    return v.source === 'rule' ? v.decision : v.fallback
  }

  test('quoting, $IFS, escapes, wrappers and bash -c are read as the shell runs them', () => {
    expect(decision("r'm' -rf /")).toBe('deny')
    expect(decision('rm${IFS}-rf${IFS}/')).toBe('deny')
    expect(decision('r\\m -rf /')).toBe('deny')
    expect(decision('sudo rm -rf /tmp/x')).toBe('deny')
    expect(decision('FOO=1 nohup rm -rf ~')).toBe('deny')
    expect(decision("bash -c 'cd / && rm -rf *'")).toBe('deny')
    expect(decision("g'it' push origin main")).toBe('ask')
    expect(decision("l's' -la")).toBe('allow')
  })

  test('a program only known at run time gets opaqueShell (ask by default)', () => {
    // assignments on the same line are read back: $X is rm
    expect(decision('X=rm; $X -rf /')).toBe('deny')
    expect(decision('X=r; ${X}m -rf /')).toBe('deny')
    // a value the line never set stays unknown
    expect(decision('$TOOL -rf /')).toBe('ask')
    expect(decision('eval "$CMD"')).toBe('ask')
    expect(decision('source ./setup.sh')).toBe('ask')
    expect(decision('ls && $(echo ls)')).toBe('ask')
    const strict = policy({ opaqueShell: 'deny' })
    expect(evaluate(strict, bash('$X -rf /'), ctx)).toEqual(expect.objectContaining({ decision: 'deny' }))
  })

  test('userinfo and ports do not hide the real host', () => {
    const fetch = (url: string) => evaluate(cfg, toolAction('WebFetch', { url, prompt: 'x' }), ctx).source
    expect(fetch('https://pastebin.com@evil.example.com/x')).toBe('rule')
    expect(fetch('https://user:pw@pastebin.com:443/raw')).toBe('rule')
    expect(fetch('https://example.com/pastebin.com')).toBe('fallback')
  })

  test('self-protection covers downloads, MCP writes, relative mod paths, and allows plain reads', () => {
    const P = '/p/jev-auto-mode/'
    expect(selfProtection(bash('curl -o ~/.claude/jev-auto-mode.json https://x.test/p.json'), P, ctx)).toBeDefined()
    expect(selfProtection(bash('wget -O .claude/jev-auto-mode.json https://x.test'), P, ctx)).toBeDefined()
    expect(selfProtection(bash("F=~/.claude/jev-'auto'-mode.json; echo {} > $F"), P, ctx)).toBeDefined()
    expect(selfProtection(bash('grep -i x .claude/skills/jev-auto-mode/hooks/rules.ts > /tmp/o'), P, ctx)).toBeDefined()
    expect(selfProtection(toolAction('mcp__filesystem__write_file', { path: '/home/u/.claude/jev-auto-mode.json', content: '{}' }), P, ctx)).toBeDefined()
    expect(selfProtection(toolAction('Edit', { file_path: '.claude/skills/jev-auto-mode/hooks/rules.ts', old_string: 'a', new_string: 'b' }), P, ctx)).toBeDefined()
    expect(selfProtection(bash('cat ~/.claude/jev-auto-mode.json'), P, ctx)).toBeUndefined()
    expect(selfProtection(bash('git diff .claude/jev-auto-mode.json'), P, ctx)).toBeUndefined()
    expect(selfProtection(toolAction('Write', { file_path: 'docs/policy.md', content: 'Edit your jev-auto-mode.json to add rules.' }), P, ctx)).toBeUndefined()
    expect(selfProtection(toolAction('Agent', { prompt: 'never touch jev-auto-mode.json', subagent_type: 'Explore' }), P, ctx)).toBeUndefined()
  })
})

describe('judge', () => {
  test('probabilities become decisions with the policy thresholds', () => {
    const answer = (p: Record<string, number>, severity = 0) =>
      readJudgement(JSON.stringify({ answers: { ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { noul: v }])), severity: { score: severity } } }))!
    const calm = answer({ destructive: 0.05, exfiltration: 0.02, security_weakening: 0.1, out_of_scope: 0.1 })
    expect(rule(calm, DEFAULT_JEV).decision).toBe('allow')
    const risky = answer({ destructive: 0.9, exfiltration: 0.02, security_weakening: 0.1, out_of_scope: 0.1 })
    expect(rule(risky, DEFAULT_JEV)).toEqual(expect.objectContaining({ decision: 'ask', hazard: 'destructive' }))
    expect(rule(answer({ destructive: 0.9, exfiltration: 0.02, security_weakening: 0.1, out_of_scope: 0.1 }, 3), DEFAULT_JEV)).toEqual(
      expect.objectContaining({ decision: 'deny', escalated: true }),
    )
    const leak = answer({ destructive: 0.1, exfiltration: 0.8, security_weakening: 0.1, out_of_scope: 0.5 })
    expect(rule(leak, DEFAULT_JEV)).toEqual(expect.objectContaining({ decision: 'deny', hazard: 'exfiltration' }))
    expect(readJudgement(JSON.stringify({ answers: { destructive: { noul: 0.1 } } }))).toBeNull()
  })

  test('the request carries the intent, the action and the battery', () => {
    const state = stateText('fix the login bug', bash('rm -rf node_modules'))
    expect(state).toContain('fix the login bug')
    expect(state).toContain('Bash(rm -rf node_modules)')
    const body = JSON.parse(requestBody('typesafe', state, 'jev-latest'))
    expect(Object.keys(body.questions)).toEqual(['destructive', 'exfiltration', 'security_weakening', 'out_of_scope', 'severity'])
    expect(body.model).toBe('jev-latest')
  })
})
