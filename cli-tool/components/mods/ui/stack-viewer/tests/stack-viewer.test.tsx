// Run with: claude plugin test ui/stack-viewer
import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { buildStack, counts, frontmatterName, mergeSettings, redact, scanFiles, showValue } from '../hooks/stack.ts'
import type { Facts, Files, Io, Section } from '../hooks/stack.ts'

const HOME = '/home/me'
const CFG = `${HOME}/.claude`
const PROJ = '/work/app'

const skill = (name: string) => `---\nname: ${name}\ndescription: d\n---\nbody\n`

/** A small machine: user and project skills that clash, agents, commands, styles, MCP, plugins. */
const DISK: Record<string, string> = {
  [`${CFG}/skills/deploy/SKILL.md`]: skill('deploy'),
  [`${CFG}/skills/pdf-tools/SKILL.md`]: skill('pdf-tools'),
  [`${PROJ}/.claude/skills/deploy/SKILL.md`]: skill('deploy'),
  [`${PROJ}/.claude/skills/release-notes/SKILL.md`]: skill('release-notes'),
  [`${PROJ}/.claude/skills/hello-mod/.claude-plugin/plugin.json`]: '{"name":"hello-mod","version":"0.1.0"}',
  [`${PROJ}/.claude/skills/hello-mod/hooks/hooks.json`]: '{"modules":["./register.ts"]}',
  [`${CFG}/agents/code-reviewer.md`]: skill('code-reviewer'),
  [`${CFG}/agents/researcher.md`]: skill('researcher'),
  [`${PROJ}/.claude/agents/code-reviewer.md`]: skill('code-reviewer'),
  [`${CFG}/commands/summarize.md`]: '---\ndescription: s\n---\n',
  [`${PROJ}/.claude/commands/deploy.md`]: '---\ndescription: s\n---\n',
  [`${PROJ}/.claude/commands/git/commit.md`]: '---\ndescription: s\n---\n',
  [`${CFG}/output-styles/terse.md`]: '---\nname: Terse\n---\n',
  [`${PROJ}/.claude/output-styles/reviewer.md`]: '---\nname: Reviewer\n---\n',
  [`${HOME}/.claude.json`]: JSON.stringify({
    mcpServers: { github: { command: 'x', env: { GITHUB_TOKEN: 'ghp_secret' } }, notes: { command: 'x' } },
    projects: { [PROJ]: { mcpServers: { docs: { command: 'x' } } } },
  }),
  [`${PROJ}/.mcp.json`]: JSON.stringify({ mcpServers: { docs: { command: 'x' }, github: { command: 'x' }, wiki: { command: 'x' } } }),
  [`${CFG}/plugins/installed_plugins.json`]: JSON.stringify({
    version: 2,
    plugins: {
      'team-tools@demo': [{ scope: 'project', projectPath: PROJ, installPath: '/cache/team-tools/1.2.0', version: '1.2.0' }],
      'elsewhere@demo': [{ scope: 'project', projectPath: '/other', installPath: '/cache/elsewhere/1.0.0' }],
    },
  }),
  '/cache/team-tools/1.2.0/.claude-plugin/plugin.json': '{"name":"team-tools","version":"1.2.0"}',
  '/cache/team-tools/1.2.0/commands/pr.md': '---\ndescription: p\n---\n',
  '/cache/team-tools/1.2.0/output-styles/pirate.md': '---\nname: Pirate\n---\n',
  '/cache/team-tools/1.2.0/hooks/hooks.json': '{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"echo hi"}]}]}}',
}

/** A file system over DISK: directories are every prefix of a file's path. */
function fakeIo(disk: Record<string, string>): Io {
  return {
    read: async path => disk[path],
    list: async dir => {
      const seen = new Map<string, 'file' | 'dir'>()
      for (const p of Object.keys(disk)) {
        if (!p.startsWith(dir + '/')) continue
        const [head, ...rest] = p.slice(dir.length + 1).split('/')
        seen.set(head!, rest.length ? 'dir' : 'file')
      }
      return [...seen].map(([name, kind]) => ({ name, kind }))
    },
  }
}

const BASE = { configDir: CFG, claudeJson: `${HOME}/.claude.json`, cwd: PROJ, root: PROJ, managedDirs: ['/etc/claude-code'], home: HOME }

