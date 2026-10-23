// Run with: claude plugin test security/jev-vercel-sandbox
import { describe, expect, test } from 'claude-code/testing'
import { builtinLabels, decide, isPlainRead, parseUseCases, readJudgement, requestBody, requestHeaders } from '../hooks/judge.ts'
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

  test('the likeliest use case counts once it reaches the threshold', () => {
    const j = { tests: 0.1, external_repo: 0.05, untrusted_code: 0.02, repo_change: 0.8, clean_build: 0.3 }
    expect(decide(j, 0.5)).toEqual({ useCase: 'repo_change', probability: 0.8, by: 'jev' })
    expect(decide({ ...j, repo_change: 0.5 }, 0.5).useCase).toBe('repo_change')
    expect(decide({ ...j, repo_change: 0.4 }, 0.5)).toEqual({ useCase: null, probability: 0.4, by: 'jev' })
  })

  test('both backends: one question per use case turned on; answers read from noul or probability', () => {
    expect(requestHeaders('gateway', 'k', 'typesafe-ai/jev')['ai-gateway-protocol-version']).toBe('0.0.1')
    const typesafe = JSON.parse(requestBody('typesafe', 'state', 'jev-latest'))
    expect(Object.keys(typesafe.questions)).toEqual(['tests', 'external_repo', 'untrusted_code', 'repo_change', 'clean_build'])
    expect(typesafe.questions.tests.type).toBe('noul')
    expect(JSON.parse(requestBody('gateway', 'state', 'm', ['tests'])).questions).toEqual({ tests: expect.objectContaining({ type: 'boolean' }) })
    const answers = { tests: { noul: 0.8 }, repo_change: { probability: 0.1 } }
    expect(readJudgement(JSON.stringify({ answers }), ['tests', 'repo_change'])).toEqual({ tests: 0.8, repo_change: 0.1 })
    expect(readJudgement(JSON.stringify({ answers }))).toBeNull()
  })

  test('the useCases option picks which jobs are looked for', () => {
    expect(parseUseCases('')).toEqual(['tests', 'external_repo', 'untrusted_code', 'repo_change', 'clean_build'])
    expect(parseUseCases('tests, clean-build, bogus')).toEqual(['tests', 'clean_build'])
    expect(builtinLabels(['tests'])).toEqual(['none', 'tests'])
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
