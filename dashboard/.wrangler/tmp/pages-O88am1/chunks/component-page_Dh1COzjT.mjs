globalThis.process ??= {}; globalThis.process.env ??= {};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatDate(iso) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}
function initials(name) {
  const words = name.replace(/\[bot\]$/, "").split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}
function commitTitle(subject) {
  return subject.replace(/\s*\(#\d+\)\s*$/, "");
}
function formatCount(n, one, many) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
const PLUGIN_KINDS = [
  { key: "skills", label: "Skills", one: "skill", many: "skills" },
  { key: "commands", label: "Commands", one: "command", many: "commands" },
  { key: "agents", label: "Agents", one: "agent", many: "agents" },
  { key: "hooks", label: "Hooks", one: "hook event", many: "hook events" },
  { key: "mcpServers", label: "MCP servers", one: "MCP server", many: "MCP servers" },
  { key: "lspServers", label: "LSP servers", one: "LSP server", many: "LSP servers" },
  { key: "outputStyles", label: "Output styles", one: "output style", many: "output styles" },
  { key: "themes", label: "Themes", one: "theme", many: "themes" },
  { key: "monitors", label: "Monitors", one: "monitor", many: "monitors" },
  { key: "bin", label: "Executables", one: "executable", many: "executables" }
];
function pluginContentsSummary(contains) {
  return PLUGIN_KINDS.filter(({ key: key2 }) => (contains?.[key2]?.length ?? 0) > 0).map(({ key: key2, one, many }) => formatCount(contains[key2].length, one, many)).join(", ");
}
function totals(files) {
  return files.reduce(
    (t, f) => ({ files: t.files + 1, lines: t.lines + (f.lines ?? 0), bytes: t.bytes + f.bytes }),
    { files: 0, lines: 0, bytes: 0 }
  );
}
function topLevelEntries(files) {
  const byName = /* @__PURE__ */ new Map();
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const slash = f.path.indexOf("/");
    const name = slash === -1 ? f.path : f.path.slice(0, slash);
    const kind = slash === -1 ? "file" : "dir";
    const entry = byName.get(name) ?? { name, kind, files: 0, lines: 0, bytes: 0, firstFile: f.path };
    entry.files += 1;
    entry.lines += f.lines ?? 0;
    entry.bytes += f.bytes;
    byName.set(name, entry);
  }
  const cmp = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  const all = [...byName.values()];
  return [...all.filter((e) => e.kind === "dir").sort(cmp), ...all.filter((e) => e.kind === "file").sort(cmp)];
}
function languageShares(languages, max = 4) {
  const total = languages.reduce((s, l) => s + l.bytes, 0);
  if (!total) return [];
  const sorted = [...languages].sort((a, b) => b.bytes - a.bytes);
  const head = sorted.slice(0, max);
  const tail = sorted.slice(max).reduce((s, l) => s + l.bytes, 0);
  const rows = head.map((l) => ({ name: l.name, bytes: l.bytes }));
  if (tail) {
    const other = rows.find((r) => r.name === "Other");
    if (other) other.bytes += tail;
    else rows.push({ name: "Other", bytes: tail });
  }
  return rows.map((r) => ({ name: r.name, pct: Math.round(r.bytes / total * 1e3) / 10 }));
}
const WORD_SPELLING = {
  ai: "AI",
  api: "API",
  cc: "CC",
  apis: "APIs",
  aws: "AWS",
  ci: "CI",
  cd: "CD",
  cli: "CLI",
  cms: "CMS",
  css: "CSS",
  db: "DB",
  dns: "DNS",
  e2e: "E2E",
  gcp: "GCP",
  gpu: "GPU",
  graphql: "GraphQL",
  github: "GitHub",
  gitlab: "GitLab",
  html: "HTML",
  http: "HTTP",
  https: "HTTPS",
  ios: "iOS",
  javascript: "JavaScript",
  jwt: "JWT",
  k8s: "K8s",
  llm: "LLM",
  llms: "LLMs",
  macos: "macOS",
  mcp: "MCP",
  ml: "ML",
  mysql: "MySQL",
  nextjs: "Next.js",
  nodejs: "Node.js",
  npm: "npm",
  oauth: "OAuth",
  openai: "OpenAI",
  pdf: "PDF",
  php: "PHP",
  postgresql: "PostgreSQL",
  pr: "PR",
  prs: "PRs",
  qa: "QA",
  rag: "RAG",
  rest: "REST",
  sdk: "SDK",
  seo: "SEO",
  sql: "SQL",
  ssh: "SSH",
  svg: "SVG",
  tdd: "TDD",
  typescript: "TypeScript",
  ui: "UI",
  url: "URL",
  ux: "UX",
  vscode: "VS Code",
  xml: "XML",
  yaml: "YAML"
};
function displayName(name) {
  return (name ?? "").replace(/\.(md|json)$/, "").split(/[-_\s]+/).filter(Boolean).map((w) => WORD_SPELLING[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
const key = (c) => (c.path ?? c.name).replace(/\.(md|json)$/, "");
function nextStepItems(current, siblings, loops, max = 6) {
  const items = loops.slice(0, max).map((component) => ({ component, block: "loop" }));
  const sameCategory = siblings.filter((c) => (c.category ?? "") === (current.category ?? "") && key(c) !== key(current)).sort((a, b) => a.name.localeCompare(b.name, "en") || key(a).localeCompare(key(b), "en"));
  const start = sameCategory.findIndex((c) => c.name.localeCompare(current.name, "en") > 0);
  const rotated = start <= 0 ? sameCategory : [...sameCategory.slice(start), ...sameCategory.slice(0, start)];
  for (const component of rotated) {
    if (items.length >= max) break;
    items.push({ component, block: "same_category" });
  }
  return items;
}

export { PLUGIN_KINDS as P, topLevelEntries as a, formatBytes as b, formatDate as c, displayName as d, commitTitle as e, formatCount as f, initials as i, languageShares as l, nextStepItems as n, pluginContentsSummary as p, totals as t };
