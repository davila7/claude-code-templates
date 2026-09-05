/**
 * secret-redactor — Function Hook (EXPERIMENTAL)
 *
 * Replaces credential-shaped strings in tool results before the model reads
 * them, and refuses to echo a redacted placeholder back into a Bash command.
 * Placement: "after" (awaits next, rewrites the result).
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "anthropic-api-key", re: /\bsk-ant-api\d{2}-[A-Za-z0-9_-]{20,}\b/g },
  { name: "openai-api-key", re: /\bsk-[A-Za-z0-9]{32,}\b/g },
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "stripe-key", re: /\b[sr]k_(live|test)_[0-9A-Za-z]{24,}\b/g },
  { name: "slack-token", re: /\bxox[abpr]-[0-9A-Za-z-]{10,}\b/g },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "private-key-block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "connection-string", re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/[^:\s]+:[^@\s]+@/gi },
];

function redactString(input: string, hits: Set<string>): string {
  let out = input;
  for (const { name, re } of PATTERNS) {
    out = out.replace(re, () => {
      hits.add(name);
      return `[REDACTED:${name}]`;
    });
  }
  return out;
}

/** Walk any JSON-ish value and redact every string inside it. */
function redactDeep(value: any, hits: Set<string>): any {
  if (typeof value === "string") return redactString(value, hits);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, hits));
  if (value && typeof value === "object") {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) copy[k] = redactDeep(v, hits);
    return copy;
  }
  return value;
}

export function register(on: any, options: Record<string, any> = {}) {
  for (const p of options.patterns ?? []) PATTERNS.push({ name: "custom", re: new RegExp(p, "g") });

  // 1. Never let a redacted placeholder travel back into a shell command.
  on("tool.call", { tool: "Bash" }, ($: Engine, e: any, next: Next) => {
    const command: string = e.command ?? "";
    if (command.includes("[REDACTED:")) {
      return { deny: "The command contains a redacted secret placeholder. Read the value from an environment variable instead." };
    }
    return next(e);
  });

  // 2. Redact every tool result before it enters the transcript.
  on("tool.call", async ($: Engine, e: any, next: Next) => {
    const result = await next(e);
    const hits = new Set<string>();
    const cleaned = redactDeep(result, hits);
    if (hits.size > 0) {
      $.ui.log(`[secret-redactor] redacted ${[...hits].join(", ")} from ${e.tool} output`);
    }
    return cleaned;
  });
}
