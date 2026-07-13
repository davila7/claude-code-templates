#!/bin/bash
# mac-storage-cleaner SURVEY — 100% read-only. Discovers and sizes caches across
# every common ecosystem, showing only what actually exists on this Mac.
# Deletes nothing. Safe to run anytime.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/lib.sh"

line () { printf '%s\n' "--------------------------------------------------------------"; }

echo "================= mac-storage-cleaner survey (read-only) ================="
echo
echo "Free space:"
if [ -d /System/Volumes/Data ]; then df -h /System/Volumes/Data 2>/dev/null | sed -n '1p;$p'; else df -h /; fi
echo

echo "===== SAFE caches — auto-clearable (only cost: slower next build) ====="
collect "${SAFE_PATHS[@]}"
if [ "${#FOUND[@]}" -gt 0 ]; then
  du -sh "${FOUND[@]}" 2>/dev/null | sort -rh
  line
  du -sch "${FOUND[@]}" 2>/dev/null | tail -1 | awk '{print "reclaimable in safe tier: "$1}'
else
  echo "  (none present)"
fi
echo

echo "===== Other large ~/Library/Caches entries (usually safe — verify, Trash if unsure) ====="
echo "Only the vetted safe list above is auto-deleted; these are for you to review."
du -sh "$HOME/Library/Caches/"* 2>/dev/null | sort -rh | head -12
echo

echo "===== App caches — Electron & browsers (safe; quit the app first) ====="
# Electron-style cache subfolders (depth<=2) + known browser profile caches.
{
  find "$HOME/Library/Application Support" -maxdepth 2 -type d \
    \( -name Cache -o -name "Code Cache" -o -name GPUCache -o -name DawnWebGPUCache \) 2>/dev/null
  for b in \
    "Google/Chrome" "BraveSoftware/Brave-Browser" "Microsoft Edge" \
    "Arc" "Vivaldi" "Chromium" "com.operasoftware.Opera"; do
    for sub in "Default/Cache" "Default/Code Cache" "Default/Service Worker/CacheStorage"; do
      d="$HOME/Library/Application Support/$b/$sub"
      [ -d "$d" ] && printf '%s\n' "$d"
    done
  done
} | while IFS= read -r d; do du -sh "$d" 2>/dev/null; done | sort -rh | head -15
[ -z "$(find "$HOME/Library/Application Support" -maxdepth 2 -type d -name Cache 2>/dev/null | head -1)" ] && echo "  (scan found little; some may be TCC-protected)"
echo

echo "===== ASK first — big, but expensive to restore or not a cache ====="
collect "${ASK_PATHS[@]}"
if [ "${#FOUND[@]}" -gt 0 ]; then
  du -sh "${FOUND[@]}" 2>/dev/null | sort -rh
else
  echo "  (none present)"
fi
d="$HOME/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw"
[ -f "$d" ] && stat -f '  Docker.raw last modified: %Sm' "$d" 2>/dev/null
echo

echo "===== NEVER auto-delete — user data (reported for awareness only) ====="
collect "${NEVER_PATHS[@]}"
if [ "${#FOUND[@]}" -gt 0 ]; then
  du -sh "${FOUND[@]}" 2>/dev/null | sort -rh
else
  echo "  (none present)"
fi
snap=$(tmutil listlocalsnapshots / 2>/dev/null | grep -c 'com.apple.TimeMachine')
[ "${snap:-0}" -gt 0 ] && echo "  Time Machine local snapshots: $snap (backups — hold 'purgeable' space; macOS thins them automatically)"
echo

echo "===== Top ~/Library/Application Support (app DATA, not cache) ====="
du -sh "$HOME/Library/Application Support/"* 2>/dev/null | sort -rh | head -8
echo
line
echo "NOTE: After deleting, macOS may mark freed space 'purgeable' (esp. if Time"
echo "Machine local snapshots reference it), so df 'Avail' can lag. It frees on"
echo "demand; to force snapshot thinning: tmutil thinlocalsnapshots / 999999999999 4"