/** What the engine reported for that machine in a real 2.1.306 session. */
const FACTS: Facts = {
  skills: [
    { name: 'deploy', source: 'userSettings' },
    { name: 'pdf-tools', source: 'userSettings' },
    { name: 'release-notes', source: 'projectSettings' },
    { name: 'git:commit', source: 'projectSettings' },
    { name: 'summarize', source: 'userSettings' },
    { name: 'team-tools:pr', source: 'plugin', pluginName: 'team-tools' },
    { name: 'team-tools:changelog', source: 'plugin', pluginName: 'team-tools' },
    { name: 'simplify', source: 'built-in' },
  ],
  agents: [
    { agentType: 'code-reviewer', source: 'projectSettings' },
    { agentType: 'researcher', source: 'userSettings' },
    { agentType: 'team-tools:code-reviewer', source: 'plugin' },
  ],
  commands: [
    { name: 'deploy', source: 'user' },
    { name: 'summarize', source: 'user' },
    { name: 'team-tools:pr', source: 'plugin', plugin: 'team-tools' },
    { name: 'team-tools:changelog', source: 'plugin', plugin: 'team-tools' },
    { name: 'stack', source: 'plugin', plugin: 'stack-viewer' },
    { name: 'compact', source: 'builtin', description: 'Clear history but keep a summary' },
    { name: 'simplify', source: 'builtin' },
  ],
  mcpTools: [
    { name: 'mcp__docs__a', serverName: 'docs' },
    { name: 'mcp__github__a', serverName: 'github' },
    { name: 'mcp__github__b', serverName: 'github' },
    { name: 'mcp__notes__a', serverName: 'notes' },
    { name: 'mcp__adhoc__a', serverName: 'adhoc' },
  ],
  memory: [
    { path: `${HOME}/.claude/CLAUDE.md`, type: 'User', tokens: 7 },
    { path: `${PROJ}/CLAUDE.md`, type: 'Project', tokens: 8 },
  ],
  settings: {
    user: { model: 'opus', outputStyle: 'Terse', env: { FOO_TOKEN: 'secret123' }, hooks: { Notification: [{ hooks: [{ type: 'command', command: 'say done' }] }] } },
    project: { model: 'sonnet', enabledPlugins: { 'team-tools@demo': true }, hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard.sh' }] }] } },
    local: { outputStyle: 'Reviewer', enabledMcpjsonServers: ['docs', 'github'] },
    flag: {},
    policy: {},
  },
  mcpSeen: {},
  home: HOME,
  cwd: PROJ,
}

const scopeOf = (s: Section, id: string) => s.scopes.find(n => n.id === id)!
const item = (s: Section, scope: string, name: string) => scopeOf(s, scope).items.find(i => i.name === name)

async function stack(facts: Facts = FACTS, disk = DISK): Promise<{ files: Files; sections: Section[] }> {
  const files = await scanFiles(fakeIo(disk), BASE)
  return { files, sections: buildStack(files, facts) }
}
const section = (sections: Section[], kind: string) => sections.find(s => s.kind === kind)!

describe('scanFiles', () => {
  test('reads every scope off disk, keeps only plugins installed for this project', async () => {
    const { files } = await stack()
    expect(files.skills.map(s => `${s.scope}:${s.name}`).sort()).toEqual([
      'project:deploy',
      'project:release-notes',
      'user:deploy',
      'user:pdf-tools',
    ])
    expect(files.commands.map(c => `${c.scope}:${c.name}`).sort()).toEqual(['project:deploy', 'project:git:commit', 'user:summarize'])
    expect(files.plugins.map(p => `${p.origin}:${p.name}`).sort()).toEqual(['installed:team-tools', 'skills-dir:hello-mod'])
    const tools = files.plugins.find(p => p.name === 'team-tools')!
    expect(tools.commands).toEqual(['pr'])
    expect(tools.styles).toEqual(['Pirate'])
    expect(tools.hookEvents[0]!.event).toBe('SessionStart')
    expect(files.mcp.map(m => `${m.scope}:${m.name}`).sort()).toEqual([
      'local:docs',
      'project:docs',
      'project:github',
      'project:wiki',
      'user:github',
      'user:notes',
    ])
    expect(JSON.stringify(files)).not.toContain('ghp_secret')
  })

  test('frontmatter names win over file names', () => {
    expect(frontmatterName('---\nname: "Diagrams first"\n---\nx')).toBe('Diagrams first')
    expect(frontmatterName('no frontmatter')).toBeUndefined()
  })
})

describe('buildStack', () => {
  test('skills: a user skill shadows the project one of the same name; plugins are namespaced', async () => {
    const s = section((await stack()).sections, 'skills')
    expect(item(s, 'user', 'deploy')!.status).toBe('active')
    expect(item(s, 'project', 'deploy')).toMatchObject({ status: 'shadowed', by: 'user' })
    expect(item(s, 'project', 'release-notes')!.status).toBe('active')
    // command files listed beside skills belong to the commands tab
    expect(item(s, 'user', 'summarize')).toBeUndefined()
    expect(item(s, 'project', 'git:commit')).toBeUndefined()
    expect(scopeOf(s, 'plugin').items.map(i => i.name)).toEqual(['team-tools:changelog'])
    expect(scopeOf(s, 'builtin').items.map(i => i.name)).toEqual(['simplify'])
    expect(s.scopes.map(n => n.id).slice(0, 3)).toEqual(['managed', 'user', 'project'])
  })

  test('commands: a skill wins over a command file of the same name', async () => {
    const s = section((await stack()).sections, 'commands')
    expect(item(s, 'project', 'deploy')).toMatchObject({ status: 'shadowed', by: 'user' })
    expect(item(s, 'project', 'git:commit')!.status).toBe('active')
    expect(item(s, 'user', 'summarize')!.status).toBe('active')
    expect(scopeOf(s, 'plugin').items.map(i => i.name).sort()).toEqual(['stack', 'team-tools:pr'])
    expect(scopeOf(s, 'builtin').items).toEqual([{ name: 'compact', detail: 'Clear history but keep a summary', status: 'active' }])
  })

  test('subagents: project beats user; plugin agents stand apart', async () => {
    const s = section((await stack()).sections, 'agents')
    expect(item(s, 'project', 'code-reviewer')!.status).toBe('active')
    expect(item(s, 'user', 'code-reviewer')).toMatchObject({ status: 'shadowed', by: 'project' })
    expect(item(s, 'user', 'researcher')!.status).toBe('active')
    expect(item(s, 'plugin', 'team-tools:code-reviewer')!.status).toBe('active')
  })

  test('MCP: local beats project beats user; unapproved project servers wait', async () => {
    const s = section((await stack()).sections, 'mcp')
    expect(item(s, 'local', 'docs')).toMatchObject({ status: 'active', detail: '1 tool' })
    expect(item(s, 'project', 'docs')).toMatchObject({ status: 'shadowed', by: 'local' })
    expect(item(s, 'project', 'github')).toMatchObject({ status: 'active', detail: '2 tools' })
    expect(item(s, 'user', 'github')).toMatchObject({ status: 'shadowed', by: 'project' })
    expect(item(s, 'project', 'wiki')).toMatchObject({ status: 'off', note: 'awaiting approval' })
    expect(item(s, 'session', 'adhoc')).toMatchObject({ status: 'active', isInferred: true })
  })

  test('MCP: the scope the engine reported on a call wins over the files', async () => {
    const s = section((await stack({ ...FACTS, mcpSeen: { adhoc: 'claudeai' } })).sections, 'mcp')
    expect(item(s, 'claudeai', 'adhoc')!.isInferred).toBeFalsy()
  })

  test('plugins: the highest enabledPlugins source decides', async () => {
    const facts = { ...FACTS, settings: { ...FACTS.settings, local: { enabledPlugins: { 'team-tools@demo': false } } } }
    const s = section((await stack(facts)).sections, 'plugins')
    expect(item(s, 'local', 'team-tools@demo')).toMatchObject({ status: 'off' })
    expect(item(s, 'project', 'team-tools@demo')).toMatchObject({ status: 'shadowed', by: 'local' })
    expect(item(s, 'skillsdir-project', 'hello-mod@skills-dir')!.status).toBe('active')
    const on = section((await stack()).sections, 'plugins')
    expect(item(on, 'project', 'team-tools@demo')!.detail).toBe('v1.2.0 · 2 skills · 1 agent · hooks')
    expect(item(on, 'session', 'stack-viewer')).toMatchObject({ status: 'active', isInferred: true })
  })

  test('hooks add up across sources; allowManagedHooksOnly turns the rest off', async () => {
    const all = section((await stack()).sections, 'hooks')
    expect(item(all, 'project', 'PreToolUse')).toMatchObject({ status: 'active', detail: 'Bash → guard.sh' })
    expect(item(all, 'user', 'Notification')!.status).toBe('active')
    expect(scopeOf(all, 'plugin').items.map(i => i.name).sort()).toEqual(['SessionStart', 'function hooks'])
    const facts = { ...FACTS, settings: { ...FACTS.settings, policy: { allowManagedHooksOnly: true } } }
    const locked = section((await stack(facts)).sections, 'hooks')
    expect(item(locked, 'project', 'PreToolUse')).toMatchObject({ status: 'off', note: 'allowManagedHooksOnly' })
  })

  test('settings: a value is overridden by a higher source, objects merge, env shows names only', async () => {
    const s = section((await stack()).sections, 'settings')
    expect(item(s, 'project', 'model')).toMatchObject({ status: 'active', detail: '"sonnet"' })
    expect(item(s, 'user', 'model')).toMatchObject({ status: 'shadowed', by: 'project' })
    expect(item(s, 'user', 'env')).toMatchObject({ status: 'active', note: 'merged', detail: '1 var: FOO_TOKEN' })
    expect(JSON.stringify(s)).not.toContain('secret123')
    expect(showValue('apiKeyHelper', '/bin/key')).toBe('•••')
    expect(mergeSettings({ user: { a: 1, l: [1], o: { x: 1 } }, local: { a: 2, l: [2], o: { y: 2 } } })).toEqual({
      a: 2,
      l: [1, 2],
      o: { x: 1, y: 2 },
    })
  })

  test('hook commands and URLs never show a credential', () => {
    expect(redact('curl -H "Authorization: Bearer abc.def" https://x.io/h?token=s3cr3t&v=1')).toBe(
      'curl -H "Authorization: Bearer •••" https://x.io/h?token=•••&v=1',
    )
    expect(redact('notify --api-key=sk_live_123 --channel ops')).toBe('notify --api-key=••• --channel ops')
    expect(redact('echo ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe('echo •••')
    expect(redact('npx prettier --write')).toBe('npx prettier --write')
  })

  test('output styles: the highest source with outputStyle selects it', async () => {
    const s = section((await stack()).sections, 'styles')
    expect(item(s, 'project', 'Reviewer')).toMatchObject({ isSelected: true, note: 'selected in Local settings' })
    expect(item(s, 'user', 'Terse')!.isSelected).toBe(false)
    expect(item(s, 'plugin', 'Pirate')!.detail).toBe('team-tools')
    expect(s.extra).toBe('selected: Reviewer ← Local · overrides User: Terse')
  })

  test('memory: every file loads, paths shortened', async () => {
    const s = section((await stack()).sections, 'memory')
    expect(scopeOf(s, 'project').items[0]!.name).toBe('./CLAUDE.md')
    expect(scopeOf(s, 'user').items[0]!.name).toBe('~/.claude/CLAUDE.md')
    expect(counts(s)).toEqual({ active: 2, shadowed: 0, off: 0 })
  })
})

// ---------------------------------------------------------------------------
// The pane, through the engine

const PANE_PROPS = {
  title: 'stack',
  isFocused: true,
  bodyColumns: 90,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

function fakeEngine(on: On) {
  const io = fakeIo(DISK)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'stack' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: PROJ }))
  on('session.root', () => ({ value: PROJ }))
  on('session.version', () => ({ value: { version: '2.1.306', base: '2.1.306', builtAt: '' } }))
  on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
  on('command.list', () => ({ value: FACTS.commands }) as never)
  on('settings.read', (_$, e) => ({ value: FACTS.settings[(e as { source?: 'user' }).source ?? 'user'] ?? {} }) as never)
  on('fs.read', async (_$, e) => {
    const text = await io.read((e as { path: string }).path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  }) as never
  on('fs.list', async (_$, e) => ({ value: (await io.list((e as { path: string }).path)).map(x => ({ ...x, size: 0, mtimeMs: 0, isLink: false })) }) as never)
  on(
    'session.usage',
    () =>
      ({
        value: {
          startedAt: 0,
          context: {
            breakdown: {
              skills: { totalSkills: 8, includedSkills: 8, tokens: 0, skillFrontmatter: FACTS.skills.map(s => ({ ...s, tokens: 1 })) },
              agents: FACTS.agents.map(a => ({ ...a, tokens: 1 })),
              mcpTools: FACTS.mcpTools.map(t => ({ ...t, tokens: 1, isLoaded: false })),
              memoryFiles: FACTS.memory,
              categories: [],
            },
          },
        },
      }) as never,
  )
}

const open = ($: Parameters<Parameters<typeof test>[1]>[0], args = '') =>
  $.command.run({ command: 'stack', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })

describe('the pane', () => {
  test('/stack draws the skills tree; a type in the sidebar switches it, on every surface', async ($, on) => {
    fakeEngine(on)
    await $.session.start({ cwd: PROJ, surface: 'terminal', isInteractive: true })
    const r = await open($)
    expect(r.text).toMatch(/components across 9 types/)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'stack-viewer', surface, component: 'Pane', requestId: 'stack-viewer', props: PANE_PROPS })
      const nb = (t: string) => new RegExp(surface === 'terminal' ? t : t.replace(/ /g, '\u00a0'))
      await ui.press({ key: 'nav:skills' })
      await ui.redraw()
      expect(await ui.find({ type: 'Text', text: nb('shadowed by User') })).toBeDefined()
      expect(await ui.find({ key: 'scope:skills:user' })).toBeDefined()
      await ui.press({ key: 'nav:mcp' })
      await ui.redraw()
      expect(await ui.find({ type: 'Text', text: nb('awaiting approval') })).toBeDefined()
      // folding a scope hides its items
      await ui.press({ key: 'scope:mcp:project' })
      await ui.redraw()
      expect(await ui.find({ type: 'Text', text: nb('awaiting approval') })).toBeUndefined()
      await ui.press({ key: 'scope:mcp:project' })
      await ui.press({ key: 'nav:skills' })
      await ui.unmount()
    }
  })
})
