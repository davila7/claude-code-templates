// "Build my stack with Claude" (/stack/armar): the browser reads a few files
// from the user's repo and sends them to the private claude-gateway Worker
// (claude.aitmpl.com), which runs Claude billed to the user's own Claude
// Platform organization (Claude Platform OAuth, linked billing).
//
// The repo is read here, in the browser, with the GitHub token the user
// already granted for "Send to repo" (or anonymously for a public repo).
// The gateway never sees a GitHub token.

import { normalizeItems, isStackType, type StackItem } from './stack-link.ts';

// import.meta.env is undefined under node --test, hence the optional chaining.
const env = (import.meta as { env?: Record<string, string | undefined> }).env;
export const CLAUDE_LINK_ENABLED = env?.PUBLIC_CLAUDE_LINK_ENABLED === 'true';
export const GATEWAY_URL = env?.PUBLIC_CLAUDE_GATEWAY_URL || 'https://claude.aitmpl.com';

export const MAX_FILE_CHARS = 20_000;
export const MAX_TREE_PATHS = 1_500;
const MAX_WORKFLOWS = 5;

// Files that say the most about a project's stack, by exact root path. Files that
// commonly carry credentials (.env*, .mcp.json, .claude/settings*.json, compose
// files with environment blocks, .npmrc) are deliberately not read.
const ROOT_FILES = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'Pipfile', 'go.mod', 'Cargo.toml', 'Gemfile',
  'composer.json', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'mix.exs', 'pubspec.yaml', 'deno.json',
  'README.md', 'CLAUDE.md', 'AGENTS.md', 'Dockerfile',
  'wrangler.toml', 'vercel.json', 'netlify.toml', 'fly.toml', 'tsconfig.json',
  'turbo.json', 'pnpm-workspace.yaml',
];

// Second line of defense for what is read: anything that looks like a credential
// is replaced before it leaves the browser.
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{20,}|sk_(live|test)_[A-Za-z0-9]{10,}|rk_(live|test)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,})\b/g,
  /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|npm_[A-Za-z0-9]{30,})\b/g,
  /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bAIza[A-Za-z0-9_-]{35}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:[^\s@\/]+@/gi,
];
const SECRET_ASSIGN = /((?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key|access[_-]?key|client[_-]?secret|auth)[A-Za-z0-9_-]*["']?\s*[:=]\s*["']?)([^\s"',;}{]{8,})/gi;

/** Replaces credential-looking values with [redacted]. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[redacted]');
  return out.replace(SECRET_ASSIGN, (_, key: string, value: string) =>
    /^(\$\{|\$\(|process\.env|os\.environ|env\(|<|\[redacted\]|true$|false$|null$|undefined$)/i.test(value) ? key + value : key + '[redacted]');
}
const CONFIG_RE = /^(next|astro|vite|nuxt|svelte|remix|tailwind|vitest|jest|playwright)\.config\.(js|mjs|cjs|ts)$/;

export function parseRepoName(input: string): string | null {
  const s = input.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').replace(/\.git$/, '');
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s) ? s : null;
}

/** Which tree paths to read, in priority order. */
export function pickFiles(paths: string[]): string[] {
  const set = new Set(paths);
  const picked = ROOT_FILES.filter((p) => set.has(p));
  for (const p of paths) if (!p.includes('/') && CONFIG_RE.test(p)) picked.push(p);
  picked.push(...paths.filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p)).slice(0, MAX_WORKFLOWS));
  return [...new Set(picked)];
}

/** A compact tree listing: skips vendored and build folders. */
export function treeListing(paths: string[]): string {
  const skip = /(^|\/)(node_modules|dist|build|\.next|vendor|\.venv|target|coverage|\.git)\//;
  const kept = paths.filter((p) => !skip.test(p));
  const shown = kept.slice(0, MAX_TREE_PATHS);
  const more = kept.length - shown.length;
  return shown.join('\n') + (more > 0 ? `\n… and ${more} more paths` : '');
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function gh<T>(path: string, token: string | null, fetcher: Fetcher, raw = false): Promise<T> {
  const res = await fetcher(`https://api.github.com${path}`, {
    headers: {
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(res.status === 404 ? 'Repository not found (private repos need GitHub connected)' : `GitHub API error ${res.status}`);
  return (raw ? res.text() : res.json()) as Promise<T>;
}

export interface RepoSnapshot { name: string; files: Array<{ path: string; content: string }> }

/** Reads the repo's tree plus its manifest and docs files. */
export async function readRepo(name: string, token: string | null, fetcher: Fetcher = fetch): Promise<RepoSnapshot> {
  const meta = await gh<{ default_branch: string }>(`/repos/${name}`, token, fetcher);
  const tree = await gh<{ tree: Array<{ path: string; type: string }> }>(
    `/repos/${name}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`, token, fetcher);
  const paths = tree.tree.filter((t) => t.type === 'blob').map((t) => t.path);
  const files = await Promise.all(pickFiles(paths).map(async (path) => {
    try {
      const content = await gh<string>(`/repos/${name}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(meta.default_branch)}`, token, fetcher, true);
      return { path, content: redactSecrets(content.slice(0, MAX_FILE_CHARS)) };
    } catch {
      return null;
    }
  }));
  return { name, files: [{ path: '(file tree)', content: treeListing(paths) }, ...files.filter((f): f is { path: string; content: string } => f !== null)] };
}

// ---------- gateway ----------

export interface StackPick { id: string; reason: string }
export interface Recommendation {
  summary: string;
  components: StackPick[];
  usage: { model: string; inputTokens: number; outputTokens: number };
}

export class GatewayError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(path: string, token: string, init: RequestInit = {}, fetcher: Fetcher = fetch): Promise<T> {
  const res = await fetcher(`${GATEWAY_URL}${path}`, {
    // /link/start sets the HttpOnly cookie that binds the OAuth callback to this browser.
    credentials: 'include',
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GatewayError(data.message || `Request failed (${res.status})`, data.error || 'error', res.status);
  return data as T;
}

export const linkStatus = (token: string) => call<{ linked: boolean; linkedAt: string | null }>('/link/status', token);
export const startLink = (token: string) => call<{ authorizeUrl: string }>('/link/start', token, { method: 'POST', body: '{}' });
export const forgetLink = (token: string) => call<{ linked: false }>('/link/forget', token, { method: 'POST', body: '{}' });
export const recommend = (token: string, repo: RepoSnapshot, model?: string) =>
  call<Recommendation>('/stack/recommend', token, { method: 'POST', body: JSON.stringify({ repo, ...(model ? { model } : {}) }) });

// ---------- picks -> install ----------

/** Splits picks into stack-link items (the 8 CLI types) and plugins (own command). */
export function splitPicks(picks: StackPick[]): { items: StackItem[]; plugins: string[] } {
  const raw: Array<{ type: string; path: string }> = [];
  const plugins: string[] = [];
  for (const p of picks) {
    const [type, ...rest] = p.id.split('/');
    const path = rest.join('/');
    if (type === 'plugins') { if (/^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)?$/i.test(path)) plugins.push(path); }
    else if (isStackType(type)) raw.push({ type, path });
  }
  return { items: normalizeItems(raw), plugins };
}
