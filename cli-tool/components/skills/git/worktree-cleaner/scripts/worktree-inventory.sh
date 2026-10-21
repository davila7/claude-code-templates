#!/usr/bin/env bash
# worktree-inventory.sh: read-only inventory of the git worktrees of one repository.
#
# Prints one block per worktree (key: value lines, blank line between blocks) with the
# evidence needed to decide whether it can be removed. It never changes refs, worktrees
# or working trees. Writes it can make: `git fetch --prune` when --fetch is passed, and
# the loose objects `git merge-tree --write-tree` stores (harmless, garbage-collected).
#
# Usage: worktree-inventory.sh [--fetch] [--no-gh] [--path <worktree>] [--repo <dir>]
# Exit codes: 0 ok, 1 not a git repository, 2 bad arguments, 3 --path matched no worktree.
# Works with bash 3.2 (macOS) and git >= 2.38 (merge-tree --write-tree; older git
# skips the "content already in default branch" check and says so).

set -u
# Never let git refresh and rewrite an index as a side effect of status.
export GIT_OPTIONAL_LOCKS=0

FETCH=0
USE_GH=1
ONLY_PATH=""
REPO_DIR="."

while [ $# -gt 0 ]; do
  case "$1" in
    --fetch) FETCH=1 ;;
    --no-gh) USE_GH=0 ;;
    --path|--repo)
      [ $# -ge 2 ] && [ -n "$2" ] || { echo "error: $1 needs a value" >&2; exit 2; }
      if [ "$1" = --path ]; then ONLY_PATH="$2"; else REPO_DIR="$2"; fi
      shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

if ! git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: $REPO_DIR is not inside a git repository" >&2
  exit 1
fi

# All worktrees share one common dir; run repo-wide commands from there.
COMMON_DIR=$(cd "$REPO_DIR" && cd "$(git rev-parse --git-common-dir)" && pwd -P)
G() { git --git-dir="$COMMON_DIR" "$@"; }

canon() { # canonical absolute path, or the input when it does not exist
  if [ -d "$1" ]; then (cd "$1" && pwd -P); else printf '%s\n' "$1"; fi
}

CURRENT_TOP=$(git -C "$REPO_DIR" rev-parse --show-toplevel 2>/dev/null || true)
[ -n "$CURRENT_TOP" ] && CURRENT_TOP=$(canon "$CURRENT_TOP")
[ -n "$ONLY_PATH" ] && ONLY_PATH=$(canon "$ONLY_PATH")

REMOTE=$(G remote | grep -qx origin && echo origin || G remote | head -n1)

FETCH_STATUS="skipped (pass --fetch to refresh remote refs)"
if [ "$FETCH" = 1 ] && [ -n "$REMOTE" ]; then
  # Never block on a credential prompt or an SSH passphrase.
  if GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes}" \
    G fetch --prune --quiet "$REMOTE" 2>/dev/null </dev/null; then FETCH_STATUS="ok ($REMOTE)"
  else FETCH_STATUS="FAILED (offline or no access): remote refs may be stale"; fi
fi

# Default branch: the remote's HEAD, else main/master/trunk as they exist.
DEFAULT_REF=""
if [ -n "$REMOTE" ]; then
  DEFAULT_REF=$(G symbolic-ref -q --short "refs/remotes/$REMOTE/HEAD" 2>/dev/null || true)
fi
if [ -z "$DEFAULT_REF" ]; then
  for b in main master trunk; do
    if [ -n "$REMOTE" ] && G show-ref --verify -q "refs/remotes/$REMOTE/$b"; then DEFAULT_REF="$REMOTE/$b"; break; fi
    if G show-ref --verify -q "refs/heads/$b"; then DEFAULT_REF="$b"; break; fi
  done
fi

MERGE_TREE_OK=0
if git merge-tree -h 2>&1 | grep -q -- '--write-tree'; then MERGE_TREE_OK=1; fi

HAVE_GH=0
if [ "$USE_GH" = 1 ] && command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then HAVE_GH=1; fi

# cwd of every running process, "pid<TAB>command<TAB>cwd", to spot sessions inside a worktree.
PROCS_FILE=$(mktemp "${TMPDIR:-/tmp}/wt-procs.XXXXXX")
trap 'rm -f "$PROCS_FILE"' EXIT
if command -v lsof >/dev/null 2>&1; then
  # -R adds the parent pid, used to drop lsof itself and its helper child.
  lsof -w -a -d cwd -F pRcn 2>/dev/null | awk -v me="$$" '
    /^p/ {pid=substr($0,2)} /^R/ {pp[pid]=substr($0,2)} /^c/ {cmd[pid]=substr($0,2)} /^n/ {cwd[pid]=substr($0,2)}
    END { for (p in cwd) { q = pp[p]; if (q == me || pp[q] == me) continue; print p "\t" cmd[p] "\t" cwd[p] } }' >"$PROCS_FILE"
