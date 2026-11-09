globalThis.process ??= {}; globalThis.process.env ??= {};
import { f as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_OwOTC5bf.mjs';
import { j as jsxRuntimeExports, b as fetchComponentContentData, o as openSignIn, e as TypeIcon, T as TYPE_CONFIG, a as componentPath, $ as $$DashboardLayout, S as SearchModal } from '../chunks/SearchModal_DgLldkrh.mjs';
import { a as reactExports } from '../chunks/_@astro-renderers_BvXjVE0w.mjs';
export { r as renderers } from '../chunks/_@astro-renderers_BvXjVE0w.mjs';
import { c as collectionsApi } from '../chunks/collections-api_CEICj9s3.mjs';
import { C as CartSidebar } from '../chunks/CartSidebar_3-7Y4qKd.mjs';

const GITHUB_API = "https://api.github.com";
async function ghFetch(path, token, options = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json();
}
async function listRepos(token) {
  const repos = [];
  let page = 1;
  while (page <= 5) {
    const batch = await ghFetch(
      `/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`,
      token
    );
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return repos;
}
async function createPR(token, repo, files, branchName, commitMessage, prTitle, prBody) {
  const repoData = await ghFetch(`/repos/${repo}`, token);
  const baseBranch = repoData.default_branch;
  const baseRef = await ghFetch(
    `/repos/${repo}/git/ref/heads/${baseBranch}`,
    token
  );
  const baseSha = baseRef.object.sha;
  const treeItems = Object.entries(files).map(([path, content]) => ({
    path,
    mode: "100644",
    type: "blob",
    content
  }));
  const tree = await ghFetch(
    `/repos/${repo}/git/trees`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ base_tree: baseSha, tree: treeItems })
    }
  );
  const commit = await ghFetch(
    `/repos/${repo}/git/commits`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        message: commitMessage,
        tree: tree.sha,
        parents: [baseSha]
      })
    }
  );
  await ghFetch(
    `/repos/${repo}/git/refs`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: commit.sha })
    }
  );
  const pr = await ghFetch(
    `/repos/${repo}/pulls`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        title: prTitle,
        body: prBody,
        head: branchName,
        base: baseBranch
      })
    }
  );
  return pr;
}

function pluralType$1(type) {
  return type.endsWith("s") ? type : type + "s";
}
function cleanPath$1(path) {
  return path?.replace(/\.(md|json)$/, "") ?? "";
}
function isSafeRelativePath(rel) {
  if (!rel || rel.length > 512 || rel.startsWith("/") || rel.includes("\\") || /[\u0000-\u001f]/.test(rel)) return false;
  return rel.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}
