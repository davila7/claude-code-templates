// Who ran the CLI for a download, self-reported by cli-tool/src/agent-detection.js
// and stored by /api/track-download-supabase (columns from database/migrations/004).

// Agent names the CLI reports. Anything else is stored as 'other'.
export const KNOWN_AGENTS = new Set([
  'claude', 'cowork', 'cursor', 'cursor-cli', 'codex', 'gemini', 'github-copilot',
  'opencode', 'augment-cli', 'antigravity', 'devin', 'replit', 'v0', 'other',
]);

// Older CLI versions send none of these, so all three stay null.
export function clientSignals(body: { agent?: unknown; entrypoint?: unknown; isTty?: unknown }) {
  const agent = typeof body.agent === 'string' ? (KNOWN_AGENTS.has(body.agent) ? body.agent : 'other') : null;
  const entrypoint =
    typeof body.entrypoint === 'string' && /^[a-z0-9_-]{1,32}$/.test(body.entrypoint) ? body.entrypoint : null;
  const isTty = typeof body.isTty === 'boolean' ? body.isTty : null;
  return { client_agent: agent, client_entrypoint: entrypoint, client_is_tty: isTty };
}

// PostgREST / Postgres codes for a column that does not exist yet (migration 004 not run).
export const MISSING_COLUMN_CODES = new Set(['PGRST204', '42703']);

type InsertResult = { error: { code?: string; message: string } | null };
type Inserter = (values: Record<string, unknown>) => PromiseLike<InsertResult>;

// Inserts the row with the client signals; until migration 004 runs, retries without them
// so download counting never stops, whatever order deploy and migration happen in.
export async function insertWithClientSignals(
  insert: Inserter,
  row: Record<string, unknown>,
  body: { agent?: unknown; entrypoint?: unknown; isTty?: unknown }
): Promise<InsertResult> {
  const first = await insert({ ...row, ...clientSignals(body) });
  if (first.error && MISSING_COLUMN_CODES.has(first.error.code ?? '')) {
    return insert(row);
  }
  return first;
}
