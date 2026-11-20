# Example: git panic

Note how the facts-verbatim rule kicks in — every command and flag survives exactly, only the explanation around them gets simpler.

## Before

> The divergence between your local branch and its upstream counterpart necessitates a non-fast-forward reconciliation. You may either integrate via `git pull --rebase origin main`, which replays your local commits atop the remote tip to maintain a linear history, or perform a merge via `git pull origin main`, which preserves the bifurcated topology at the cost of a merge commit. Under no circumstances should you execute `git push --force` without first ascertaining that no collaborators have based work on the published history.

## `/bro`

## After

> Ok so: someone else pushed commits to `main` while you were working, and now git won't take your push because the two histories split. You have two options. Run `git pull --rebase origin main` — this picks up your commits and puts them on top of the newest remote code, keeps history clean, this is usually what you want. Or run `git pull origin main` — this glues the two histories together with an extra "merge commit". Both work. The one thing you should NOT do is `git push --force` — that would overwrite everyone else's work. Only force-push if you're 100% sure nobody else touched that branch.
