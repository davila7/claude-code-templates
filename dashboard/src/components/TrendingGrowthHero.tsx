import TrendingShareMenu from './TrendingShareMenu';
import { type InstallersBlock, cumulativePoints, formatNumber, pctChange } from '../lib/trending-share';

interface Props {
  installers: InstallersBlock;
  weeklyDownloads: number;
  totalCountries: number;
  shareUrl: string;
}

const W = 560;
const H = 140;

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function TrendingGrowthHero({ installers, weeklyDownloads, totalCountries, shareUrl }: Props) {
  const monthly = installers.monthly;
  const first = monthly[0];
  const last = monthly[monthly.length - 1];
  const points = cumulativePoints(monthly, W, H);
  const lastPoint = points.split(' ').pop()?.split(',').map(Number) ?? [0, 0];
  const activeChange = pctChange(installers.activeWeek, installers.activePrevWeek);
  const returningPct = installers.activeWeek ? Math.round((installers.returningWeek / installers.activeWeek) * 100) : null;

  const tiles: { value: string; label: string; note?: string }[] = [
    {
      value: installers.activeWeek.toLocaleString('en-US'),
      label: 'Active installers, last 7 days',
      note: activeChange === null ? undefined : `${activeChange > 0 ? '+' : ''}${activeChange}% vs previous 7 days`,
    },
    { value: returningPct === null ? '—' : `${returningPct}%`, label: 'Came back after an earlier install' },
    { value: formatNumber(weeklyDownloads), label: 'Installs this week' },
    installers.addedThisMonth !== null
      ? { value: String(installers.addedThisMonth), label: 'Components added this month' }
      : { value: String(totalCountries), label: 'Countries' },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-center bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="text-[40px] leading-none font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">
            {installers.total.toLocaleString('en-US')}
          </div>
          <div className="text-[13px] text-[var(--color-text-secondary)]">
            unique installers since {first ? monthLabel(first.month) : 'launch'}
          </div>
          {last && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full border border-[var(--color-accent)]/40 text-[var(--color-accent)]">
                +{last.new.toLocaleString('en-US')} new in {monthLabel(last.month).split(' ')[0]}
              </span>
              <TrendingShareMenu
                source="trending"
                label="Share these numbers"
                url={shareUrl}
                text={`Claude Code Templates: ${installers.total.toLocaleString('en-US')} unique installers so far, ${installers.activeWeek.toLocaleString('en-US')} in the last 7 days.`}
              />
            </div>
          )}
        </div>
        <figure className="min-w-0 m-0">
          <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-auto" role="img"
            aria-label={`Unique installers, cumulative by month: ${first?.cumulative.toLocaleString('en-US')} in ${first ? monthLabel(first.month) : ''} to ${last?.cumulative.toLocaleString('en-US')} in ${last ? monthLabel(last.month) : ''}`}>
            <line x1="4" y1={H - 4} x2={W - 4} y2={H - 4} stroke="var(--color-border)" />
            <polygon points={`4,${H - 4} ${points} ${W - 4},${H - 4}`} fill="var(--color-accent)" fillOpacity="0.14" />
            <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
            <circle cx={lastPoint[0]} cy={lastPoint[1]} r="4" fill="var(--color-accent)" />
            {first && <text x="4" y={H + 14} fontSize="11" fill="var(--color-text-tertiary)">{monthLabel(first.month)}</text>}
            {last && <text x={W - 4} y={H + 14} fontSize="11" textAnchor="end" fill="var(--color-text-tertiary)">{monthLabel(last.month)}</text>}
          </svg>
        </figure>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-4 py-3.5">
            <div className="text-[22px] font-bold text-[var(--color-text-primary)] tabular-nums leading-none mb-1.5">{t.value}</div>
            <div className="text-[11px] text-[var(--color-text-tertiary)] font-medium">{t.label}</div>
            {t.note && <div className="text-[11px] text-[var(--color-text-secondary)] tabular-nums mt-1">{t.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
