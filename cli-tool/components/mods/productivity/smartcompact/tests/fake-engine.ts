import type {
  AgentInfo,
  FsEntry,
  ModelCompleteRequest,
  ModelCompleteResult,
  On,
  PromptEditInput,
  SessionMessage,
} from 'claude-code';
import type { Engine as TestEngine } from 'claude-code/testing';

// The engine hands fs hooks the path in the platform's own spelling, so the fake keys its files with forward slashes.
// An absolute POSIX path works on both hosts: Linux keeps it, Windows adds a drive that `slashed` strips again.
// A `C:/home` style path fails on Linux, because the engine resolves it under the cwd and the fake misses it.
/** The fake home folder. */
export const FAKE_HOME = '/home/test';
/** A fake CLAUDE_CONFIG_DIR. */
export const FAKE_CONFIG_DIR = '/config';
// The fake cannot read the disk, so it serves the shipped prompt for the plugin folder under test itself.
// The test kit's `$.plugin.root` is a temp folder and a hooks module cannot import node:url, so any other
// continue-prompt.md counts as the shipped one. The user's override lives under the fake home.
const SHIPPED_PROMPT_NAME = '/continue-prompt.md';

/** The user's own continue prompt under the fake home folder. */
export const OVERRIDE_PROMPT_FILE = `${FAKE_HOME}/.claude/smartcompact/continue-prompt.md`;

/** A copy of `continue-prompt.md`. Keep the two the same. */
export const SHIPPED_CONTINUE_PROMPT = [
  'Context was compacted automatically.',
  '{next}',
  '- If you were waiting for me (a question, a choice or a review), ask it again.',
  '- If the current task or plan has more steps, do the next one.',
  '- If all work is done, stop and say so.',
].join('\n');

export const SUMMARY: SessionMessage = { role: 'user', text: 'Summary of the work so far.', toolUses: [] };

const NO_USAGE = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

/** What the fake session holds and what the plugin did to it. Tests change the first part and read the second. */
export type FakeSession = {
  /** Change it to stand in for a /resume to another session in the same process. */
  id: string;
  /** Undefined stands in for the time before the first response, when the engine has no count yet. */
  tokens: number | undefined;
  draft: string;
  isDialogOpen: boolean;
  agents: AgentInfo[];
  agentChecks: number;
  listCalls: string[];
  messages: SessionMessage[];
  claudeReply: (request: ModelCompleteRequest) => ModelCompleteResult | Promise<ModelCompleteResult>;
  compactError: string | undefined;
  compactSkip: string | undefined;
  compacts: (string | undefined)[];
  submitted: string[];
  statuses: (string | undefined)[];
  claudeModels: string[];
  commands: string[];
  isCommandRefused: boolean;
  files: Map<string, string>;
  /** File times in milliseconds, with 0 for files not listed here. */
  mtimes: Map<string, number>;
  /** Paths whose read fails, as a locked or broken file would. */
  unreadableFiles: Set<string>;
  /** When set, pauses a file read before the fake returns its contents. */
  beforeRead?: (path: string) => Promise<void>;
  store: Map<string, unknown>;
  /** Texts of the rows the plugin appended. */
  notes: string[];
  /** When set, the plugin's own append is refused with this reason. */
  noteDeny: string | undefined;
};

/** Stands in for the engine beneath the plugin: each hook answers from the fake session. */
export function fakeSession(on: On, stored: Record<string, unknown> = {}): FakeSession {
  const session: FakeSession = {
    id: 'session-1',
    tokens: 0,
    draft: '',
    isDialogOpen: false,
    agents: [],
    agentChecks: 0,
    listCalls: [],
    messages: [{ role: 'user', text: 'Fix the bug.', toolUses: [] }],
    claudeReply: () => claudeVerdict(true, 'work is done'),
    compactError: undefined,
    compactSkip: undefined,
    compacts: [],
    submitted: [],
    statuses: [],
    claudeModels: [],
    commands: [],
    isCommandRefused: false,
    files: new Map(),
    mtimes: new Map(),
    unreadableFiles: new Set(),
    store: new Map(Object.entries(stored)),
    notes: [],
    noteDeny: undefined,
  };

  answerTurnEvents(on);
  answerSessionCalls(on, session);
  answerPromptCalls(on, session);
  answerModelCalls(on, session);
  answerFiles(on, session);
  answerStore(on, session);
  answerCommands(on, session);

  return session;
}

/** The event names the plugin wrote to its log, in order. */
export function loggedEvents(session: FakeSession): string[] {
  return loggedLines(session).map((line) => String(line['event']));
}

