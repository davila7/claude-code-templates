#!/usr/bin/env node
/**
 * pre-push-review — multi-agent expert panel (project-agnostic; Windows, Linux, macOS).
 *
 * Runs an expert PANEL of independent reviewers (Claude Code CLI, headless `-p`) over the
 * diff IN PARALLEL — each constrained to ONE branch of code review — then aggregates their
 * findings and blocks the push only on blocking (default: critical) issues.
 *
 * Why a panel (not one reviewer): a single generalist pass misses domain-specific defects.
 * Independent specialists each catch a different failure class, and they auto-adapt to the
 * project by ingesting its own guidance file (CLAUDE.md / copilot-instructions / AGENTS.md).
 *
 * This file is self-contained and project-agnostic. It ships inside the pre-push-review
 * plugin and is invoked by the plugin's PreToolUse gate (scripts/prepush-gate.mjs). It can
 * also be run directly, or wired into a repo's husky `.husky/pre-push`.
 *
 * Usage:
 *   node ai-review-panel.mjs              # review staged changes
 *   node ai-review-panel.mjs --branch     # review committed changes being pushed
 *   node ai-review-panel.mjs --base main  # explicit base branch
 *   node ai-review-panel.mjs --pr 123     # review a PR diff and post the report as a comment
 *
 * Env knobs:
 *   CLAUDE_BIN            explicit path to the claude binary
 *   AI_REVIEW_MODEL       model for reviewers (default: sonnet)
 *   AI_REVIEW_TIMEOUT_MS  per-agent timeout (default: 240000)
 *   AI_REVIEW_BLOCK_ON    severity that blocks: critical|high (default: critical)
 *   AI_REVIEW_REQUIRED    1 = fail (exit 2) if the CLI is unavailable (default: 0 = warn+pass)
 *   AI_REVIEW_SKIP        1 = skip review entirely (escape hatch)
 *
 * Exit codes: 0 = ok / advisory, 1 = blocking issues found, 2 = CLI unavailable & required.
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const MAX_DIFF_LINES = 3000;
const MODEL = process.env.AI_REVIEW_MODEL || 'sonnet';
const TIMEOUT_MS = Number(process.env.AI_REVIEW_TIMEOUT_MS || 240_000);
const BLOCK_ON = (process.env.AI_REVIEW_BLOCK_ON || 'critical').toLowerCase();
const REQUIRED = process.env.AI_REVIEW_REQUIRED === '1';

const args = process.argv.slice(2);
let reviewMode = 'staged';
let baseBranch = '';
let prNumber = '';
let postToPr = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--branch') reviewMode = 'branch';
  else if (args[i] === '--base' && args[i + 1]) baseBranch = args[++i];
  else if (args[i] === '--pr' && args[i + 1]) {
    prNumber = args[++i];
    postToPr = true;
    reviewMode = 'branch';
  } else if (args[i] === '--post') postToPr = true;
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log(
      'Usage: node ai-review-panel.mjs [--branch] [--base <branch>] [--pr <n>] [--post]',
    );
    process.exit(0);
  }
}
if (process.env.AI_REVIEW_POST_PR === '1') postToPr = true;

if (process.env.AI_REVIEW_SKIP === '1' || process.env.PREPUSH_REVIEW_SKIP === '1') {
  console.log('[pre-push-review] Skipped (AI_REVIEW_SKIP=1).');
  process.exit(0);
}

// In --pr mode, review the FULL PR diff against its base branch (prefer origin/<base>).
if (prNumber && !baseBranch) {
  const b = run(`gh pr view ${prNumber} --json baseRefName -q .baseRefName`);
  if (b)
    baseBranch = run(`git rev-parse --verify --quiet origin/${b}`) ? `origin/${b}` : b;
}

// ---------------------------------------------------------------------------
// The expert panel — 6 independent branches of review (project-agnostic).
// ---------------------------------------------------------------------------
const ROLES = [
  {
    key: 'security',
    title: 'Security & Privacy',
    system:
      'You are a senior application-security reviewer. Review ONLY: authentication & ' +
      'authorization flaws, multi-tenant/data isolation, injection (SQL/NoSQL/command/path), ' +
      'secret or credential leakage, sensitive-data (PII/PHI) exposure in logs or responses, ' +
      'unsafe deserialization, SSRF, and insecure defaults. Ignore style and performance.',
  },
  {
    key: 'correctness',
    title: 'Correctness & Logic',
    system:
      'You are a senior correctness reviewer. Review ONLY: logic bugs, inverted/incorrect ' +
      'conditionals, off-by-one, null/undefined hazards, incorrect state transitions, ' +
      'data-integrity issues, and backward-incompatible changes to public behavior. ' +
      'Ignore style, naming, and performance.',
  },
  {
    key: 'reliability',
    title: 'Error Handling & Reliability',
    system:
      'You are a senior reliability reviewer. Review ONLY: missing or swallowed error ' +
      'handling, unhandled promise rejections, race conditions, retries/idempotency, ' +
      'resource leaks, timeouts, and failures that are silently masked instead of surfaced. ' +
      'Ignore style and naming.',
  },
  {
    key: 'performance',
    title: 'Performance & Scale',
    system:
      'You are a senior performance reviewer. Review ONLY: N+1 queries/calls, unbounded ' +
      'loops or fetches, missing pagination, inefficient data access patterns, needless ' +
      'work in hot paths, memory blowups, and cost/scale risks. Ignore style and naming.',
  },
  {
    key: 'tests',
    title: 'Test Coverage & Quality',
    system:
      'You are a senior test reviewer. Review ONLY: whether new logic and branches in the ' +
      'diff are adequately tested — missing tests, weak assertions, flaky patterns, and ' +
      'tests that would still pass if the code were broken. Ignore style and naming.',
  },
  {
    key: 'maintainability',
    title: 'Maintainability & Design',
    system:
      'You are a senior design reviewer. Review ONLY: poor API/module boundaries, excessive ' +
      'complexity, duplication, dead code, leaky abstractions, and changes that will be hard ' +
      'to evolve. Report only consequential issues, not nitpicks.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 }).trim();
  } catch {
    return '';
  }
}

/** Resolve the claude binary robustly — pre-push hooks run in a non-login shell whose
 *  PATH often omits ~/.local/bin, which is exactly why a bare `claude` "isn't found". */