async function buildFileMap(items) {
  const files = {};
  await Promise.all(
    items.map(async (item) => {
      const componentType = item.component_type === "function-hook" || item.component_type === "function-hooks" ? "mod" : item.component_type;
      const type = pluralType$1(componentType);
      const cleanItemPath = cleanPath$1(item.component_path);
      const contentData = await fetchComponentContentData(componentType, cleanItemPath);
      const content = contentData.content;
      if (!content) return;
      const name = item.component_name?.replace(/\.(md|json)$/, "") ?? "";
      switch (type) {
        case "loops":
          files[`.claude/loops/${name}.md`] = content;
          break;
        case "mods": {
          for (const [rel, text] of Object.entries(contentData.files ?? {})) {
            if (!isSafeRelativePath(rel)) throw new Error(`mod ${name}: refusing file path "${rel}"`);
            files[`.claude/skills/${name}/${rel}`] = text;
          }
          files[`.claude/skills/${name}/README.md`] = content;
          break;
        }
        case "agents":
          files[`.claude/agents/${name}.md`] = content;
          break;
        case "commands":
          files[`.claude/commands/${name}.md`] = content;
          break;
        case "skills": {
          const skillPath = cleanItemPath.replace(/^[^/]+\//, "");
          files[`.claude/skills/${skillPath}/SKILL.md`] = content;
          break;
        }
        case "hooks":
          files[`.claude/hooks/${name}.json`] = content;
          break;
        case "settings":
          files[`.claude/settings/${name}.json`] = content;
          break;
        case "mcps":
          files[`.mcp-components/${name}.json`] = content;
          break;
      }
    })
  );
  return files;
}
function SendToRepoModal({ items, collectionName, onClose }) {
  const [step, setStep] = reactExports.useState(() => {
    const token2 = sessionStorage.getItem("github_token");
    return token2 ? "select-repo" : "connect";
  });
  const [token, setToken] = reactExports.useState(() => sessionStorage.getItem("github_token") ?? "");
  const [repos, setRepos] = reactExports.useState([]);
  const [filteredRepos, setFilteredRepos] = reactExports.useState([]);
  const [search, setSearch] = reactExports.useState("");
  const [loadingRepos, setLoadingRepos] = reactExports.useState(false);
  const [selectedRepo, setSelectedRepo] = reactExports.useState(null);
  const [prResult, setPrResult] = reactExports.useState(null);
  const [error, setError] = reactExports.useState("");
  const backdropRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "github-oauth" && event.data.token) {
        sessionStorage.setItem("github_token", event.data.token);
        setToken(event.data.token);
        setStep("select-repo");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  reactExports.useEffect(() => {
    if (step === "select-repo" && token && repos.length === 0) {
      loadRepos();
    }
  }, [step, token]);
  reactExports.useEffect(() => {
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
    } catch (err) {
      if (err.message?.includes("401")) {
        sessionStorage.removeItem("github_token");
        setToken("");
        setStep("connect");
      } else {
        setError(err.message);
        setStep("error");
      }
    } finally {
      setLoadingRepos(false);
    }
  }
  function startOAuth() {
    {
      setError("GitHub OAuth is not configured (missing PUBLIC_GITHUB_CLIENT_ID)");
      setStep("error");
      return;
    }
  }
  const handleCreatePR = reactExports.useCallback(async () => {
    if (!selectedRepo || !token) return;
    setStep("creating");
    try {
      const files = await buildFileMap(items);
      if (Object.keys(files).length === 0) {
        throw new Error("No component content found to include in PR");
      }
      const branchName = `claude-components/${collectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const pr = await createPR(
        token,
        selectedRepo.full_name,
        files,
        `${branchName}-${timestamp}`,
        `Add Claude Code components: ${collectionName}`,
        `Add Claude Code components: ${collectionName}`,
        [
          `## Claude Code Components`,
          "",
          `This PR adds **${items.length}** component${items.length !== 1 ? "s" : ""} from the "${collectionName}" collection.`,
          "",
          "### Files",
          "",
          ...Object.keys(files).map((f) => `- \`${f}\``),
          "",
          "---",
          `Sent from [AI Templates](https://app.aitmpl.com/my-components)`
        ].join("\n")
      );
      setPrResult(pr);
      setStep("done");
    } catch (err) {
      setError(err.message);
      setStep("error");
    }
  }, [selectedRepo, token, items, collectionName]);
  function handleBackdropClick(e) {
    if (e.target === backdropRef.current) onClose();
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      ref: backdropRef,
      onClick: handleBackdropClick,
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm",
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-lg mx-4 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-5 h-5 text-[var(--color-text-primary)]", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-sm font-semibold text-white", children: "Send to GitHub" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: onClose,
              className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-tertiary)] hover:text-white transition-colors",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-5 py-4", children: [
          step === "connect" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center py-6", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-[var(--color-text-secondary)] mb-4", children: "Connect your GitHub account to create a PR with your components." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                onClick: startOAuth,
                className: "inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" }) }),
                  "Connect GitHub"
                ]
              }
            )
          ] }),
          step === "select-repo" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                value: search,
                onChange: (e) => setSearch(e.target.value),
                placeholder: "Search repositories...",
                className: "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-border-hover)] transition-colors",
                autoFocus: true
              }
            ) }),
            loadingRepos ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center py-8", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-5 h-5 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" }) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-h-72 overflow-y-auto space-y-0.5 -mx-1 px-1", children: [
              filteredRepos.map((repo) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  onClick: () => setSelectedRepo(repo),
                  className: `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedRepo?.id === repo.id ? "bg-blue-500/15 border border-blue-500/30" : "hover:bg-white/[0.04] border border-transparent"}`,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4 shrink-0 text-[var(--color-text-tertiary)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[13px] text-white truncate", children: repo.full_name }),
                      repo.description && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[11px] text-[var(--color-text-tertiary)] truncate mt-0.5", children: repo.description })
                    ] }),
                    repo.private && /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M7 11V7a5 5 0 0110 0v4" })
                    ] })
                  ]
                },
                repo.id
              )),
              filteredRepos.length === 0 && !loadingRepos && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center justify-center py-12 px-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-16 h-16 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center mb-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-8 h-8 text-[var(--color-text-tertiary)]", fill: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" }) }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[14px] font-medium text-[var(--color-text-primary)] mb-1", children: search ? "No repositories found" : "No repositories available" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[13px] text-[var(--color-text-secondary)] text-center max-w-xs", children: search ? "Try a different search term" : "Connect your GitHub account to see your repositories" })
              ] })
            ] }),
            selectedRepo && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-[12px] text-[var(--color-text-tertiary)]", children: [
                items.length,
                " component",
                items.length !== 1 ? "s" : "",
                " → ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[var(--color-text-primary)]", children: selectedRepo.full_name })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  onClick: handleCreatePR,
                  className: "flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[13px] font-medium transition-colors",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "18", cy: "18", r: "3" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "6", cy: "6", r: "3" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M13 6h3a2 2 0 012 2v7" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "6", y1: "9", x2: "6", y2: "21" })
                    ] }),
                    "Create PR"
                  ]
                }
              )
            ] })
          ] }),
          step === "creating" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center py-8", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-6 h-6 border-2 border-[var(--color-text-tertiary)] border-t-[var(--color-text-primary)] rounded-full animate-spin mx-auto mb-3" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-[var(--color-text-secondary)]", children: "Creating pull request..." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[11px] text-[var(--color-text-tertiary)] mt-1", children: [
              "Adding ",
              items.length,
              " component",
              items.length !== 1 ? "s" : "",
              " to ",
              selectedRepo?.full_name
            ] })
          ] }),
          step === "done" && prResult && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center py-6", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-5 h-5 text-green-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-white mb-1", children: "Pull Request Created!" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[12px] text-[var(--color-text-tertiary)] mb-4", children: [
              "PR #",
              prResult.number,
              " in ",
              selectedRepo?.full_name
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "a",
              {
                href: prResult.html_url,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors",
                children: [
                  "View on GitHub",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) })
                ]
              }
            )
          ] }),
          step === "error" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center py-6", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-5 h-5 text-red-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-white mb-1", children: "Something went wrong" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[12px] text-[var(--color-text-tertiary)] mb-4 max-w-sm mx-auto", children: error }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: () => {
                  setError("");
                  setStep(token ? "select-repo" : "connect");
                },
                className: "px-4 py-2 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-4)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors",
                children: "Try Again"
              }
            )
          ] })
        ] })
      ] })
    }
  );
}