export function loggedLines(session: FakeSession): Record<string, unknown>[] {
  const log = session.files.get(`${FAKE_HOME}/.claude/smartcompact/logs/${session.id.replace(/[^A-Za-z0-9_-]/g, '')}.jsonl`) ?? '';

  return log.split('\n').filter((line) => line !== '').map((line) => JSON.parse(line));
}

export function claudeVerdict(compact: boolean, reason: string): ModelCompleteResult {
  return { isAnswered: true, text: JSON.stringify({ compact, reason }), usage: NO_USAGE };
}

/** The person deletes the whole draft. The test kit runs `prompt.edit` but its typings leave the call out. */
export async function clearDraft($: TestEngine, draft: string): Promise<void> {
  const prompt = $.prompt as unknown as { edit: (e: PromptEditInput) => Promise<unknown> };

  const end = draft.length;

  await prompt.edit({ origin: { kind: 'composer' }, text: draft, cursor: end, start: 0, end, inputText: '' });
}

export function finishedTurn(turnId = 'turn-1') {
  return { answer: 'Done. Shall I push?', durationMs: 1000, isAborted: false, turnId, reason: 'answer' as const };
}

/** A finished main turn whose answer ends with the compact tag. */
export function taggedTurn(next: string, turnId = 'turn-1') {
  return { ...finishedTurn(turnId), answer: `The tests pass.\n<smartcompact>${next}</smartcompact>` };
}

/** Seeds the files Claude Code writes for a subagent. Returns the transcript path. */
export function seedSubagent(session: FakeSession, id: string, finished: boolean, mtimeMs: number): string {
  const base = `${FAKE_HOME}/.claude/projects/C--work/${session.id}/subagents/agent-${id}`;

  session.files.set(`${base}.meta.json`, JSON.stringify({ finished }));
  session.files.set(`${base}.jsonl`, '');
  session.mtimes.set(`${base}.jsonl`, mtimeMs);

  return `${base}.jsonl`;
}

/** Runs one model request of a turn to its end: of the main session, or of a subagent when `agentId` is given. */
export async function runStep($: TestEngine, index: number, agentId?: string, turnId = 'turn-1'): Promise<void> {
  const stream = $.turn.step({
    turnId,
    index,
    model: 'opus',
    messageCount: 1,
    ...(agentId === undefined ? {} : { agentId }),
  });

  for await (const _chunk of stream) {
    // Reads the stream to its end, as the engine does.
  }
}

/** A tool result row of the main session, or of a subagent when `agentId` is given. */
export function toolResult(agentId?: string, uuid = 'row-1') {
  return {
    message: {
      type: 'user' as const,
      role: 'user' as const,
      content: [{ type: 'tool_result' as const, tool_use_id: 'tool-1', content: 'ok' }],
    },
    door: 'tool-result' as const,
    origin: { kind: 'tool' as const, tool: 'Bash' },
    uuid,
    ...(agentId === undefined ? {} : { agentId }),
  };
}

/** Runs a slash command as the person typing it at the prompt. */
export function runCommand($: TestEngine, command: string) {
  return $.command.run({
    command,
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  });
}

/** A timed status without its `HH:mm`, so a test does not depend on the local time zone. */
export function withoutTime(status: string | undefined): string | undefined {
  return status?.replace(/ \d\d:\d\d$/, '');
}

function answerTurnEvents(on: On): void {
  // A response with no text and no tool calls. Only the step's start matters to the plugin.
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null };
  });
  on('turn.complete', (_$, e) => ({ text: e.answer }));
  on('turn.start', (_$, e) => ({ turnId: e.turnId }));
  on('session.start', (_$, e) => ({ cwd: e.cwd }));
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
}

function answerSessionCalls(on: On, session: FakeSession): void {
  on('ui.status', (_$, e) => {
    session.statuses.push(e.text);

    return { value: undefined };
  });
  on('session.id', () => ({ value: session.id }));
  on('session.cwd', () => ({ value: 'C:/work' }));
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { ...(session.tokens === undefined ? {} : { tokens: session.tokens }), window: 200000 },
      rateLimits: [],
    },
  }));
  on('session.messages', () => ({ value: session.messages }));
  on('agent.list', () => {
    session.agentChecks += 1;

    return { value: session.agents };
  });
  on('session.compact', (_$, e) => {
    if (session.compactError !== undefined) {
      throw new Error(session.compactError);
    }

    if (session.compactSkip !== undefined) {
      return { skip: session.compactSkip };
    }

    session.compacts.push(e.instructions);

    return { messages: [SUMMARY] };
  });
  // The engine skips an append hook that answers without next, except with a deny.
  on('session.append', (_$, e, next) => {
    if (e.door !== 'tool-result') {
      if (session.noteDeny !== undefined) {
        return { deny: session.noteDeny };
      }

      session.notes.push(e.message.content.map((block) => ('text' in block ? block.text : '')).join(''));
    }

    return next(e);
  });
}

