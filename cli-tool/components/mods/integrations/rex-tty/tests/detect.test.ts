// Run with: claude plugin test integrations/rex-tty
import { describe, expect, test } from 'claude-code/testing'
import { gitFromSubcommand, quoted, unwrap, banner, blockOf, clamp, compile, needsTerminal, paneOutput, saysNoTerminal, segments, shellFor, side, strings, waited, words } from '../hooks/detect.ts'

describe('needsTerminal', () => {
  const yes = [
    'sudo apt install jq',
    'cd /tmp && sudo -u postgres psql',
    'FOO=1 sudo make install',
    'echo ok; /usr/bin/sudo true',
    'gh auth login',
    'gh auth refresh -s project',
    'git rebase -i HEAD~3',
    'git rebase --interactive main',
    'git add -p',
    'git stash --patch',
    'git commit',
    'git commit --amend',
    'npm login',
    'docker login ghcr.io -u me',
    'gcloud auth login',
    'aws sso login --profile dev',
    'ssh-add ~/.ssh/id_ed25519',
    'ssh-keygen -t ed25519 -f key',
    'su - deploy',
    'wrangler login',
    'git -C repo rebase -i HEAD~2',
    'git -c core.editor=vim commit',
    'env FOO=1 sudo ls',
    'timeout 5 sudo ls',
    'command sudo ls',
    'env -u FOO sudo make install',
    'nice -n 5 sudo ls',
    'timeout -k 5 10 sudo ls',
    'cd /srv && \\\n  sudo systemctl restart app',
    'echo ok && \\\nsudo ls',
    'git --no-pager -C repo commit',
  ]
  for (const c of yes) test(`sends: ${c}`, () => expect(needsTerminal(c)).not.toBe(null))

  const no = [
    'ls -la',
    'sudo -n true',
    'sudo -nE env',
    'echo secret | sudo -S whoami',
    'echo "run sudo make install later"',
    "grep -r 'git commit' docs",
    'gh auth status',
    'gh auth login --with-token < token.txt',
    'git rebase main',
    'git rebase --continue',
    'GIT_SEQUENCE_EDITOR=true git rebase -i HEAD~2',
    'git commit -m "fix: a thing"',
    'git commit -am wip',
    'git commit --amend --no-edit',
    'git commit -m "$(cat <<EOF\nsubject (scope)\nEOF\n)"',
    'git add -A',
    'docker login -u me --password-stdin',
    'npm install',
    'ssh-add -l',
    'ssh-keygen -t ed25519 -f key -N ""',
    'ssh-keygen -lf key.pub',
    'sudoku --solve',
    'constructor --help',
    'toString',
    '__proto__ x',
    'hasOwnProperty login',
    'sudo -u root -n ls',
    'cat <<EOF > notes.txt\nsudo apt install x\ngit commit\nEOF',
    'aws configure set region us-east-1',
    'az login --service-principal -u a -p b',
    'stripe login --api-key sk_x',
    'supabase login --token t',
    'git -C repo commit -m x',
    'git commit -C HEAD',
    'git commit -C HEAD~1 --no-edit',
    "cat <<'END-OF.FILE' > notes.txt\nsudo apt install x\nEND-OF.FILE",
    'cat <<"my eof"\nsudo ls\nmy eof',
    'cat <<-EOF\n\tsudo ls\n\tEOF',
    'echo a \\\n  b',
    '',
  ]
  for (const c of no) test(`leaves: ${c || '(empty)'}`, () => expect(needsTerminal(c)).toBe(null))

  test('extra patterns add, skip patterns win', () => {
    expect(needsTerminal('mytool deploy', [/^mytool deploy/])).not.toBe(null)
    expect(needsTerminal('sudo ls', [], [/^sudo ls$/])).toBe(null)
  })
})