function resolveClaudeBin() {
  if (process.env.CLAUDE_BIN && existsSync(process.env.CLAUDE_BIN)) {
    return process.env.CLAUDE_BIN;
  }
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'command -v claude';
    const found = execSync(cmd, { encoding: 'utf-8' }).trim().split('\n')[0].trim();
    if (found && (existsSync(found) || process.platform === 'win32')) return found;
  } catch {
    /* fall through to known locations */
  }
  const home = homedir();
  for (const c of [
    resolve(home, '.local/bin/claude'),
    resolve(home, '.claude/local/claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ]) {
    if (existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'claude.cmd' : 'claude';
}

/** Load the project's own review guidance so the generic panel adapts per repo. */
function loadProjectContext() {
  for (const p of [
    'CLAUDE.md',
    '.github/copilot-instructions.md',
    'AGENTS.md',
    '.cursorrules',
  ]) {
    const full = resolve(p);
    if (existsSync(full)) return readFileSync(full, 'utf-8').slice(0, 6000);
  }
  return '';
}

/** Extract a JSON object from a model reply that may include prose or code fences. */
function parseFindings(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s === -1 || e === -1 || e < s) return null;
  try {
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    return null;
  }
}

/** Run one reviewer agent headlessly; resolves to a result (never rejects). */
function runAgent(bin, role, userPrompt) {
  return new Promise((done) => {
    const env = { ...process.env };
    delete env.CLAUDECODE; // allow nested invocation from within Claude Code
    const child = spawn(
      bin,
      ['-p', '--model', MODEL, '--append-system-prompt', role.system],
      { env },
    );
    let out = '';
    let err = '';
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(res);
    };
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {}
      finish({ role, ok: false, error: `timeout after ${TIMEOUT_MS}ms`, findings: [] });
    }, TIMEOUT_MS);

    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => finish({ role, ok: false, error: e.message, findings: [] }));
    child.on('close', (code) => {
      const parsed = parseFindings(out);
      if (!parsed)
        finish({
          role,
          ok: false,
          error: (err || `exit ${code}`).slice(0, 200) + ' (unparseable output)',
          findings: [],
        });
      else
        finish({
          role,
          ok: true,
          findings: Array.isArray(parsed.findings) ? parsed.findings : [],
          summary: parsed.summary || '',
        });
    });

    child.stdin.write(userPrompt);
    child.stdin.end();
  });
}

