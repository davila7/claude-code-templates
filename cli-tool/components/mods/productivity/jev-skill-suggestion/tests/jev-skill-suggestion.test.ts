// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test productivity/jev-skill-suggestion
import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const HOME = '/home/u'
const BACKUP = 'jev-skill-suggestion.skill-overrides.backup.json'

// The engine beneath the plugin. The user's files sit only in `dir`, so a hook
// that looked anywhere else would find nothing: one skill whose frontmatter
// name is not its directory, and settings that already have it off.
function fakeEngine(on: On, env: Record<string, string>, dir: string) {
  const files: Record<string, string> = {
    [`${dir}/settings.json`]: '{"skillOverrides":{"deploy":"off"}}',
    [`${dir}/skills/deploy/SKILL.md`]: '---\nname: Deploy Things\ndescription: Ships the app\n---\nRun the deploy script.',
  }
  mock.env(on, env)
  on('session.cwd', () => ({ value: '/repo' }))
  on('fs.exists', ($, e) => ({ value: Object.keys(files).some((f) => f === e.path || f.startsWith(`${e.path}/`)) }))
  on('fs.read', ($, e) => {
    if (!(e.path in files)) throw new Error('ENOENT')
    return { value: files[e.path]! }
  })
  on('fs.list', ($, e) => ({ value: e.path === `${dir}/skills` ? [{ name: 'deploy', kind: 'dir' as const, size: 0, isLink: false }] : [] }))
  on('command.list', () => ({ value: [{ name: 'Deploy Things', description: 'Ships the app', source: 'user' as const }] }))
  on('model.classify', () => ({ value: 'deploy' }))
  on('clock.now', () => ({ value: 0 }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('skill.prompt', async ($, e) => ({ text: e.text }))
  on('prompt.submit', async ($, e) => ({ text: e.text, context: e.context }))
}

test('the setup reads, writes and removes under CLAUDE_CONFIG_DIR, not HOME', async ($, on) => {
  fakeEngine(on, { HOME, CLAUDE_CONFIG_DIR: '/cfg' }, '/cfg')
  const apply = (await $.skill.prompt({ skill: 'jev-skill-suggestion:setup', text: '' })).text
  // The display name maps to its directory and the settings say it is off: both read from /cfg.
  expect(apply).toContain('Already hidden, left as they are (1):\n- deploy')
  expect(apply).toContain(`first write /cfg/${BACKUP}`)
  expect(apply).toContain('edit /cfg/settings.json')
  const restore = (await $.skill.prompt({ skill: 'jev-skill-suggestion:setup', text: 'restore' })).text
  expect(restore).toContain(`Read /cfg/${BACKUP}`)
  expect(restore).toContain(`Bash tool: rm '/cfg/${BACKUP}'\n`)
  expect(apply + restore).not.toContain(HOME)
})

test('without CLAUDE_CONFIG_DIR the setup falls back to ~/.claude and the allowed rm', async ($, on) => {
  fakeEngine(on, { HOME }, `${HOME}/.claude`)
  const apply = (await $.skill.prompt({ skill: 'jev-skill-suggestion:setup', text: '' })).text
  expect(apply).toContain('Already hidden, left as they are (1):\n- deploy')
  expect(apply).toContain(`edit ${HOME}/.claude/settings.json`)
  const restore = (await $.skill.prompt({ skill: 'jev-skill-suggestion:setup', text: 'restore' })).text
  expect(restore).toContain(`Bash tool: rm ~/.claude/${BACKUP}\n`)
})

test('a prompt gets the user skill injected from CLAUDE_CONFIG_DIR, found by its display name', async ($, on) => {
  fakeEngine(on, { HOME, CLAUDE_CONFIG_DIR: '/cfg' }, '/cfg')
  const submitted = await $.prompt.submit({ text: 'ship it', wait: false, origin: { kind: 'composer' } })
  const block = submitted.context?.join('\n') ?? ''
  expect(block).toContain('<skill name="deploy" dir="/cfg/skills/deploy">')
  expect(block).toContain('Run the deploy script.')
})
