#!/usr/bin/env node
/**
 * Frontmatter validator for component files.
 *
 * Every agent, command and skill shipped by this repo is loaded by Claude Code
 * as a Markdown file with a YAML frontmatter block. If that block does not
 * parse, or carries a value of the wrong type, the component silently fails to
 * load at install time — the file is still published, it just never starts.
 *
 * This script is a fast, dependency-light gate for exactly that failure mode.
 * It is intentionally narrower than `security-audit.js`: it only answers
 * "will Claude Code be able to read this file's frontmatter?", so it can run
 * as a blocking check on pull requests without tripping over the pre-existing
 * content-quality debt the full audit reports.
 *
 * Usage:
 *   node src/validate-frontmatter.js                    # validate everything
 *   node src/validate-frontmatter.js --fix              # rewrite what it can
 *   node src/validate-frontmatter.js path/a.md path/b.md
 *   node src/validate-frontmatter.js --json
 *
 * Exit code is 1 when any file is invalid, 0 otherwise.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const COMPONENTS_DIR = path.resolve(__dirname, '..', 'components');
const SCANNED_TYPES = ['agents', 'commands'];

// Claude Code accepts three shapes for `model`: a documented alias, a full
// model ID, or `inherit` (reuse the parent session's model).
// https://code.claude.com/docs/en/sub-agents
const MODEL_ALIASES = ['sonnet', 'opus', 'haiku', 'fable', 'inherit'];
const MODEL_ID_RE = /^claude-[a-z0-9-]+$/;

function isValidModel(value) {
  const v = String(value).trim();
  return MODEL_ALIASES.includes(v) || MODEL_ID_RE.test(v);
}

// Frontmatter keys whose value must be a plain string. `argument-hint: [file]`
// is the classic trap — YAML reads the brackets as a flow sequence, so the
// value arrives as an array (or fails to parse outright when there are two
// bracket groups on the line).
const STRING_KEYS = ['argument-hint', 'description', 'name', 'model'];

// Fields Claude Code requires per component type. Everything else is optional:
// a command's name comes from its file name, and an agent with no `tools`
// simply inherits the session's tools.
// https://code.claude.com/docs/en/slash-commands
const REQUIRED_FIELDS = { agents: ['name', 'description'], commands: [] };

function componentType(file) {
  return file.includes(`${path.sep}commands${path.sep}`) ? 'commands' : 'agents';
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(full);
    }
  }
  return acc;
}

// README.md / index-style files document a directory, they are not components
// and Claude Code never loads them. Applied to discovered *and* explicit paths,
// so CI passing a changed README through never trips FM_MISSING.
function isDocumentationFile(file) {
  return /^(README|index|agent-overview)\.md$/i.test(path.basename(file));
}

function discoverComponents() {
  const files = [];
  for (const type of SCANNED_TYPES) {
    walk(path.join(COMPONENTS_DIR, type), files);
  }
  return files.filter((f) => !isDocumentationFile(f));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function validate(file) {
  const content = fs.readFileSync(file, 'utf8');
  const issues = [];

  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    issues.push({
      code: 'FM_MISSING',
      message: 'No YAML frontmatter block (file must open with --- and close with ---)',
      fixable: false,
    });
    return { file, content, issues };
  }

  const block = match[1];
  let data;
  try {
    data = yaml.load(block);
  } catch (error) {
    issues.push({
      code: 'FM_INVALID_YAML',
      message: `Frontmatter is not valid YAML: ${error.message.split('\n')[0]}`,
      fixable: true,
    });
    return { file, content, block, issues };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    issues.push({
      code: 'FM_NOT_A_MAP',
      message: 'Frontmatter must be a mapping of key: value pairs',
      fixable: false,
    });
    return { file, content, block, issues };
  }

  for (const key of STRING_KEYS) {
    if (key in data && data[key] !== null && typeof data[key] !== 'string') {
      issues.push({
        code: 'FM_WRONG_TYPE',
        message: `\`${key}\` must be a string, got ${Array.isArray(data[key]) ? 'a list' : typeof data[key]} — wrap the value in quotes`,
        fixable: true,
        key,
      });
    }
  }

  for (const field of REQUIRED_FIELDS[componentType(file)]) {
    if (!data[field] || String(data[field]).trim() === '') {
      issues.push({
        code: 'FM_MISSING_FIELD',
        message: `Missing required field \`${field}\``,
        fixable: false,
      });
    }
  }

  if (typeof data.model === 'string' && !isValidModel(data.model)) {
    issues.push({
      code: 'FM_BAD_MODEL',
      message: `\`model: ${data.model}\` is not a value Claude Code accepts. Use an alias (${MODEL_ALIASES.join(', ')}) or a full model ID such as claude-opus-5`,
      fixable: true,
      key: 'model',
    });
  }

  return { file, content, block, data, issues };
}

// ---------------------------------------------------------------------------
// Repair
// ---------------------------------------------------------------------------

/** Does this plain scalar need quoting to survive a YAML round-trip? */
function needsQuoting(value) {
  const v = value.trim();
  if (!v) return false;
  if (/^(['"]).*\1$/.test(v)) return false; // already quoted end to end
  if (/^[[{*&!|>%@`]/.test(v)) return true; // YAML indicator at the start
  if (/:(\s|$)/.test(v)) return true; // "Beast Mode 2.0: a powerful..."
  if (/\s#/.test(v)) return true; // trailing comment marker
  return false;
}

function quote(value) {
  return `"${value.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Map a human-readable model label ("Claude Sonnet 4.5", "Claude Sonnet 4.5
 * (copilot)") onto the documented alias. Values that already have a valid
 * shape are left exactly as the author wrote them.
 */
function normaliseModel(value) {
  const raw = String(value).trim().replace(/^["']|["']$/g, '');
  if (isValidModel(raw)) return null;
  const v = raw.toLowerCase();
  for (const alias of ['opus', 'haiku', 'sonnet', 'fable']) {
    if (v.includes(alias)) return alias;
  }
  return null;
}

/**
 * Rewrite the frontmatter block line by line. Only top-level `key: value`
 * lines are touched, and only where the value is a plain scalar that YAML
 * would misread — list items, nested maps and block scalars are left alone.
 */
/**
 * Re-emit `key: first line` + its indented continuation lines as a literal
 * block scalar. A multi-line plain scalar cannot contain `: ` or a leading
 * `-`, which is exactly what long descriptions with embedded <example> blocks
 * do contain — a block scalar carries them verbatim.
 */
function toBlockScalar(key, firstLine, continuation) {
  const body = [firstLine.trim(), ...continuation];
  const indents = continuation
    .filter((l) => l.trim() !== '')
    .map((l) => l.match(/^[ \t]*/)[0].length);
  const minIndent = indents.length ? Math.min(...indents) : 0;
  const pad = minIndent >= 2 ? 0 : 2 - minIndent;

  return [
    `${key}: |-`,
    `  ${body[0]}`,
    ...body.slice(1).map((l) => (l.trim() === '' ? '' : ' '.repeat(pad) + l)),
  ];
}

function repair(block) {
  const lines = block.split('\n');
  const out = [];
  let inBlockScalar = false;
  let changed = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (inBlockScalar) {
      if (/^\s+/.test(line) || line.trim() === '') {
        out.push(line);
        continue;
      }
      inBlockScalar = false;
    }

    // A block scalar opener (`description: |`) must be recognised before the
    // generic key/value match, otherwise the `|` is mistaken for a value and
    // quoted — which orphans every indented line that follows it.
    if (/^[A-Za-z0-9_-]+:[ \t]*[|>][-+0-9]*[ \t]*$/.test(line)) {
      inBlockScalar = true;
      out.push(line);
      continue;
    }

    const m = line.match(/^([A-Za-z0-9_-]+):[ \t]+(.+)$/);
    if (!m) {
      out.push(line);
      continue;
    }

    const [, key, rawValue] = m;
    const value = rawValue;

    // Multi-line plain scalar: the value continues on the following indented
    // lines. Promote the whole thing to a block scalar rather than trying to
    // quote a value that spans several lines.
    const continuation = [];
    let j = i + 1;
    while (j < lines.length && (/^[ \t]+\S/.test(lines[j]) || lines[j].trim() === '')) {
      continuation.push(lines[j]);
      j += 1;
    }
    while (continuation.length && continuation[continuation.length - 1].trim() === '') {
      continuation.pop();
      j -= 1;
    }
    if (continuation.length) {
      out.push(...toBlockScalar(key, value, continuation));
      i = j - 1;
      changed = true;
      continue;
    }

    if (key === 'model') {
      const normalised = normaliseModel(value);
      if (normalised) {
        out.push(`${key}: ${normalised}`);
        changed = true;
        continue;
      }
    }

    if (needsQuoting(value)) {
      out.push(`${key}: ${quote(value)}`);
      changed = true;
      continue;
    }

    out.push(line);
  }

  return { block: out.join('\n'), changed };
}

function applyFix(result) {
  if (!result.block) return false;
  const { block: repaired, changed } = repair(result.block);
  if (!changed) return false;

  // Only write if the repair actually produces parseable frontmatter.
  try {
    const data = yaml.load(repaired);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  } catch {
    return false;
  }

  const updated = result.content.replace(FRONTMATTER_RE, () => `---\n${repaired}\n---`);
  fs.writeFileSync(result.file, updated, 'utf8');
  return true;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const asJson = args.includes('--json');
  const explicit = args.filter((a) => !a.startsWith('--'));

  const files = explicit.length
    ? explicit
        .map((f) => path.resolve(f))
        .filter((f) => fs.existsSync(f) && f.endsWith('.md') && !isDocumentationFile(f))
    : discoverComponents();

  if (!files.length) {
    if (!asJson) console.log('No component files to validate.');
    process.exit(0);
  }

  let results = files.map(validate);

  let fixed = 0;
  if (fix) {
    for (const result of results) {
      if (result.issues.some((i) => i.fixable) && applyFix(result)) fixed += 1;
    }
    results = files.map(validate); // re-validate after repair
  }

  const failing = results.filter((r) => r.issues.length);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          summary: { total: results.length, passed: results.length - failing.length, failed: failing.length, fixed },
          failures: failing.map((r) => ({
            file: path.relative(process.cwd(), r.file),
            issues: r.issues.map(({ code, message }) => ({ code, message })),
          })),
        },
        null,
        2
      )
    );
    process.exit(failing.length ? 1 : 0);
  }

  for (const result of failing) {
    console.log(`\n✖ ${path.relative(process.cwd(), result.file)}`);
    for (const issue of result.issues) {
      console.log(`    ${issue.code}: ${issue.message}`);
    }
  }

  console.log(
    `\n${results.length - failing.length}/${results.length} component files have valid frontmatter.`
  );
  if (fix) console.log(`${fixed} file(s) repaired.`);
  if (failing.length) {
    console.log(
      `\n${failing.length} file(s) need attention. Run \`npm run frontmatter:fix\` to repair the mechanical cases.`
    );
  }

  process.exit(failing.length ? 1 : 0);
}

if (require.main === module) main();

module.exports = { validate, repair, needsQuoting, normaliseModel, isValidModel, isDocumentationFile, MODEL_ALIASES };
