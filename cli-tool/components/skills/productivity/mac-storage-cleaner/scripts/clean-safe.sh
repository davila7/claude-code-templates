#!/bin/bash
# mac-storage-cleaner CLEAN — removes ONLY the vetted safe tier (pure caches).
# Never touches the ask/never tiers, browser/app data, models, VMs, or backups.
# Handles read-only files (chmod) and reports anything blocked by macOS App
# Management/TCC instead of failing. Run survey.sh first and show the user.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/lib.sh"
load_whitelist

# Reject anything other than --dry-run outright: an unrecognized flag (typo,
# stale docs, a future option someone half-wires up) must never fail OPEN into
# a real deletion run just because it doesn't match the "--dry-run" check below.
[ $# -gt 0 ] && [ "$1" != "--dry-run" ] && { echo "unknown argument: $1 (only --dry-run is supported)"; exit 2; }

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1
[ "${MSC_DRY_RUN:-0}" = "1" ] && DRY=1
export MSC_DRY_RUN="$DRY"
[ "$DRY" = 1 ] && echo "=== DRY RUN — nothing will be deleted ==="

total_kb=0
skipped=0
# Deferred-skip rollup (printed once, near the end): breaks the generic
# `skipped` total down by REASON so the user gets one actionable line instead
# of having to scroll every "skipped (...)" entry above to find the pattern.
skipped_inuse=0
skipped_wl=0
skipped_sym=0
# Abort-if-unlogged: a run that deletes without recording what it deleted
# defeats the whole audit-trail promise. Refuse by default; MSC_ALLOW_UNLOGGED=1
# is an explicit, opt-in escape hatch for the rare case the log dir genuinely
# can't be made writable (falls back to the old warn-and-continue behavior).
if [ "$DRY" != 1 ] && ! log_writable; then
  if [ "${MSC_ALLOW_UNLOGGED:-0}" = "1" ]; then
    echo "⚠ Cannot write the audit log ($LOG_DIR/operations.log) — cleanup will proceed, but this run will NOT be recorded."
  else
    echo "✗ Cannot write the audit log ($LOG_DIR/operations.log). Refusing to delete unlogged. Set MSC_ALLOW_UNLOGGED=1 to override."
    exit 3
  fi
fi
echo "Clearing safe caches (pure caches only)..."
collect "${SAFE_PATHS[@]}"
# bash 3.2 (macOS default) throws "unbound variable" on "${FOUND[@]}" when the
# array is empty under `set -u` — which happens on a fresh Mac with no dev
# caches. Guard the loop so a clean machine reports "nothing to do" instead of crashing.
[ "${#FOUND[@]}" -gt 0 ] && for p in "${FOUND[@]}"; do
  if [ -L "$p" ]; then
    echo "  skipped (symlink — removing it would only delete the link, not the data): $p"
    log_op skipped-symlink "-" "$p"
    skipped=$((skipped + 1)); skipped_sym=$((skipped_sym + 1))
    continue
  fi
  if is_whitelisted "$p"; then
    echo "  skipped (whitelisted): $p"
    log_op skipped-whitelisted "-" "$p"
    skipped=$((skipped + 1)); skipped_wl=$((skipped_wl + 1))
    continue
  fi
  if reason=$(guard_reason_for_path "$p"); then
    echo "  skipped ($reason): $p"
    log_op skipped-in-use "-" "$p"
    skipped=$((skipped + 1)); skipped_inuse=$((skipped_inuse + 1))
    continue
  fi
  kb=$(size_kb "$p")
  # size_kb can come back empty (du failed/blocked) — say so honestly instead
  # of printing a misleading "0.0K"; ${kb:-0} below still guards the actual
  # arithmetic under set -u and never lets an unknown size inflate the total.
  disp=$([ -n "$kb" ] && human_kb "$kb" || echo "size?")
  if ! validate_target_path "$p"; then
    echo "  REFUSED (protected path reached deletion loop — report this): $p"
    log_op refused "-" "$p"
    skipped=$((skipped + 1))
    continue
  fi
  if [ "$DRY" = 1 ]; then
    echo "  would remove $disp  $p"
    total_kb=$((total_kb + ${kb:-0}))
    continue
  fi
  if ! rm -rf "$p" 2>/dev/null; then
    chmod -R u+w "$p" 2>/dev/null   # read-only files (e.g. Go/SwiftPM caches)
    rm -rf "$p" 2>/dev/null
  fi
  if [ -e "$p" ]; then
    kb_after=$(size_kb "$p")
    if [ -n "$kb_after" ] && [ "${kb_after:-0}" -lt "${kb:-0}" ]; then
      freed=$(( ${kb:-0} - kb_after ))
      echo "  partially removed ($(human_kb "$freed") freed, $(human_kb "$kb_after") blocked): $p"
      log_op partial "$(human_kb "$freed")" "$p"
      total_kb=$((total_kb + freed)); skipped=$((skipped + 1))
    else
      echo "  skipped (macOS App Management/TCC-protected or in use): $p"
      log_op skipped "$disp" "$p"
      skipped=$((skipped + 1))
    fi
  else
    echo "  removed $disp  $p"
    log_op removed "$disp" "$p"
    total_kb=$((total_kb + ${kb:-0}))
  fi
done

# Keep-N retention: DeviceSupport regenerates per-version on device connect, so
# keep the newest MSC_DEVICE_SUPPORT_KEEP (default 2) and clear older versions.
KEEPN="${MSC_DEVICE_SUPPORT_KEEP:-2}"
case "$KEEPN" in ''|*[!0-9]*) KEEPN=2 ;; esac
for base in "${KEEP_N_PATHS[@]}"; do
  [ -d "$base" ] || continue
  # [ -d ] above FOLLOWS a symlink, so a symlinked retention root (e.g. "iOS
  # DeviceSupport" replaced with a symlink to elsewhere) would otherwise sail
  # through and have its TARGET's children enumerated and deleted. Refuse the
  # base itself instead.
  [ -L "$base" ] && { echo "  skipped (symlink base): $base"; log_op skipped-symlink "-" "$base"; skipped=$((skipped+1)); skipped_sym=$((skipped_sym+1)); continue; }
  if is_whitelisted "$base"; then
    echo "  skipped (whitelisted): $base"; log_op skipped-whitelisted "-" "$base"; skipped=$((skipped+1)); skipped_wl=$((skipped_wl+1)); continue
  fi
  if reason=$(guard_reason_for_path "$base"); then
    echo "  skipped ($reason): $base"; log_op skipped-in-use "-" "$base"; skipped=$((skipped+1)); skipped_inuse=$((skipped_inuse+1)); continue
  fi
  removed_any=0
  while IFS= read -r child; do
    # Empty child would collapse "$base/$child" to $base itself — never delete that.
    [ -n "$child" ] || continue
    p="$base/$child"
    [ -e "$p" ] || continue
    if [ -L "$p" ]; then
      echo "  skipped (symlink — removing it would only delete the link, not the data): $p"
      log_op skipped-symlink "-" "$p"; skipped=$((skipped+1)); skipped_sym=$((skipped_sym+1)); continue
    fi
    if is_whitelisted "$p"; then
      echo "  skipped (whitelisted): $p"; log_op skipped-whitelisted "-" "$p"; skipped=$((skipped+1)); skipped_wl=$((skipped_wl+1)); continue
    fi
    kb=$(size_kb "$p")
    disp=$([ -n "$kb" ] && human_kb "$kb" || echo "size?")
    if ! validate_target_path "$p"; then
      echo "  REFUSED (protected path reached deletion loop — report this): $p"
      log_op refused "-" "$p"; skipped=$((skipped+1)); continue
    fi
    if [ "$DRY" = 1 ]; then
      echo "  would remove $disp  $p"
      total_kb=$((total_kb + ${kb:-0})); removed_any=1; continue
    fi
    rm -rf "$p" 2>/dev/null
    if [ -e "$p" ]; then
      kb_after=$(size_kb "$p")
      if [ -n "$kb_after" ] && [ "${kb_after:-0}" -lt "${kb:-0}" ]; then
        freed=$(( ${kb:-0} - kb_after ))
        echo "  partially removed ($(human_kb "$freed") freed, $(human_kb "$kb_after") blocked): $p"
        log_op partial "$(human_kb "$freed")" "$p"
        total_kb=$((total_kb + freed)); skipped=$((skipped+1))
      else
        echo "  skipped (protected or in use): $p"; log_op skipped "$disp" "$p"; skipped=$((skipped+1))
      fi
    else
      echo "  removed $disp  $p"; log_op removed "$disp" "$p"
      total_kb=$((total_kb + ${kb:-0})); removed_any=1
    fi
  done <<EOF