elif [ -d /proc ]; then
  for d in /proc/[0-9]*; do
    cwd=$(readlink "$d/cwd" 2>/dev/null) || continue
    printf '%s\t%s\t%s\n' "${d#/proc/}" "$(cat "$d/comm" 2>/dev/null)" "$cwd"
  done >"$PROCS_FILE"
fi
# Exclude this script and its ancestors (the calling shell, the agent). Siblings are kept:
# a dev server started from the same shell is a real user of its worktree.
# Only the current user's processes are visible to lsof and /proc.
SELF_PIDS=$(ps -A -o pid= -o ppid= 2>/dev/null | awk -v me="$$" '
  { parent[$1] = $2 }
  END { out = " "; for (p = me; p != "" && p != 0 && !(p in seen); p = parent[p]) { seen[p] = 1; out = out p " " }; print out }')
[ -z "$SELF_PIDS" ] && SELF_PIDS=" $$ $PPID "
# The worktrees those ancestors sit in (this agent session, its shell) are "current" too,
# even when --repo points elsewhere: never offer to remove the tree we are running from.
SELF_CWDS=$(awk -F'\t' -v self="$SELF_PIDS" 'index(self, " " $1 " ") > 0 {print $3}' "$PROCS_FILE")
SELF_CWDS="$SELF_CWDS
$(pwd -P)"

mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }
NOW=$(date +%s)

echo "repo: $(canon "$COMMON_DIR")"
echo "default_branch: ${DEFAULT_REF:-UNKNOWN}"
echo "fetch: $FETCH_STATUS"
echo "gh: $([ "$HAVE_GH" = 1 ] && echo available || echo 'not used (missing, not authenticated or --no-gh)')"
echo "merge_tree_check: $([ "$MERGE_TREE_OK" = 1 ] && echo available || echo 'unavailable (git < 2.38)')"
echo

