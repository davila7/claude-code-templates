import { describe, expect, test, type Mounted } from 'claude-code/testing'
import type { On } from 'claude-code'

import { ACTIONS } from '../hooks/register.tsx'

const PATH = '/repo/todo.md'
const SURFACES = ['terminal', 'desktop'] as const
const SITE = { scroll: { offset: 0, bodyRows: 20 }, view: {} }
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, ...SITE },
} as const
const PANE = {
  component: 'Pane',
  requestId: 'todo',
  props: { title: 'todo.md', isFocused: true, bodyColumns: 60, placement: 'dock', ...SITE },
} as const

type Pane = Mounted<(typeof SURFACES)[number], 'Pane'>

// The new task field's key, found among the drawn fields: it changes with every add.
async function newFieldKey(ui: Pick<Pane, 'findAll'>) {
  return (await ui.findAll({ type: 'Input' })).find(field => field.key?.startsWith('new'))?.key
}

// Types a task into the new task field and presses Enter.
async function addTask(ui: Pick<Pane, 'findAll' | 'input'>, text: string) {
  await ui.input({ key: (await newFieldKey(ui)) ?? 'new', text })
}

// The engine beneath the plugin: a repo at /repo, its files in memory, and the panes it opened.
function host(on: On, file?: string) {
  const files = new Map<string, string>(file === undefined ? [] : [[PATH, file]])
  // Paths that are symbolic links rather than files of their own.
  const links = new Set<string>()
  const panes = new Set<string>()
  on('process.run', () => ({
    value: { exitCode: 0, stdout: '/repo\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('session.cwd', () => ({ value: '/repo/sub' }))
  on('fs.exists', ($, e) => ({ value: files.has(e.path) }))
  on('fs.stat', ($, e) => {
    const text = files.get(e.path)
    if (text === undefined) {
      throw new Error(`ENOENT: ${e.path}`)
    }
    return { value: { kind: 'file' as const, size: text.length, mtimeMs: 0, isLink: links.has(e.path) } }
  })
  on('fs.read', ($, e) => {
    const text = files.get(e.path)
    if (text === undefined) {
      throw new Error(`ENOENT: ${e.path}`)
    }
    return { value: text }
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: [...panes].map(id => ({ id, title: id, isShown: true, isFocused: true, isPlaced: true })),
  }))
  on('ui.open', ($, e) => {
    panes.add(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', ($, e) => {
    panes.delete(e.id)
    return { value: undefined }
  })
  // Another mod's band, which the plugin must keep beside its own button.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>other mod</Text>
  })

  return { files, links, panes, toasts }
}

describe('todo-pane', () => {
  test('the band counts open tasks and keeps the band beneath', async ($, on) => {
    host(on, '# Todo\n- [ ] a\n- [x] b\n* [ ] c\n')
    await $.classic.SessionStart({ source: 'clear' })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'todo-pane', surface, ...BAND })
      expect((await ui.find({ key: 'todo' }))?.text).toBe('📝 todo (2)')
      expect(await ui.find({ type: 'Text', text: 'other mod' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('the band shows no count while todo.md is missing', async ($, on) => {
    host(on)
    await $.classic.SessionStart({ source: 'clear' })
    const ui = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'todo' }))?.text).toBe('📝 todo')
  })

  test('no toggleAction draws the band button without an action', async ($, on) => {
    host(on, '- [ ] a\n')
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'todo-pane', surface, ...BAND })
      expect((await ui.find({ key: 'todo' }))?.props.action).toBeUndefined()
      await ui.unmount()
    }
  })

  // Each name is one this build knows: an unknown one would cost the whole band.
  for (const toggleAction of ACTIONS) {
    test(`toggleAction ${toggleAction} rides on the band button`, { options: { toggleAction } }, async ($, on) => {
      host(on, '- [ ] a\n')
      for (const surface of SURFACES) {
        const ui = await $.ui.mount({ plugin: 'todo-pane', surface, ...BAND })
        expect((await ui.find({ key: 'todo' }))?.props.action).toBe(toggleAction)
        await ui.unmount()
      }
    })
  }

  for (const toggleAction of ['toggle todo', 'app:noSuchAction', 'app:exit']) {
    test(`toggleAction "${toggleAction}" toasts why and keeps the band`, { options: { toggleAction } }, async ($, on) => {
      const { toasts } = host(on, '- [ ] a\n')
      await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
      expect(toasts).toEqual([expect.stringContaining(`"${toggleAction}" is not one of app:cycleDiffBase`)])
      const ui = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...BAND })
      const button = await ui.find({ key: 'todo' })
      expect(button?.text).toBe('📝 todo (1)')
      expect(button?.props.action).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: 'other mod' })).toBeDefined()
    })
  }

  test('the band button and /todo open and close the pane', async ($, on) => {
    const { panes } = host(on, '- [ ] a\n')
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'todo-pane', surface, ...BAND })
      await ui.press({ key: 'todo' })
      expect([...panes]).toEqual(['todo'])
      await ui.press({ key: 'todo' })
      expect([...panes]).toEqual([])
      await ui.unmount()
    }
    await $.command.run({
      command: 'todo',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })
    expect([...panes]).toEqual(['todo'])
  })

  test('pane edits write back only the touched line', async ($, on) => {
    const { files } = host(on, '# Todo\n- [ ] a\n- [x] b\n')
    await $.classic.SessionStart({ source: 'clear' })
    for (const surface of SURFACES) {
      files.set(PATH, '# Todo\n- [ ] a\n- [x] b\n')
      await $.classic.SessionStart({ source: 'resume' })
      const ui = await $.ui.mount({ plugin: 'todo-pane', surface, ...PANE })
      expect(await ui.find({ type: 'Text', text: '# Todo' })).toBeDefined()

      await ui.press({ key: 'toggle1' })
      expect(files.get(PATH)).toBe('# Todo\n- [x] a\n- [x] b\n')
      await ui.input({ key: 'text2', text: 'bee' })
      expect(files.get(PATH)).toBe('# Todo\n- [x] a\n- [x] bee\n')
      await ui.press({ key: 'delete1' })
      expect(files.get(PATH)).toBe('# Todo\n- [x] bee\n')
      await addTask(ui, 'c')
      expect(files.get(PATH)).toBe('# Todo\n- [x] bee\n- [ ] c\n')
      await ui.unmount()
    }
  })

  test('the delete x sits one column apart from the task text', async ($, on) => {
    const { files } = host(on, '- [ ] a\n')
    await $.classic.SessionStart({ source: 'resume' })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'todo-pane', surface, ...PANE })
      expect((await ui.find({ key: 'gap0' }))?.props.marginLeft).toBe(1)
      await ui.unmount()
    }
    const ui = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...PANE })
    await ui.press({ key: 'delete0' })
    expect(files.get(PATH)).toBe('')
  })

  test('the new task field is drawn afresh after each add', async ($, on) => {
    const { files } = host(on, '- [ ] a\n')
    await $.classic.SessionStart({ source: 'clear' })
    for (const surface of SURFACES) {
      files.set(PATH, '- [ ] a\n')
      const ui = await $.ui.mount({ plugin: 'todo-pane', surface, ...PANE })
      const before = await newFieldKey(ui)
      await addTask(ui, 'b')
      // Desktop puts the typed text back into a field redrawn under the same key and value,
      // where a second Enter would add the task again. The terminal needs the new key for the
      // focus: the plugin puts the pane's ring on it (the kit keeps no ring, so that is checked live).
      expect(await newFieldKey(ui)).not.toBe(before)
      await addTask(ui, 'c')
      expect(files.get(PATH)).toBe('- [ ] a\n- [ ] b\n- [ ] c\n')
      await ui.unmount()
    }
  })

  test('a change made outside the pane is kept, and a stale row does nothing', async ($, on) => {
    const { files } = host(on, '- [ ] a\n- [ ] b\n')
    await $.classic.SessionStart({ source: 'clear' })
    const ui = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...PANE })
    files.set(PATH, '- [ ] a\n- [ ] b\n- [ ] from the editor\n')
    await ui.press({ key: 'toggle0' })
    expect(files.get(PATH)).toBe('- [ ] a\n- [ ] b\n- [ ] from the editor\n')
    // The refusal redrew the pane over the file as it is now, so the next press lands.
    await ui.press({ key: 'toggle0' })
    expect(files.get(PATH)).toBe('- [x] a\n- [ ] b\n- [ ] from the editor\n')

    files.set(PATH, '- [ ] zzz\n')
    await ui.press({ key: 'delete1' })
    expect(files.get(PATH)).toBe('- [ ] zzz\n')
  })

  test('a row whose lines above shifted does nothing, even onto an identical line', async ($, on) => {
    const { files } = host(on, '- [ ] x\n- [ ] a\n- [ ] a\n')
    await $.classic.SessionStart({ source: 'clear' })
    const ui = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...PANE })
    files.set(PATH, '- [ ] a\n- [ ] a\n')
    await ui.press({ key: 'toggle1' })
    expect(files.get(PATH)).toBe('- [ ] a\n- [ ] a\n')
  })

  test('a row does nothing when an identical line above it was removed or added', async ($, on) => {
    const { files } = host(on, '- [ ] a\n- [ ] a\n- [ ] a\n')
    await $.classic.SessionStart({ source: 'clear' })
    const removed = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...PANE })
    files.set(PATH, '- [ ] a\n- [ ] a\n')
    await removed.press({ key: 'toggle1' })
    expect(files.get(PATH)).toBe('- [ ] a\n- [ ] a\n')
    await removed.unmount()

    const added = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...PANE })
    files.set(PATH, '- [ ] a\n- [ ] a\n- [ ] a\n')
    await added.press({ key: 'delete1' })
    expect(files.get(PATH)).toBe('- [ ] a\n- [ ] a\n- [ ] a\n')
  })

  test('a missing todo.md shows the empty state and the first task creates it', async ($, on) => {
    const { files } = host(on)
    for (const surface of SURFACES) {
      files.delete(PATH)
      await $.classic.SessionStart({ source: 'clear' })
      const ui = await $.ui.mount({ plugin: 'todo-pane', surface, ...PANE })
      expect(await ui.find({ type: 'Text', text: /No todo.md yet/ })).toBeDefined()
      await addTask(ui, 'first')
      expect(files.get(PATH)).toBe('- [ ] first\n')
      await ui.unmount()
    }
  })

  test('a todo.md that is a symbolic link is never written through', async ($, on) => {
    const { files, links, toasts } = host(on, '- [ ] a\n')
    await $.classic.SessionStart({ source: 'clear' })
    links.add(PATH)
    // Drawn from before the link, so the field still offers an add.
    const ui = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...PANE })
    await addTask(ui, 'b')
    expect(files.get(PATH)).toBe('- [ ] a\n')
    expect(toasts).toContain('todo-pane: todo.md is a symbolic link, left alone')
  })

  test('a todo.md that becomes a symbolic link shows none of the tasks read before', async ($, on) => {
    const { links } = host(on, '- [ ] a\n')
    await $.classic.SessionStart({ source: 'clear' })
    links.add(PATH)
    await $.command.run({
      command: 'todo',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })
    const band = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...BAND })
    expect((await band.find({ key: 'todo' }))?.text).toBe('📝 todo')
    const pane = await $.ui.mount({ plugin: 'todo-pane', surface: 'terminal', ...PANE })
    expect(await pane.find({ key: 'toggle0' })).toBeUndefined()
    expect(await newFieldKey(pane)).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: /left alone/ })).toBeDefined()
  })
})