$(keep_newest_n_children "$base" "$KEEPN")
EOF
  [ "$removed_any" = 1 ] && echo "  (kept $KEEPN newest in $(basename "$base"))"
done

# AI CLI old versions: keep the active one (symlink-pinned) + N newest others.
AIKEEP="${MSC_AI_AGENTS_KEEP:-1}"
case "$AIKEEP" in ''|*[!0-9]*) AIKEEP=1 ;; esac
for spec in "${AI_AGENT_SPECS[@]}"; do
  root="${spec%%|*}"; rest="${spec#*|}"; label="${rest%%|*}"; link="${rest#*|}"
  [ -d "$root" ] || continue
  # Same symlinked-root defense as the DeviceSupport keep-N loop above.
  [ -L "$root" ] && { echo "  skipped (symlink base): $root"; log_op skipped-symlink "-" "$root"; skipped=$((skipped+1)); skipped_sym=$((skipped_sym+1)); continue; }
  if is_whitelisted "$root"; then
    echo "  skipped (whitelisted): $root"; log_op skipped-whitelisted "-" "$root"; skipped=$((skipped+1)); skipped_wl=$((skipped_wl+1)); continue
  fi
  if ! active=$(resolve_active_version_dir "$root" "$link"); then
    echo "  skipped (active version unknown): $label"
    continue
  fi
  kept_others=0
  while IFS= read -r child; do
    [ -n "$child" ] || continue
    [ -d "$root/$child" ] || continue   # stray files (e.g. .DS_Store) are never version dirs — ignore entirely
    [ "$child" = "$active" ] && continue
    if [ "$kept_others" -lt "$AIKEEP" ]; then kept_others=$((kept_others+1)); continue; fi
    p="$root/$child"
    [ -e "$p" ] || continue
    if [ -L "$p" ]; then
      echo "  skipped (symlink — removing it would only delete the link, not the data): $p"
      log_op skipped-symlink "-" "$p"; skipped=$((skipped+1)); skipped_sym=$((skipped_sym+1)); continue
    fi
    if is_whitelisted "$p"; then
      echo "  skipped (whitelisted): $p"; log_op skipped-whitelisted "-" "$p"; skipped=$((skipped+1)); skipped_wl=$((skipped_wl+1)); continue
    fi
    kb=$(size_kb "$p")
    disp=$([ -n "$kb" ] && human_kb "$kb" || echo "size?")
    if ! validate_target_path "$p"; then
      echo "  REFUSED (protected path reached deletion loop — report this): $p"
      log_op refused "-" "$p"; skipped=$((skipped+1)); continue
    fi
    if [ "$DRY" = 1 ]; then
      echo "  would remove $disp  $p ($label old version)"
      total_kb=$((total_kb + ${kb:-0})); continue
    fi
    rm -rf "$p" 2>/dev/null
    if [ -e "$p" ]; then
      kb_after=$(size_kb "$p")
      if [ -n "$kb_after" ] && [ "${kb_after:-0}" -lt "${kb:-0}" ]; then
        freed=$(( ${kb:-0} - kb_after ))
        echo "  partially removed ($(human_kb "$freed") freed, $(human_kb "$kb_after") blocked): $p"
        log_op partial "$(human_kb "$freed")" "$p"
        total_kb=$((total_kb + freed)); skipped=$((skipped+1))
      else
        echo "  skipped: $p"; log_op skipped "$disp" "$p"; skipped=$((skipped+1))
      fi
    else
      echo "  removed $disp  $p ($label old version)"
      log_op removed "$disp" "$p"; total_kb=$((total_kb + ${kb:-0}))
    fi
  # NOTE: unlike the DeviceSupport loop above, this used to intentionally keep
  # mtime ordering here — semver dirs (e.g. "1.0.117" vs "1.0.2") need version
  # sort, not lexical sort, and the ACTIVE version is symlink-pinned (never
  # picked by this ordering at all), so which "spare" versions the mtime
  # order kept was thought to be low-stakes. But `sort -rV` handles semver
  # dirs correctly too, so for consistency with the DeviceSupport loop (and to
  # remove the same updater-can-reorder-mtime risk), use the same
  # glob+version-sort enumeration here as well.
  done <<EOF
