import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ShownUrl } from '../types'
import { qrText } from './qr'

const shown = atom({ plugin: 'remote-qr', key: 'url' } as const, null as ShownUrl)

// Bumped by every dismissal, so a wait that outlives one never shows the code.
let generation = 0

export const register: Register = on => {
  on('command.run', { command: 'remote-control' }, async ($, e, next) => {
    // /remote-control prints nothing as text; the engine records the bridge id in
    // <config dir>/sessions/<pid>.json beside this session's id.
    const bridgeId = async (): Promise<string | undefined> => {
      const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
      const dir = `${(await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${home}/.claude`}/sessions`
      const id = await $.session.id()
      for (const entry of await $.fs.list(dir)) {
        if (!entry.name.endsWith('.json')) continue
        try {
          const s = JSON.parse(String(await $.fs.read(`${dir}/${entry.name}`)))
          if (s.sessionId === id) return typeof s.bridgeSessionId === 'string' ? s.bridgeSessionId : undefined
        } catch {
          // another process may be mid-write; skip it
        }
      }
      return undefined
    }

    // The bridge connects after the command returns, so wait for its id off the hook's clock.
    const showQrOnConnect = async (asOf: number) => {
      for (let i = 0; i < 30 && asOf === generation; i++) {
        const now = await bridgeId().catch(() => undefined)
        if (asOf !== generation) return
        if (now) {
          // Checked inside the write too: a dismissal can land while it happens.
          await update($, shown, held => (asOf === generation ? `https://claude.ai/code/${now}` : held))
          return
        }
        await $.clock.sleep(500)
      }
    }

    // Already connected means the command shows its menu: leave that alone.
    const before = await bridgeId().catch(() => undefined)
    const ran = await next(e)
    if (!before) void showQrOnConnect(generation)

    return ran
  })

  on('prompt.submit', async ($, e, next) => {
    generation++
    // Always write: the new version sends a write in progress back to its check.
    await update($, shown, () => null)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const url = await read($, shown)
    const qr = url && qrText(url)
    if (e.props.hasSurvey || !qr) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    // Other mods draw here too: keep what they drew below the code.
    const below = await next(e)

    // A code cut, wrapped or scrolled does not scan. What other mods drew below
    // may make the band scroll, so the header and code must fit its window.
    const lines = qr.split('\n')
    const width = Array.from(lines[0] ?? '').length
    const height = lines.length + 1
    const fits = width <= e.props.bodyColumns && height <= e.props.scroll.bodyRows

    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>
            {fits ? 'Scan with your phone to continue there ' : `Enlarge the terminal to ${width}×${height} to show the QR Code `}
          </Text>
          <Button
            key="close"
            label="Close"
            onPress={() => {
              generation++
              return update($, shown, () => null)
            }}
          />
        </Box>
        {fits
          ? lines.map(line => (
              // Fixed colors so the code reads right on light and dark terminals alike.
              <Text color="#ffffff" backgroundColor="#000000">
                {line}
              </Text>
            ))
          : null}
        {below}
      </Box>
    )
  })
}
