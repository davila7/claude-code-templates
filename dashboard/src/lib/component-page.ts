// Formatting for the component page's file list, About column and language bar.
// Pure functions over the `meta` block written by scripts/generate_components_json.py.

export interface MetaFile {
  path: string;
  bytes: number;
  lines: number | null;
}

export interface FileEntry {
  name: string;
  kind: 'dir' | 'file';
  files: number;
  lines: number;
  bytes: number;
  /** The file to open in the explorer when the row is picked. */
  firstFile: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "Oct 30, 2026", read from the date the commit carries (the author's day, not the server's). */
export function formatDate(iso: string | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function initials(name: string): string {
  const words = name.replace(/\[bot\]$/, '').split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}

/** Commit subject without the trailing "(#1234)" GitHub adds on squash merges. */
export function commitTitle(subject: string): string {
  return subject.replace(/\s*\(#\d+\)\s*$/, '');
}

export function formatCount(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

export function totals(files: MetaFile[]): { files: number; lines: number; bytes: number } {
  return files.reduce(
    (t, f) => ({ files: t.files + 1, lines: t.lines + (f.lines ?? 0), bytes: t.bytes + f.bytes }),
    { files: 0, lines: 0, bytes: 0 },
  );
}

/** Top-level rows like a GitHub tree: folders first, then files, each alphabetical. */
export function topLevelEntries(files: MetaFile[]): FileEntry[] {
  const byName = new Map<string, FileEntry>();
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const slash = f.path.indexOf('/');
    const name = slash === -1 ? f.path : f.path.slice(0, slash);
    const kind = slash === -1 ? 'file' : 'dir';
    const entry = byName.get(name) ?? { name, kind, files: 0, lines: 0, bytes: 0, firstFile: f.path };
    entry.files += 1;
    entry.lines += f.lines ?? 0;
    entry.bytes += f.bytes;
    byName.set(name, entry);
  }
  const cmp = (a: FileEntry, b: FileEntry) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  const all = [...byName.values()];
  return [...all.filter((e) => e.kind === 'dir').sort(cmp), ...all.filter((e) => e.kind === 'file').sort(cmp)];
}

/** Language shares in percent with one decimal, largest first; the tail past `max` becomes "Other". */
export function languageShares(languages: { name: string; bytes: number }[], max = 4): { name: string; pct: number }[] {
  const total = languages.reduce((s, l) => s + l.bytes, 0);
  if (!total) return [];
  const sorted = [...languages].sort((a, b) => b.bytes - a.bytes);
  const head = sorted.slice(0, max);
  const tail = sorted.slice(max).reduce((s, l) => s + l.bytes, 0);
  const rows = head.map((l) => ({ name: l.name, bytes: l.bytes }));
  if (tail) {
    const other = rows.find((r) => r.name === 'Other');
    if (other) other.bytes += tail;
    else rows.push({ name: 'Other', bytes: tail });
  }
  return rows.map((r) => ({ name: r.name, pct: Math.round((r.bytes / total) * 1000) / 10 }));
}
