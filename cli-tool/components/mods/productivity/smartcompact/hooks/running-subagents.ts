import type { AgentStatus } from 'claude-code';
import type { Engine } from './engine.ts';

// `waiting` covers an agent that stopped but still waits on background work of its own.
const BUSY_STATUSES: readonly AgentStatus[] = ['pending', 'running', 'waiting'];
// Long tool calls can leave a working agent quiet for many minutes. The engine can keep finished agents busy for hours.
const STALE_AFTER_MS = 60 * 60 * 1000;
const MISS_CACHE_MS = 60_000;

// Scanning every project is costly. Retry a miss after a short wait because the first subagent may create the folder.
let cachedFolder: { sessionId: string; path: string } | { sessionId: string; path: undefined; retryAt: number } | undefined;

/**
 * Finished agents can linger in the engine. Finished meta or a transcript quiet for 60 minutes overrides a busy status.
 * Missing or unreadable files leave the engine status in charge.
 */
export async function runningSubagentIds(engine: Engine): Promise<string[]> {
  const agents = (await engine.agents()).filter((agent) => BUSY_STATUSES.includes(agent.status));

  if (agents.length === 0) {
    return [];
  }

  const folder = await subagentsFolder(engine).catch(() => undefined);

  if (folder === undefined) {
    return agents.map((agent) => agent.id);
  }

  const now = await engine.now();
  const running: string[] = [];

  for (const agent of agents) {
    // Teammates in another pane have no files in this session. Their engine status stays in charge.
    if (!/^[A-Za-z0-9_-]+$/.test(agent.id)) {
      running.push(agent.id);

      continue;
    }

    const base = `${folder}/agent-${agent.id}`;

    if (!(await isMarkedFinished(engine, `${base}.meta.json`)) && !(await isStale(engine, `${base}.jsonl`, now))) {
      running.push(agent.id);
    }
  }

  return running;
}

// A missing file or broken JSON is no proof that the agent stopped.
async function isMarkedFinished(engine: Engine, metaPath: string): Promise<boolean> {
  try {
    const meta: unknown = JSON.parse(await engine.fs.read(metaPath));

    return typeof meta === 'object' && meta !== null && (meta as { finished?: unknown }).finished === true;
  } catch {
    return false;
  }
}

async function isStale(engine: Engine, transcriptPath: string, now: number): Promise<boolean> {
  try {
    const transcript = await engine.fs.stat(transcriptPath);

    return now - transcript.mtimeMs >= STALE_AFTER_MS;
  } catch {
    return false;
  }
}

// The project folder name is not derived from the cwd, because the session may have moved since it started.
async function subagentsFolder(engine: Engine): Promise<string | undefined> {
  const sessionId = await engine.sessionId();

  if (cachedFolder?.sessionId === sessionId) {
    if (cachedFolder.path !== undefined || (await engine.now()) < cachedFolder.retryAt) {
      return cachedFolder.path;
    }
  }

  cachedFolder = undefined;
  const home = (await engine.env.userProfile()) || (await engine.env.home()) || '';
  const configDir = (await engine.env.configDir()) || `${home}/.claude`;
  const projects = `${configDir}/projects`;

  for (const entry of await engine.fs.list(projects).catch(() => [])) {
    const path = `${projects}/${entry.name}/${sessionId}/subagents`;

    if (entry.kind === 'dir' && (await engine.fs.exists(path))) {
      cachedFolder = { sessionId, path };

      return path;
    }
  }

  cachedFolder = { sessionId, path: undefined, retryAt: (await engine.now()) + MISS_CACHE_MS };

  return undefined;
}
