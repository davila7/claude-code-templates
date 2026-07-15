#!/bin/bash
# mac-storage-cleaner CLEAN — removes ONLY the vetted safe tier (pure caches).
# Never touches the ask/never tiers, browser/app data, models, VMs, or backups.
# Handles read-only files (chmod) and reports anything blocked by macOS App
# Management/TCC instead of failing. Run survey.sh first and show the user.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/lib.sh"

total_kb=0
skipped=0
log_writable || echo "⚠ Cannot write the audit log ($LOG_DIR/operations.log) — cleanup will proceed, but this run will NOT be recorded."
echo "Clearing safe caches (pure caches only)..."
collect "${SAFE_PATHS[@]}"
# bash 3.2 (macOS default) throws "unbound variable" on "${FOUND[@]}" when the
# array is empty under `set -u` — which happens on a fresh Mac with no dev
# caches. Guard the loop so a clean machine reports "nothing to do" instead of crashing.
[ "${#FOUND[@]}" -gt 0 ] && for p in "${FOUND[@]}"; do
  kb=$(size_kb "$p")
  if ! rm -rf "$p" 2>/dev/null; then
    chmod -R u+w "$p" 2>/dev/null   # read-only files (e.g. Go/SwiftPM caches)
    rm -rf "$p" 2>/dev/null
  fi
  if [ -e "$p" ]; then
    echo "  skipped (macOS App Management/TCC-protected or in use): $p"
    log_op skipped "$(human_kb "${kb:-0}")" "$p"
    skipped=$((skipped + 1))
  else
    echo "  removed $(human_kb "${kb:-0}")  $p"
    log_op removed "$(human_kb "${kb:-0}")" "$p"
    total_kb=$((total_kb + ${kb:-0}))
  fi
done

# Tool-native cleanups that are unambiguously safe (freed space is separate from
# the rm total above; both are logged for the audit trail).
if command -v brew >/dev/null 2>&1; then
  echo "  brew cleanup (brew cleanup -s --prune=all)..."
  brew cleanup -s --prune=all >/dev/null 2>&1 && { echo "  done: brew cleanup"; log_op cleaned "brew cache" "brew cleanup -s --prune=all"; }
fi
# Gate simctl on a REAL developer install. /usr/bin/xcrun is a stub present on
# every Mac, so `command -v xcrun` passes even with no Xcode/CLT — and calling it
# then pops the macOS "install command line developer tools" dialog, which would
# ambush a non-developer just trying to free space. xcode-select -p only succeeds
# when a toolchain is actually selected.
if xcode-select -p >/dev/null 2>&1 && command -v xcrun >/dev/null 2>&1; then
  xcrun simctl delete unavailable >/dev/null 2>&1 && { echo "  done: removed unavailable simulators"; log_op cleaned "unavailable simulators" "simctl delete unavailable"; }
fi

echo
echo "Approx. reclaimed from cache deletions: $(human_kb "$total_kb") (brew/simulator cleanup above frees more, not counted here)"
[ "$skipped" -gt 0 ] && echo "($skipped path(s) skipped — delete via Finder if you need them gone.)"
echo
echo "Free space now:"
if [ -d /System/Volumes/Data ]; then df -h /System/Volumes/Data 2>/dev/null | sed -n '1p;$p'; else df -h /; fi
echo "(APFS may report freed space as 'purgeable'; df 'Avail' can lag behind.)"
echo "Log: $LOG_DIR/operations.log"
