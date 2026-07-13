#!/bin/bash
# mac-storage-cleaner EXTRAS — read-only discovery BEYOND caches. Finds the space
# hogs the cache survey misses: leftovers of uninstalled apps, big/old files,
# and stale installers. Deletes nothing. Everything here is ask-tier: present
# candidates, let the user choose, then remove via trash-items.sh (reversible).
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
. "$DIR/lib.sh"

line () { printf '%s\n' "--------------------------------------------------------------"; }

echo "============== mac-storage-cleaner extras (read-only) =============="
echo

echo "===== App data whose owner a quick check could NOT confirm installed ====="
echo "CANDIDATES ONLY (>=5MB). A quick check + Spotlight didn't find the owning"
echo "app — but Spotlight misses un-indexed apps, so some of these ARE still"
echo "installed. The skill must confirm each app is really gone before removing,"
echo "and remove via the Trash (reversible), never rm."
if ! mdutil -s / 2>/dev/null | grep -qi 'indexing enabled'; then
  echo "  ⚠ Spotlight indexing looks OFF on this Mac — the install check is UNRELIABLE"
  echo "    here and may list apps that are actually installed. Treat as informational"
  echo "    only and confirm every app by hand before removing anything."
fi
export IDS="$(installed_bundle_ids | sort -u)"
for d in "$HOME/Library/Containers/"*; do
  [ -d "$d" ] || continue
  name=$(basename "$d")
  case "$name" in
    com.apple.*) continue ;;
    # UUID-named group/anonymous containers aren't bundle IDs — reviewed separately.
    [0-9A-Fa-f]*-[0-9A-Fa-f]*-[0-9A-Fa-f]*-*) continue ;;
  esac
  kb=$(size_kb "$d"); [ "${kb:-0}" -ge 5120 ] || continue   # cheap size gate first (skip <5MB noise)
  container_is_orphan "$name" || continue                    # expensive Spotlight lookup only for big ones
  printf '%s\t%s\n' "${kb:-0}" "$d"
done | sort -rn | head -15 | while IFS="$(printf '\t')" read -r kb d; do
  printf '  %s\t%s\n' "$(human_kb "$kb")" "$d"
done
echo "  (if empty: nothing over 5MB looked unmatched)"
echo
echo "Review by hand (folder names aren't bundle IDs, so not auto-classified):"
echo "  - large ~/Library/Application Support entries:"
du -sh "$HOME/Library/Application Support/"* 2>/dev/null | sort -rh | head -6
echo "  - UUID-named containers (group/anonymous — check what owns them):"
for d in "$HOME/Library/Containers/"*; do
  name=$(basename "$d")
  case "$name" in [0-9A-Fa-f]*-[0-9A-Fa-f]*-[0-9A-Fa-f]*-*) du -sh "$d" 2>/dev/null ;; esac
done | sort -rh | head -5
echo

echo "===== Stale installers (.dmg/.pkg/.iso in Downloads & Desktop) ====="
find "$HOME/Downloads" "$HOME/Desktop" -maxdepth 2 -type f \
  \( -iname '*.dmg' -o -iname '*.pkg' -o -iname '*.iso' -o -iname '*.msi' \) 2>/dev/null \
  -exec du -sh {} + 2>/dev/null | sort -rh | head -20
echo

echo "===== Biggest files in your home (>500MB, non-Library) ====="
find "$HOME/Downloads" "$HOME/Desktop" "$HOME/Documents" "$HOME/Movies" \
  -type f -size +500M 2>/dev/null \
  -exec du -sh {} + 2>/dev/null | sort -rh | head -20
echo

echo "===== Old Downloads (not modified in 90+ days) ====="
old=$(find "$HOME/Downloads" -maxdepth 1 -mtime +90 2>/dev/null | wc -l | tr -d ' ')
if [ "${old:-0}" -gt 0 ]; then
  echo "  $old item(s), totaling:"
  find "$HOME/Downloads" -maxdepth 1 -mtime +90 -exec du -sk {} + 2>/dev/null \
    | awk '{s+=$1} END{printf "  %.1f GB\n", s/1024/1024}'
else
  echo "  (none)"
fi
echo
line
echo "To remove any of these reversibly (into the Trash, restorable):"
echo "  bash $DIR/trash-items.sh \"/path/one\" \"/path/two\" ..."
