import type { ScanSnippet, SkillSpectorFinding, SkillSpectorResult } from '../lib/types';
import { scanCategories, scanCategoryName } from '../lib/component-page';
import { ShieldCheckIcon } from './SkillSpectorBadge';
import { NvidiaMark } from './HarnessReport';

// SkillSpector report on the component page. Informative, not alarming: one
// accent color in shades, no severity labels or install verdicts (Daniel,
// 2026-10-21). A score ring and a bar of observations per category sit on
// top; each finding opens like an accordion to the lines it points at.
// Rendered on the server only (native <details>), so it ships no JavaScript.

interface Props {
  result: SkillSpectorResult;
  /** Code around each finding, aligned with result.findings (content file `scanSnippets`). */
  snippets?: (ScanSnippet | null)[];
  /** Component type: every type but skills and plugins is scanned inside a generated SKILL.md. */
  componentType?: string;
}

// Categories after the fourth share one "Other" segment so the bar stays readable.
const MAX_SEGMENTS = 4;
const SHADES = [100, 72, 50, 34, 20];

function shade(i: number): string {
  const pct = SHADES[Math.min(i, SHADES.length - 1)];
  return pct === 100
    ? 'var(--color-accent)'
    : `color-mix(in srgb, var(--color-accent) ${pct}%, var(--color-surface-3))`;
}

function ScoreRing({ score }: { score: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, score));
  return (
    <div className="relative w-[112px] h-[112px] shrink-0" role="img" aria-label={`Scanner score ${value} of 100`}>
      <svg viewBox="0 0 112 112" className="w-full h-full" aria-hidden="true">
        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="9" />
        {value > 0 && (
          <circle
            cx="56"
            cy="56"
            r={r}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - value / 100)}
            transform="rotate(-90 56 56)"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-[26px] leading-none font-semibold text-[var(--color-text-primary)]">{value}</span>
        <span className="mt-1 font-mono text-[10.5px] text-[var(--color-text-tertiary)]">of 100</span>
      </div>
    </div>
  );
}

