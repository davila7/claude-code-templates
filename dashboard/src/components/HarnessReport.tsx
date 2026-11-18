import type { HarnessResult } from '../lib/types';
import { harnessAgentName, harnessStatusText, harnessSummary } from '../lib/component-page';

// Agent compatibility on the skill page, from NVIDIA SkillEvaluator's Harness
// Check. Informative like the SkillSpector report: it says how each agent reads
// the skill once installed, not whether the skill is good. Rendered on the
// server only (no client directive), so it ships no JavaScript.

export function TerminalIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 9l3 3-3 3M13 15h4" />
    </svg>
  );
}

interface Props {
  result: HarnessResult;
}

export default function HarnessReport({ result }: Props) {
  const summary = harnessSummary(result.agents);
  const withNotes = result.agents.filter((a) => a.notes.length > 0);
  return (
    <section
      id="compatibility"
      className="mb-10 scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/25 text-[var(--color-accent)]">
            <TerminalIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Agent compatibility</h3>
            <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
              Checked by NVIDIA SkillEvaluator Harness Check
              {result.version ? ` · v${result.version}` : ''}
              {result.checkedAt ? ` · ${result.checkedAt.slice(0, 10)}` : ''}
            </p>
          </div>
        </div>
        <div className="font-mono text-[13px] text-[var(--color-text-secondary)] sm:text-right">
          <span className="text-[var(--color-text-primary)] font-semibold">{summary.loads}</span> of {summary.total} load it
          {summary.notes > 0 && <> · {summary.notes} {summary.notes === 1 ? 'note' : 'notes'}</>}
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        How each agent reads this skill once it is installed, from the agents' documented loading rules. No agent
        was run. A note means the agent loads the skill but changes part of its text, or drops it.
      </p>

      <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {result.agents.map((a) => (
          <li key={a.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-0)] px-3 py-2.5 min-w-0">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.notes.length || a.status !== 'loads' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-success)]'}`}
                aria-hidden="true"
              />
              <span className="truncate">{harnessAgentName(a.id)}</span>
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-[var(--color-text-tertiary)]">
              {harnessStatusText(a.status, a.notes.length)}
            </div>
          </li>
        ))}
      </ul>

      {withNotes.length > 0 && (
        <ul className="mt-5 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {withNotes.flatMap((a) =>
            a.notes.map((n) => (
              <li key={`${a.id}-${n.id}`} className="py-3 min-w-0">
                <div className="text-[13px] text-[var(--color-text-primary)]">
                  <span className="font-semibold">{harnessAgentName(a.id)}:</span> {n.message}
                </div>
                {n.fix && <div className="mt-1 text-[12.5px] text-[var(--color-text-secondary)]">Fix: {n.fix}</div>}
                <div className="mt-0.5 font-mono text-[11px] text-[var(--color-text-tertiary)] break-all">
                  {n.id}{a.verified ? ` · verified on ${a.verified}` : ''}
                </div>
              </li>
            )),
          )}
        </ul>
      )}

      <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
        Learn more about{' '}
        <a
          href="https://github.com/NVIDIA/SkillEvaluator"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--color-text-primary)]"
        >
          NVIDIA SkillEvaluator
        </a>
        .
      </p>
    </section>
  );
}
