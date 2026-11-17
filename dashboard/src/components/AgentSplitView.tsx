// "Agents vs humans" tab of /trending. Reads trending-data.json's clientSplit,
// built by scripts/generate_trending_data.py from the client_* columns that
// CLI >= 1.32.0 reports (cli-tool/src/agent-detection.js). Display only.

export interface ClientSplit {
  since: string | null;
  totals: { agent: number; human: number; nonInteractive: number; unknown: number };
  agents: { name: string; downloads: number }[];
  entrypoints: { name: string; downloads: number }[];
  daily: {
    dates: string[];
    agent: number[];
    human: number[];
    nonInteractive: number[];
    unknown: number[];
  };
}

type Kind = 'agent' | 'human' | 'nonInteractive';

const KINDS: { key: Kind; label: string; hint: string; color: string }[] = [
  { key: 'agent', label: 'AI agents', hint: 'Run from Claude Code, Cursor, Codex and other agents', color: 'var(--color-accent)' },
  { key: 'human', label: 'People', hint: 'Typed in an interactive terminal', color: 'var(--color-primary-400)' },
  { key: 'nonInteractive', label: 'Scripts', hint: 'No terminal and no agent: CI-like scripts, pipes', color: 'var(--color-text-tertiary)' },
];

const AGENT_NAMES: Record<string, string> = {
  claude: 'Claude Code',
  cowork: 'Claude Cowork',
  cursor: 'Cursor',
  'cursor-cli': 'Cursor CLI',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  'github-copilot': 'GitHub Copilot',
  opencode: 'OpenCode',
  'augment-cli': 'Augment',
  antigravity: 'Antigravity',
  devin: 'Devin',
  replit: 'Replit',
  v0: 'v0',
  other: 'Other',
};

function pct(n: number, total: number): string {
  if (!total) return '0%';
  const p = (n / total) * 100;
  return (p < 10 ? p.toFixed(1) : Math.round(p).toString()) + '%';
}

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function BarList({ title, rows, total, names }: {
  title: string;
  rows: { name: string; downloads: number }[];
  total: number;
  names?: Record<string, string>;
}) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="text-[12px] text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider mb-3">{title}</div>
      {rows.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-tertiary)]">No data yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[13px] text-[var(--color-text-primary)] truncate">{names?.[r.name] ?? r.name}</span>
                <span className="text-[12px] text-[var(--color-text-tertiary)] tabular-nums shrink-0">
                  {r.downloads.toLocaleString('en-US')} · {pct(r.downloads, total)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: pct(r.downloads, total) }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AgentSplitView({ split }: { split?: ClientSplit }) {
  if (!split || !split.since) {
    return (
      <div className="px-6 py-16 text-center max-w-md mx-auto">
        <p className="text-[14px] text-[var(--color-text-primary)] font-medium mb-2">Collecting data</p>
        <p className="text-[12px] text-[var(--color-text-tertiary)] leading-relaxed">
          Installs made with CLI 1.32.0 or newer report whether an AI agent or a person ran them.
          This view fills in as those installs arrive; the data refreshes once a day.
        </p>
      </div>
    );
  }

  const { totals, daily } = split;
  const reported = totals.agent + totals.human + totals.nonInteractive;
  const start = Math.max(0, daily.dates.indexOf(split.since));
  const days = daily.dates.slice(start).map((date, i) => {
    const j = start + i;
    return { date, agent: daily.agent[j], human: daily.human[j], nonInteractive: daily.nonInteractive[j], unknown: daily.unknown[j] };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.agent + d.human + d.nonInteractive));

  return (
    <div className="px-6 pb-8 flex flex-col gap-4">
      <p className="text-[12px] text-[var(--color-text-tertiary)]">
        Installs from CLI 1.32.0+ since {shortDate(split.since)} ({reported.toLocaleString('en-US')} installs).{' '}
        {totals.unknown.toLocaleString('en-US')} installs from older CLI versions in the same window don't report and are left out.
      </p>

      {/* Share cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {KINDS.map((k) => (
          <div key={k.key} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-4 py-3.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: k.color }} />
              <span className="text-[12px] text-[var(--color-text-secondary)] font-medium">{k.label}</span>
            </div>
            <div className="text-[22px] font-bold text-[var(--color-text-primary)] tabular-nums leading-none mb-1.5">
              {pct(totals[k.key], reported)}
            </div>
            <div className="text-[11px] text-[var(--color-text-tertiary)]">
              {totals[k.key].toLocaleString('en-US')} installs · {k.hint}
            </div>
          </div>
        ))}
      </div>

      {/* Daily stacked bars */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
        <div className="text-[12px] text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider mb-3">Installs per day</div>
        <div className="flex items-end gap-1 h-40" role="img" aria-label="Installs per day by who ran the CLI">
          {days.map((d) => {
            const total = d.agent + d.human + d.nonInteractive;
            return (
              <div
                key={d.date}
                className="flex-1 min-w-0 max-w-[48px] h-full flex flex-col justify-end"
                title={`${shortDate(d.date)}: ${d.agent} agents, ${d.human} people, ${d.nonInteractive} scripts`}
              >
                <div className="flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: `${(total / maxDay) * 100}%` }}>
                  {KINDS.map((k) => (
                    <div key={k.key} style={{ background: k.color, height: total ? `${(d[k.key] / total) * 100}%` : 0 }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
          <span>{shortDate(days[0].date)}</span>
          {days.length > 1 && <span>{shortDate(days[days.length - 1].date)}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BarList title="Which agent" rows={split.agents} total={totals.agent} names={AGENT_NAMES} />
        <BarList title="Claude Code entrypoint" rows={split.entrypoints} total={totals.agent} />
      </div>

      <p className="text-[11px] text-[var(--color-text-tertiary)] leading-relaxed">
        Self-reported by the CLI from environment variables, so it can be spoofed. A command a person types inside an
        agent counts as the agent, and an agent install usually still means a person asked for it. Runs with CI=true are
        not tracked at all.
      </p>
    </div>
  );
}
