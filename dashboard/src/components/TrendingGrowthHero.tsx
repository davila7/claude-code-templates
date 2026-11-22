import TrendingShareMenu from './TrendingShareMenu';
import { type InstallersBlock, formatNumber, pctChange } from '../lib/trending-share';

interface Props {
  installers: InstallersBlock;
  weeklyDownloads: number;
  totalCountries: number;
  shareUrl: string;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function TrendingGrowthHero({ installers, weeklyDownloads, totalCountries, shareUrl }: Props) {
  const monthly = installers.monthly;
  const first = monthly[0];
  const last = monthly[monthly.length - 1];
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
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl px-5 py-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="text-[36px] leading-none font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">
            {installers.total.toLocaleString('en-US')}
          </div>
          <div className="text-[13px] text-[var(--color-text-secondary)]">
            unique installers since {first ? monthLabel(first.month) : 'launch'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {last && (
            <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full border border-[var(--color-accent)]/40 text-[var(--color-accent)]">
              +{last.new.toLocaleString('en-US')} new in {monthLabel(last.month).split(' ')[0]}
            </span>
          )}
          <TrendingShareMenu
            source="trending"
            label="Share these numbers"
            url={shareUrl}
            text={`Claude Code Templates: ${installers.total.toLocaleString('en-US')} unique installers so far, ${installers.activeWeek.toLocaleString('en-US')} in the last 7 days.`}
          />
        </div>
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
