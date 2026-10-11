// The program tables of the shell analysis. Pure: no `$`.

/** Program classes. */
export const LIST = new Set(['ls', 'stat', 'du', 'file', 'test', '[', '[[', 'tree', 'realpath', 'readlink', 'dirname', 'basename', 'pwd', 'which'])
export const READ = new Set(['cat', 'head', 'tail', 'less', 'more', 'bat', 'wc', 'cut', 'sort', 'uniq', 'cmp', 'diff', 'xxd', 'od', 'hexdump', 'strings', 'base64', 'md5', 'md5sum', 'shasum', 'sha256sum'])
export const CODE_FIRST = new Set(['awk', 'jq', 'yq', 'sed'])
export const PATTERN_FIRST = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ugrep'])
export const WRITE = new Set(['touch', 'mkdir', 'mkfifo'])
export const MODE_FIRST = new Set(['chmod', 'chown', 'chgrp'])
export const COPY = new Set(['cp', 'install', 'rsync', 'scp'])
export const DESTROY = new Set(['rm', 'rmdir', 'unlink', 'shred', 'srm', 'trash', 'trash-put', 'truncate', 'rimraf'])
export const ARCHIVE = new Set(['tar', 'zip', 'unzip'])
export const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish'])
export const INTERPRETER = /^(python[0-9.]*|pypy3?|node|nodejs|tsx|ts-node|bun|deno|ruby|php|perl)$/

/** Programs that add no skeleton; of these only the list class adds effects. */
export const TRIVIAL = new Set(['cd', 'pushd', 'popd', 'export', 'declare', 'local', 'readonly', 'set', 'unset', 'true', 'false', ':', 'sleep', 'echo', 'printf', 'for', 'case', 'esac', 'done', 'fi', 'in', 'function', 'select', 'return', 'exit', 'shift', 'wait', 'trap', 'alias', 'hash', 'type'])

/** Shell keywords removed from the front of a command. */
export const KEYWORDS = new Set(['!', 'if', 'then', 'elif', 'else', 'do', 'while', 'until', '{', '}'])

/** Programs whose operands are paths, so a skeleton writes them as absolute paths. */
export const PATHY = new Set([...LIST, ...READ, ...CODE_FIRST, ...PATTERN_FIRST, ...WRITE, ...MODE_FIRST, ...COPY, ...DESTROY, ...ARCHIVE, 'mv', 'ln', 'tee'])

/** Programs that always reach below their operands. */
export const ALWAYS_RECURSIVE = new Set(['du', 'tree', 'rg', 'ag', 'ugrep', 'srm', 'trash', 'trash-put', 'rimraf'])

/** Programs that remove a symbolic link itself, not what it leads to, when they do not reach below it. */
export const UNLINKERS = new Set(['rm', 'unlink', 'rmdir'])

/** Programs that pass on the lines they read, or some of them, when they name no file. */
export const PASS_THROUGH = new Set(['sort', 'uniq', 'head', 'tail', 'tac', 'shuf'])

const GREP_RECURSIVE = { letters: 'rR', longs: ['--recursive', '--dereference-recursive'] }
const MODE_RECURSIVE = { letters: 'R', longs: ['--recursive'] }

/** The short letters and long names that make a program reach below its operands. */
export const RECURSIVE_FLAGS: ReadonlyMap<string, { letters: string; longs: readonly string[] }> = new Map([
  ['ls', { letters: 'R', longs: ['--recursive'] }],
  ['grep', GREP_RECURSIVE],
  ['egrep', GREP_RECURSIVE],
  ['fgrep', GREP_RECURSIVE],
  ['diff', { letters: 'r', longs: ['--recursive'] }],
  ['rm', { letters: 'rR', longs: ['--recursive'] }],
  ['chmod', MODE_RECURSIVE],
  ['chown', MODE_RECURSIVE],
  ['chgrp', MODE_RECURSIVE],
  ['cp', { letters: 'rRa', longs: ['--recursive', '--archive'] }],
  ['rsync', { letters: 'ra', longs: ['--recursive', '--archive'] }],
  ['scp', { letters: 'r', longs: [] }],
])

/** The value-taking flags of a program, by how many words each takes; ATTACHED marks a flag whose value can only join its own word (`-i.bak`). */
export type Values = Readonly<Record<string, number>>

/** A flag whose value can only join its own word, as `sed -i.bak` and `perl -pi.orig` take theirs, and is empty otherwise. */
export const ATTACHED = -1

/** A wrapper that runs the rest of the line: its value-taking flags, the operands before the command, and the flags that set the folder the command runs in. */
type Wrapper = { values: Values; operands: number; chdir: readonly string[] }