report() { # $1 path $2 head $3 branch-ref $4 detached $5 bare $6 locked $7 lock-reason $8 prunable $9 prune-reason
  local path="$1" head="$2" bref="$3" detached="$4" bare="$5" locked="$6" lreason="$7" prunable="$8" preason="$9"
  local cpath branch exists=yes is_main=no is_current=no
  cpath=$(canon "$path")
  [ -n "$ONLY_PATH" ] && [ "$cpath" != "$ONLY_PATH" ] && return
  MATCHED=$((MATCHED + 1))
  branch=${bref#refs/heads/}
  [ -d "$path" ] || exists=no
  [ "$path" = "$MAIN_PATH" ] && is_main=yes
  [ -n "$CURRENT_TOP" ] && [ "$cpath" = "$CURRENT_TOP" ] && is_current=yes
  if [ "$is_current" = no ] && [ "$path" != "$MAIN_PATH" ] && printf '%s\n' "$SELF_CWDS" \
    | awk -v p="$cpath" '$0 == p || index($0, p "/") == 1 {f = 1} END {exit !f}'; then is_current=yes; fi

  echo "worktree: $path"
  echo "branch: ${branch:-"(detached)"}"
  echo "head: $head"
  echo "main_worktree: $is_main"
  echo "current_worktree: $is_current"
  echo "dir_exists: $exists"
  echo "bare: $bare"
  echo "locked: $locked${lreason:+ ($lreason)}"
  echo "prunable: $prunable${preason:+ ($preason)}"
  case "$cpath" in */.claude/worktrees/*) echo "created_by: claude-code (path under .claude/worktrees/)";; esac

  if [ "$bare" = yes ]; then echo "verdict: PROTECTED (bare repository)"; echo; return; fi
  if [ "$exists" = no ]; then
    if [ "$locked" = yes ]; then echo "verdict: REVIEW (directory missing but locked: unlock first)"
    else echo "verdict: STALE_ENTRY (directory missing)"; fi
    echo; return
  fi

  # Working tree state, from inside that worktree. If git cannot read it (broken .git file,
  # safe.directory ownership, permissions) nothing below can be trusted.
  local status gitdir tracked untracked ignored_kept submodules
  gitdir=$(git -C "$path" rev-parse --absolute-git-dir 2>/dev/null)
  if ! status=$(git -C "$path" status --porcelain=v1 --untracked-files=all --ignored=matching 2>&1) \
    || [ -z "$gitdir" ]; then
    echo "git_error: $(printf '%s' "$status" | head -n 2 | tr '\n' ' ')"
    echo "verdict: REVIEW (git cannot read this worktree; inspect it by hand)"
    echo; return
  fi
  tracked=$(printf '%s\n' "$status" | grep -Ev '^(\?\? |!! |$)' | grep -c . || true)
  untracked=$(printf '%s\n' "$status" | grep -c '^?? ' || true)
  # git worktree remove deletes ignored files silently. Report every ignored entry that is not
  # a known regenerable artifact (dependencies, build output, caches): .env, local settings,
  # keys, or a whole ignored directory such as secrets/ all show up here.
  ignored_kept=$(printf '%s\n' "$status" | sed -n 's/^!! //p' | awk '
    NF == 0 { next }
    { e = $0; sub(/\/$/, "", e); n = split(e, part, "/"); b = part[n] }
    b ~ /^(node_modules|dist|build|out|target|coverage|\.next|\.nuxt|\.astro|\.svelte-kit|\.turbo|\.cache|\.parcel-cache|\.wrangler|\.vercel|\.venv|venv|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|\.tox|\.gradle|\.DS_Store)$/ { next }
    b ~ /\.(pyc|pyo|log|tsbuildinfo)$/ { next }
    { print }')
  local ignored_count; ignored_count=$(printf '%s' "$ignored_kept" | grep -c . || true)
  [ "$ignored_count" -gt 0 ] && ignored_kept=$(printf '%s\n' "$ignored_kept" | head -n 10 | tr '\n' ' ') || ignored_kept=""
  [ "$ignored_count" -gt 10 ] && ignored_kept="$ignored_kept(+$((ignored_count - 10)) more)"
  submodules=no
  [ -f "$path/.gitmodules" ] && submodules=yes
  echo "modified_tracked: $tracked"
  echo "untracked_files: $untracked"
  if [ "$untracked" -gt 0 ] || [ "$tracked" -gt 0 ]; then
    echo "changed_paths: $(printf '%s\n' "$status" | grep -v '^!! ' | head -n 8 | cut -c4- | tr '\n' ' ')"
  fi
  echo "ignored_local_files: ${ignored_kept:-none}"
  echo "submodules: $submodules"

  # Commits that exist only here: not reachable from any remote-tracking ref.
  local local_only ahead_upstream upstream track content_in_default="n/a" ancestor="n/a"
  local_only=$(G rev-list --count "$head" --not --remotes 2>/dev/null || echo "?")
  echo "commits_not_on_any_remote: $local_only"
  if [ -n "$branch" ]; then
    upstream=$(G for-each-ref --format='%(upstream:short)' "refs/heads/$branch")
    track=$(G for-each-ref --format='%(upstream:track)' "refs/heads/$branch")
    echo "upstream: ${upstream:-none}${track:+ $track}"
  fi
  if [ -n "$DEFAULT_REF" ]; then
    if G merge-base --is-ancestor "$head" "$DEFAULT_REF" 2>/dev/null; then ancestor=yes; else ancestor=no; fi
    if [ "$MERGE_TREE_OK" = 1 ]; then
      # Squash/rebase merges: merging this head into the default branch changes nothing.
      local mt dt
      mt=$(G merge-tree --write-tree "$DEFAULT_REF" "$head" 2>/dev/null | head -n1) || mt=""
      dt=$(G rev-parse "$DEFAULT_REF^{tree}")
      if [ -n "$mt" ] && [ "$mt" = "$dt" ]; then content_in_default=yes; else content_in_default=no; fi
    fi
  fi
  echo "head_merged_into_default: $ancestor"
  echo "content_already_in_default: $content_in_default"

  local pr="unknown"
  if [ "$HAVE_GH" = 1 ] && [ -n "$branch" ]; then
    pr=$( (cd "$MAIN_PATH" 2>/dev/null || cd "$path"; gh pr list --head "$branch" --state all --limit 1 \
      --json number,state,url --jq '.[] | "#\(.number) \(.state) \(.url)"') 2>/dev/null)
    [ -z "$pr" ] && pr="none"
  fi
  echo "pr: $pr"

  # Activity: running processes with cwd inside, last commit, last index write.
  local users="" last_commit idx_age
  users=$(awk -F'\t' -v p="$cpath" -v self="$SELF_PIDS" '
    ($3 == p || index($3, p "/") == 1) && index(self, " " $1 " ") == 0 {printf "%s(%s) ", $2, $1}' "$PROCS_FILE")
  last_commit=$(G log -1 --format='%cr' "$head" 2>/dev/null)
  if [ -f "$gitdir/index" ]; then idx_age=$(( (NOW - $(mtime "$gitdir/index")) / 3600 )); else idx_age=0; fi
  # A Claude Code session that is idle, paused or archived has no process but still owns its
  # worktree: its transcripts live in ~/.claude/projects/<path with non-alphanumerics as ->/.
  local session_age="" slug sdir newest
  for slug in "$(printf '%s' "$cpath" | sed 's/[^A-Za-z0-9]/-/g')" "$(printf '%s' "$path" | sed 's/[^A-Za-z0-9]/-/g')"; do
    sdir="${HOME:-~}/.claude/projects/$slug"
    [ -d "$sdir" ] || continue
    newest=$(ls -t "$sdir"/*.jsonl 2>/dev/null | head -n1)
    [ -n "$newest" ] && session_age=$(( (NOW - $(mtime "$newest")) / 3600 )) && break
  done
  echo "processes_inside: ${users:-none}"
  echo "claude_session_hours_ago: ${session_age:-none}"
  echo "last_commit: $last_commit"
  echo "index_touched_hours_ago: $idx_age"

  # Verdict. The skill re-explains it to the user; this is a summary, not permission.
  local verdict reasons=""
  if [ "$is_main" = yes ] || [ "$is_current" = yes ]; then verdict=PROTECTED
    reasons="$([ "$is_main" = yes ] && echo 'main worktree')$([ "$is_main" = yes ] && [ "$is_current" = yes ] && echo ', ')$([ "$is_current" = yes ] && echo 'current worktree')"
  elif [ -n "$users" ]; then verdict=IN_USE; reasons="processes have their cwd inside"
  elif [ "$tracked" -gt 0 ] || [ "$untracked" -gt 0 ]; then verdict=AT_RISK; reasons="uncommitted or untracked changes"
  elif [ "$local_only" != 0 ] && [ "$content_in_default" != yes ] && [ "$ancestor" != yes ]; then
    verdict=AT_RISK; reasons="$local_only commit(s) not on any remote and not in default branch"
  elif [ "$locked" = yes ]; then verdict=REVIEW; reasons="locked"
  else
    verdict=SAFE
    if [ "$ancestor" = yes ] || [ "$content_in_default" = yes ]; then reasons="work is in $DEFAULT_REF"
    else
      # Pushed but not in the default branch. Removing the worktree loses nothing (commits
      # are on the remote), but whether the work is finished is the user's call.
      verdict=REVIEW
      case "$pr" in
        *MERGED*) reasons="PR ${pr%% http*} but HEAD has changes not in $DEFAULT_REF" ;;
        *CLOSED*) reasons="PR ${pr%% http*} without merge; work is only on the remote branch" ;;
        *OPEN*) reasons="PR ${pr%% http*} still open" ;;
        *) reasons="pushed but not in $DEFAULT_REF, PR state $pr" ;;
      esac
    fi
    [ "$idx_age" -lt 2 ] && { verdict=REVIEW; reasons="$reasons; touched in the last 2h"; }
    [ "$submodules" = yes ] && { verdict=REVIEW; reasons="$reasons; has submodules (remove needs --force)"; }
    [ -n "$ignored_kept" ] && { verdict=REVIEW; reasons="$reasons; ignored local files would be deleted"; }
    [ -n "$session_age" ] && [ "$session_age" -lt 168 ] && { verdict=REVIEW; reasons="$reasons; a Claude Code session used it ${session_age}h ago"; }
  fi
  echo "verdict: $verdict ($reasons)"
  echo
}

MAIN_PATH=""
MATCHED=0
path="" head="" bref="" detached=no bare=no locked=no lreason="" prunable=no preason=""
flush() {
  [ -z "$path" ] && return
  [ -z "$MAIN_PATH" ] && MAIN_PATH="$path"
  report "$path" "$head" "$bref" "$detached" "$bare" "$locked" "$lreason" "$prunable" "$preason" </dev/null
  path="" head="" bref="" detached=no bare=no locked=no lreason="" prunable=no preason=""
}
# Read the whole porcelain listing first: report() runs git and must not share its stdin.
LIST=$(G worktree list --porcelain; echo)
while IFS= read -r line; do
  case "$line" in
    "worktree "*) path=${line#worktree } ;;
    "HEAD "*) head=${line#HEAD } ;;
    "branch "*) bref=${line#branch } ;;
    detached) detached=yes ;;
    bare) bare=yes ;;
    locked) locked=yes ;;
    "locked "*) locked=yes; lreason=${line#locked } ;;
    prunable) prunable=yes ;;
    "prunable "*) prunable=yes; preason=${line#prunable } ;;
    "") flush ;;
  esac
done <<LISTEOF
$LIST
LISTEOF
flush

if [ -n "$ONLY_PATH" ] && [ "$MATCHED" = 0 ]; then
  echo "error: no worktree matches $ONLY_PATH (compare with git worktree list)" >&2
  exit 3
fi
