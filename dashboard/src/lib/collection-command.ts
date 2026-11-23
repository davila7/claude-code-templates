// "Install All" for a collection, on My Components and on the shared /c/<slug>
// page. A collection item keeps the catalog's own type ("agent", "mod",
// "loop", ...) and path (agents, hooks... with .md/.json), as the Save button
// sends them.

import { pluralType } from './component-url.ts';
import { TYPE_CONFIG } from './icons.ts';

export interface CollectionCommandItem { component_type: string; component_path: string }

// The CLI flag of each type. Retired templates keep the flag they had here.
const FLAGS = new Map<string, string>([
  ...Object.entries(TYPE_CONFIG).map(([type, config]): [string, string] => [type, config.flag]),
  ['templates', '--template'],
]);

// The plural type of a collection item. "function-hook" was renamed to "mod"
// with the same slugs, and collections saved before the rename still hold it.
export function collectionItemType(type: string): string {
  const plural = pluralType(type);
  return plural === 'function-hooks' ? 'mods' : plural;
}

function installPath(path: string): string {
  return String(path ?? '').replace(/^cli-tool\/components\/[^/]+\//, '').replace(/\.(md|json)$/, '');
}

// One flag per type, in the order each type first appears; paths keep their
// order. Types the CLI cannot install (a sandbox, say) are left out.
export function collectionInstallCommand(items: CollectionCommandItem[]): string {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const type = collectionItemType(item.component_type);
    if (!FLAGS.has(type)) continue;
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(installPath(item.component_path));
  }
  let cmd = 'npx claude-code-templates@latest';
  for (const [type, paths] of groups) cmd += ` ${FLAGS.get(type)} ${paths.join(',')}`;
  return cmd;
}
