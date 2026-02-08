# Evaluation: mitchellh/vouch for Claude Code Templates

**Repository:** https://github.com/mitchellh/vouch
**Author:** Mitchell Hashimoto (creator of Terraform, Vagrant, Ghostty)
**License:** MIT
**Date:** 2026-02-08

## What is Vouch?

A project trust management system. Maintainers explicitly **vouch** for contributors before they can interact with a project, and can **denounce** bad actors. The trust list is a flat `.td` file (Trustdown format) that can be parsed with standard tools.

Key features:
- Flat-file trust list (`VOUCHED.td`) with simple syntax
- Web of trust across projects (shared vouch/denounce lists)
- GitHub Actions for automated PR gating (check-pr, manage-by-issue, manage-by-discussion)
- CLI for local management (add, check, denounce, remove)
- Used in production by [Ghostty](https://github.com/ghostty-org/ghostty)

## Decision: Adopt the System (Not Migrate Code)

The vouch CLI is written in Nushell and is not suitable for migration as a Claude Code Templates component. However, the **system itself** is designed to be adopted by any project through:

1. A `VOUCHED.td` file in the repository
2. GitHub Actions that reference `mitchellh/vouch/action/*@main`

No Nushell dependency is needed at the project level -- the GitHub Actions handle everything.

## Integration Applied

### Files Created

| File | Purpose |
|------|---------|
| `.github/VOUCHED.td` | Trust list with project owner (davila7) as initial vouched user |
| `.github/workflows/vouch-check-pr.yml` | Auto-checks PR authors on open/reopen; closes PRs from unvouched/denounced users |
| `.github/workflows/vouch-manage-by-issue.yml` | Lets collaborators vouch/denounce/unvouch via issue comments |
| `.github/workflows/vouch-manage-by-discussion.yml` | Same as above but via GitHub Discussions |

### How It Works

1. **PR opens** -> `vouch-check-pr` checks if the author is in `VOUCHED.td`
   - Bots and collaborators with write access are auto-allowed
   - Vouched users pass
   - Unvouched/denounced users get their PR auto-closed with a message
   - `/recheck` comment re-triggers the check (useful after vouching someone)

2. **Collaborator comments `vouch` on an issue** -> `vouch-manage-by-issue` adds the issue author to `VOUCHED.td`
   - `vouch @user` vouches a specific user
   - `vouch @user reason` vouches with a reason
   - `denounce @user` blocks a user
   - `unvouch @user` removes a user

3. **Same via Discussions** -> `vouch-manage-by-discussion` handles discussion comments

### Managing the Trust List

**Vouch a new contributor:**
Comment `vouch` on any issue authored by that person, or `vouch @username` on any issue.

**Denounce a bad actor:**
Comment `denounce @username AI slop contributor` on any issue.

**Remove someone:**
Comment `unvouch @username` on any issue.

All changes are auto-committed by the GitHub Actions bot.

### Future: Web of Trust

Vouch supports importing trust lists from other projects. If other projects in the ecosystem adopt vouch, we can share vouch/denounce lists so trusted contributors in one project are automatically trusted in related ones.
