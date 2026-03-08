const GITHUB_API = 'https://api.github.com';

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
  description: string | null;
  updated_at: string;
}

interface GitHubRef {
  ref: string;
  object: { sha: string };
}

interface GitHubTreeItem {
  path: string;
  mode: '100644';
  type: 'blob';
  content: string;
}

export interface PRResult {
  html_url: string;
  number: number;
}

async function ghFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function listRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  while (page <= 5) {
    const batch = await ghFetch<GitHubRepo[]>(
      `/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`,
      token
    );
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return repos;
}

export async function createPR(
  token: string,
  repo: string,
  files: Record<string, string>,
  branchName: string,
  commitMessage: string,
  prTitle: string,
  prBody: string
): Promise<PRResult> {
  // 1. Get default branch ref
  const repoData = await ghFetch<GitHubRepo>(`/repos/${repo}`, token);
  const baseBranch = repoData.default_branch;

  const baseRef = await ghFetch<GitHubRef>(
    `/repos/${repo}/git/ref/heads/${baseBranch}`,
    token
  );
  const baseSha = baseRef.object.sha;

  // 2. Create tree with all files
  const treeItems: GitHubTreeItem[] = Object.entries(files).map(([path, content]) => ({
    path,
    mode: '100644',
    type: 'blob',
    content,
  }));

  const tree = await ghFetch<{ sha: string }>(
    `/repos/${repo}/git/trees`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
    }
  );

  // 3. Create commit
  const commit = await ghFetch<{ sha: string }>(
    `/repos/${repo}/git/commits`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        message: commitMessage,
        tree: tree.sha,
        parents: [baseSha],
      }),
    }
  );

  // 4. Create branch
  await ghFetch(
    `/repos/${repo}/git/refs`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: commit.sha }),
    }
  );

  // 5. Create PR
  const pr = await ghFetch<PRResult>(
    `/repos/${repo}/pulls`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        title: prTitle,
        body: prBody,
        head: branchName,
        base: baseBranch,
      }),
    }
  );

  return pr;
}
