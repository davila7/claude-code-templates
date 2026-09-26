// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test security/jev-vercel-sandbox
import { describe, expect, test } from 'claude-code/testing'
import { describeChanges, filesToUpload, folderName, isExcluded, nulList, readChanges, relativeCwd, uploadBatches } from '../hooks/workspace.ts'

describe('workspace', () => {
  test('credentials and private folders never go up; examples and ordinary files do', () => {
    for (const p of ['.env', '.env.local', 'apps/web/.env.production', '.dev.vars', '.npmrc', 'certs/server.pem', 'deploy.key', 'id_ed25519', '.ssh/config', '.claude/settings.local.json', 'a/node_modules/x/index.js', '.vercel/project.json']) {
      expect(isExcluded(p)).toBe(true)
    }
    for (const p of ['.env.example', '.env.sample', 'README.md', 'src/env.ts', 'keyboard.ts', 'docs/.envrc.md']) {
      expect(isExcluded(p)).toBe(false)
    }
  })

  test('the upload list drops deleted files, secrets and duplicates', () => {
    const listed = nulList('./README.md\0src/a.ts\0.env\0gone.txt\0src/a.ts\0')
    expect(filesToUpload(listed, ['gone.txt'])).toEqual({ files: ['README.md', 'src/a.ts'], excluded: ['.env'] })
  })

  test('the base64 is cut into argument lists that rebuild it in order', () => {
    const b64 = 'A'.repeat(25) + 'B'.repeat(25)
    const batches = uploadBatches(b64, 10, 2)
    expect(batches.length).toBe(3)
    expect(batches.every(b => b.every(a => a.length <= 10))).toBe(true)
    expect(batches.flat().join('')).toBe(b64)
  })

  test('git status after add -A reads as added, modified and deleted files', () => {
    const changes = readChanges('M  README.md\nA  build/out.js\nD  src/app.ts\nA  "with space.txt"\n')
    expect(changes).toEqual([
      { path: 'README.md', kind: 'modified' },
      { path: 'build/out.js', kind: 'added' },
      { path: 'src/app.ts', kind: 'deleted' },
      { path: 'with space.txt', kind: 'added' },
    ])
    expect(describeChanges(changes, 2)).toBe('4 files changed: ~README.md, +build/out.js, … 2 more')
    expect(describeChanges([])).toBe('no files changed')
  })

  test('the sandbox folder and working directory follow the project root', () => {
    expect(folderName('/home/me/my app/')).toBe('my_app')
    expect(folderName('C:\\work\\repo')).toBe('repo')
    expect(relativeCwd('/repo', '/repo')).toBe('')
    expect(relativeCwd('/repo', '/repo/src/lib')).toBe('src/lib')
    expect(relativeCwd('/repo', '/other')).toBe(null)
  })
})
