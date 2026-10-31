// router.json edits the pane writes: the rewrite, its validation and what Undo restores. Pure: the hook reads and
// writes the file.
import { loadConfig } from './config.mjs';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// The router.json text after `change(previousFile)` and the config it loads, from the file's text or null when there
// is none. Throws when the old text is not JSON or the result does not validate.
export function rewrittenConfig(text, change) {
  const file = change(text === null ? {} : JSON.parse(text));
  return { config: loadConfig({ userFile: file }), text: `${JSON.stringify(file, null, 2)}\n` };
}

// The pane line for a write that failed.
export function notSaved(error) {
  // A JSON parse message quotes the file; the loadConfig messages name the setting only.
  const reason = error instanceof SyntaxError ? 'router.json is not valid JSON' : error.message;
  return `Not saved: ${reason}. router.json is unchanged.`;
}

// The leaves where router.json `after` differs from `before`, each with its value in `before`, or no `value` where it
// had none. An object present on one side only is walked as empty on the other, so a sibling stays out of it.
export function changedLeaves(before, after, path = []) {
  const out = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const [a, b] = [before[key], after[key]];
    if ((isRecord(a) || a === undefined) && (isRecord(b) || b === undefined) && (isRecord(a) || isRecord(b)))
      out.push(...changedLeaves(a ?? {}, b ?? {}, [...path, key]));
    else if (JSON.stringify(a) !== JSON.stringify(b))
      out.push(Object.hasOwn(before, key) ? { path: [...path, key], value: a } : { path: [...path, key] });
  }
  return out;
}

// The router.json `file` with each leaf of one pane write put back as it was before it: a value written again
// verbatim, a leaf that was absent deleted along with any object that leaves empty. Leaves the write did not touch,
// such as an edit made on disk since, stay as they are.
export function restored(file, leaves) {
  const next = structuredClone(file);
  for (const { path, ...leaf } of leaves) {
    const parents = path.slice(0, -1);
    const key = path.at(-1);
    if (Object.hasOwn(leaf, 'value')) {
      let node = next;
      for (const name of parents) {
        if (!isRecord(node[name])) node[name] = {};
        node = node[name];
      }
      node[key] = leaf.value;
      continue;
    }
    const chain = [next];
    for (const name of parents) {
      if (!isRecord(chain.at(-1)[name])) break;
      chain.push(chain.at(-1)[name]);
    }
    if (chain.length !== path.length) continue;
    delete chain.at(-1)[key];
    for (let i = chain.length - 1; i > 0 && !Object.keys(chain[i]).length; i -= 1) delete chain[i - 1][path[i - 1]];
  }
  return next;
}