$(version_sorted_children "$root")
EOF
done

# Handoff / Universal Clipboard staging: useractivityd is supposed to prune
# these transfer buffers itself but can leave many GB behind (mole #1178).
# Only items UNTOUCHED FOR 60+ MINUTES go — never cut an in-flight sync.
PB="$HOME/Library/Group Containers/group.com.apple.coreservices.useractivityd/shared-pasteboard"
if [ -d "$PB" ] && [ ! -L "$PB" ] && ! is_whitelisted "$PB"; then
  while IFS= read -r -d '' p; do
    [ -n "$p" ] || continue
    [ -e "$p" ] || continue
    [ -L "$p" ] && continue
    # The -mmin +60 age gate above only looks at the candidate's OWN mtime; a
    # directory's mtime doesn't necessarily update every time a file INSIDE it
    # changes, so an old-looking top-level dir can still have an in-flight
    # sync writing to it right now. Skip if ANY descendant was modified in
    # the last 60 minutes — never cut something still actively syncing.
    if [ -d "$p" ] && [ -n "$(find "$p" -mmin -60 -print -quit 2>/dev/null)" ]; then continue; fi
    if is_whitelisted "$p"; then
      echo "  skipped (whitelisted): $p"; log_op skipped-whitelisted "-" "$p"; skipped=$((skipped+1)); skipped_wl=$((skipped_wl+1)); continue
    fi
    kb=$(size_kb "$p")
    disp=$([ -n "$kb" ] && human_kb "$kb" || echo "size?")
    if ! validate_target_path "$p"; then
      echo "  REFUSED (protected path reached deletion loop — report this): $p"
      log_op refused "-" "$p"; skipped=$((skipped+1)); continue
    fi
    if [ "$DRY" = 1 ]; then
      echo "  would remove $disp  $p (Handoff clipboard buffer)"
      total_kb=$((total_kb + ${kb:-0})); continue
    fi
    rm -rf "$p" 2>/dev/null
    if [ -e "$p" ]; then
      echo "  skipped (protected or in use): $p"
      log_op skipped "$disp" "$p"; skipped=$((skipped + 1))
    else
      echo "  removed $disp  $p (Handoff clipboard buffer)"
      log_op removed "$disp" "$p"; total_kb=$((total_kb + ${kb:-0}))
    fi
  # process substitution (bash 3.2-safe): keeps the loop in THIS shell (not a
  # pipe subshell) so total_kb/skipped/... mutations above actually persist;
  # -print0/-d '' makes the enumeration NUL-delimited, safe for any filename
  # (including ones containing newlines).
  done < <(find "$PB" -mindepth 1 -maxdepth 1 -mmin +60 -print0 2>/dev/null)
