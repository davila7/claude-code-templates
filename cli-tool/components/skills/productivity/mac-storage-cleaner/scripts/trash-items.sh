#!/bin/bash
# mac-storage-cleaner TRASH — move given paths to the Trash (reversible), not rm.
# Use for anything riskier than a pure cache: ask-tier items, app leftovers,
# big/old files. The user can restore from Trash until it's emptied. Every
# action is logged. Usage: trash-items.sh [--force] [--dry-run] <path> [<path> ...]
# Exit codes: 0 = ok (nothing failed — includes a dry-run mix of
# previewed+refused items, and a missing-only run); 1 = at least one item
# could not be trashed (permissions/TCC); 2 = nothing was moved or previewed
# and at least one item was refused (all-refused, dry or real), OR an unknown
# leading flag was given — this must fail closed (exit, trash nothing) rather
# than fall into the path loop and trash the remaining arguments for real;
# 3 = refused to run at all because the audit log isn't writable (see
# MSC_ALLOW_UNLOGGED below); 4 = refused as a bulk operation (see
# MSC_MAX_TRASH_ITEMS / MSC_MAX_TRASH_GB and --force).
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/lib.sh"

# --force must be the first argument. It only ever relaxes the bulk-operation
# cap below; it does not bypass path validation or the never-tier denials.
FORCE=0
[ "${1:-}" = "--force" ] && { FORCE=1; shift; }

# Any other leading flag must be recognized explicitly and never fall through
# to the path loop below: an unrecognized flag like --dry-run used to print
# "not found: --dry-run" and then trash the REMAINING paths for real — a
# preview request silently performing a real destructive run. --dry-run is a
# real preview switch (same contract as MSC_DRY_RUN=1, wired in below); any
# other -* argument is rejected outright (fail closed, exit 2) rather than
# risk the same class of bug for a flag we haven't thought of yet.
DRY_FLAG=0
case "${1:-}" in
  --dry-run) DRY_FLAG=1; shift ;;
  --) shift ;;
  -*) echo "unknown argument: $1 (supported: --force, --dry-run)"; exit 2 ;;
esac

[ "$#" -eq 0 ] && { echo "usage: trash-items.sh [--force] [--dry-run] <path> [<path> ...]  (exit 0=ok/previewed/missing-only, 1=a trash failed, 2=all refused & nothing moved/previewed (or an unknown flag), 3=audit log unwritable, 4=refused as a bulk operation)"; exit 1; }

# --dry-run (DRY_FLAG above) or MSC_DRY_RUN=1 is a REAL preview here, not just
# a log_op no-op: without this, a caller that exports MSC_DRY_RUN=1 (e.g.
# following clean-safe.sh's convention) would still get every path actually
# moved to the Trash — log_op would silently no-op, so the run wouldn't even
# be audited. Ordering matches clean-safe.sh's contract: nothing is
# validated/scanned differently, only the final trash_path call (and its log
# entry) is skipped. MSC_DRY_RUN=1 can only ever make a run safer, so it is
# checked last and can turn DRY on but never off.
DRY=0
[ "$DRY_FLAG" = 1 ] && DRY=1
[ "${MSC_DRY_RUN:-0}" = "1" ] && DRY=1
export MSC_DRY_RUN="$DRY"
[ "$DRY" = 1 ] && echo "=== DRY RUN — nothing will be trashed ==="

# Abort-if-unlogged: a run that trashes items without recording what it did
# defeats the whole audit-trail promise. Refuse by default; MSC_ALLOW_UNLOGGED=1
# is an explicit, opt-in escape hatch (falls back to the old warn-and-continue).
if [ "$DRY" != 1 ] && ! log_writable; then
  if [ "${MSC_ALLOW_UNLOGGED:-0}" = "1" ]; then
    echo "⚠ Cannot write the audit log ($LOG_DIR/operations.log) — items will still be trashed, but this run will NOT be recorded."
  else
    echo "✗ Cannot write the audit log ($LOG_DIR/operations.log). Refusing to delete unlogged. Set MSC_ALLOW_UNLOGGED=1 to override."
    exit 3
  fi