describe('what the person is shown', () => {
  test('control characters never reach the question or the banner', () => {
    expect(banner('echo a\u001b[2K\u001b[1Gls')).toBe('rex-tty ▸ echo a[2K[1Gls')
    expect(quoted('a\u0007b\nc')).toBe('ab\nc')
  })
  test('a long command is shown to its limit, with what is left out', () => {
    const q = quoted('x'.repeat(20) + '\ny', 10)
    expect(q.startsWith('x'.repeat(10) + '\n… (12 more characters, 2 lines in all')).toBe(true)
  })
  test('wrappers are looked through', () => {
    expect(unwrap(['env', '-i', 'A=1', 'nohup', 'sudo', 'ls'])).toEqual(['sudo', 'ls'])
    expect(unwrap(['timeout', '5', 'sudo', 'ls'])).toEqual(['sudo', 'ls'])
    expect(unwrap(['timeout', '-k', '5', '10', 'sudo'])).toEqual(['sudo'])
    expect(unwrap(['env', '-u', 'FOO', '--', 'sudo'])).toEqual(['sudo'])
    expect(unwrap(['/usr/bin/nice', '-n', '5', 'ls'])).toEqual(['ls'])
  })
  test('git global options go, the subcommand keeps its own', () => {
    expect(gitFromSubcommand(['-C', 'repo', '--no-pager', 'commit', '-C', 'HEAD'])).toEqual(['commit', '-C', 'HEAD'])
    expect(gitFromSubcommand(['status'])).toEqual(['status'])
  })
})

describe('shell parsing', () => {
  test('segments split at operators outside quotes', () => {
    expect(segments('a && b; c | d')).toEqual(['a', 'b', 'c', 'd'])
    expect(segments('echo "a; b" && c')).toEqual(['echo "a; b"', 'c'])
    expect(segments('a && \\\n  b')).toEqual(['a', 'b'])
    expect(segments('cat <<X\nsudo ls\nX\necho done')).toEqual(['cat <<HEREDOC', 'echo done'])
  })
  test('words drop assignments and quotes', () => {
    expect(words('A=1 B=2 cmd "x y" z')).toEqual({ assignments: ['A=1', 'B=2'], argv: ['cmd', 'x y', 'z'] })
  })
})

describe('options', () => {
  test('lists, patterns, numbers and sides', () => {
    expect(strings('a, b,,')).toEqual(['a', 'b'])
    expect(compile(['^ok$', '(']).bad).toEqual(['('])
    expect(clamp('40', 10, 90, 35)).toBe(40)
    expect(clamp(500, 10, 90, 35)).toBe(90)
    expect(clamp('x', 10, 90, 35)).toBe(35)
    expect(side('left')).toBe('left')
    expect(side('diagonal')).toBe('below')
    expect(shellFor('/bin/zsh')).toBe('/bin/zsh')
    expect(shellFor('/opt/homebrew/bin/fish')).toBe('/bin/bash')
    expect(shellFor(undefined)).toBe('/bin/bash')
  })
})

describe('rex output', () => {
  test('the block id of a split', () => {
    expect(blockOf('{"anchor_id":"block:a","block_ids":["block:b"],"revision":2}')).toBe('block:b')
    expect(blockOf('Error: nope')).toBe(null)
    expect(blockOf('{"block_ids":[]}')).toBe(null)
  })
  test('how a wait ended', () => {
    expect(waited('{"exit_code":7,"error":"exit status 7"}\n', 'Error: exit status 7\n')).toEqual({ kind: 'exit', code: 7 })
    expect(waited('{"exit_code":0}\n', '')).toEqual({ kind: 'exit', code: 0 })
    expect(waited('', 'Error: wait timed out after 2s: context deadline exceeded\n')).toEqual({ kind: 'timeout' })
    expect(waited('', 'Error: block target "x" not found\n')).toEqual({ kind: 'gone', detail: 'Error: block target "x" not found' })
  })
  test('the pane text loses the banner and keeps the tail', () => {
    const head = banner('sudo  make\ninstall')
    expect(head).toBe('rex-tty ▸ sudo make install')
    expect(paneOutput(`${head}\n\nPassword:\ninstalled\n\n`, head)).toBe('Password:\ninstalled')
    expect(paneOutput('no banner here\n', head)).toBe('no banner here')
    const long = paneOutput(`${head}\n\n${'x'.repeat(50)}`, head, 10)
    expect(long.endsWith('x'.repeat(10))).toBe(true)
    expect(long.startsWith('[… 40 earlier')).toBe(true)
  })
  test('a no-terminal failure is recognised', () => {
    expect(saysNoTerminal('sudo: a terminal is required to read the password')).toBe(true)
    expect(saysNoTerminal('error: cannot prompt because user interactivity has been disabled')).toBe(true)
    expect(saysNoTerminal('fatal: not a git repository')).toBe(false)
  })
})
