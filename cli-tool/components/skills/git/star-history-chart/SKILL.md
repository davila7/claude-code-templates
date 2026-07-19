---
name: star-history-chart
description: Add a self-hosted "Stargazers over time" chart to any GitHub repo's README. GitHub now restricts the stargazers endpoint to a repo's own admins/collaborators, so third-party live services (star-history free tier, starchart.cc) return "Requires authentication" for everyone. This generates a static, theme-aware SVG in-repo and auto-refreshes it weekly with a GitHub Action using the repo's own GITHUB_TOKEN. Use when the star chart in a README is broken, shows "Requires authentication", or you want a star history that never breaks.
---

# Star History Chart (self-hosted, never breaks)

Add a "Stargazers over time" chart that renders from a static SVG committed to
the repo and refreshes itself weekly — no external chart service, no broken
images.

## Why this exists

GitHub now restricts the `/stargazers` endpoint to a repository's own admins and
collaborators. Unauthenticated requests return `{"message":"Requires
authentication"}`, which breaks every third-party live-chart service
(star-history.com free tier, starchart.cc, etc.) for **all** repos. The only
reliable fix is to generate the chart yourself with an authenticated token and
commit a static image. Inside GitHub Actions, the repo's own `GITHUB_TOKEN` can
read its own stargazers, so the whole thing runs with zero secrets to configure.

## What this skill sets up

1. `scripts/generate_star_history.py` — fetches stargazers (authenticated),
   renders a clean, light/dark-adaptive SVG.
2. `.github/workflows/star-history.yml` — weekly cron + manual trigger that
   regenerates and commits `docs/star-history.svg`.
3. A README section pointing at the local SVG.

## Workflow

### Step 1: Copy the script and workflow into the repo

```bash
mkdir -p scripts .github/workflows docs
cp skills/git/star-history-chart/scripts/generate_star_history.py scripts/generate_star_history.py
cp skills/git/star-history-chart/assets/star-history.yml .github/workflows/star-history.yml
```

> The script needs the `requests` package: `pip install requests`.
> It resolves the repo from `STAR_HISTORY_REPO`, then `GITHUB_REPOSITORY`
> (set automatically in Actions), then the `origin` git remote — so no edits
> are required for it to work in a different repo.

### Step 2: Generate the SVG once, locally

Use a token that can read the repo's stargazers (as owner/collaborator). The
GitHub CLI provides one:

```bash
GITHUB_TOKEN=$(gh auth token) python scripts/generate_star_history.py
```

This writes `docs/star-history.svg`. For a repo with many thousands of stars the
first run paginates the whole stargazer list and can take a couple of minutes.

Verify it rendered (optional, macOS): `qlmanage -t -s 800 -o . docs/star-history.svg`

### Step 3: Add it to the README

Add or replace the star chart section. Point the image at the **local** SVG.
Set the link target to wherever you want clicks to go (the repo, a docs page, or
your own site):

```markdown
## Stargazers over time
[![Stargazers over time](docs/star-history.svg)](https://github.com/OWNER/REPO/stargazers)
```

If replacing a broken `star-history.com` / `starchart.cc` embed, swap only the
image URL to `docs/star-history.svg` and keep or update the link target.

### Step 4: Commit

```bash
git add scripts/generate_star_history.py .github/workflows/star-history.yml docs/star-history.svg README.md
git commit -m "feat(readme): self-hosted stargazers chart with weekly auto-refresh"
git push
```

### Step 5: (Optional) Trigger the auto-refresh now

The workflow runs every Monday at 04:00 UTC. To refresh immediately without
waiting: **GitHub → Actions → "Update Star History" → Run workflow**.

## Customization

- **Output path** — set `STAR_HISTORY_OUTPUT` (default `docs/star-history.svg`).
- **Different repo** — set `STAR_HISTORY_REPO=owner/name`.
- **Colors / size** — edit the `.line`, `.area`, `.dot` CSS and `WIDTH`/`HEIGHT`
  constants near the top of `generate_star_history.py`. The chart is
  theme-aware via a `prefers-color-scheme: dark` block, so it looks right in
  both GitHub light and dark modes.
- **Refresh cadence** — edit the `cron` expression in the workflow.

## Notes

- No secrets to add: the workflow uses the automatic `GITHUB_TOKEN`.
- Private repos work too, as long as the token can read the repo.
- The script uses only `requests` plus the Python standard library.
