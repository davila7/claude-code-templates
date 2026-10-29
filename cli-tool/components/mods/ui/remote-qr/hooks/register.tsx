import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ShownUrl } from '../types'
import { qrText } from './qr'

const shown = atom({ plugin: 'remote-qr', key: 'url' } as const, null as ShownUrl)

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
    const showQrOnConnect = async () => {
      for (let i = 0; i < 30; i++) {
        const now = await bridgeId().catch(() => undefined)
        if (now) {
          await update($, shown, () => `https://claude.ai/code/${now}`)
          return
        }
        await $.clock.sleep(500)
      }
    }

    // Already connected means the command shows its menu: leave that alone.
    const before = await bridgeId().catch(() => undefined)
    const ran = await next(e)
    if (!before) void showQrOnConnect()

    return ran
  })

  on('prompt.submit', async ($, e, next) => {
    if (await read($, shown)) await update($, shown, () => null)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const url = await read($, shown)
    const qr = url && qrText(url)
    if (e.props.hasSurvey || !qr) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>Scan with your phone to continue there </Text>
          <Button key="close" label="Close" onPress={() => update($, shown, () => null)} />
        </Box>
        {qr.split('\n').map(line => (
          // Fixed colors so the code reads right on light and dark terminals alike.
          <Text color="#ffffff" backgroundColor="#000000">
            {line}
          </Text>
        ))}
      </Box>
    )
  })
}