/** Wrappers that run the rest of the line. */
export const WRAPPERS: ReadonlyMap<string, Wrapper> = new Map<string, Wrapper>([
  ['sudo', { values: { '-u': 1, '-g': 1, '-C': 1, '-D': 1, '-h': 1, '-p': 1, '-r': 1, '-t': 1, '-T': 1, '-U': 1, '--chdir': 1 }, operands: 0, chdir: ['-D', '--chdir'] }],
  ['doas', { values: { '-u': 1, '-C': 1 }, operands: 0, chdir: [] }],
  ['env', { values: { '-u': 1, '-C': 1, '-S': 1, '--unset': 1, '--chdir': 1, '--split-string': 1 }, operands: 0, chdir: ['-C', '--chdir'] }],
  ['command', { values: {}, operands: 0, chdir: [] }],
  ['builtin', { values: {}, operands: 0, chdir: [] }],
  ['exec', { values: { '-a': 1 }, operands: 0, chdir: [] }],
  ['nohup', { values: {}, operands: 0, chdir: [] }],
  ['time', { values: { '-f': 1, '-o': 1 }, operands: 0, chdir: [] }],
  ['timeout', { values: { '-s': 1, '-k': 1, '--signal': 1, '--kill-after': 1 }, operands: 1, chdir: [] }],
  ['nice', { values: { '-n': 1, '--adjustment': 1 }, operands: 0, chdir: [] }],
  ['ionice', { values: { '-c': 1, '-n': 1, '-p': 1, '--class': 1, '--classdata': 1 }, operands: 0, chdir: [] }],
  ['stdbuf', { values: { '-i': 1, '-o': 1, '-e': 1 }, operands: 0, chdir: [] }],
  ['caffeinate', { values: { '-t': 1, '-w': 1 }, operands: 0, chdir: [] }],
  ['watch', { values: { '-n': 1, '--interval': 1 }, operands: 0, chdir: [] }],
  ['xargs', { values: { '-n': 1, '-P': 1, '-I': 1, '-J': 1, '-L': 1, '-s': 1, '-d': 1, '-E': 1, '--eof': 1, '-a': 1, '-i': ATTACHED, '--arg-file': 1, '--max-args': 1, '--max-lines': 1, '--max-procs': 1, '--delimiter': 1 }, operands: 0, chdir: [] }],
])

/** A program that runs the command after it, behind one of its subcommands when it names any: its value-taking flags, the flags that set the folder, the flags whose value is shell code, the flags that run the command through a shell, and whether the command is a package whose program has the package's name. */
export type Runner = { subs: readonly string[]; values: Values; chdir: readonly string[]; code: readonly string[]; shell: readonly string[]; isPackage: boolean }

const PACKAGE_VALUES = { '-p': 1, '--package': 1 }

/** Package and environment runners: `uv run`, `npx`, `pnpm exec`, and the like. */
export const RUNNERS: ReadonlyMap<string, Runner> = new Map<string, Runner>([
  ['uv', { subs: ['run'], values: { '--with': 1, '-w': 1, '--with-editable': 1, '--with-requirements': 1, '--python': 1, '-p': 1, '--project': 1, '--directory': 1, '--package': 1, '--extra': 1, '--group': 1, '--env-file': 1, '--index': 1, '--default-index': 1, '--index-url': 1, '--extra-index-url': 1 }, chdir: ['--directory'], code: [], shell: [], isPackage: false }],
  ['poetry', { subs: ['run'], values: { '-C': 1, '--directory': 1, '-P': 1, '--project': 1 }, chdir: ['-C', '--directory'], code: [], shell: [], isPackage: false }],
  ['npx', { subs: [], values: { ...PACKAGE_VALUES, '-c': 1, '--call': 1 }, chdir: [], code: ['-c', '--call'], shell: [], isPackage: true }],
  ['bunx', { subs: [], values: PACKAGE_VALUES, chdir: [], code: [], shell: [], isPackage: true }],
  ['pnpm', { subs: ['exec'], values: { '-C': 1, '--dir': 1, '--filter': 1, '-F': 1, '--package': 1 }, chdir: ['-C', '--dir'], code: [], shell: ['-c', '--shell-mode'], isPackage: true }],
])

const GREP_VALUES = { '-e': 1, '-f': 1, '-m': 1, '-A': 1, '-B': 1, '-C': 1, '-d': 1, '-D': 1, '--regexp': 1, '--file': 1, '--max-count': 1, '--after-context': 1, '--before-context': 1, '--context': 1, '--include': 1, '--exclude': 1, '--exclude-dir': 1, '--label': 1 }
const COPY_VALUES = { '-t': 1, '-S': 1, '--target-directory': 1, '--suffix': 1 }
const SHELL_VALUES = { '-o': 1, '-O': 1, '--rcfile': 1, '--init-file': 1 }