function useGlobalAuth() {
  const [state, setState] = reactExports.useState({ isSignedIn: false, isLoaded: false, email: "" });
  reactExports.useEffect(() => {
    function check() {
      const clerk = window.Clerk;
      if (clerk?.loaded) {
        const email = clerk.user?.primaryEmailAddress?.emailAddress ?? "";
        setState({ isSignedIn: !!clerk.user, isLoaded: true, email });
      }
    }
    check();
    const interval = setInterval(check, 500);
    const handleChange = () => check();
    window.addEventListener("clerk:session", handleChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("clerk:session", handleChange);
    };
  }, []);
  const getToken = async () => {
    const clerk = window.Clerk;
    return clerk?.session?.getToken() ?? null;
  };
  return { ...state, getToken };
}
const TYPE_FLAGS = {
  agents: "--agent",
  commands: "--command",
  settings: "--setting",
  hooks: "--hook",
  mcps: "--mcp",
  skills: "--skill",
  templates: "--template"
};
function cleanPath(path) {
  return path?.replace(/\.(md|json)$/, "") ?? "";
}
function formatName(name) {
  if (!name) return "";
  return name.replace(/\.(md|json)$/, "").replace(/[-_]/g, " ").split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function pluralType(type) {
  return type.endsWith("s") ? type : type + "s";
}
const TYPE_ORDER = ["skills", "agents", "commands", "settings", "hooks", "mcps"];
function groupByType(items) {
  const map = {};
  for (const item of items) {
    const t = pluralType(item.component_type);
    if (!map[t]) map[t] = [];
    map[t].push(item);
  }
  return TYPE_ORDER.filter((t) => map[t]?.length).map((t) => ({
    type: t,
    label: TYPE_CONFIG[t]?.label ?? t,
    color: TYPE_CONFIG[t]?.color ?? "var(--color-text-tertiary)",
    items: map[t]
  }));
}
function getFileName(item) {
  const t = pluralType(item.component_type);
  const name = item.component_name?.replace(/\.(md|json)$/, "") ?? "";
  if (t === "agents") return `${name}.md`;
  if (t === "commands") return `${name}.md`;
  if (t === "skills") return name;
  if (t === "hooks") return `${name}.json`;
  if (t === "settings") return name;
  if (t === "mcps") return name;
  return name;
}
function buildProjectTree(items) {
  const grouped = {};
  for (const item of items) {
    const t = pluralType(item.component_type);
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(item);
  }
  const claudeChildren = [];
  if (grouped.agents?.length) {
    claudeChildren.push({
      name: "agents",
      type: "folder",
      color: TYPE_CONFIG.agents?.color,
      componentType: "agents",
      children: grouped.agents.map((item) => ({
        name: getFileName(item),
        type: "file",
        color: TYPE_CONFIG.agents?.color,
        componentType: "agents",
        item
      }))
    });
  }
  if (grouped.commands?.length) {
    claudeChildren.push({
      name: "commands",
      type: "folder",
      color: TYPE_CONFIG.commands?.color,
      componentType: "commands",
      children: grouped.commands.map((item) => ({
        name: getFileName(item),
        type: "file",
        color: TYPE_CONFIG.commands?.color,
        componentType: "commands",
        item
      }))
    });
  }
  if (grouped.skills?.length) {
    claudeChildren.push({
      name: "skills",
      type: "folder",
      color: TYPE_CONFIG.skills?.color,
      componentType: "skills",
      children: grouped.skills.map((item) => ({
        name: getFileName(item),
        type: "folder",
        color: TYPE_CONFIG.skills?.color,
        componentType: "skills",
        item
      }))
    });
  }
  if (grouped.hooks?.length) {
    claudeChildren.push({
      name: "hooks",
      type: "folder",
      color: TYPE_CONFIG.hooks?.color,
      componentType: "hooks",
      children: grouped.hooks.map((item) => ({
        name: getFileName(item),
        type: "file",
        color: TYPE_CONFIG.hooks?.color,
        componentType: "hooks",
        item
      }))
    });
  }
  if (grouped.settings?.length) {
    claudeChildren.push({
      name: "settings.json",
      type: "file",
      color: TYPE_CONFIG.settings?.color,
      componentType: "settings",
      children: grouped.settings.map((item) => ({
        name: formatName(item.component_name),
        type: "file",
        color: TYPE_CONFIG.settings?.color,
        componentType: "settings",
        item
      }))
    });
  }
  const root = {
    name: "project",
    type: "folder",
    children: [
      {
        name: ".claude",
        type: "folder",
        children: claudeChildren
      }
    ]
  };
  if (grouped.mcps?.length) {
    root.children.push({
      name: ".mcp.json",
      type: "file",
      color: TYPE_CONFIG.mcps?.color,
      componentType: "mcps",
      children: grouped.mcps.map((item) => ({
        name: formatName(item.component_name),
        type: "file",
        color: TYPE_CONFIG.mcps?.color,
        componentType: "mcps",
        item
      }))
    });
  }
  return root;
}
function ProjectTreeNode({
  node,
  depth,
  expandedPaths,
  togglePath,
  currentPath,
  onRemoveItem,
  collectionId
}) {
  const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
  const isExpanded = expandedPaths.has(fullPath);
  const hasChildren = node.children && node.children.length > 0;
  const isLeafFile = node.type === "file" && node.item;
  const isContainerFile = node.type === "file" && hasChildren && !node.item;
  const isClickable = hasChildren || isLeafFile;
  const pl = depth * 12 + 8;
  const fileIcon = /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5 shrink-0", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", style: { color: node.color ?? "var(--color-text-tertiary)" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" }) });
  const folderIcon = (color) => /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5 shrink-0", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", style: { color: color ?? "var(--color-text-tertiary)" }, children: isExpanded ? /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 1.85L5 19z" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" }) });
  if (isLeafFile) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "group/treeitem flex items-center gap-1.5 py-[4px] rounded-md text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors",
        style: { paddingLeft: pl },
        children: [
          fileIcon,
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "a",
            {
              href: componentPath(node.item.component_type, cleanPath(node.item.component_path)),
              className: "truncate flex-1 hover:underline",
              style: { color: node.color },
              children: node.name
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                onRemoveItem(node.item, collectionId);
              },
              className: "p-0.5 rounded hover:bg-white/10 text-[var(--color-text-tertiary)] hover:text-red-400 transition-colors opacity-0 group-hover/treeitem:opacity-100 shrink-0 mr-1",
              title: "Remove",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3 h-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
            }
          )
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        onClick: () => {
          if (isClickable) togglePath(fullPath);
        },
        role: isClickable ? "button" : void 0,
        className: `flex items-center gap-1.5 py-[4px] rounded-md text-[12px] transition-colors ${isClickable ? "cursor-pointer hover:bg-[var(--color-surface-2]" : ""} ${node.name === ".claude" ? "text-[var(--color-text-primary)] font-medium" : "text-[var(--color-text-secondary)]"}`,
        style: { paddingLeft: pl },
        children: [
          hasChildren ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            "svg",
            {
              className: `w-3 h-3 shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`,
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              strokeWidth: "2",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 5l7 7-7 7" })
            }
          ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "w-3 shrink-0" }),
          node.type === "folder" ? folderIcon(node.color) : isContainerFile ? fileIcon : folderIcon(node.color),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "truncate", style: { color: node.name === ".claude" || node.name === "project" ? void 0 : node.color }, children: [
            node.name,
            node.type === "folder" && node.name !== "project" ? "/" : ""
          ] }),
          node.componentType && hasChildren && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] text-[var(--color-text-tertiary)] ml-auto mr-1", children: node.children.length })
        ]
      }
    ),
    isExpanded && hasChildren && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: node.children.map((child, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      ProjectTreeNode,
      {
        node: child,
        depth: depth + 1,
        expandedPaths,
        togglePath,
        currentPath: fullPath,
        onRemoveItem,
        collectionId
      },
      `${child.name}-${i}`
    )) })
  ] });
}
function generateCommand(items) {
  const grouped = {};
  for (const item of items) {
    const t = pluralType(item.component_type);
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(cleanPath(item.component_path));
  }
  let cmd = "npx claude-code-templates@latest";
  for (const [type, paths] of Object.entries(grouped)) {
    const flag = TYPE_FLAGS[type];
    if (flag) cmd += ` ${flag} ${paths.join(",")}`;
  }
  return cmd;
}
function MainContentTree({
  node,
  depth,
  isLast,
  prefix,
  onRemoveItem,
  collectionId
}) {
  const hasChildren = node.children && node.children.length > 0;
  const connector = depth === 0 ? "" : isLast ? "└── " : "├── ";
  const childPrefix = depth === 0 ? "" : prefix + (isLast ? "    " : "│   ");
  const displayName = node.type === "folder" ? `${node.name}/` : node.name;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    depth > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "group/treeline flex items-center whitespace-pre leading-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-[var(--color-text-tertiary)] select-none", children: [
        prefix,
        connector
      ] }),
      node.item ? /* @__PURE__ */ jsxRuntimeExports.jsx(
        "a",
        {
          href: componentPath(node.item.component_type, cleanPath(node.item.component_path)),
          className: "hover:underline",
          style: { color: node.color ?? "var(--color-text-secondary)" },
          children: displayName
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: node.color ?? (node.name === ".claude" ? "var(--color-text-primary)" : "var(--color-text-tertiary)") }, className: node.name === ".claude" ? "font-semibold" : "", children: displayName }),
      node.item && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => onRemoveItem(node.item, collectionId),
          className: "ml-2 p-0.5 rounded hover:bg-white/10 text-[var(--color-text-tertiary)] hover:text-red-400 transition-colors opacity-0 group-hover/treeline:opacity-100 shrink-0",
          title: "Remove",
          children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3 h-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
        }
      )
    ] }),
    hasChildren && node.children.map((child, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      MainContentTree,
      {
        node: child,
        depth: depth + 1,
        isLast: i === node.children.length - 1,
        prefix: childPrefix,
        onRemoveItem,
        collectionId
      },
      `${child.name}-${i}`
    ))
  ] });
}
function CollectionContextMenu({
  onRename,
  onDelete,
  onClose
}) {
  const ref = reactExports.useRef(null);
  reactExports.useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref, className: "absolute right-0 top-full mt-1 w-36 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 py-1", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: onRename, className: "flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3 h-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }) }),
      "Rename"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: onDelete, className: "flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-red-400 hover:text-red-300 hover:bg-white/[0.06] transition-colors", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3 h-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }),
      "Delete"
    ] })
  ] });
}
function MyComponentsView() {
  const { isSignedIn, isLoaded, email, getToken } = useGlobalAuth();
  const canSendToRepo = email === "dan.avila7@gmail.com";
  const [collections, setCollections] = reactExports.useState([]);
  const [selectedId, setSelectedId] = reactExports.useState(null);
  const [expandedIds, setExpandedIds] = reactExports.useState(/* @__PURE__ */ new Set());
  const [expandedPaths, setExpandedPaths] = reactExports.useState(/* @__PURE__ */ new Set(["project", "project/.claude"]));
  const [loading, setLoading] = reactExports.useState(true);
  const [newName, setNewName] = reactExports.useState("");
  const [creating, setCreating] = reactExports.useState(false);
  const [contextMenu, setContextMenu] = reactExports.useState(null);
  const [renaming, setRenaming] = reactExports.useState(null);
  const [renameValue, setRenameValue] = reactExports.useState("");
  const [copied, setCopied] = reactExports.useState(false);
  const [showSendToRepo, setShowSendToRepo] = reactExports.useState(false);
  const [shareLoading, setShareLoading] = reactExports.useState(false);
  const [shareCopied, setShareCopied] = reactExports.useState(false);
  const [showShareModal, setShowShareModal] = reactExports.useState(false);
  const [shareUrl, setShareUrl] = reactExports.useState("");
  reactExports.useEffect(() => {
    if (isSignedIn) loadCollections();
  }, [isSignedIn]);
  async function loadCollections() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const cols = await collectionsApi.list(token);
      setCollections(cols);
      if (cols.length > 0 && !selectedId) {
        const wanted = new URLSearchParams(window.location.search).get("collection");
        const first = cols.find((c) => c.id === wanted) ?? cols[0];
        setSelectedId(first.id);
        setExpandedIds(/* @__PURE__ */ new Set([first.id]));
      }
    } catch (err) {
      console.error("Failed to load collections:", err);
    } finally {
      setLoading(false);
    }
  }
  async function handleCreate() {
    if (!newName.trim()) return;
    const token = await getToken();
    if (!token) return;
    setCreating(true);
    try {
      const col = await collectionsApi.create(token, newName.trim());
      setCollections((prev) => [...prev, col]);
      setSelectedId(col.id);
      setNewName("");
    } catch (err) {
      console.error("Failed to create collection:", err);
    } finally {
      setCreating(false);
    }
  }
  async function handleRename(id) {
    if (!renameValue.trim()) return;
    const token = await getToken();
    if (!token) return;
    try {
      await collectionsApi.rename(token, id, renameValue.trim());
      setCollections(
        (prev) => prev.map((c) => c.id === id ? { ...c, name: renameValue.trim() } : c)
      );
      setRenaming(null);
    } catch (err) {
      console.error("Failed to rename:", err);
    }
  }
  async function handleDelete(id) {
    if (!confirm("Delete this collection and all its items?")) return;
    const token = await getToken();
    if (!token) return;
    try {
      await collectionsApi.delete(token, id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) {
        const remaining = collections.filter((c) => c.id !== id);
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setContextMenu(null);
  }
  async function handleRemoveItem(item, collectionId) {
    const token = await getToken();
    if (!token) return;
    try {
      await collectionsApi.removeItem(token, item.id, collectionId);
      setCollections(
        (prev) => prev.map(
          (c) => c.id === collectionId ? { ...c, collection_items: c.collection_items.filter((i) => i.id !== item.id) } : c
        )
      );
    } catch (err) {
      console.error("Failed to remove item:", err);
    }
  }
  function copyCommand(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  }
  function openShareModal(url) {
    setShareUrl(url);
    setShowShareModal(true);
  }
  async function handleShare() {
    if (!selectedCollection) return;
    const isCurrentlyPublic = !!selectedCollection.is_public;
    if (isCurrentlyPublic && selectedCollection.share_slug) {
      openShareModal(`${window.location.origin}/c/${selectedCollection.share_slug}`);
      return;
    }
    setShareLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/collections/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ collectionId: selectedCollection.id, enable: true })
      });
      const data = await res.json();
      if (res.ok) {
        setCollections((prev) => prev.map(
          (c) => c.id === selectedCollection.id ? { ...c, share_slug: data.share_slug, is_public: data.is_public } : c
        ));
        if (data.is_public && data.share_slug) {
          openShareModal(`${window.location.origin}/c/${data.share_slug}`);
        }
      }
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setShareLoading(false);
    }
  }
  if (!isLoaded) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center h-full", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-5 h-5 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" }) });
  }
  if (!isSignedIn) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center px-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-16 h-16 rounded-2xl bg-[var(--color-surface-3)] flex items-center justify-center mb-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-8 h-8 text-[var(--color-text-tertiary)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold text-[var(--color-text-primary)] mb-2", children: "Save your favorite components" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-[var(--color-text-tertiary)] mb-6 max-w-sm", children: "Sign in to create collections and organize the components you use most." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => openSignIn("collection"),
          className: "px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors",
          children: "Sign In"
        }
      )
    ] });
  }
  if (loading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center py-20", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-5 h-5 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" }) });
  }
  function toggleTreePath(path) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }
  const selectedCollection = collections.find((c) => c.id === selectedId);
  const selectedItems = selectedCollection?.collection_items ?? [];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-60 border-r border-[var(--color-border)] flex flex-col shrink-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-4 py-3 border-b border-[var(--color-border)]", children: /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-sm font-semibold text-[var(--color-text-primary)]", children: "My Components" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-2 py-2 border-b border-[var(--color-border)]", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            value: newName,
            onChange: (e) => setNewName(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") handleCreate();
            },
            placeholder: "New collection...",
            className: "flex-1 bg-transparent border-none text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-2 py-1.5 outline-none",
            maxLength: 100
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: handleCreate,
            disabled: !newName.trim() || creating,
            className: "p-1.5 rounded hover:bg-[var(--color-surface-3)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] disabled:opacity-30 transition-colors",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4v16m8-8H4" }) })
          }
        )
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-1 overflow-y-auto py-2 px-2 space-y-0.5", children: collections.map((col) => {
        const isExpanded = expandedIds.has(col.id);
        const isSelected = selectedId === col.id;
        const items = col.collection_items ?? [];
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
          renaming === col.id ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-2 py-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              autoFocus: true,
              value: renameValue,
              onChange: (e) => setRenameValue(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") handleRename(col.id);
                if (e.key === "Escape") setRenaming(null);
              },
              onBlur: () => handleRename(col.id),
              className: "w-full bg-[var(--color-surface-3)] border-none rounded text-[12px] text-[var(--color-text-primary)] px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500",
              maxLength: 100
            }
          ) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              onClick: () => {
                setSelectedId(col.id);
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(col.id)) next.delete(col.id);
                  else next.add(col.id);
                  return next;
                });
              },
              role: "button",
              className: `flex items-center gap-1.5 w-full px-2 py-[6px] rounded-md text-[13px] transition-colors group cursor-pointer ${isSelected ? "bg-[var(--color-surface-3] text-[var(--color-text-primary)] font-medium" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2]"}`,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "svg",
                  {
                    className: `w-3 h-3 shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`,
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    strokeWidth: "2",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 5l7 7-7 7" })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4 shrink-0 text-[var(--color-text-tertiary)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate flex-1 text-left", children: col.name }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] text-[var(--color-text-tertiary)]", children: items.length }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      setContextMenu(contextMenu === col.id ? null : col.id);
                    },
                    className: "opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3 h-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 5v.01M12 12v.01M12 19v.01" }) })
                  }
                )
              ]
            }
          ),
          contextMenu === col.id && /* @__PURE__ */ jsxRuntimeExports.jsx(
            CollectionContextMenu,
            {
              onRename: () => {
                setRenaming(col.id);
                setRenameValue(col.name);
                setContextMenu(null);
              },
              onDelete: () => handleDelete(col.id),
              onClose: () => setContextMenu(null)
            }
          ),
          isExpanded && items.length > 0 && (() => {
            const tree = buildProjectTree(items);
            return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ml-1 mt-0.5 mb-1", children: tree.children.map((child, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
              ProjectTreeNode,
              {
                node: child,
                depth: 1,
                expandedPaths,
                togglePath: toggleTreePath,
                currentPath: "project",
                onRemoveItem: handleRemoveItem,
                collectionId: col.id
              },
              `${child.name}-${i}`
            )) });
          })()
        ] }, col.id);
      }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-1 overflow-y-auto", children: !selectedCollection ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col items-center justify-center h-full text-center px-6", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-[var(--color-text-tertiary)]", children: "Select a collection" }) }) : selectedItems.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center px-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-20 h-20 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center mb-6", children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-10 h-10 text-[var(--color-text-tertiary)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-[15px] font-semibold text-[var(--color-text-primary)] mb-2", children: "Collection is empty" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[13px] text-[var(--color-text-secondary)] max-w-md leading-relaxed mb-6", children: [
        '"',
        selectedCollection.name,
        `" doesn't have any components yet. Browse the marketplace and click the bookmark icon to save components here.`
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "a",
        {
          href: "/agents",
          className: "px-4 py-2 bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] rounded-lg text-[13px] font-medium text-white transition-all",
          children: "Browse Components"
        }
      )
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mb-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-base font-semibold text-[var(--color-text-primary)]", children: selectedCollection.name }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-[12px] text-[var(--color-text-tertiary)]", children: [
            selectedItems.length,
            " component",
            selectedItems.length !== 1 ? "s" : ""
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              onClick: handleShare,
              disabled: shareLoading,
              className: `flex items-center gap-2 px-4 py-2 border rounded-lg text-[13px] font-medium transition-colors ${selectedCollection?.is_public ? "bg-blue-500/10 text-blue-400 border-blue-500/25 hover:bg-blue-500/20" : "bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] border-[var(--color-border)]"}`,
              title: selectedCollection?.is_public ? "Click to copy link or disable sharing" : "Share this collection publicly",
              children: [
                shareLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className: "w-4 h-4 animate-spin", fill: "none", viewBox: "0 0 24 24", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })
                ] }) : shareCopied ? /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" }) }),
                shareCopied ? "Link Copied!" : selectedCollection?.is_public ? "Shared" : "Share"
              ]
            }
          ),
          canSendToRepo && /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              onClick: () => setShowSendToRepo(true),
              className: "flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg text-[13px] font-medium transition-colors",
              title: "Create a Pull Request with these components",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" }) }),
                "Send to Repo"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => copyCommand(generateCommand(selectedItems)),
              className: "flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-gray-100 transition-colors",
              children: copied ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) }),
                "Copied!"
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: "4 17 10 11 4 5" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "12", y1: "19", x2: "20", y2: "19" })
                ] }),
                "Install All"
              ] })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-3 mb-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("code", { className: "text-[12px] text-[var(--color-text-secondary)] font-mono break-all leading-relaxed", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[var(--color-text-tertiary)] select-none", children: "$ " }),
        generateCommand(selectedItems)
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4 text-[var(--color-text-tertiary)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-[13px] font-medium text-[var(--color-text-secondary)]", children: "Project Structure" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] text-[var(--color-text-tertiary)]", children: "How components will be installed" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-4 font-mono text-[12px]", children: (() => {
          const tree = buildProjectTree(selectedItems);
          return /* @__PURE__ */ jsxRuntimeExports.jsx(
            MainContentTree,
            {
              node: tree,
              depth: 0,
              isLast: true,
              prefix: "",
              onRemoveItem: handleRemoveItem,
              collectionId: selectedCollection.id
            }
          );
        })() })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-6", children: groupByType(selectedItems).map((group) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "w-5 h-5 rounded flex items-center justify-center",
              style: { backgroundColor: `${group.color}18`, color: group.color },
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(TypeIcon, { type: group.type, size: 14 })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-[13px] font-semibold", style: { color: group.color }, children: group.label }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-[11px] text-[var(--color-text-tertiary)]", children: [
            "(",
            group.items.length,
            ")"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5", children: group.items.map((item) => {
          const config = TYPE_CONFIG[group.type];
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "group/card flex items-start gap-3 p-3.5 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-card-hover)] transition-all duration-200",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    className: "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    style: { backgroundColor: config ? `${config.color}12` : "rgba(255, 255, 255, 0.03)", color: config?.color ?? "var(--color-text-tertiary)" },
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(TypeIcon, { type: group.type })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "a",
                    {
                      href: componentPath(item.component_type, cleanPath(item.component_path)),
                      className: "text-[13px] font-medium text-[var(--color-text-primary)] hover:text-white transition-colors line-clamp-1",
                      children: formatName(item.component_name)
                    }
                  ),
                  item.component_category && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-1.5 mt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--color-text-tertiary)]", children: item.component_category }) })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => handleRemoveItem(item, selectedCollection.id),
                    className: "p-1.5 rounded hover:bg-white/10 text-[var(--color-text-tertiary)] hover:text-red-400 transition-colors opacity-0 group-hover/card:opacity-100 shrink-0",
                    title: "Remove",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
                  }
                )
              ]
            },
            item.id
          );
        }) })
      ] }, group.type)) })
    ] }) }),
    showSendToRepo && selectedCollection && /* @__PURE__ */ jsxRuntimeExports.jsx(
      SendToRepoModal,
      {
        items: selectedItems,
        collectionName: selectedCollection.name,
        onClose: () => setShowSendToRepo(false)
      }
    ),
    showShareModal && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm",
        onClick: () => setShowShareModal(false),
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "relative w-full max-w-md mx-4 p-6 rounded-2xl border",
            style: { background: "var(--color-surface-1)", borderColor: "var(--color-border)", boxShadow: "0 25px 50px rgba(0,0,0,0.4)" },
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: () => setShowShareModal(false),
                  className: "absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                  style: { color: "var(--color-text-tertiary)" },
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) })
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 mb-5", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-10 h-10 rounded-xl flex items-center justify-center", style: { background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-5 h-5", style: { color: "#60a5fa" }, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" }) }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-[15px] font-bold", style: { color: "var(--color-text-primary)" }, children: "Share Collection" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[12px]", style: { color: "var(--color-text-tertiary)" }, children: selectedCollection?.name })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-[11px] font-semibold uppercase tracking-wider mb-2 block", style: { color: "var(--color-text-tertiary)" }, children: "Public link" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "input",
                    {
                      readOnly: true,
                      value: shareUrl,
                      className: "flex-1 px-3 py-2.5 rounded-lg text-[13px] font-mono outline-none",
                      style: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" },
                      onFocus: (e) => e.target.select()
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: () => {
                        navigator.clipboard.writeText(shareUrl);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2e3);
                      },
                      className: "px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all shrink-0",
                      style: {
                        background: shareCopied ? "rgba(34,197,94,0.15)" : "var(--color-surface-3)",
                        color: shareCopied ? "#22c55e" : "var(--color-text-primary)",
                        border: `1px solid ${shareCopied ? "rgba(34,197,94,0.3)" : "var(--color-border)"}`
                      },
                      children: shareCopied ? "Copied!" : "Copy"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-[11px] font-semibold uppercase tracking-wider mb-2 block", style: { color: "var(--color-text-tertiary)" }, children: "Share on" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "a",
                    {
                      href: `https://x.com/intent/tweet?text=${encodeURIComponent(`Check out my "${selectedCollection?.name}" Claude Code collection!`)}&url=${encodeURIComponent(shareUrl)}`,
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className: "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:scale-[1.02] no-underline",
                      style: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" },
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" }) }),
                        "Post on X"
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "a",
                    {
                      href: `https://www.threads.net/intent/post?text=${encodeURIComponent(`Check out my "${selectedCollection?.name}" Claude Code collection! ${shareUrl}`)}`,
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className: "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:scale-[1.02] no-underline",
                      style: { background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" },
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-4 h-4", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.187.408-2.26 1.33-3.02.86-.706 2.035-1.107 3.402-1.162 1.163-.047 2.21.1 3.127.436-.055-.79-.271-1.418-.644-1.88-.478-.593-1.223-.896-2.216-.902h-.04c-.78.003-1.81.27-2.2.992l-1.76-.978C8.737 6.074 10.17 5.47 11.87 5.46h.06c1.49.009 2.686.505 3.535 1.46.745.836 1.2 1.964 1.352 3.353.58.226 1.1.507 1.553.84 1.118.82 1.927 1.907 2.372 3.166.775 2.19.592 4.9-1.346 6.797-1.83 1.793-4.093 2.588-7.218 2.612l.012.012zm-1.677-7.87c-.746.04-1.5.186-1.91.476-.38.27-.533.642-.51 1.065.04.703.57 1.39 1.88 1.39h.14c1.44-.072 2.406-1.16 2.72-3.076-.73-.263-1.535-.396-2.32-.355z" }) }),
                        "Post on Threads"
                      ]
                    }
                  )
                ] })
              ] })
            ]
          }
        )
      }
    )
  ] });
}

const prerender = false;
const $$MyComponents = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "DashboardLayout", $$DashboardLayout, { "title": "My Components - Claude Code Templates" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="h-full"> ${renderComponent($$result2, "MyComponentsView", MyComponentsView, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/home/user/claude-code-templates/dashboard/src/components/MyComponentsView.tsx", "client:component-export": "default" })} </div> ${renderComponent($$result2, "SearchModal", SearchModal, { "client:idle": true, "client:component-hydration": "idle", "client:component-path": "/home/user/claude-code-templates/dashboard/src/components/SearchModal.tsx", "client:component-export": "default" })} ${renderComponent($$result2, "CartSidebar", CartSidebar, { "client:idle": true, "client:component-hydration": "idle", "client:component-path": "/home/user/claude-code-templates/dashboard/src/components/CartSidebar.tsx", "client:component-export": "default" })} ` })}`;
}, "/home/user/claude-code-templates/dashboard/src/pages/my-components.astro", void 0);

const $$file = "/home/user/claude-code-templates/dashboard/src/pages/my-components.astro";
const $$url = "/my-components";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$MyComponents,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
