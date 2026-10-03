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
load_whitelist
collect "${SAFE_PATHS[@]}"
if [ "${#FOUND[@]}" -gt 0 ]; then
  # Partition into eligible (would actually be cleared) vs whitelisted (user
  # opted these out) BEFORE totaling, so "reclaimable" never overstates what
  # clean-safe.sh would really do — a whitelisted multi-GB cache silently
  # inflating the headline total would be exactly the kind of dishonest
  # accounting this tool exists to avoid.
  eligible=(); wl=()
  for f in "${FOUND[@]}"; do
    if is_whitelisted "$f"; then wl+=("$f"); else eligible+=("$f"); fi
  done
  {
    [ "${#eligible[@]}" -gt 0 ] && du -sh "${eligible[@]}" 2>/dev/null
    [ "${#wl[@]}" -gt 0 ] && du -sh "${wl[@]}" 2>/dev/null | sed 's/$/ (whitelisted — excluded from total)/'
  } | sort -rh
  line
  if [ "${#eligible[@]}" -gt 0 ]; then
    du -sch "${eligible[@]}" 2>/dev/null | tail -1 | awk '{print "reclaimable in safe tier: "$1}'
  else
    echo "reclaimable in safe tier: $(human_kb 0)"
  fi
  echo "  (process-guarded items may still be skipped at run time — clean-safe.sh --dry-run gives the exact preview)"
  [ "${#WHITELIST[@]}" -gt 0 ] && \
    echo "  (whitelist active: ${#WHITELIST[@]} protected pattern(s) — clean-safe will skip matches; edit $MSC_WHITELIST_FILE)"
else
  echo "  (none present)"
fi
collect "${KEEP_N_PATHS[@]}"
if [ "${#FOUND[@]}" -gt 0 ]; then
  KEEPN="${MSC_DEVICE_SUPPORT_KEEP:-2}"
  case "$KEEPN" in ''|*[!0-9]*) KEEPN=2 ;; esac
  du -sh "${FOUND[@]}" 2>/dev/null | sort -rh | sed "s/\$/   (keeps $KEEPN newest versions)/"
fi
echo

echo "===== Other large ~/Library/Caches entries (usually safe — verify, Trash if unsure) ====="
echo "Only the vetted safe list above is auto-deleted; these are for you to review."
du -sh "$HOME/Library/Caches/"* 2>/dev/null | sort -rh | head -12
echo

echo "===== App caches — Electron apps (clean-safe clears these automatically when the app isn't running) ====="
# Electron-style cache subfolders (depth<=2) directly under an app's own
# Application Support dir — these are what clean-safe.sh actually auto-clears.
# Kept as a separate listing (and header) from the browser-profile block
# below: browser profile caches are NEVER auto-cleared, so grouping them
# under the same "auto-clear" title would overclaim what this tool does.
electron_apps=$(
  find "$HOME/Library/Application Support" -mindepth 2 -maxdepth 2 -type d \
    \( -name Cache -o -name "Code Cache" -o -name GPUCache -o -name DawnWebGPUCache \) 2>/dev/null \
  | while IFS= read -r d; do du -sh "$d" 2>/dev/null; done | sort -rh | head -15
)
if [ -n "$electron_apps" ]; then printf '%s\n' "$electron_apps"; else echo "  (no Electron-style app caches found, or they're TCC-protected)"; fi
echo
echo "  browser profile caches (NOT auto-cleared — review via catalog):"
browser_apps=$(
  {
    for b in \
      "Google/Chrome" "BraveSoftware/Brave-Browser" "Microsoft Edge" \
      "Arc" "Vivaldi" "Chromium" "com.operasoftware.Opera"; do
      for sub in "Default/Cache" "Default/Code Cache" "Default/Service Worker/CacheStorage"; do
        d="$HOME/Library/Application Support/$b/$sub"
        [ -d "$d" ] && printf '%s\n' "$d"
      done
    done
  } | while IFS= read -r d; do du -sh "$d" 2>/dev/null; done | sort -rh | head -15
)
if [ -n "$browser_apps" ]; then printf '%s\n' "$browser_apps"; else echo "  (none found)"; fi
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
# Read-only; gated on xcode-select -p (same reasoning as clean-safe.sh) so a
# non-developer Mac with no toolchain selected never triggers simctl at all.
if xcode-select -p >/dev/null 2>&1; then
  rtcount=$(xcrun simctl list runtimes 2>/dev/null | grep -c " - ")
  [ "${rtcount:-0}" -gt 0 ] && echo "  iOS/watchOS/tvOS simulator runtimes installed: $rtcount — each 5-10GB; remove unused: xcrun simctl runtime list / delete <id>"
fi
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
