import type { SkillSpectorResult } from '../lib/types';
import { ShieldCheckIcon } from './SkillSpectorBadge';

// SkillSpector report on the component page. Informative, not alarming:
// neutral colors, no severity labels or install verdicts. Rendered on the
// server only (no client directive), so it ships no JavaScript.

interface Props {
  result: SkillSpectorResult;
}

export default function SkillSpectorReport({ result }: Props) {
  const shown = result.findings.length;
  return (
    <section
      id="security-scan"
      className="mb-10 scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/25 text-[var(--color-accent)]">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Scanned by NVIDIA SkillSpector</h3>
            <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
              Automated static analysis (no LLM)
              {result.version ? ` · v${result.version}` : ''}
              {result.scannedAt ? ` · ${result.scannedAt.slice(0, 10)}` : ''}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="font-mono text-[13px] text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-text-primary)] font-semibold">{result.issueCount}</span>{' '}
            {result.issueCount === 1 ? 'observation' : 'observations'}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-[var(--color-text-tertiary)]">scanner score {result.score}/100</div>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        SkillSpector looks for patterns such as shell commands, credential access, network calls or unpinned
        dependencies. An observation is something worth reading in the files before you install, not a
        confirmed vulnerability. Components that run code locally, like hooks, MCP servers and security tooling,
        naturally show more of them.
      </p>

      {shown > 0 ? (
        <ul className="mt-5 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {result.findings.map((f, i) => (
            <li key={i} className="flex gap-3 py-3">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-text-tertiary)]" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[13px] text-[var(--color-text-primary)]">
                  {f.title}
                  {f.count > 1 && <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]"> ×{f.count}</span>}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-[var(--color-text-tertiary)] break-all">
                  {f.category} · {f.file}{f.line ? `:${f.line}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
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
        .
      </p>
    </section>
  );
}
