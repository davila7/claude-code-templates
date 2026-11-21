import { useEffect, useMemo, useState } from 'react';
import { TYPE_CONFIG } from '../lib/icons';
import TypeIcon from './TypeIcon';
import { AGENT_NAMES } from './AgentSplitView';
import { componentPath } from '../lib/component-url';
import { formatName, formatNumber } from '../lib/trending-share';
import {
  LEADERBOARD_TYPES, INSTALL_BUCKETS,
  type LeaderboardLists, type LeaderboardType, type RankedEntry,
  rankList, topByCategory, typeStats, bucketCounts, matchesQuery, isLeaderboardType,
} from '../lib/leaderboard';

export interface HarnessSplit {
  since: string | null;
  agents: { name: string; downloads: number }[];
}

interface Props {
  lists: LeaderboardLists;
  /** "type/path" keys of the components rising this week (trending-data.json). */
  rising: string[];
  harness: HarnessSplit | null;
  lastUpdated: string | null;
}

type Tab = 'overview' | LeaderboardType;

const PAGE = 50;
const CATEGORY_PREVIEW = 9;

function medal(rank: number): string {
  if (rank === 1) return 'medal-gold';
  if (rank === 2) return 'medal-silver';
  if (rank === 3) return 'medal-bronze';
  return 'medal-default';
}

function pct(v: number): string {
  const p = v * 100;
  return (p > 0 && p < 10 ? p.toFixed(1) : Math.round(p).toString()) + '%';
}

function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso.replace(/\+00:00Z$/, 'Z'));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function RisingTag() {
  return (
    <a href="/trending" className="hot-badge shrink-0" title="Rising this week on /trending">
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
      Rising
    </a>
  );
}

/** One compact "1  Name  12.3k" row, used by the overview and category cards. */
function MiniRow({ type, e, rising }: { type: LeaderboardType; e: RankedEntry; rising: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2 border-t border-[var(--color-border)] first:border-t-0">
      <span className="w-5 text-right font-ui-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)] shrink-0">{e.rank}</span>
      <a
        href={componentPath(type, e.path)}
        className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
        title={e.path}
      >
        {formatName(e.name)}
      </a>
      {rising && <RisingTag />}
      <span className="font-ui-mono text-[12px] font-semibold tabular-nums text-[var(--color-text-primary)] shrink-0" title={`${e.installs.toLocaleString('en-US')} installs`}>
        {formatNumber(e.installs)}
      </span>
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="font-ui-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">{children}</h3>;
}

function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color ?? 'var(--color-accent)' }} />
    </div>
  );
}

export default function LeaderboardView({ lists, rising, harness, lastUpdated }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [allCategories, setAllCategories] = useState(false);

  // Follow the URL fragment on load and on back/forward or an in-page #type link.
  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.slice(1);
      setTab(isLeaderboardType(h) ? h : 'overview');
      setQuery('');
      setCategory('');
      setShown(PAGE);
      setAllCategories(false);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const select = (next: Tab) => {
    setTab(next);
    setQuery('');
    setCategory('');
    setShown(PAGE);
    setAllCategories(false);
    history.replaceState(null, '', next === 'overview' ? window.location.pathname : `#${next}`);
  };

  const risingSet = useMemo(() => new Set(rising), [rising]);
  const ranked = useMemo(() => {
    const out = {} as Record<LeaderboardType, RankedEntry[]>;
    for (const t of LEADERBOARD_TYPES) out[t] = rankList(lists[t] ?? []);
    return out;
  }, [lists]);
  const stats = useMemo(() => {
    const out = {} as Record<LeaderboardType, ReturnType<typeof typeStats>>;
    for (const t of LEADERBOARD_TYPES) out[t] = typeStats(lists[t] ?? []);
    return out;
  }, [lists]);

  const totalComponents = LEADERBOARD_TYPES.reduce((s, t) => s + stats[t].components, 0);
  const totalInstalls = LEADERBOARD_TYPES.reduce((s, t) => s + stats[t].installs, 0);

  return (
    <div className="pb-10">
      {/* Header */}
      <header className="px-4 sm:px-6 pt-6 pb-5">
        <h1 className="text-[22px] font-semibold text-[var(--color-text-primary)]">Harness Components Leaderboard</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--color-text-secondary)] antialiased">
          {totalComponents.toLocaleString('en-US')} components for Claude Code and other agent harnesses (Codex, OpenCode, Cursor…),
          ranked by how many times developers installed them with the CLI. The order comes only from install counts: sponsored placements never change it.
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-[11px] text-[var(--color-text-tertiary)]">Components ranked</dt>
            <dd className="font-ui-mono text-[18px] font-semibold tabular-nums text-[var(--color-text-primary)]">{totalComponents.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--color-text-tertiary)]">Installs counted</dt>
            <dd className="font-ui-mono text-[18px] font-semibold tabular-nums text-[var(--color-text-primary)]">{totalInstalls.toLocaleString('en-US')}</dd>
          </div>
          {lastUpdated && (
            <div>
              <dt className="text-[11px] text-[var(--color-text-tertiary)]">Updated</dt>
              <dd className="font-ui-mono text-[18px] font-semibold text-[var(--color-text-primary)]">{shortDate(lastUpdated)}</dd>
            </div>
          )}
        </dl>
      </header>

      {/* Tabs */}
      <nav className="px-4 sm:px-6 border-b border-[var(--color-border)]" aria-label="Leaderboard type">
        <div className="flex gap-1 overflow-x-auto -mb-px" role="tablist">
          {(['overview', ...LEADERBOARD_TYPES] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => select(t)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] border-b-2 transition-colors ${
                  active
                    ? 'border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {t !== 'overview' && (
                  <span style={{ color: TYPE_CONFIG[t]?.color }}><TypeIcon type={t} size={14} /></span>
                )}
                {t === 'overview' ? 'Overview' : TYPE_CONFIG[t]?.label ?? t}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === 'overview' ? (
        <Overview ranked={ranked} stats={stats} lists={lists} risingSet={risingSet} harness={harness} onSelect={select} />
      ) : (
        <TypeBoard
          type={tab}
          ranked={ranked[tab]}
          stats={stats[tab]}
          risingSet={risingSet}
          query={query}
          setQuery={(q) => { setQuery(q); setShown(PAGE); }}
          category={category}
          setCategory={(c) => { setCategory(c); setShown(PAGE); }}
          shown={shown}
          showMore={() => setShown((n) => n + PAGE)}
          allCategories={allCategories}
          toggleCategories={() => setAllCategories((v) => !v)}
        />
      )}

      <Methodology />
    </div>
  );
}

