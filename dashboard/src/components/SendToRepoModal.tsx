import { useState, useEffect, useRef, useCallback } from 'react';
import { listRepos, createPR, type GitHubRepo, type PRResult } from '../lib/github-api';
import type { CollectionItem, ComponentsData, Component } from '../lib/types';
import { COMPONENTS_JSON_URL } from '../lib/constants';

type Step = 'connect' | 'select-repo' | 'creating' | 'done' | 'error';

interface Props {
  items: CollectionItem[];
  collectionName: string;
  onClose: () => void;
}

const GITHUB_CLIENT_ID = import.meta.env.PUBLIC_GITHUB_CLIENT_ID ?? '';

function pluralType(type: string): string {
  return type.endsWith('s') ? type : type + 's';
}

function cleanPath(path: string): string {
  return path?.replace(/\.(md|json)$/, '') ?? '';
}

// Map collection items to file paths + content
function buildFileMap(
  items: CollectionItem[],
  componentsData: ComponentsData
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const item of items) {
    const type = pluralType(item.component_type);
    const components = (componentsData as Record<string, Component[]>)[type] ?? [];
    const cleanItemPath = cleanPath(item.component_path);

    const match = components.find((c) => {
      const cleanCompPath = cleanPath(c.path);
      return cleanCompPath === cleanItemPath || cleanCompPath === item.component_path;
    });

    if (!match?.content) continue;

    const name = item.component_name?.replace(/\.(md|json)$/, '') ?? '';

    switch (type) {
      case 'agents':
        files[`.claude/agents/${name}.md`] = match.content;
        break;
      case 'commands':
        files[`.claude/commands/${name}.md`] = match.content;
        break;
      case 'skills': {
        // Skills may have multiple files; content is the main SKILL.md
        const skillPath = cleanItemPath.replace(/^[^/]+\//, '');
        files[`.claude/skills/${skillPath}/SKILL.md`] = match.content;
        break;
      }
      case 'hooks':
        files[`.claude/hooks/${name}.json`] = match.content;
        break;
      case 'settings':
        // Settings content is JSON that should be merged into settings.json
        files[`.claude/settings/${name}.json`] = match.content;
        break;
      case 'mcps':
        files[`.mcp-components/${name}.json`] = match.content;
        break;
    }
  }

  return files;
}