function Snippet({
  finding,
  snippet,
  wrapped,
}: {
  finding: SkillSpectorFinding;
  snippet: ScanSnippet | null | undefined;
  wrapped: boolean;
}) {
  if (!snippet || !snippet.lines.length) {
    // A wrapped component's SKILL.md is the stub the scanner needs, not a file it ships.
    const aboutWhole = wrapped && finding.file === 'SKILL.md';
    return (
      <p className="px-4 py-3 text-[12.5px] text-[var(--color-text-tertiary)]">
        {aboutWhole
          ? 'No code excerpt: this observation is about the component as a whole, not one line.'
          : 'Code excerpt not available for this observation.'}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto bg-[var(--color-surface-0)]">
      <table className="w-full border-collapse font-mono text-[12px] leading-[1.65]">
        <tbody>
          {snippet.lines.map((text, i) => {
            const n = snippet.start + i;
            const hit = n === finding.line;
            return (
              <tr key={n} className={hit ? 'bg-[var(--color-accent)]/10' : undefined}>
                <td
                  className={`select-none w-px whitespace-nowrap pl-4 pr-3 text-right border-r border-[var(--color-border)] ${
                    hit ? 'text-[var(--color-accent)] shadow-[inset_2px_0_0_var(--color-accent)]' : 'text-[var(--color-text-tertiary)]'
                  }`}
                >
                  {n}
                </td>
                <td className="whitespace-pre px-3 text-[var(--color-text-secondary)]">{text || ' '}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SkillSpectorReport({ result, snippets = [], componentType = '' }: Props) {
  const wrapped = !['skills', 'skill', 'plugins', 'plugin'].includes(componentType);
  // Findings are grouped by (id, title, file); `count` is how many observations each row stands for.
  const shown = result.findings.reduce((total, f) => total + f.count, 0);
  const { entries, complete } = scanCategories(result);
  const segments: [string, number][] = entries.slice(0, MAX_SEGMENTS);
  const rest = entries.slice(MAX_SEGMENTS).reduce((n, [, v]) => n + v, 0);
  if (rest > 0) segments.push(['Other', rest]);
  const barTotal = segments.reduce((n, [, v]) => n + v, 0);

  return (
    <section
      id="security-scan"
      className="mb-10 scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/25 text-[var(--color-accent)]">
          <ShieldCheckIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            Scanned by <NvidiaMark className="h-4 w-4 mx-0.5" /> NVIDIA SkillSpector
          </h3>
          <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
            Automated static analysis (no LLM)
            {result.version ? ` · v${result.version}` : ''}
            {result.scannedAt ? ` · ${result.scannedAt.slice(0, 10)}` : ''}
          </p>
          {result.analysis === 'partial' && (
            <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
              Partial analysis: some checks could not run on this component.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
        <ScoreRing score={result.score} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-[var(--color-text-primary)]">
            <span className="font-semibold">{result.issueCount}</span>{' '}
            {result.issueCount === 1 ? 'observation' : 'observations'}
            {entries.length > 0 && (
              <span className="text-[var(--color-text-secondary)]">
                {' '}in {entries.length} {entries.length === 1 ? 'category' : 'categories'}
              </span>
            )}
          </p>
          {barTotal > 0 && (
            <>
              <div
                className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full bg-[var(--color-surface-3)]"
                role="img"
                aria-label={segments.map(([c, n]) => `${scanCategoryName(c)}: ${n}`).join(', ')}
              >
                {segments.map(([c, n], i) => (
                  <span key={c} className="h-full" style={{ flexGrow: n, flexBasis: 0, minWidth: '4px', background: shade(i) }} />
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--color-text-secondary)]">
                {segments.map(([c, n], i) => (
                  <li key={c} className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: shade(i) }} aria-hidden="true" />
                    {scanCategoryName(c)} <span className="font-mono text-[11.5px] text-[var(--color-text-tertiary)]">{n}</span>
                  </li>
                ))}
              </ul>
              {!complete && result.issueCount > shown && (
                <p className="mt-2 text-[11.5px] text-[var(--color-text-tertiary)]">
                  Counts from the {shown} observations listed below; the next scan adds the rest.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        SkillSpector looks for patterns such as shell commands, credential access, network calls or unpinned
        dependencies. An observation is something worth reading in the files before you install, not a
        confirmed vulnerability. Components that run code locally, like hooks, MCP servers and security tooling,
        naturally show more of them. Open one to see the lines it points at.
      </p>

      {result.findings.length > 0 ? (
        <div className="mt-5 grid gap-2">
          {result.findings.map((f, i) => (
            <details
              key={i}
              open={i === 0}
              className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-0)] overflow-hidden"
            >
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)] [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">
                <svg
                  className="mt-[3px] w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)] transition-transform group-open:rotate-90"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-[var(--color-text-primary)]">
                    {f.title}
                    {f.count > 1 && <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]"> ×{f.count}</span>}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[var(--color-text-tertiary)] break-all">
                    {scanCategoryName(f.category)} · {f.file}{f.line ? `:${f.line}` : ''}
                  </div>
                </div>
              </summary>
              <div className="border-t border-[var(--color-border)]">
                <Snippet finding={f} snippet={snippets[i]} wrapped={wrapped} />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-[13px] text-[var(--color-text-secondary)]">No observations.</p>
      )}

      <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
        {result.issueCount > shown ? `Showing ${shown} of ${result.issueCount} observations. ` : ''}
        Learn more about{' '}
        <a
          href="https://github.com/NVIDIA/skillspector"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--color-text-primary)]"
        >
          NVIDIA SkillSpector
        </a>
        {' '}or{' '}
        <a href="/security" className="underline hover:text-[var(--color-text-primary)]">
          how components are reviewed
        </a>
        .
      </p>
    </section>
  );
}