/** Render the panel result as a Markdown PR comment. */
function buildReviewMarkdown(results, findings, counts, desc, lines) {
  const out = [];
  out.push(`## 🤖 pre-push-review — expert panel (${results.length} agents · model=${MODEL})`);
  out.push('');
  out.push(`Reviewed: **${desc}** (${lines} lines).`);
  out.push('');
  out.push('| Agent | Findings |');
  out.push('|---|---|');
  for (const r of results) {
    out.push(`| ${r.role.title} | ${r.ok ? `${r.findings.length}` : '⚠ failed'} |`);
  }
  out.push('');
  if (findings.length === 0) {
    out.push('_No issues reported by any agent. LGTM._');
  } else {
    for (const f of findings) {
      out.push(
        `- **[${f.severity.toUpperCase()}]** \`${f.file || '?'}:${f.line ?? '?'}\` — ${f.issue}` +
          (f.suggestion ? `\n  - ↳ ${f.suggestion}` : '') +
          ` _(${f.agent})_`,
      );
    }
  }
  out.push('');
  out.push(
    `**SUMMARY:** ${counts.critical} critical · ${counts.high} high · ${counts.medium} medium · ${counts.low} low`,
  );
  const fail = results.filter((r) => !r.ok).length;
  if (fail) out.push(`\n_⚠ ${fail}/${results.length} agent(s) failed — review is partial._`);
  out.push('\n<sub>pre-push-review multi-agent panel. Advisory; complements automated reviewers.</sub>');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Collect diff (any source file; exclude lockfiles/build noise)
// ---------------------------------------------------------------------------
const EXCLUDES = [
  ":(exclude)*.lock",
  ":(exclude)*-lock.json",
  ":(exclude)*-lock.yaml",
  ":(exclude)*.min.js",
  ":(exclude)*.map",
  ":(exclude)**/__snapshots__/**",
  ":(exclude)dist/**",
  ":(exclude)build/**",
];
let diff = '';
let description = '';
if (reviewMode === 'staged') {
  diff = run(`git diff --cached --diff-filter=ACMR -- . ${EXCLUDES.map((e) => `"${e}"`).join(' ')}`);
  if (!diff)
    diff = run(`git diff --diff-filter=ACMR -- . ${EXCLUDES.map((e) => `"${e}"`).join(' ')}`);
  description = 'staged/unstaged changes';
} else {
  // Review EXACTLY the commits being pushed — those not yet on any remote. This is
  // project-agnostic (no base-branch guessing) and matches what `git push` will send,
  // so a feature branch is reviewed for its OWN changes, not its base's divergence.
  let range;
  if (baseBranch) {
    range = `${baseBranch}...HEAD`;
    description = `branch changes vs ${baseBranch}`;
  } else {
    // Determine ONLY the commits being pushed. Prefer the push/upstream target; fall back
    // to "not on any remote". If there's nothing to push, review nothing — NEVER fall back
    // to the full base-branch history (that floods the review and false-blocks on a base's
    // pre-existing debt). Use --base explicitly for a full-branch review.
    let newCommits = run('git rev-list @{push}..HEAD').split('\n').filter(Boolean);
    if (!newCommits.length)
      newCommits = run('git rev-list @{upstream}..HEAD').split('\n').filter(Boolean);
    if (!newCommits.length)
      newCommits = run('git rev-list HEAD --not --remotes').split('\n').filter(Boolean);
    if (!newCommits.length) {
      console.log('[pre-push-review] No unpushed commits to review.');
      process.exit(0);
    }
    range = `${newCommits[newCommits.length - 1]}^..HEAD`;
    description = `${newCommits.length} commit(s) being pushed`;
  }
  diff = run(
    `git diff ${range} --diff-filter=ACMR -- . ${EXCLUDES.map((e) => `"${e}"`).join(' ')}`,
  );
}

if (!diff) {
  console.log('[pre-push-review] No code changes to review.');
  process.exit(0);
}

let diffLines = diff.split('\n').length;
if (diffLines > MAX_DIFF_LINES) {
  console.log(
    `[pre-push-review] Diff is ${diffLines} lines, truncating to ${MAX_DIFF_LINES} (review is partial).`,
  );
  diff = diff.split('\n').slice(0, MAX_DIFF_LINES).join('\n');
  diffLines = MAX_DIFF_LINES;
}

// ---------------------------------------------------------------------------
// Build shared prompt
// ---------------------------------------------------------------------------
const projectContext = loadProjectContext();
const userPrompt = `Review this git diff (${description}) STRICTLY within your assigned focus area.

${projectContext ? `## Project guidance (from the repo)\n${projectContext}\n` : ''}
## Output (MANDATORY)
Output ONLY a JSON object — no prose, no markdown fences — of exactly this shape:
{"findings":[{"severity":"critical|high|medium|low","file":"path","line":0,"issue":"what & why","suggestion":"fix"}],"summary":"one sentence"}
Rules: report only issues within your focus area; cite file:line from the diff; do NOT invent issues; reserve "critical" for defects that must block a release (data loss, security/privacy breach, broken core behavior). If nothing in your area, return {"findings":[],"summary":"LGTM"}.

## Diff
\`\`\`diff
${diff}
\`\`\``;

// ---------------------------------------------------------------------------
// Run the panel
// ---------------------------------------------------------------------------
const bin = resolveClaudeBin();
console.log(
  `[pre-push-review] Reviewing ${description} (${diffLines} lines) with ${ROLES.length} expert agents [model=${MODEL}]...`,
);

const results = await Promise.all(ROLES.map((role) => runAgent(bin, role, userPrompt)));

// ---------------------------------------------------------------------------
// Aggregate + report
// ---------------------------------------------------------------------------
const RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const all = [];
for (const r of results) {
  for (const f of r.findings) {
    const sev = String(f.severity || 'low').toLowerCase();
    if (!(sev in RANK)) continue;
    all.push({ ...f, severity: sev, agent: r.role.title });
  }
}
const seen = new Set();
const findings = all
  .filter((f) => {
    const k = `${f.severity}|${f.file}|${f.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  })
  .sort((a, b) => RANK[a.severity] - RANK[b.severity]);

const counts = { critical: 0, high: 0, medium: 0, low: 0 };
for (const f of findings) counts[f.severity]++;

console.log('\n==================================');
console.log('  pre-push-review — expert panel');
console.log('==================================');
for (const r of results) {
  console.log(
    `  • ${r.role.title.padEnd(28)} ${r.ok ? `${r.findings.length} finding(s)` : `FAILED: ${r.error}`}`,
  );
}
console.log('');
for (const f of findings) {
  console.log(
    `[${f.severity.toUpperCase()}] ${f.file || '?'}:${f.line ?? '?'} — ${f.issue}` +
      (f.suggestion ? `\n        ↳ ${f.suggestion}` : '') +
      `   (${f.agent})`,
  );
}
if (findings.length === 0) console.log('  No issues reported by any agent. LGTM.');
console.log(
  `\nSUMMARY: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low`,
);

// Publish the review to the PR so it's visible (complements automated reviewers) and our
// code is never merged without an exhaustive review on record.
if (postToPr) {
  const pr = prNumber || run('gh pr view --json number -q .number');
  if (pr) {
    try {
      // Edit our previous review in place (one rolling comment per PR, not one per push).
      execSync(`gh pr comment ${pr} --edit-last --create-if-none --body-file -`, {
        input: buildReviewMarkdown(results, findings, counts, description, diffLines),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      });
      console.log(`[pre-push-review] Posted review to PR #${pr}.`);
    } catch (e) {
      console.warn(
        `[pre-push-review] Could not post to PR #${pr}: ${String(e.stderr || e.message || '').slice(0, 200)}`,
      );
    }
  } else {
    console.warn('[pre-push-review] --post/--pr set but no PR found for the current branch.');
  }
}

const failed = results.filter((r) => !r.ok);
if (failed.length === results.length) {
  if (REQUIRED) {
    console.error('[pre-push-review] All review agents failed — blocking (AI_REVIEW_REQUIRED=1).');
    process.exit(2);
  }
  console.warn('[pre-push-review] All review agents failed — skipping (advisory).');
  process.exit(0);
}
if (failed.length > 0) {
  console.warn(`[pre-push-review] Note: ${failed.length}/${results.length} agent(s) failed; review is partial.`);
}

const blocking = BLOCK_ON === 'high' ? counts.critical + counts.high : counts.critical;
if (blocking > 0) {
  console.log('\n==================================');
  console.log(`  BLOCKED: ${blocking} ${BLOCK_ON}+ issue(s) found`);
  console.log('  (fix, or bypass once with: git push --no-verify)');
  console.log('==================================');
  process.exit(1);
}
console.log('[pre-push-review] Passed. No blocking issues.');
process.exit(0);
