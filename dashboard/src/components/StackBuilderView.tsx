import { useCallback, useEffect, useState } from 'react';
import { useGlobalAuth } from '../lib/use-global-auth';
import { openSignIn } from '../lib/sign-in';
import { encodeStack, stackCommand, stackPath } from '../lib/stack-link';
import {
  forgetLink, GatewayError, linkStatus, parseRepoName, readRepo, recommend, splitPicks, startLink,
  type Recommendation,
} from '../lib/claude-stack';

type Link = 'unknown' | 'linked' | 'unlinked';

async function clerkToken(): Promise<string | null> {
  return (window as any).Clerk?.session?.getToken() ?? null;
}

export default function StackBuilderView() {
  const { isSignedIn, isLoaded } = useGlobalAuth();
  const [link, setLink] = useState<Link>('unknown');
  const [notice, setNotice] = useState('');
  const [repoInput, setRepoInput] = useState('');
  const [phase, setPhase] = useState<'idle' | 'reading' | 'thinking'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Recommendation | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('claude');
    if (p === 'linked') setNotice('Your Claude organization is linked.');
    else if (p === 'canceled') setNotice('Linking was canceled.');
    else if (p === 'error') setNotice('Linking failed. Try again.');
    if (p) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      const token = await clerkToken();
      if (!token) return;
      try {
        setLink((await linkStatus(token)).linked ? 'linked' : 'unlinked');
      } catch {
        setLink('unlinked');
      }
    })();
  }, [isSignedIn]);

  const connect = useCallback(async () => {
    setError('');
    const token = await clerkToken();
    if (!token) return openSignIn();
    try {
      const { authorizeUrl } = await startLink(token);
      window.location.assign(authorizeUrl);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const unlink = useCallback(async () => {
    const token = await clerkToken();
    if (!token) return;
    await forgetLink(token).catch(() => {});
    setLink('unlinked');
    setResult(null);
  }, []);

  const run = useCallback(async () => {
    const name = parseRepoName(repoInput);
    if (!name) return setError('Enter a repository as owner/name or a github.com URL.');
    const token = await clerkToken();
    if (!token) return openSignIn();
    setError('');
    setResult(null);
    try {
      setPhase('reading');
      const snapshot = await readRepo(name, sessionStorage.getItem('github_token'));
      setPhase('thinking');
      setResult(await recommend(token, snapshot));
    } catch (e) {
      if (e instanceof GatewayError && e.code === 'not_linked') setLink('unlinked');
      setError((e as Error).message);
    } finally {
      setPhase('idle');
    }
  }, [repoInput]);

  const picks = result ? splitPicks(result.components) : null;
  const code = picks && picks.items.length ? encodeStack(picks.items) : null;
  const command = picks
    ? [picks.items.length ? stackCommand(picks.items) : null, ...picks.plugins.map((p) => `npx claude-code-templates@latest --plugin ${p}`)]
        .filter(Boolean).join('\n')
    : '';

  const card = 'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5';
  const button = 'px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--color-text-primary)] text-[var(--color-surface-0)] disabled:opacity-50';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Build my stack with Claude</h1>
        <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
          Claude reads your repository and picks components from the catalog. It runs on your own Claude Platform
          organization: you link it once, and each run is billed to it at its normal API rates.
        </p>
      </header>

      {notice && <div className="text-[13px] text-[var(--color-text-secondary)]">{notice}</div>}

      <section className={card}>
        <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">1. Link your Claude organization</h2>
        {!isLoaded ? null : !isSignedIn ? (
          <div className="mt-3 flex items-center gap-3">
            <button className={button} onClick={() => openSignIn()}>Sign in</button>
            <span className="text-[13px] text-[var(--color-text-tertiary)]">An aitmpl account keeps the link.</span>
          </div>
        ) : link === 'linked' ? (
          <div className="mt-3 flex items-center gap-3 text-[13px] text-[var(--color-text-secondary)]">
            <span>Linked.</span>
            <button className="underline text-[var(--color-text-tertiary)]" onClick={unlink}>Forget this link</button>
          </div>
        ) : link === 'unlinked' ? (
          <div className="mt-3 flex flex-col gap-2">
            <div><button className={button} onClick={connect}>Link with Claude</button></div>
            <p className="text-[12px] text-[var(--color-text-tertiary)]">
              You need an Admin or Billing role in a Claude Platform (Console) organization that pays for the API.
              A Claude Pro or Max subscription alone can't be linked. You set a monthly spend limit when you approve,
              and you can revoke it any time in Console under Linked platforms.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-[var(--color-text-tertiary)]">Checking…</p>
        )}
      </section>

      <section className={card}>
        <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">2. Pick a repository</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/name"
            className="flex-1 min-w-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none"
          />
          <button className={button} disabled={link !== 'linked' || phase !== 'idle'} onClick={run}>
            {phase === 'reading' ? 'Reading repo…' : phase === 'thinking' ? 'Claude is working…' : 'Recommend'}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-text-tertiary)]">
          Your browser reads the manifests, README, CLAUDE.md and file tree and sends only those to Claude.
          Private repos use the GitHub connection from "Send to repo".
        </p>
        {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}
      </section>

      {result && picks && (
        <section className={card}>
          <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Your stack</h2>
          <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">{result.summary}</p>
          <ul className="mt-4 flex flex-col gap-3">
            {result.components.map((c) => (
              <li key={c.id} className="text-[13px]">
                <a href={`/component/${c.id}`} className="font-medium text-[var(--color-text-primary)] underline">{c.id}</a>
                <p className="text-[var(--color-text-secondary)]">{c.reason}</p>
              </li>
            ))}
          </ul>
          {command && (
            <div className="mt-4">
              <pre className="text-[12px] whitespace-pre-wrap break-all bg-[var(--color-surface-2)] rounded-lg p-3 text-[var(--color-text-primary)]">{command}</pre>
              <div className="mt-2 flex gap-3 text-[13px]">
                <button className="underline" onClick={() => { navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? 'Copied' : 'Copy command'}
                </button>
                {code && <a className="underline" href={stackPath(code)}>Open as a stack link</a>}
              </div>
            </div>
          )}
          <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">
            {result.usage.model} · {result.usage.inputTokens.toLocaleString()} input and {result.usage.outputTokens.toLocaleString()} output tokens, billed to your organization.
            Picks come from catalog search by text match; sponsored placements never affect them.
          </p>
        </section>
      )}
    </div>
  );
}