/** Flags whose value is the next word (two words for jq's `--arg NAME VALUE`), per program; a flag not listed takes no value. */
const VALUE_FLAGS: ReadonlyMap<string, Values> = new Map<string, Values>([
  ['grep', GREP_VALUES],
  ['egrep', GREP_VALUES],
  ['fgrep', GREP_VALUES],
  ['ugrep', GREP_VALUES],
  ['rg', { '-e': 1, '-f': 1, '-g': 1, '-t': 1, '-T': 1, '-m': 1, '-A': 1, '-B': 1, '-C': 1, '-j': 1, '-M': 1, '--regexp': 1, '--file': 1, '--glob': 1, '--iglob': 1, '--type': 1, '--type-not': 1, '--type-add': 1, '--max-count': 1, '--max-depth': 1, '--sort': 1, '--sortr': 1 }],
  ['ag', { '-G': 1, '-A': 1, '-B': 1, '-C': 1, '-m': 1, '--ignore': 1, '--depth': 1 }],
  ['sed', { '-e': 1, '-f': 1, '-l': 1, '-i': ATTACHED, '--expression': 1, '--file': 1 }],
  ['awk', { '-f': 1, '-v': 1, '-F': 1 }],
  ['jq', { '-f': 1, '--from-file': 1, '--arg': 2, '--argjson': 2, '--slurpfile': 2, '--rawfile': 2, '--indent': 1 }],
  ['yq', { '-f': 1, '--from-file': 1, '-o': 1, '-p': 1, '--output-format': 1, '--input-format': 1 }],
  ['head', { '-n': 1, '-c': 1 }],
  ['tail', { '-n': 1, '-c': 1 }],
  ['cut', { '-d': 1, '-f': 1, '-c': 1, '-b': 1 }],
  ['sort', { '-k': 1, '-t': 1, '-o': 1, '-T': 1, '-S': 1, '--output': 1 }],
  ['uniq', { '-f': 1, '-s': 1, '-w': 1 }],
  ['xxd', { '-l': 1, '-s': 1, '-c': 1, '-g': 1 }],
  ['od', { '-A': 1, '-t': 1, '-j': 1, '-N': 1 }],
  ['hexdump', { '-n': 1, '-s': 1, '-e': 1, '-f': 1 }],
  ['strings', { '-n': 1, '-t': 1 }],
  ['base64', { '-b': 1, '-w': 1, '-i': 1, '-o': 1, '--input': 1, '--output': 1 }],
  ['shasum', { '-a': 1 }],
  ['du', { '-d': 1, '-B': 1, '-t': 1, '--max-depth': 1 }],
  ['stat', { '-f': 1, '-c': 1, '-t': 1 }],
  ['tree', { '-L': 1, '-P': 1, '-I': 1, '-o': 1 }],
  ['ls', { '-I': 1, '-w': 1, '-T': 1 }],
  ['touch', { '-r': 1, '-t': 1, '-d': 1 }],
  ['mkdir', { '-m': 1 }],
  ['mkfifo', { '-m': 1 }],
  ['chmod', { '--reference': 1 }],
  ['chown', { '--reference': 1 }],
  ['chgrp', { '--reference': 1 }],
  ['cp', COPY_VALUES],
  ['mv', COPY_VALUES],
  ['ln', COPY_VALUES],
  ['install', { ...COPY_VALUES, '-m': 1, '-o': 1, '-g': 1, '--mode': 1, '--owner': 1, '--group': 1 }],
  ['rsync', { '-e': 1, '-f': 1, '--rsh': 1, '--exclude': 1, '--include': 1, '--filter': 1, '--files-from': 1, '--chmod': 1, '--exclude-from': 1, '--include-from': 1 }],
  ['scp', { '-i': 1, '-P': 1, '-o': 1, '-F': 1, '-c': 1, '-l': 1, '-S': 1, '-J': 1 }],
  ['truncate', { '-s': 1, '-r': 1, '--size': 1, '--reference': 1 }],
  ['shred', { '-n': 1, '-s': 1, '--iterations': 1, '--size': 1 }],
  ['tar', { '-f': 1, '-C': 1, '-T': 1, '-X': 1, '--file': 1, '--directory': 1, '--exclude': 1, '--files-from': 1 }],
  ['zip', { '-x': 1, '-i': 1, '-b': 1, '-P': 1 }],
  ['unzip', { '-d': 1, '-x': 1, '-P': 1 }],
  ['curl', { '-d': 1, '--data': 1, '--data-binary': 1, '--data-urlencode': 1, '--data-raw': 1, '--data-ascii': 1, '--json': 1, '-F': 1, '--form': 1, '-T': 1, '--upload-file': 1, '-K': 1, '--config': 1, '-o': 1, '--output': 1, '--output-dir': 1, '-D': 1, '--dump-header': 1, '-c': 1, '--cookie-jar': 1, '-X': 1, '--request': 1, '-H': 1, '--header': 1, '-u': 1, '--user': 1, '-A': 1, '--user-agent': 1, '-e': 1, '--referer': 1, '-b': 1, '--cookie': 1, '-m': 1, '--max-time': 1, '-w': 1, '--write-out': 1, '-x': 1, '--proxy': 1 }],
  ['wget', { '-O': 1, '-P': 1, '-o': 1, '-a': 1, '-U': 1, '-t': 1, '-T': 1, '-e': 1, '-i': 1, '--output-document': 1, '--directory-prefix': 1, '--output-file': 1, '--post-file': 1, '--body-file': 1, '--post-data': 1, '--body-data': 1, '--header': 1, '--input-file': 1 }],
  ['sh', SHELL_VALUES],
  ['bash', SHELL_VALUES],
  ['zsh', SHELL_VALUES],
  ['dash', SHELL_VALUES],
  ['ksh', SHELL_VALUES],
  ['fish', SHELL_VALUES],
  ['python', { '-c': 1, '-m': 1, '-W': 1, '-X': 1 }],
  ['node', { '-e': 1, '-p': 1, '-r': 1, '-C': 1, '--eval': 1, '--print': 1, '--require': 1, '--import': 1, '--loader': 1 }],
  ['bun', { '-e': 1, '-p': 1, '--eval': 1, '--print': 1 }],
  ['ruby', { '-e': 1, '-I': 1, '-r': 1 }],
  ['php', { '-r': 1, '-f': 1, '-d': 1 }],
  ['perl', { '-e': 1, '-E': 1, '-I': 1, '-i': ATTACHED, '-M': ATTACHED, '-m': ATTACHED, '-F': ATTACHED }],
])

