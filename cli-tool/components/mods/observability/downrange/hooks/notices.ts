/** One `<task-notification>` block. */
export type Notice = {
  ids: string[]
  outputFile?: string
  status?: string
  summary?: string
  event?: string
}

const OPEN = '<task-notification>'
const CLOSE = '</task-notification>'
/** One header field, as the engine writes each one on a line of its own, before the block's body. */
const FIELD = /\s*<(task-id|tool-use-id|task-type|output-file|status|summary)>([\s\S]*?)<\/\1>/y
const EVENT_OPEN = '<event>'
const EVENT_CLOSE = '</event>'
const ID_SHAPE = /^\S{1,128}$/

/** Text as it stood before the engine escaped `&`, `<`, and `>` in it. */
const unescaped = (text: string): string => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')

/**
 * One block's content: its header fields (every task id of a valid shape, and the first non-empty status and summary),
 * then the text of the first `<event>` in its body. The body's other parts (a note, a result, usage, plain text) are
 * not read.
 */
function noticeOf(block: string): Notice {
  const ids: string[] = []
  const first = new Map<string, string>()
  let end = 0
  for (;;) {
    FIELD.lastIndex = end
    const field = FIELD.exec(block)
    if (field === null) break
    end = FIELD.lastIndex
    const [, name = '', text = ''] = field
    const value = unescaped(text.trim())
    if (name === 'task-id') {
      if (ID_SHAPE.test(value)) ids.push(value)
    } else if (value !== '' && !first.has(name)) {
      first.set(name, value)
    }
  }
  const open = block.indexOf(EVENT_OPEN, end)
  const close = open === -1 ? -1 : block.indexOf(EVENT_CLOSE, open)
  const event = close === -1 ? undefined : unescaped(block.slice(open + EVENT_OPEN.length, close))
  return { ids, outputFile: first.get('output-file'), status: first.get('status'), summary: first.get('summary'), event }
}

/**
 * Every notification block in a delivered prompt, in order. The engine escapes every value inside a block, so a block
 * runs to the first `</task-notification>` after its opening tag. Blocks follow one another with only white space
 * between them. Other text after a block is that block's trailing text, which the engine does not escape (a stalled
 * command's last output, for one), so nothing after it is read.
 */
export function noticesOf(text: string): Notice[] {
  const notices: Notice[] = []
  let at = text.indexOf(OPEN)
  while (at !== -1) {
    const start = at + OPEN.length
    const close = text.indexOf(CLOSE, start)
    if (close === -1) break
    notices.push(noticeOf(text.slice(start, close)))
    const end = close + CLOSE.length
    const next = text.indexOf(OPEN, end)
    at = next !== -1 && text.slice(end, next).trim() === '' ? next : -1
  }
  return notices
}