fi
moved=0
failed=0
refused=0
previewed=0
missing=0
if [ "$DRY" != 1 ]; then
# Blast-radius cap. Some agents (opencode, OpenClaw) run shell commands with no
# approval prompt, so a single call assembling "all my old downloads" could move
# hundreds of a user's files at once. Count only ELIGIBLE paths — missing and
# protected-refused paths are not the user's data leaving its place. One `du -sck`
# gives the grand total in a single walk.
MAX_ITEMS="${MSC_MAX_TRASH_ITEMS:-100}"
MAX_GB="${MSC_MAX_TRASH_GB:-5}"
case "$MAX_ITEMS" in ''|*[!0-9]*) MAX_ITEMS=100 ;; esac
case "$MAX_GB"    in ''|*[!0-9]*) MAX_GB=5 ;; esac
# An all-digit string can still be an invalid OCTAL literal in bash arithmetic
# ("08" -> "value too great for base"), which would make $(( )) below fail and
# silently skip the size cap. Force base 10 once, here, so every later use —
# arithmetic and display alike — sees a normalized decimal.
MAX_ITEMS=$((10#$MAX_ITEMS))
MAX_GB=$((10#$MAX_GB))
eligible_n=0
eligible=()
for p in "$@"; do
  { [ -e "$p" ] || [ -L "$p" ]; } || continue
  validate_target_path "$p" || continue
  eligible+=("$p")
  eligible_n=$((eligible_n + 1))
done
bulk_kb=0
size_unknown=0
if [ "$eligible_n" -gt 0 ]; then
  # Capture du's OWN exit status, not a pipeline's: `du_out=$(du ...)` is a
  # single command substitution around ONE command (no internal pipe), so $?
  # right after it is genuinely du's rc. `${PIPESTATUS[0]}` cannot be used
  # here instead — PIPESTATUS does not cross a command-substitution subshell
  # boundary (verified: `x=$(false | true); echo "${PIPESTATUS[*]}"` prints
  # `0`, the outer assignment's own status, not the inner pipe's — in bash
  # 3.2 or later). A permission-denied path makes du print a well-formed but
  # WRONG "0\ttotal" while still exiting non-zero, so the captured rc is the
  # only reliable signal for that case. The tail/awk extraction below now
  # runs on already-captured text, not a second live subprocess pipe, so it
  # needs no exit-status handling of its own.
  du_out=$(du -sck "${eligible[@]}" 2>/dev/null)
  du_rc=$?
  bulk_kb=$(printf '%s\n' "$du_out" | tail -1 | awk '{print $1}')
  # An empty/non-numeric total means du gave us nothing usable — never fake
  # that as a trustworthy zero (honest-accounting: report size? on an
  # unmeasurable path, never a silent 0). A genuinely successful zero (every
  # eligible path measured and truly empty) is already a valid digit string
  # and never reaches this branch, so it is never mistaken for "unmeasurable".
  case "$bulk_kb" in ''|*[!0-9]*) bulk_kb=0; size_unknown=1 ;; esac
  [ "$du_rc" -ne 0 ] && size_unknown=1
fi
# Honest-accounting: bulk_kb is forced to 0 above whenever size_unknown=1, so
# human_kb on it would print a misleading "0.0K" in the refusal message below
# (as if the batch were measured and genuinely empty). Say size? instead.
if [ "$size_unknown" = 1 ]; then bulk_disp="size?"; else bulk_disp=$(human_kb "$bulk_kb"); fi
if [ "$FORCE" != 1 ] && { [ "$eligible_n" -gt "$MAX_ITEMS" ] || { [ "$size_unknown" != 1 ] && [ "$bulk_kb" -gt $((MAX_GB * 1024 * 1024)) ]; }; }; then
  echo "✗ Refusing a bulk operation: $eligible_n item(s), $bulk_disp (limits: $MAX_ITEMS items, ${MAX_GB}GB)."
  echo "  This guard exists because some agents run shell commands without asking you first."
  echo "  Review the list, then re-run the same command with --force as the first argument."
  log_op refused-blast-radius "$bulk_disp" "$eligible_n item(s)"
  exit 4
fi
# Size was unmeasurable (some eligible path is unreadable) — fail open, not
# closed: over-refusing on a transient permission hiccup would just push
# users toward --force, which also disables the item cap. Say so honestly
# instead of silently proceeding as if the batch were confirmed small.
if [ "$size_unknown" = 1 ]; then
  echo "⚠ Could not fully measure this batch (some paths are unreadable) — the ${MAX_GB}GB size guard was NOT enforced for this run. The $MAX_ITEMS-item limit still applies."
  log_op size-unmeasurable "?" "$eligible_n item(s)"
fi
# Spec D2: the audit log must record the consent path for every destructive
# invocation. clean-safe.sh already logs `consent -- --apply`; --force is the
# most dangerous invocation this tool has (it also disables the item cap), so
# it must leave the same kind of marker. Nested inside `[ "$DRY" != 1 ]` above
# — a `--force --dry-run` preview must never log a consent marker for a
# deletion that didn't happen.
[ "$FORCE" = 1 ] && log_op consent "-" "--force"
fi
for p in "$@"; do
  if [ ! -e "$p" ] && [ ! -L "$p" ]; then
    echo "  not found: $p"
    missing=$((missing + 1))
    continue
  fi
  # Refuse BEFORE the size scan: du -sk on a protected root ($HOME, /Users,
  # ...) can walk gigabytes of data just to print a number nobody asked for
  # once we're about to say REFUSED anyway. trash_path still re-validates
  # internally (rc 2) as defense in depth for callers that invoke it
  # directly, but refusal here must stay O(1).
  if ! validate_target_path "$p"; then
    echo "  REFUSED (protected system/user root — never trashed by this tool): $p"
    log_op refused "-" "$p"
    refused=$((refused + 1))
    continue
  fi
  # size_kb can come back empty (du failed/blocked) — say so honestly instead
  # of printing a misleading "0.0K".
  kb=$(size_kb "$p")
  sz=$([ -n "$kb" ] && human_kb "$kb" || echo "size?")
  if [ "$DRY" = 1 ]; then
    echo "  would trash $sz  $p"
    previewed=$((previewed + 1))
    continue
  fi
  rc=0; trash_path "$p" || rc=$?
  if [ "$rc" -eq 0 ]; then
    if [ -n "$TRASH_METHOD" ]; then
      echo "  trashed ($TRASH_METHOD) $sz  $p"
      log_op "trashed($TRASH_METHOD)" "$sz" "$p"
      moved=$((moved + 1))
    else
      # rc 0 with an EMPTY TRASH_METHOD means trash_path found nothing to
      # move (already gone) — reporting "trashed" here would be a lie about
      # what actually happened.
      echo "  already gone: $p"
    fi
  elif [ "$rc" -eq 2 ]; then
    echo "  REFUSED (protected system/user root — never trashed by this tool): $p"
    log_op refused "-" "$p"
    refused=$((refused + 1))
  else
    echo "  could NOT trash (permissions/TCC?): $p"
    log_op trash-failed "$sz" "$p"
    failed=$((failed + 1))
  fi
done

echo
if [ "$DRY" = 1 ]; then
  echo "Preview only — nothing was trashed. Re-run without MSC_DRY_RUN=1 to actually trash these items."
  [ "$previewed" -gt 0 ] && echo "$previewed item(s) previewed."
else
  echo "$moved item(s) moved to Trash — restorable until you empty it."
  echo "Space is reclaimed when the Trash is emptied (Finder > Empty Trash)."
fi
[ "$refused" -gt 0 ] && echo "$refused item(s) refused (protected path)."
[ "$missing" -gt 0 ] && echo "$missing item(s) not found."
echo "Log: $LOG_DIR/operations.log"

# Exit codes: 1 = at least one item could not be trashed (permissions/TCC);
# 2 = nothing was moved or even previewed AND at least one item was refused
# (an all-refused run — dry or real — signals failure; a run mixing a valid
# path with a refused one still exits 0, since the valid path did/would move,
# and a missing-only run also exits 0 — nothing failed or was refused, the
# missing count is just called out above) — an unrecognized leading flag also
# exits 2, but earlier, before argument parsing even reaches this point;
# 4 = refused as a bulk operation (see MSC_MAX_TRASH_ITEMS / MSC_MAX_TRASH_GB
# and --force) — exited earlier, above the main loop, before anything was moved.
if [ "$failed" -gt 0 ]; then
  exit 1
elif [ "$((moved + previewed))" -eq 0 ] && [ "$refused" -gt 0 ]; then
  exit 2
fi
exit 0