function answerPromptCalls(on: On, session: FakeSession): void {
  on('prompt.context', (_$, e) => ({ blocks: e.blocks }));
  on('prompt.read', () => ({ value: { text: session.draft, cursor: session.draft.length } }));
  on('prompt.fill', () =>
    session.isDialogOpen ? { isFilled: false, refusal: 'dialog' as const } : { isFilled: true });
  on('prompt.submit', (_$, e) => {
    session.submitted.push(e.text);

    return { text: e.text };
  });
  on('prompt.edit', (_$, e) => {
    session.draft = `${e.text.slice(0, e.start)}${e.inputText}${e.text.slice(e.end)}`;

    return { text: session.draft, cursor: session.draft.length };
  });
}

function answerModelCalls(on: On, session: FakeSession): void {
  on('model.complete', async (_$, e) => {
    session.claudeModels.push(e.model);

    return { value: await session.claudeReply(e) };
  });
}

// Values pass through JSON as in the engine's own store.
function answerStore(on: On, session: FakeSession): void {
  on('store.get', (_$, e) => ({ value: session.store.get(e.key) }));
  on('store.set', (_$, e) => {
    session.store.set(e.key, JSON.parse(JSON.stringify(e.value)));

    return { value: undefined };
  });
  on('store.delete', (_$, e) => {
    session.store.delete(e.key);

    return { value: undefined };
  });
}

function answerCommands(on: On, session: FakeSession): void {
  on('command.register', (_$, e) => {
    if (session.isCommandRefused) {
      throw new Error(`cannot register ${e.name}`);
    }

    session.commands.push(e.name);

    return { value: { command: e.name } };
  });
}

function answerFiles(on: On, session: FakeSession): void {
  on('fs.exists', (_$, e) => ({ value: hasPath(session, slashed(e.path)) || isShippedPrompt(e.path) }));
  on('fs.list', (_$, e) => {
    const folder = slashed(e.path);
    session.listCalls.push(folder);

    if (!hasPath(session, folder)) {
      throw new Error(`missing ${folder}`);
    }

    const prefix = `${folder}/`;
    const entries = new Map<string, FsEntry>();

    for (const [path, text] of session.files) {
      if (!path.startsWith(prefix)) {
        continue;
      }

      const tail = path.slice(prefix.length);
      const name = tail.split('/')[0]!;
      const isDir = tail.includes('/');

      entries.set(name, {
        name,
        kind: isDir ? 'dir' : 'file',
        size: isDir ? 0 : text.length,
        mtimeMs: isDir ? 0 : session.mtimes.get(path) ?? 0,
        isLink: false,
      });
    }

    return { value: [...entries.values()] };
  });
  on('fs.stat', (_$, e) => {
    const path = slashed(e.path);

    if (!hasPath(session, path)) {
      throw new Error(`missing ${path}`);
    }

    return { value: {
      kind: session.files.has(path) ? 'file' as const : 'dir' as const,
      size: session.files.get(path)?.length ?? 0,
      mtimeMs: session.mtimes.get(path) ?? 0,
      isLink: false,
    } };
  });
  on('fs.read', async (_$, e) => {
    await session.beforeRead?.(e.path);

    if (session.unreadableFiles.has(slashed(e.path))) {
      throw new Error(`cannot read ${e.path}`);
    }

    return { value: session.files.get(slashed(e.path)) ?? (isShippedPrompt(e.path) ? SHIPPED_CONTINUE_PROMPT : '') };
  });
  on('fs.write', (_$, e) => {
    session.files.set(slashed(e.path), e.text);

    return { value: undefined };
  });
}

function hasPath(session: FakeSession, path: string): boolean {
  return session.files.has(path) || [...session.files.keys()].some((file) => file.startsWith(`${path}/`));
}

function slashed(path: string): string {
  return path.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '');
}

function isShippedPrompt(path: string): boolean {
  const file = slashed(path);

  return file.endsWith(SHIPPED_PROMPT_NAME) && file !== OVERRIDE_PROMPT_FILE;
}
