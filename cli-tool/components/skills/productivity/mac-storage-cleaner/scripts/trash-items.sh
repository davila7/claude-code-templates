#!/bin/bash
# mac-storage-cleaner TRASH — move given paths to the Trash (reversible), not rm.
# Use for anything riskier than a pure cache: ask-tier items, app leftovers,
# big/old files. The user can restore from Trash until it's emptied. Every
# action is logged. Usage: trash-items.sh <path> [<path> ...]
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/lib.sh"

[ "$#" -eq 0 ] && { echo "usage: trash-items.sh <path> [<path> ...]"; exit 1; }

moved=0
for p in "$@"; do
  if [ ! -e "$p" ]; then
    echo "  not found: $p"
    continue
  fi
  sz=$(human_kb "$(size_kb "$p")")
  if trash_path "$p"; then
    echo "  trashed $sz  $p"
    log_op trashed "$sz" "$p"
    moved=$((moved + 1))
  else
    echo "  could NOT trash (permissions/TCC?): $p"
    log_op trash-failed "$sz" "$p"
  fi
done

echo
echo "$moved item(s) moved to Trash — restorable until you empty it."
echo "Space is reclaimed when the Trash is emptied (Finder > Empty Trash)."
echo "Log: $LOG_DIR/operations.log"