export default function SendToRepoModal({ items, collectionName, onClose }: Props) {
  const [step, setStep] = useState<Step>(() => {
    const token = sessionStorage.getItem('github_token');
    return token ? 'select-repo' : 'connect';
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('github_token') ?? '');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [search, setSearch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [prResult, setPrResult] = useState<PRResult | null>(null);
  const [error, setError] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);

  // Listen for OAuth callback
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'github-oauth' && event.data.token) {
        sessionStorage.setItem('github_token', event.data.token);
        setToken(event.data.token);
        setStep('select-repo');
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Load repos when we have a token
  useEffect(() => {
    if (step === 'select-repo' && token && repos.length === 0) {
      loadRepos();
    }
  }, [step, token]);

  // Filter repos on search
  useEffect(() => {
    if (!search.trim()) {
      setFilteredRepos(repos);
    } else {
      const q = search.toLowerCase();
      setFilteredRepos(repos.filter((r) => r.full_name.toLowerCase().includes(q)));
    }
  }, [search, repos]);

  async function loadRepos() {
    setLoadingRepos(true);
    try {
      const data = await listRepos(token);
      setRepos(data);
      setFilteredRepos(data);
    } catch (err: any) {
      if (err.message?.includes('401')) {
        sessionStorage.removeItem('github_token');
        setToken('');
        setStep('connect');
      } else {
        setError(err.message);
        setStep('error');
      }
    } finally {
      setLoadingRepos(false);
    }
  }

  function startOAuth() {
    if (!GITHUB_CLIENT_ID) {
      setError('GitHub OAuth is not configured (missing PUBLIC_GITHUB_CLIENT_ID)');
      setStep('error');
      return;
    }
    const redirectUri = `${window.location.origin}/github-callback`;
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;
    const w = 600, h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(url, 'github-oauth', `width=${w},height=${h},left=${left},top=${top}`);
  }

  const handleCreatePR = useCallback(async () => {
    if (!selectedRepo || !token) return;
    setStep('creating');

    try {
      // Fetch component content
      const res = await fetch(COMPONENTS_JSON_URL);
      if (!res.ok) throw new Error('Failed to load components data');
      const componentsData: ComponentsData = await res.json();

      const files = buildFileMap(items, componentsData);

      if (Object.keys(files).length === 0) {
        throw new Error('No component content found to include in PR');
      }

      const branchName = `claude-components/${collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const timestamp = new Date().toISOString().slice(0, 10);

      const pr = await createPR(
        token,
        selectedRepo.full_name,
        files,
        `${branchName}-${timestamp}`,
        `Add Claude Code components: ${collectionName}`,
        `Add Claude Code components: ${collectionName}`,
        [
          `## Claude Code Components`,
          '',
          `This PR adds **${items.length}** component${items.length !== 1 ? 's' : ''} from the "${collectionName}" collection.`,
          '',
          '### Files',
          '',
          ...Object.keys(files).map((f) => `- \`${f}\``),
          '',
          '---',
          `Sent from [AI Templates](https://app.aitmpl.com/my-components)`,
        ].join('\n')
      );

      setPrResult(pr);
      setStep('done');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  }, [selectedRepo, token, items, collectionName]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg mx-4 bg-[var(--color-surface-1)] border border-[var(--color-border-hover)] rounded-xl shadow-[0_0_40px_rgba(124,92,255,0.4)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-hover)]">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <h3 className="text-sm font-semibold text-white">Send to GitHub</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-[--color-text-tertiary] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {/* Step: Connect GitHub */}
          {step === 'connect' && (
            <div className="text-center py-6">
              <p className="text-sm text-[--color-text-secondary] mb-4">
                Connect your GitHub account to create a PR with your components.
              </p>
              <button
                onClick={startOAuth}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Connect GitHub
              </button>
            </div>
          )}

          {/* Step: Select repo */}
          {step === 'select-repo' && (
            <div>
              <div className="mb-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search repositories..."
                  className="w-full bg-[var(--color-surface-0)] border border-[var(--color-border-hover)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-primary-500)] focus:shadow-[0_0_0_3px_rgba(124,92,255,0.1)] transition-all"
                  autoFocus
                />
              </div>

              {loadingRepos ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#333] border-t-white rounded-full animate-spin" />
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-0.5 -mx-1 px-1">
                  {filteredRepos.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={() => setSelectedRepo(repo)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selectedRepo?.id === repo.id
                          ? 'bg-blue-500/15 border border-blue-500/30'
                          : 'hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <svg className="w-4 h-4 shrink-0 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-white truncate">{repo.full_name}</div>
                        {repo.description && (
                          <div className="text-[11px] text-[--color-text-tertiary] truncate mt-0.5">
                            {repo.description}
                          </div>
                        )}
                      </div>
                      {repo.private && (
                        <svg className="w-3.5 h-3.5 shrink-0 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                      )}
                    </button>
                  ))}
                  {filteredRepos.length === 0 && !loadingRepos && (
                    <p className="text-center text-sm text-[--color-text-tertiary] py-6">
                      {search ? 'No repositories found' : 'No repositories available'}
                    </p>
                  )}
                </div>
              )}

              {/* Footer with create PR button */}
              {selectedRepo && (
                <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between">
                  <div className="text-[12px] text-[--color-text-tertiary]">
                    {items.length} component{items.length !== 1 ? 's' : ''} → <span className="text-white">{selectedRepo.full_name}</span>
                  </div>
                  <button
                    onClick={handleCreatePR}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[13px] font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="18" r="3" />
                      <circle cx="6" cy="6" r="3" />
                      <path d="M13 6h3a2 2 0 012 2v7" />
                      <line x1="6" y1="9" x2="6" y2="21" />
                    </svg>
                    Create PR
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step: Creating */}
          {step === 'creating' && (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-[#333] border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[--color-text-secondary]">Creating pull request...</p>
              <p className="text-[11px] text-[--color-text-tertiary] mt-1">
                Adding {items.length} component{items.length !== 1 ? 's' : ''} to {selectedRepo?.full_name}
              </p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && prResult && (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white mb-1">Pull Request Created!</p>
              <p className="text-[12px] text-[--color-text-tertiary] mb-4">
                PR #{prResult.number} in {selectedRepo?.full_name}
              </p>
              <a
                href={prResult.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                View on GitHub
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white mb-1">Something went wrong</p>
              <p className="text-[12px] text-[--color-text-tertiary] mb-4 max-w-sm mx-auto">{error}</p>
              <button
                onClick={() => {
                  setError('');
                  setStep(token ? 'select-repo' : 'connect');
                }}
                className="px-4 py-2 bg-[--color-surface-3] hover:bg-[--color-surface-4] rounded-lg text-sm text-[--color-text-secondary] hover:text-white transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