fi

# Crash reports: apps/macOS write .crash/.ips files here on every crash and
# never prune old ones. Age-gated (30+ days) the same way as Handoff above —
# a recent crash report may still be needed (e.g. for a bug report), so only
# stale ones are cleared. Same shape as the Handoff section: base-level
# symlink/whitelist gate the whole section, per-child symlink/whitelist gate
# each report.
DR="$HOME/Library/Logs/DiagnosticReports"
if [ -d "$DR" ] && [ -L "$DR" ]; then
  echo "  skipped (symlink base): $DR"
  log_op skipped-symlink "-" "$DR"; skipped=$((skipped+1)); skipped_sym=$((skipped_sym+1))
elif [ -d "$DR" ] && ! is_whitelisted "$DR"; then
  while IFS= read -r -d '' p; do
    [ -n "$p" ] || continue
    [ -e "$p" ] || continue
    [ -L "$p" ] && continue
    if is_whitelisted "$p"; then
      echo "  skipped (whitelisted): $p"; log_op skipped-whitelisted "-" "$p"; skipped=$((skipped+1)); skipped_wl=$((skipped_wl+1)); continue
    fi
    kb=$(size_kb "$p")
    disp=$([ -n "$kb" ] && human_kb "$kb" || echo "size?")
    if ! validate_target_path "$p"; then
      echo "  REFUSED (protected path reached deletion loop — report this): $p"
      log_op refused "-" "$p"; skipped=$((skipped+1)); continue
    fi
    if [ "$DRY" = 1 ]; then
      echo "  would remove $disp  $p (crash report >30d)"
      total_kb=$((total_kb + ${kb:-0})); continue
    fi
    rm -rf "$p" 2>/dev/null
    if [ -e "$p" ]; then
      echo "  skipped (protected or in use): $p"
      log_op skipped "$disp" "$p"; skipped=$((skipped + 1))
    else
      echo "  removed $disp  $p (crash report >30d)"
      log_op removed "$disp" "$p"; total_kb=$((total_kb + ${kb:-0}))
    fi
  done < <(find "$DR" -mindepth 1 -maxdepth 1 -mtime +30 -print0 2>/dev/null)
