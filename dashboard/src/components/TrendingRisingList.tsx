import TypeIcon from './TypeIcon';
import TrendingShareMenu from './TrendingShareMenu';
import { TYPE_CONFIG } from '../lib/icons';
import { type RisingItem, formatName, pctChange, safePath, sharePath, shareText } from '../lib/trending-share';

interface Props {
  items: RisingItem[];
  origin: string;
}

export default function TrendingRisingList({ items, origin }: Props) {
  const max = Math.max(...items.map((i) => i.installersWeek), 1);
  return (
    <section className="px-6 pb-6" aria-labelledby="rising-title">
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 id="rising-title" className="text-[12px] text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">Rising this week</h2>
          <span className="text-[11px] text-[var(--color-text-tertiary)]">Unique installers, last 7 days vs the 7 before</span>
        </div>
        <ol className="grid gap-2.5 list-none m-0 p-0">
          {items.map((item, i) => {
            const path = safePath(item.path);
            if (!path) return null;
            const change = pctChange(item.installersWeek, item.installersPrevWeek);
            const color = TYPE_CONFIG[item.type]?.color;
            const entry = {
              type: item.type, path, name: item.name, category: item.category,
              headline: `#${i + 1} rising this week`,
              installersWeek: item.installersWeek, installersPrevWeek: item.installersPrevWeek,
              downloadsTotal: item.downloadsTotal,
            };
            return (
              <li key={`${item.type}/${path}`} className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)_4.5rem_2rem] max-md:grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color ? `${color}15` : 'rgba(115,115,115,0.15)', color: color ?? 'var(--color-text-tertiary)' }}>
                    <TypeIcon type={item.type} size={14} />
                  </span>
                  <div className="min-w-0">
                    <a href={`/component/${item.type}/${path}`} className="block text-[13px] font-medium text-[var(--color-text-primary)] truncate hover:text-[var(--color-accent)]">
                      {formatName(item.name)}
                    </a>
                    <span className="block text-[10px] text-[var(--color-text-tertiary)] truncate">{item.category}</span>
                  </div>
                </div>
                <div className="grid gap-1 min-w-0 max-md:col-span-full max-md:order-last">
                  <div className="h-1.5 rounded-full bg-[var(--color-surface-3)]" style={{ width: `${Math.max(2, (item.installersPrevWeek / max) * 100)}%` }} />
                  <div className="h-1.5 rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.max(2, (item.installersWeek / max) * 100)}%` }} />
                  <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                    {item.installersPrevWeek.toLocaleString('en-US')} → {item.installersWeek.toLocaleString('en-US')} installers
                  </span>
                </div>
                <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full border border-current stat-today-active whitespace-nowrap text-center">
                  {change === null ? 'New' : `+${change}%`}
                </span>
                <TrendingShareMenu compact source="trending" url={`${origin}${sharePath(item.type, path)}`} text={shareText(entry)} component={{ type: item.type, path }} />
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
