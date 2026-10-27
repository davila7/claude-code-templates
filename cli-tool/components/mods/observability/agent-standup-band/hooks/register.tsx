// Agent Standup's band for Claude Code (a mod: Claude Code's function hooks). In the session you are in, a line above the prompt says when another Claude Code session
// on this computer needs you (an approval, an answer), and a toast says when one needs you or has finished its turn. It reads only the status file each session keeps
// in <config dir>/sessions/<pid>.json (written by Claude Code 2.1.221 and later in the terminal, 2.1.269 elsewhere; mods run from 2.1.294) and asks `ps` whether a waiting session's process still runs. Nothing is sent anywhere.
// The whole call, with every session as a character: /agent-standup:open (the agent-standup plugin).
import type { EngineInterface, Register } from 'claude-code'

// What the band shows, kept in the module and not in $.state: $.state needs a "types" contract in plugin.json, which Claude Code before 2.1.29x refuses in a manifest.
// A reload of the module starts them over, and the next look (every 4 s) fills them again.
type Need = { id: string; where: string; what: string }   // the session that waits; its folder, name and app; "an approval", "an answer"
let needs: readonly Need[] = []
let hidden: ReadonlySet<string> = new Set()   // the waits you put away with "Hide": the band stays away until another one comes; one that ends is forgotten, so the same session asking again shows
const keyOf = (n: Need): string => n.id + ':' + n.what

type Status = { pid?: unknown; sessionId?: unknown; status?: unknown; waitingFor?: unknown; cwd?: unknown; name?: unknown; nameSource?: unknown; entrypoint?: unknown }

// "web-shop · release (VS Code)": the folder, the name you gave the session (not the one Claude Code made up), the app it runs in
export const whereOf = (s: Status): string => {
  const cwd = typeof s.cwd === 'string' ? s.cwd : ''
  const folder = cwd.split(/[\\/]/).filter(Boolean).pop() || 'A session'
  const named = typeof s.name === 'string' && s.name && s.nameSource !== 'derived' ? ' · ' + s.name : ''
  const app = s.entrypoint === 'claude-vscode' ? ' (VS Code)' : s.entrypoint === 'claude-desktop' ? ' (desktop app)' : ''
  return folder + named + app
}
export const whatOf = (w: unknown): string => (w === 'permission prompt' ? 'an approval' : w === 'input needed' ? 'an answer' : 'you')
// waiting, and not on a dialog the person opened there themselves (/model, /config…): those say "dialog open"
const waits = (s: Status): boolean => s.status === 'waiting' && s.waitingFor !== 'dialog open'
// a session a program started with claude -p (entrypoint sdk-cli): its questions go to that program, and its turns are not yours. An Agent SDK host (sdk-ts, sdk-py: Zed, a home-made app)
// may show its menus to a person, so those are kept (as liveStatus in Agent Standup's server)
const byProgram = (s: Status): boolean => s.entrypoint === 'sdk-cli'

// The processes that still run, of those asked about. A session that crashed leaves its file behind, saying what it was doing then.
const alive = async ($: EngineInterface, pids: readonly number[]): Promise<Set<number>> => {
  if (!pids.length) return new Set()
  try {
    const { stdout } = await $.process.run(['ps', '-o', 'pid=', '-p', pids.join(',')], { timeoutMs: 5000 })
    return new Set(stdout.split(/\s+/).filter(Boolean).map(Number))   // ps exits 1 when none of them runs: nothing is listed then
  } catch {
    return new Set(pids)   // no ps (Windows): every file is taken at its word
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const config = (await $.env.get('CLAUDE_CONFIG_DIR')) || ((await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || '') + '/.claude'
    const dir = config.replace(/[\\/]+$/, '') + '/sessions'
    let before = new Map<string, string>()   // session id → what it was doing at the last look; nothing is announced at the first look
    let first = true

    const look = async () => {
      const self = await $.session.id()   // read at every look: /clear and resume go on under another id, and no session.start fires for it
      let names: string[] = []
      try {
        names = (await $.fs.list(dir)).filter(f => f.kind === 'file' && /^\d+\.json$/.test(f.name)).map(f => f.name)
      } catch {
        names = []   // no such folder: a Claude Code that writes no status, or none has run yet
      }
      const rows: Status[] = []
      for (const n of names) {
        try {
          const s = JSON.parse(await $.fs.read(dir + '/' + n)) as Status
          if (s && typeof s.sessionId === 'string' && s.sessionId !== self && !byProgram(s)) rows.push(s)
        } catch {
          // a file being written, or not one of Claude Code's: skipped
        }
      }
      const pids = rows.filter(waits).map(s => Number(s.pid)).filter(p => Number.isInteger(p) && p > 0)
      const live = await alive($, pids)
      const list: Need[] = rows.filter(s => waits(s) && live.has(Number(s.pid))).map(s => ({ id: String(s.sessionId), where: whereOf(s), what: whatOf(s.waitingFor) }))
      const keys = new Set(list.map(keyOf))
      if ([...hidden].some(k => !keys.has(k))) hidden = new Set([...hidden].filter(k => keys.has(k)))
      if (JSON.stringify(needs) !== JSON.stringify(list)) {
        needs = list
        $.ui.invalidate('ui.render')
      }

      const now = new Map(rows.map(s => [String(s.sessionId), waits(s) ? 'waiting' : String(s.status)]))
      if (!first) {
        for (const s of rows) {
          const was = before.get(String(s.sessionId)), is = now.get(String(s.sessionId))
          if (is === 'waiting' && was !== 'waiting' && live.has(Number(s.pid))) $.ui.toast(`✋ ${whereOf(s)} needs ${whatOf(s.waitingFor)}`)
          else if (is === 'idle' && was === 'busy') $.ui.toast(`✓ ${whereOf(s)} has finished: your turn there`)
        }
      }
      before = now
      first = false
    }

    await look().catch(() => undefined)
    $.clock.every(4000, () => {
      look().catch(() => undefined)
    })
    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = needs
    if (e.props.hasSurvey || !list.some(n => !hidden.has(keyOf(n)))) return next(e)
    const below = await next(e)   // what the other mods and the engine draw there stays, under the band
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {list.slice(0, 3).map(n => (
          <Text key={n.id} wrap="truncate-end">
            ✋ {n.where} <Text dimColor>needs {n.what}</Text>
          </Text>
        ))}
        {list.length > 3 ? <Text dimColor>and {list.length - 3} more</Text> : null}
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Agent Standup · /agent-standup:open shows them all</Text>
          <Button
            key="hide"
            label="Hide"
            plain
            onPress={() => {
              hidden = new Set(list.map(keyOf))
              $.ui.invalidate('ui.render')
            }}
          />
        </Box>
        {below}
      </Box>
    )
  })
}