fi

# Electron/Chromium-style app caches: survey.sh has long reported these
# (Cache/Code Cache/GPUCache/DawnWebGPUCache directly under an app's own
# Application Support folder); graduate detection into guarded auto-deletion.
# -mindepth 2 -maxdepth 2 keeps this to DIRECT CHILD app dirs only (e.g.
# "Claude/Cache") — never something deeper inside a browser profile, which
# stays manual (see catalog).
AS="$HOME/Library/Application Support"
if [ -d "$AS" ] && [ -L "$AS" ]; then
  echo "  skipped (symlink base): $AS"
  log_op skipped-symlink "-" "$AS"; skipped=$((skipped+1)); skipped_sym=$((skipped_sym+1))
elif [ -d "$AS" ]; then
  while IFS= read -r -d '' p; do
    [ -n "$p" ] || continue
    [ -e "$p" ] || continue
    # app = the first path component after "Application Support/" (name
    # only — may contain spaces, e.g. "Microsoft Teams"). Newline-safe (and
    # NUL-safe) via the process-substitution-fed `while read -d ''` below,
    # not word-splitting.
    rest="${p#"$AS"/}"
    app="${rest%%/*}"
    appdir="$AS/$app"
    if [ -L "$p" ] || [ -L "$appdir" ]; then
      echo "  skipped (symlink — removing it would only delete the link, not the data): $p"
      log_op skipped-symlink "-" "$p"; skipped=$((skipped+1)); skipped_sym=$((skipped_sym+1)); continue
    fi
    if is_whitelisted "$p" || is_whitelisted "$appdir"; then
      echo "  skipped (whitelisted): $p"; log_op skipped-whitelisted "-" "$p"; skipped=$((skipped+1)); skipped_wl=$((skipped_wl+1)); continue
    fi
    # Process guard, fail-closed (tri-state): an Electron app rewrites these
    # caches live, so a running (or unreadable-process-table) owner must
    # block deletion, not just a known-idle one. The app DIRECTORY name is an
    # approximation of the real process name — a real process name doesn't
    # always match its Application Support folder name verbatim — so a plain
    # exact-name miss must not fail OPEN. Check both directions,
    # case-insensitively: an exact process-name match OR a substring match
    # against any command line. Over-matching only ever costs an extra skip
    # (safe); only a clean double miss counts as idle.
    if command -v pgrep >/dev/null 2>&1; then
      if pgrep -qix "$app" 2>/dev/null || pgrep -qif "$app" 2>/dev/null; then guard_rc=0
      else rc=$?; if [ "$rc" -eq 1 ]; then guard_rc=1; else guard_rc=2; fi; fi
    else
      guard_rc=2
    fi
    if [ "$guard_rc" != 1 ]; then
      echo "  skipped (app running or state unknown): $p"
      log_op skipped-in-use "-" "$p"; skipped=$((skipped+1)); skipped_inuse=$((skipped_inuse+1)); continue
    fi
    kb=$(size_kb "$p")
    disp=$([ -n "$kb" ] && human_kb "$kb" || echo "size?")
    if ! validate_target_path "$p"; then
      echo "  REFUSED (protected path reached deletion loop — report this): $p"
      log_op refused "-" "$p"; skipped=$((skipped+1)); continue
    fi
    if [ "$DRY" = 1 ]; then
      echo "  would remove $disp  $p"
      total_kb=$((total_kb + ${kb:-0})); continue
    fi
    if ! rm -rf "$p" 2>/dev/null; then
      chmod -R u+w "$p" 2>/dev/null
      rm -rf "$p" 2>/dev/null
    fi
    if [ -e "$p" ]; then
      kb_after=$(size_kb "$p")
      if [ -n "$kb_after" ] && [ "${kb_after:-0}" -lt "${kb:-0}" ]; then
        freed=$(( ${kb:-0} - kb_after ))
        echo "  partially removed ($(human_kb "$freed") freed, $(human_kb "$kb_after") blocked): $p"
        log_op partial "$(human_kb "$freed")" "$p"
        total_kb=$((total_kb + freed)); skipped=$((skipped+1))
      else
        echo "  skipped (macOS App Management/TCC-protected or in use): $p"
        log_op skipped "$disp" "$p"; skipped=$((skipped+1))
      fi
    else
      echo "  removed $disp  $p"
      log_op removed "$disp" "$p"; total_kb=$((total_kb + ${kb:-0}))
    fi
  done < <(find "$AS" -mindepth 2 -maxdepth 2 -type d \( -name Cache -o -name "Code Cache" -o -name GPUCache -o -name DawnWebGPUCache \) -print0 2>/dev/null)