function Overview({ ranked, stats, lists, risingSet, harness, onSelect }: {
  ranked: Record<LeaderboardType, RankedEntry[]>;
  stats: Record<LeaderboardType, ReturnType<typeof typeStats>>;
  lists: LeaderboardLists;
  risingSet: Set<string>;
  harness: HarnessSplit | null;
  onSelect: (t: Tab) => void;
}) {
  const maxTypeInstalls = Math.max(...LEADERBOARD_TYPES.map((t) => stats[t].installs));
  const totalInstalls = LEADERBOARD_TYPES.reduce((s, t) => s + stats[t].installs, 0);
  const buckets = bucketCounts(LEADERBOARD_TYPES.map((t) => lists[t] ?? []));
  const maxBucket = Math.max(...buckets);
  const totalComponents = buckets.reduce((s, n) => s + n, 0);
  const harnessRows = (harness?.agents ?? []).filter((a) => a.downloads > 0);
  const harnessTotal = harnessRows.reduce((s, a) => s + a.downloads, 0);
  const harnessMax = Math.max(0, ...harnessRows.map((a) => a.downloads));

  return (
    <>
      <section className="px-4 sm:px-6 pt-6">
        <div className="grid gap-x-8 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
          {LEADERBOARD_TYPES.map((t) => (
            <div key={t} className="min-w-0">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-border)]">
                <SectionLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <span style={{ color: TYPE_CONFIG[t]?.color }}><TypeIcon type={t} size={13} /></span>
                    Top {TYPE_CONFIG[t]?.label}
                  </span>
                </SectionLabel>
                <span className="font-ui-mono text-[11px] text-[var(--color-text-tertiary)]">{stats[t].components}</span>
              </div>
              <ol>
                {ranked[t].slice(0, 5).map((e) => (
                  <MiniRow key={e.path} type={t} e={e} rising={risingSet.has(`${t}/${e.path}`)} />
                ))}
              </ol>
              <button
                type="button"
                onClick={() => onSelect(t)}
                className="mt-1 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
              >
                Full {TYPE_CONFIG[t]?.label} ranking →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Statistics */}
      <section className="px-4 sm:px-6 pt-12">
        <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)]">Statistics</h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)] antialiased">
          How installs spread across the catalog.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <SectionLabel>Installs by type</SectionLabel>
            <ul className="mt-3 space-y-3">
              {[...LEADERBOARD_TYPES].sort((a, b) => stats[b].installs - stats[a].installs).map((t) => (
                <li key={t}>
                  <div className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="text-[var(--color-text-primary)]">{TYPE_CONFIG[t]?.label}</span>
                    <span className="font-ui-mono tabular-nums text-[var(--color-text-secondary)]">
                      {formatNumber(stats[t].installs)} · {pct(totalInstalls ? stats[t].installs / totalInstalls : 0)}
                    </span>
                  </div>
                  <div className="mt-1"><Bar value={stats[t].installs} max={maxTypeInstalls} color={TYPE_CONFIG[t]?.color} /></div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <SectionLabel>Installs per component</SectionLabel>
            <div className="mt-4 flex items-end gap-2 h-32" role="img" aria-label="Number of components in each install range">
              {buckets.map((n, i) => (
                <div key={INSTALL_BUCKETS[i].label} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="font-ui-mono text-[11px] tabular-nums text-[var(--color-text-secondary)] mb-1">{n}</span>
                  <div className="w-full rounded-t bg-[var(--color-accent)]/70" style={{ height: `${maxBucket ? Math.max(3, (n / maxBucket) * 100) : 0}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2">
              {INSTALL_BUCKETS.map((b) => (
                <span key={b.label} className="flex-1 text-center font-ui-mono text-[10px] text-[var(--color-text-tertiary)]">{b.label}</span>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-[var(--color-text-secondary)] antialiased">
              {pct(totalComponents ? (buckets[3] + buckets[4]) / totalComponents : 0)} of components have 1,000 installs or more.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <SectionLabel>Installs by agent</SectionLabel>
            {harnessRows.length > 0 ? (
              <>
                <ul className="mt-3 space-y-3">
                  {harnessRows.slice(0, 7).map((a) => (
                    <li key={a.name}>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="text-[var(--color-text-primary)]">{AGENT_NAMES[a.name] ?? formatName(a.name)}</span>
                        <span className="font-ui-mono tabular-nums text-[var(--color-text-secondary)]">{pct(a.downloads / harnessTotal)}</span>
                      </div>
                      <div className="mt-1"><Bar value={a.downloads} max={harnessMax} /></div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12px] text-[var(--color-text-secondary)] antialiased">
                  Installs run by an AI agent{harness?.since ? ` since ${shortDate(harness.since)}` : ''}, by the agent that ran them.{' '}
                  <a href="/trending#agents" className="underline hover:text-[var(--color-text-primary)]">Agents vs people</a>
                </p>
              </>
            ) : (
              <p className="mt-3 text-[12px] text-[var(--color-text-secondary)]">No agent data yet.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function TypeBoard(props: {
  type: LeaderboardType;
  ranked: RankedEntry[];
  stats: ReturnType<typeof typeStats>;
  risingSet: Set<string>;
  query: string;
  setQuery: (q: string) => void;
  category: string;
  setCategory: (c: string) => void;
  shown: number;
  showMore: () => void;
  allCategories: boolean;
  toggleCategories: () => void;
}) {
  const { type, ranked, stats, risingSet, query, setQuery, category, setCategory, shown, showMore, allCategories, toggleCategories } = props;
  const label = TYPE_CONFIG[type]?.label ?? type;
  const blocks = useMemo(() => topByCategory(ranked, 5), [ranked]);
  const categories = useMemo(() => [...new Set(ranked.map((e) => e.category))].sort(), [ranked]);
  const filtered = useMemo(
    () => ranked.filter((e) => (!category || e.category === category) && matchesQuery(e, query)),
    [ranked, category, query]
  );
  const top = ranked[0]?.installs ?? 0;
  const visibleBlocks = allCategories ? blocks : blocks.slice(0, CATEGORY_PREVIEW);

  return (
    <>
      <section className="px-4 sm:px-6 pt-6">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { k: `${label} ranked`, v: stats.components.toLocaleString('en-US') },
            { k: 'Installs', v: stats.installs.toLocaleString('en-US') },
            { k: 'Median per component', v: stats.median.toLocaleString('en-US') },
            { k: 'Share of the top 10%', v: pct(stats.top10Share) },
          ].map((s) => (
            <div key={s.k} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2.5">
              <dt className="text-[11px] text-[var(--color-text-tertiary)]">{s.k}</dt>
              <dd className="font-ui-mono text-[16px] font-semibold tabular-nums text-[var(--color-text-primary)]">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="px-4 sm:px-6 pt-8">
        <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)]">Top {label} by category</h2>
        <div className="mt-4 grid gap-x-8 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
          {visibleBlocks.map((b) => (
            <div key={b.category} className="min-w-0">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-border)]">
                <SectionLabel>{formatName(b.category)}</SectionLabel>
                <span className="font-ui-mono text-[11px] text-[var(--color-text-tertiary)]" title={`${b.components} components, ${b.installs.toLocaleString('en-US')} installs`}>
                  {formatNumber(b.installs)}
                </span>
              </div>
              <ol>
                {b.top.map((e) => (
                  <MiniRow key={e.path} type={type} e={e} rising={risingSet.has(`${type}/${e.path}`)} />
                ))}
              </ol>
            </div>
          ))}
        </div>
        {blocks.length > CATEGORY_PREVIEW && (
          <button
            type="button"
            onClick={toggleCategories}
            className="mt-5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
          >
            {allCategories ? 'Show fewer categories' : `Show all ${blocks.length} categories`}
          </button>
        )}
      </section>

      <section className="px-4 sm:px-6 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)]">Full {label} ranking</h2>
          <div className="flex w-full sm:w-auto gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Find a ${TYPE_CONFIG[type]?.singular ?? 'component'}`}
              aria-label={`Search ${label}`}
              className="min-w-0 flex-1 sm:w-56 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] px-3 py-1.5 outline-none focus:border-[var(--color-accent)]/50"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Category"
              className="max-w-[45%] sm:max-w-none bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] px-2 py-1.5 outline-none cursor-pointer"
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{formatName(c)}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
          <div className="hidden sm:grid grid-cols-[56px_1fr_160px_88px] gap-3 px-4 py-2.5 bg-[var(--color-surface-2)] border-b border-[var(--color-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            <span>Rank</span>
            <span>{TYPE_CONFIG[type]?.singular ?? 'Component'}</span>
            <span>Category</span>
            <span className="text-right">Installs</span>
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--color-text-secondary)]">No {label.toLowerCase()} match this search.</p>
          ) : (
            <ol className="divide-y divide-[var(--color-border)]">
              {filtered.slice(0, shown).map((e) => (
                <li key={e.path} className="grid grid-cols-[40px_1fr_auto] sm:grid-cols-[56px_1fr_160px_88px] items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-2)] transition-colors">
                  <span className={`w-7 h-7 rounded-md flex items-center justify-center font-ui-mono text-[12px] font-bold tabular-nums ${medal(e.rank)}`}>{e.rank}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <a href={componentPath(type, e.path)} className="truncate text-[13px] font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors">
                        {formatName(e.name)}
                      </a>
                      {risingSet.has(`${type}/${e.path}`) && <RisingTag />}
                    </div>
                    <div className="mt-1 hidden sm:block max-w-[240px]"><Bar value={e.installs} max={top} color={TYPE_CONFIG[type]?.color} /></div>
                    <span className="sm:hidden text-[11px] text-[var(--color-text-tertiary)]">{formatName(e.category)}</span>
                  </div>
                  <span className="hidden sm:block truncate text-[12px] text-[var(--color-text-secondary)]">{formatName(e.category)}</span>
                  <span className="text-right font-ui-mono text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]" title={`${e.installs.toLocaleString('en-US')} installs`}>
                    {formatNumber(e.installs)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {filtered.length > shown && (
          <button
            type="button"
            onClick={showMore}
            className="mt-3 w-full rounded-lg border border-[var(--color-border)] py-2 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            Show {Math.min(PAGE, filtered.length - shown)} more of {filtered.length - shown}
          </button>
        )}
      </section>
    </>
  );
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What does the ranking count?',
    a: 'Every time someone installs a component with npx claude-code-templates, the CLI records one install for it. A component\'s number is its total installs since we started counting, so the list moves slowly. For what is growing right now, see Trending, which counts unique installers over the last 7 days.',
  },
  {
    q: 'Can a component pay to rank higher?',
    a: 'No. The order comes only from install counts. Sponsored placements appear elsewhere on the site, always labeled as sponsored, and never change this list, search results or category order.',
  },
  {
    q: 'Do security scans or compatibility checks change the order?',
    a: 'No. The SkillSpector scan and the agent compatibility check are shown on each component page to help you decide, but they are never used to sort or filter this list.',
  },
  {
    q: 'How often is it updated?',
    a: 'Install counts are refreshed every day and the page is rebuilt with them.',
  },
  {
    q: 'Why is a new component so low?',
    a: 'Totals favor components that have been in the catalog longer. New components show up on Trending first, marked Rising here when they grow fast in a week.',
  },
  {
    q: 'Which components are not listed?',
    a: 'Loops and plugins have their own pages and too few installs to rank yet. Retired project templates are not ranked.',
  },
];

function Methodology() {
  return (
    <section className="px-4 sm:px-6 pt-12">
      <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)]">How the leaderboard works</h2>
      <div className="mt-4 max-w-3xl divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {FAQ.map((f) => (
          <details key={f.q} className="group py-3">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-[14px] text-[var(--color-text-primary)]">
              {f.q}
              <span aria-hidden="true" className="text-[var(--color-text-tertiary)] transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)] antialiased">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
