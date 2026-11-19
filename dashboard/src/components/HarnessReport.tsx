import type { HarnessResult } from '../lib/types';
import { harnessAgentLogo, harnessAgentName, harnessStatusText, harnessSummary, NVIDIA_LOGO } from '../lib/component-page';

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

function AgentLogo({ id, className }: { id: string; className: string }) {
  const logo = harnessAgentLogo(id);
  if (!logo) return null;
  return (
    <img
      src={logo.src}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      className={`${className} shrink-0${logo.mono ? ' oss-icon' : ''}`}
    />
  );
}

/** The NVIDIA eye next to the tool's name, in its official green (never inverted). */
export function NvidiaMark({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return <img src={NVIDIA_LOGO} alt="" width={14} height={14} className={`${className} inline-block shrink-0 align-[-2px]`} />;
}

/** loads as written | loads with changes | not loaded: one color each in the ring, the dots and the notes. */
function agentTone(a: { status: string; notes: unknown[] }): 'ok' | 'note' | 'off' {
  if (a.status === 'not_loaded') return 'off';
  return a.notes.length || a.status !== 'loads' ? 'note' : 'ok';
}

const TONE_COLOR = {
  ok: 'var(--color-success)',
  note: 'var(--color-accent)',
  off: 'color-mix(in srgb, var(--color-text-tertiary) 35%, transparent)',
} as const;

/** One segment per agent, in card order. */
function AgentRing({ agents, loads }: { agents: HarnessResult['agents']; loads: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const n = Math.max(agents.length, 1);
  const seg = c / n;
  const gap = agents.length > 1 ? 6 : 0;
  return (
    <div
      className="relative w-[132px] h-[132px] shrink-0"
      role="img"
      aria-label={`${loads} of ${agents.length} agents load this skill`}
    >
      <svg viewBox="0 0 132 132" className="w-full h-full" aria-hidden="true">
        {agents.map((a, i) => (
          <circle
            key={a.id}
            cx="66"
            cy="66"
            r={r}
            fill="none"
            stroke={TONE_COLOR[agentTone(a)]}
            strokeWidth="12"
            strokeDasharray={`${seg - gap} ${c - seg + gap}`}
            strokeDashoffset={-i * seg}
            transform="rotate(-90 66 66)"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-[28px] leading-none font-semibold text-[var(--color-text-primary)]">
          {loads}/{agents.length}
        </span>
        <span className="mt-1 font-mono text-[11px] text-[var(--color-text-tertiary)]">load it</span>
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)] transition-transform group-open:rotate-90"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function HarnessReport({ result }: Props) {
  const summary = harnessSummary(result.agents);
  const notes = result.agents.flatMap((a) => a.notes.map((n) => ({ a, n })));
  return (
    <section
      id="compatibility"
      className="@container mb-10 scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/25 text-[var(--color-accent)]">
            <TerminalIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Agent compatibility</h3>
            <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
              Checked by <NvidiaMark className="h-3 w-3" /> NVIDIA SkillEvaluator Harness Check
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

      <div className="mt-5 flex flex-col @2xl:flex-row @2xl:items-center gap-5 @2xl:gap-6">
        <div className="self-center">
          <AgentRing agents={result.agents} loads={summary.loads} />
        </div>
        <ul className="grid flex-1 min-w-0 grid-cols-2 @3xl:grid-cols-3 gap-2.5">
          {result.agents.map((a) => {
            const tone = agentTone(a);
            return (
              <li
                key={a.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-0)] p-3.5 min-w-0"
              >
                <div className="flex items-center gap-2.5 text-[14.5px] font-semibold text-[var(--color-text-primary)]">
                  <AgentLogo id={a.id} className="h-7 w-7" />
                  <span className="min-w-0 leading-tight">{harnessAgentName(a.id)}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 font-mono text-[11.5px] text-[var(--color-text-tertiary)]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TONE_COLOR[tone] }} aria-hidden="true" />
                  {harnessStatusText(a.status, a.notes.length)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {notes.length > 0 ? (
        <div className="mt-5 grid gap-2">
          {notes.map(({ a, n }, i) => (
            <details
              key={`${a.id}-${n.id}-${i}`}
              open={i === 0}
              className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-0)] overflow-hidden"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)] [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">
                <Chevron />
                <AgentLogo id={a.id} className="h-6 w-6" />
                <span className="min-w-0 flex-1 text-[13.5px] text-[var(--color-text-primary)]">
                  <span className="font-semibold">{harnessAgentName(a.id)}</span>
                  <span className="text-[12.5px] text-[var(--color-text-tertiary)]">
                    {' '}· {a.status === 'not_loaded' ? 'not loaded' : 'loads with changes'}
                  </span>
                </span>
              </summary>
              <div className="border-t border-[var(--color-border)] px-4 py-3 @lg:pl-[68px]">
                <p className="text-[13.5px] leading-relaxed text-[var(--color-text-primary)]">{n.message}</p>
                {n.fix && (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
                    <span className="font-semibold">Fix:</span> {n.fix}
                  </p>
                )}
                <p className="mt-1.5 font-mono text-[11px] text-[var(--color-text-tertiary)] break-all">
                  {n.id}
                  {a.verified ? ` · verified on ${a.verified}` : ''}
                </p>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-[13px] text-[var(--color-text-secondary)]">Every agent loads this skill as written. No notes.</p>
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