/** The value-taking flags of git's subcommands that Arrester reads. */
export const GIT_SUB_VALUES: ReadonlyMap<string, Values> = new Map<string, Values>([
  ['clean', { '-e': 1, '--exclude': 1 }],
  ['rm', { '--pathspec-from-file': 1 }],
  ['checkout', { '-b': 1, '-B': 1, '--orphan': 1 }],
  ['restore', { '-s': 1, '--source': 1 }],
  ['stash', { '-m': 1, '--message': 1 }],
])

/** The flags whose value is code, per interpreter family. */
export const CODE_FLAGS: ReadonlyMap<string, readonly string[]> = new Map([
  ['python', ['-c']],
  ['node', ['-e', '--eval', '-p', '--print']],
  ['bun', ['-e', '--eval', '-p', '--print']],
  ['ruby', ['-e']],
  ['php', ['-r']],
  ['perl', ['-e', '-E']],
])

/** `claude` launch flags that load other settings or turn off permission checks, hooks, or mods. */
export const CLAUDE_OFF = new Set(['--settings', '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions', '--bare', '--safe-mode'])

/** `claude plugin` subcommands that turn a plugin off. */
export const PLUGIN_OFF = new Set(['disable', 'uninstall'])

const DECODERS = new Set(['uudecode', 'gunzip', 'zcat', 'bzcat', 'xzcat'])
const HANDLED = new Set(['find', 'git', 'gh', 'curl', 'wget', 'dd', 'eval', 'source', '.', 'openssl', 'gzip', 'claude', ...DECODERS])

/** The value-taking flags of a program; none when the table does not list it. */
export function valuesOf(program: string): Values {
  return VALUE_FLAGS.get(program) ?? {}
}

/** True when the flags hold one of `letters` in a short cluster (`-rf`) or one of the long names. */
export function hasFlag(flags: readonly string[], letters: string, longs: readonly string[] = []): boolean {
  return flags.some(flag => longs.includes(flag) || (/^-[A-Za-z]+$/.test(flag) && [...letters].some(letter => flag.includes(letter))))
}

/** True when the program decodes or unpacks text. */
export function isDecoder(program: string, flags: readonly string[]): boolean {
  if (program === 'base64') return hasFlag(flags, 'dD', ['--decode'])
  if (program === 'xxd') return hasFlag(flags, 'r', ['--revert'])
  if (program === 'openssl') return flags.includes('-d')
  if (program === 'gzip') return hasFlag(flags, 'd', ['--decompress'])
  return DECODERS.has(program)
}

/** The interpreter table key: Python variants share `python`; Node and TypeScript runners share `node`. */
export function family(program: string): string {
  if (/^(python|pypy)/.test(program)) return 'python'
  return ['nodejs', 'tsx', 'ts-node'].includes(program) ? 'node' : program
}

/** True when Arrester reads the program itself, so a path to it is not a script run. */
export function isKnown(program: string): boolean {
  return [PATHY, TRIVIAL, SHELLS, HANDLED].some(set => set.has(program)) || INTERPRETER.test(program) || WRAPPERS.has(program) || RUNNERS.has(program)
}