fi

# Tool-native cleanups that are unambiguously safe (freed space is separate from
# the rm total above; both are logged for the audit trail).
if command -v brew >/dev/null 2>&1; then
  if [ "$DRY" = 1 ]; then
    echo "  would run: brew cleanup -s --prune=all"
  else
    echo "  brew cleanup (brew cleanup -s --prune=all)..."
    if brew cleanup -s --prune=all >/dev/null 2>&1; then
      echo "  done: brew cleanup"; log_op cleaned "-" "brew cleanup -s --prune=all"
    else
      echo "  (brew cleanup didn't complete — skipped)"
    fi
  fi
fi
# conda: owner command only — pkgs/ is hardlinked into live envs, raw rm breaks them.
if command -v conda >/dev/null 2>&1; then
  if [ "$DRY" = 1 ]; then
    echo "  would run: conda clean -y --tarballs --index-cache --logfiles"
  else
    if conda clean -y --tarballs --index-cache --logfiles >/dev/null 2>&1; then
      echo "  done: conda clean"; log_op cleaned "-" "conda clean -y --tarballs --index-cache --logfiles"
    else
      echo "  (conda clean didn't complete — skipped)"
    fi
  fi
fi
# Gate simctl on a REAL developer install. /usr/bin/xcrun is a stub present on
# every Mac, so `command -v xcrun` passes even with no Xcode/CLT — and calling it
# then pops the macOS "install command line developer tools" dialog, which would
# ambush a non-developer just trying to free space. xcode-select -p only succeeds
# when a toolchain is actually selected.
if xcode-select -p >/dev/null 2>&1 && command -v xcrun >/dev/null 2>&1; then
  if [ "$DRY" = 1 ]; then
    echo "  would run: xcrun simctl delete unavailable"
  else
    if xcrun simctl delete unavailable >/dev/null 2>&1; then
      echo "  done: removed unavailable simulators"; log_op cleaned "-" "simctl delete unavailable"
    else
      echo "  (no unavailable simulators to remove, or simctl unavailable)"
    fi
  fi
fi

echo
if [ "$DRY" = 1 ]; then
  echo "Would reclaim from cache deletions: $(human_kb "$total_kb") — run without --dry-run to apply."
else
  echo "Approx. reclaimed from cache deletions: $(human_kb "$total_kb") (brew/simulator cleanup above frees more, not counted here)"
fi
[ "$skipped" -gt 0 ] && echo "($skipped path(s) skipped — delete via Finder if you need them gone.)"
# Deferred-skip rollup: one actionable line breaking the total down by WHY
# something was skipped, instead of making the user scroll every line above
# to spot the pattern. Only non-zero parts are shown, comma-joined.
skip_parts=()
[ "$skipped_inuse" -gt 0 ] && skip_parts+=("$skipped_inuse in-use (quit the apps and re-run)")
[ "$skipped_wl" -gt 0 ] && skip_parts+=("$skipped_wl whitelisted")
[ "$skipped_sym" -gt 0 ] && skip_parts+=("$skipped_sym symlinked")
if [ "${#skip_parts[@]}" -gt 0 ]; then
  rollup="${skip_parts[0]}"
  i=1
  while [ "$i" -lt "${#skip_parts[@]}" ]; do
    rollup="$rollup, ${skip_parts[$i]}"
    i=$((i + 1))
  done
  echo "Skipped: $rollup."
fi
echo
echo "Free space now:"
if [ -d /System/Volumes/Data ]; then df -h /System/Volumes/Data 2>/dev/null | sed -n '1p;$p'; else df -h /; fi
echo "(APFS may report freed space as 'purgeable'; df 'Avail' can lag behind.)"
echo "Log: $LOG_DIR/operations.log"
