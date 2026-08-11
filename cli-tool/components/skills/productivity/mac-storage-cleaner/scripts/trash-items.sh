#!/bin/bash
# mac-storage-cleaner TRASH — move given paths to the Trash (reversible), not rm.
# Use for anything riskier than a pure cache: ask-tier items, app leftovers,
# big/old files. The user can restore from Trash until it's emptied. Every
# action is logged. Usage: trash-items.sh <path> [<path> ...]
# Exit codes: 0 = ok (nothing failed); 1 = at least one item could not be
# trashed (permissions/TCC); 2 = every item was refused and nothing moved;
# 3 = refused to run at all because the audit log isn't writable (see
# MSC_ALLOW_UNLOGGED below).
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/lib.sh"

[ "$#" -eq 0 ] && { echo "usage: trash-items.sh <path> [<path> ...]  (exit 0=ok, 1=a trash failed, 2=all refused/nothing moved, 3=audit log unwritable)"; exit 1; }

# MSC_DRY_RUN=1 is a REAL preview here, not just a log_op no-op: without this,
# a caller that exports MSC_DRY_RUN=1 (e.g. following clean-safe.sh's
# convention) would still get every path actually moved to the Trash — log_op
# would silently no-op, so the run wouldn't even be audited. Ordering matches
# clean-safe.sh's contract: nothing is validated/scanned differently, only the
# final trash_path call (and its log entry) is skipped.
DRY=0
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
for p in "$@"; do
  if [ ! -e "$p" ] && [ ! -L "$p" ]; then
    echo "  not found: $p"
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
else
  echo "$moved item(s) moved to Trash — restorable until you empty it."
  echo "Space is reclaimed when the Trash is emptied (Finder > Empty Trash)."
fi
echo "Log: $LOG_DIR/operations.log"

if [ "$failed" -gt 0 ]; then
  exit 1
elif [ "$refused" -gt 0 ] && [ "$moved" -eq 0 ]; then
  exit 2
fi
exit 0
