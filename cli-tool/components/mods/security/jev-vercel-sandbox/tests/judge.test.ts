// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test security/jev-vercel-sandbox
import { describe, expect, test } from 'claude-code/testing'
import { decide, isPlainRead, readJudgement, requestBody, requestHeaders } from '../hooks/judge.ts'
import { commandBody, oidcClaims, readCommandStream, readSandbox, resolveCredentials } from '../hooks/vercel.ts'

describe('judge', () => {
  test('plain reads skip the judge; anything with an operator or a write flag does not', () => {
    for (const c of ['ls -la', 'git status', 'git log --oneline -5', 'cat README.md', "grep -rn foo src", 'find . -name "*.ts"', 'git branch', 'git branch -a', 'git remote -v']) {
      expect(isPlainRead(c)).toBe(true)
    }
    for (const c of ['rm -rf build', 'ls; rm -rf /', 'cat a > b', 'git push', 'git reset --hard', 'find . -delete', 'sed -i s/a/b/ f', "sed -n '1w out' f", 'git branch -D main', 'git branch -M x', 'git remote remove origin', 'git remote set-url origin x', 'echo $(whoami)', 'npm install']) {
      expect(isPlainRead(c)).toBe(false)
    }
  })

  test('a hazard at the threshold, or a severe score alone, sends it to the sandbox', () => {
    const j = (p: number, severity: number | null = 0) => ({
      probabilities: { destructive: p, remote_code: 0.01, system_change: 0.02, exfiltration: 0.01 },
      severity,
    })
    expect(decide(j(0.91), 0.5, 2)).toMatchObject({ route: 'sandbox', hazard: 'destructive' })
    expect(decide(j(0.5), 0.5, 2).route).toBe('sandbox')
    expect(decide(j(0.2), 0.5, 2).route).toBe('local')
    expect(decide(j(0.2, 2.4), 0.5, 2)).toMatchObject({ route: 'sandbox', bySeverity: true })
  })

  test('both backends: the Gateway carries its protocol header, answers read from noul or probability', () => {
    expect(requestHeaders('gateway', 'k', 'typesafe-ai/jev')['ai-gateway-protocol-version']).toBe('0.0.1')
    expect(JSON.parse(requestBody('typesafe', 'state', 'jev-latest')).questions.remote_code.type).toBe('noul')
    const answers = { destructive: { noul: 0.8 }, remote_code: { probability: 0.1 }, system_change: { noul: 0 }, exfiltration: { noul: 0 }, severity: { score: 2.5 } }
    expect(readJudgement(JSON.stringify({ answers }))).toEqual({
      probabilities: { destructive: 0.8, remote_code: 0.1, system_change: 0, exfiltration: 0 },
      severity: 2.5,
    })
    expect(readJudgement(JSON.stringify({ answers: { destructive: { noul: 1 } } }))).toBeNull()
  })
})

describe('vercel', () => {
  test('an access token needs team and project; an OIDC token carries them', () => {
    expect(resolveCredentials('tok', '', '')).toEqual({ ok: false, missing: ['vercelTeamId', 'vercelProjectId'] })
    expect(resolveCredentials('', 'team_x', 'prj_x')).toEqual({ ok: false, missing: ['vercelToken'] })
    const payload = btoa(JSON.stringify({ owner_id: 'team_o', project_id: 'prj_o' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const jwt = `h.${payload}.s`
    expect(oidcClaims(jwt)).toEqual({ teamId: 'team_o', projectId: 'prj_o' })
    expect(resolveCredentials(jwt, '', '')).toMatchObject({ ok: true, kind: 'oidc token', credentials: { teamId: 'team_o', projectId: 'prj_o' } })
    expect(oidcClaims('not-a-jwt')).toBeNull()
  })

  test('the command stream reads output, exit code and a stream error', () => {
    const lines = (...l: unknown[]) => l.map(x => JSON.stringify(x)).join('\n')
    expect(readCommandStream(lines({ command: { exitCode: null } }, { stream: 'stdout', data: 'a' }, { stream: 'stdout', data: 'b' }, { command: { exitCode: 0, durationMs: 5 } }))).toEqual({
      exitCode: 0,
      stdout: 'ab',
      stderr: '',
      durationMs: 5,
    })
    expect(readCommandStream(lines({ command: { exitCode: null } }, { stream: 'error', data: { code: 'sandbox_stopped', message: 'gone' } })).error).toBe('sandbox_stopped: gone')
    expect(readCommandStream(lines({ command: { exitCode: null } })).error).toContain('ended before')
  })

  test('the command runs through bash with no local env; a get keeps the sandbox name', () => {
    expect(JSON.parse(commandBody('rm -rf x', 1000, '/vercel/sandbox'))).toEqual({
      command: 'bash', args: ['-c', 'rm -rf x'], cwd: '/vercel/sandbox', env: {}, sudo: false, wait: true, logs: true, timeout: 1000,
    })
    const s = readSandbox(JSON.stringify({ session: { id: 's1', status: 'running', region: 'iad1', vcpus: 2, memory: 4096, timeout: 1, cwd: '/w', createdAt: 5 }, routes: [] }), 'sbx-name')
    expect(s).toMatchObject({ name: 'sbx-name', sessionId: 's1', status: 'running', startedAt: 5 })
  })
})
