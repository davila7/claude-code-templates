# macOS cache catalog

The full, tiered inventory the skill reasons from. `survey.sh` sizes the common
roots automatically; consult this when you hit something the survey didn't cover,
need the exact reclaim command, or must judge a borderline location.

## Tiers

- **safe** — a pure cache. Deleting it can only make the next build/install/run
  slower. Zero risk to data the user or an app cannot regenerate. Auto-delete OK.
- **ask** — large but *not* a free cache: expensive to restore (multi-GB
  re-download, long rebuild), or a directory that mixes cache with things the user
  may want (models, VM disks, simulator state). Always confirm first.
- **never** — user data or app state that does not regenerate. The scripts never
  touch these; they appear only so you can *warn* the user when something big
  (an old iPhone backup, a full Trash) is masquerading as "storage to clean."

Golden rule: **when unsure, demote.** A slower rebuild is a shrug; deleting a
license file, an unpushable archive, or someone's only local backup is not.

## Safe tier

| Location | What | Reclaim | Regenerates on |
|---|---|---|---|
| `~/Library/Developer/Xcode/DerivedData` | Xcode build products, indexes | `rm -rf` | next Xcode / `xcodebuild` |
| `~/Library/Developer/Xcode/{iOS,watchOS,tvOS} DeviceSupport` | symbols copied from attached devices | `rm -rf` | re-copies when a device on that OS build is re-attached (note: an OS build you no longer have a device for won't regenerate — minor, only affects symbolicating that old build). clean-safe keeps the N newest versions (`MSC_DEVICE_SUPPORT_KEEP`, default 2) so your current devices' symbols survive; older versions re-download on next connect of such a device. |
| `~/Library/Developer/CoreSimulator/Caches` | simulator runtime caches | `rm -rf` | automatically |
| `~/Library/Caches/com.apple.dt.Xcode` | misc Xcode cache | `rm -rf` | automatically |
| `~/Library/Caches/org.swift.swiftpm` | SwiftPM download cache | `rm -rf` | next resolve |
| `~/Library/Caches/CocoaPods` | pod spec/download cache | `rm -rf` or `pod cache clean --all` | next `pod install` |
| `~/.gradle/caches` | Gradle dependency + build cache | `rm -rf` | next Gradle build |
| `~/.npm` | npm download cache | `rm -rf` or `npm cache clean --force` | next `npm i` |
| `~/.bun/install/cache` | Bun install cache | `rm -rf` | next `bun i` |
| `~/Library/Caches/Yarn` | Yarn classic cache | `rm -rf` or `yarn cache clean` | next `yarn` |
| `~/Library/Caches/{node-gyp,typescript,electron,electron-builder}` | tool download/build caches | `rm -rf` | next use |
| `~/.cache/uv`, `~/Library/Caches/uv` | uv wheel/source cache | `uv cache clean` or `rm -rf` | next `uv` |
| `~/.cache/pip`, `~/Library/Caches/pip` | pip wheel cache | `pip cache purge` or `rm -rf` | next `pip install` |
| `~/Library/Caches/composer`, `~/.composer/cache` | Composer (PHP) download cache | `rm -rf` | Composer re-downloads packages on next `install`/`update` |
| `~/.gem/ruby/*/cache` | downloaded `.gem` archives | `rm -rf` | next `gem install`/`bundle install` — installed gems live in `gems/` alongside, untouched |
| `~/Library/Caches/go-build` | Go compile cache | `go clean -cache` or `rm -rf` | next `go build` |
| `~/Library/Caches/Homebrew` + downloads | brew bottle/download cache | `brew cleanup -s --prune=all` | next `brew install` |
| `~/Library/Group Containers/group.com.apple.coreservices.useractivityd/shared-pasteboard` | Handoff / Universal Clipboard transfer buffers; `useractivityd` is supposed to prune these itself but can leave many GB behind (mole #1178) | `rm -rf` **only items older than 60 minutes** (age-gated — an in-flight Universal Clipboard sync must never be cut) | automatically as new Handoff transfers occur |
| `/private/tmp/{metro-*,haste-map-*,react-native-packager-cache-*,react-packager-cache-*}` | Metro/RN temp | `rm -rf` | next Metro start (bare `react-*` is deliberately NOT safe — it would match user clones like `react-native-fork`) |
| `~/Library/Caches/org.carthage.CarthageKit` | Carthage (third iOS dependency manager, alongside CocoaPods/SwiftPM above) build/download cache | `rm -rf` | next `carthage bootstrap`/`carthage update` |
| `~/Library/Caches/pypoetry` | Poetry (Python) package/artifact cache | `rm -rf` or `poetry cache clear --all .` | next `poetry install` |
| `~/.cache/mise` | mise (asdf-style tool version manager) download/install cache | `rm -rf` | next `mise install` |
| `~/Library/Caches/mise` | mise's macOS cache dir (separate from `~/.cache/mise` above) | `rm -rf` | next `mise install` |
| `~/Library/Caches/Google/AndroidStudio*` | Android Studio IDE caches (versioned folder, hence the glob) | `rm -rf` | automatically (IDE reindexes on next launch) |
| `~/.android/cache` | Android SDK/build-tool cache | `rm -rf` | next Android build |
| `~/.android/build-cache` | Android Gradle plugin build cache | `rm -rf` | next Android build |
| `~/Library/Logs/DiagnosticReports` | crash reports (`.crash`/`.ips`); macOS/apps never prune these themselves | `rm -rf` (clean-safe.sh removes only items **older than 30 days**, age-gated like Handoff above) | new reports keep accumulating; a report younger than 30 days is kept in case it's still needed for a bug report |
| `~/Library/Caches/<app>` (generic, NOT on the list above) | most per-app caches | prefer `trash-items.sh` (reversible); `rm -rf` only once you've confirmed it's a pure cache | usually automatic — but some apps keep the only local copy of downloaded content or a token here, so verify before deleting |

**Browser & Electron app caches (safe, but quit the app first):** delete only the
cache *subfolders* — never the whole app-support folder, which holds real data.
- Electron apps (Slack, Discord, VS Code, Cursor, Windsurf, Teams, Notion, …):
  `~/Library/Application Support/<App>/{Cache,Code Cache,GPUCache,DawnWebGPUCache}`.
  `clean-safe.sh` now clears these four cache subfolders **automatically** for
  every direct child of `~/Library/Application Support` (audit wave 2) —
  guarded by a fail-closed `pgrep -x` check on the app-folder name (running or
  unknown state ⇒ skip) so a live app's cache is never touched mid-write.
  Browsers' profile caches (below) remain manual/unchanged.
- Chromium browsers (Chrome, Arc, Brave, Edge, Vivaldi):
  `~/Library/Application Support/<Browser>/<Profile>/{Cache,Code Cache,Service Worker/CacheStorage}`.
  Clearing `Service Worker/CacheStorage` drops sites' offline data (minor).
- Spotify: `~/Library/Caches/com.spotify.client` and `.../Application Support/Spotify/PersistentCache`.
- Also safe: `~/Library/Caches/ms-playwright*`, `~/.cache/puppeteer`, `~/Library/Caches/Cypress`,
  `~/Library/Caches/JetBrains` — but these force a browser re-download or IDE reindex,
  so they sit in **ask** for auto-runs; recommend them, don't delete silently.

## Ask tier

| Location | Why not auto | Right move |
|---|---|---|
| `~/Library/Containers/com.docker.docker` (`Docker.raw`) | VM disk with images/volumes — not a cache | Start Docker, run `docker system prune -a` (and `docker volume prune`). Never `rm` the .raw. |
| `~/.cache/huggingface`, `~/.ollama/models`, `~/.cache/torch`, `~/.lmstudio` | multi-GB model re-downloads | Confirm; if duplicate variants of one model exist (e.g. whisper in faster-whisper + MLX + turbo), point it out and delete the unused ones. |
| `~/Library/Developer/CoreSimulator/Devices` | simulator state + installed apps | `xcrun simctl delete unavailable` is safe (orphans only). Deleting active devices wipes their state — ask. |
| `~/miniconda3/pkgs`, `~/anaconda3/pkgs`, `~/opt/*conda*/pkgs` (or wherever conda is installed) | package cache is hardlinked into every live conda env — raw `rm` on `pkgs/` breaks them | **owner command only:** `conda clean -y --tarballs --index-cache --logfiles`. Never `rm` inside `pkgs/`. |
| Browser old-version framework folders inside `.app` bundles (Chrome/Edge/Brave `Contents/Frameworks/*/Versions/<old-version>`) | lives inside a `.app` bundle — TCC App Management can block deletion, and the browser must be quit first | **report-only** (`find-extras.sh` lists every version except the one `Current` points to); user picks, `trash-items.sh` removes; if TCC blocks it, use Finder |
| `~/Library/Developer/Xcode/Archives` | contains dSYMs + shippable builds | **Warn:** deleting loses crash symbolication and re-upload ability. Ask. |
| `~/Library/pnpm/store`, `~/.pnpm-store` | content store all projects hardlink from | `pnpm store prune` removes only unreferenced; safer than `rm -rf`. |
| `~/go/pkg/mod` | module cache, files are read-only | `go clean -modcache` (plain `rm -rf` fails on perms). Re-downloads. |
| `~/.cargo/registry` (`cache/`, `src/`) | crate cache | `rm -rf ~/.cargo/registry/{cache,src}` only. **Never** `~/.cargo` — holds `bin/` (installed binaries) and `config.toml`. |
| `~/Library/Caches/deno`, `~/.cache/deno` | modules fetched from arbitrary URLs (unlike npm, a source can 404 permanently) | `deno clean` or `rm -rf`; ask, since a raw-URL import that vanished can't be re-fetched. |
| `~/.gradle/wrapper/dists` | downloaded Gradle distributions | re-download; ask. |
| `~/.m2/repository` | Maven local repo | cache-like but large; **never** `~/.m2` itself — `settings.xml` lives at its root. |
| `~/Library/Caches/JetBrains`, `~/Library/Application Support/JetBrains/*/caches` | IDE indexes | forces full reindex; recommend, don't auto. |
| `~/.android/avd` | emulator images + snapshots — deleting wipes that emulator's state | advise per-AVD review, then `avdmanager delete avd -n <name>` for ones no longer needed |
| `~/Library/Android/sdk/system-images` | old Android API-level system images | `sdkmanager --uninstall "system-images;android-XX;..."` for API levels no longer targeted |
| `~/.orbstack` | verify layout before advising — this data dir includes VM state, not just cache | prefer OrbStack's own prune commands (e.g. its CLI/GUI cleanup) over manual `rm` |
| project `node_modules` / `target/` / `build/` | per-project, huge in aggregate | see stale-project sweep below. |

## Never tier (warn only)

- `~/Library/Application Support/MobileSync/Backup` — local iOS device backups. User data.
- `~/Library/Application Support/CallHistoryDB`, `AddressBook`, Messages `chat.db`, Mail `V*/` — app data.
- `~/Pictures/Photos Library.photoslibrary` — the photo library itself.
- `~/.Trash` — emptying is fine but it's the user's decision; offer, don't assume.
- `~/Library/Application Support/<app>` (whole folder), `~/Library/Preferences`,
  `~/Library/Keychains`, anything under `~/.ssh`, `~/.aws`, `~/.config` credentials — never.
- Time Machine **local snapshots** (`tmutil listlocalsnapshots /`) — these are backups.
  They hold "purgeable" space macOS reclaims on demand; only thin them if the disk is
  genuinely wedged: `tmutil thinlocalsnapshots / 999999999999 4`.
- `/System`, `/Library/Caches`, `/private/var/folders`, dyld shared cache — system-owned
  or SIP-protected. Leave them to macOS; don't reach for `sudo` to force it.

These are now mechanically refused by trash-items.sh, not just policy: `~/Library/Application
Support/MobileSync/Backup`, `~/Library/Keychains`, `~/Library/Mail`, `~/Library/Messages`,
`~/.ssh`, `~/.aws`, `~/.gnupg`, and `~/Pictures/*.photoslibrary` are subtree-denied in
`validate_target_path` — passing them (or anything underneath them) to `trash-items.sh`
is refused, not just discouraged.

## App leftovers (uninstalled apps)

Dragging an app to the Trash leaves its data scattered across the library. For an
app you've **confirmed is uninstalled**, its leftovers live in these locations —
match by bundle id (e.g. `com.foo.Bar`) or app name. `find-extras.sh` flags the
sandbox-container ones; the rest need a name/id match. Always Trash, never `rm`,
and verify the app is truly gone first (a live app here means data loss).

- `~/Library/Containers/<bundle id>` — sandboxed app data (biggest usually)
- `~/Library/Group Containers/<group id>` — shared between an app and its extensions
- `~/Library/Application Support/<app or id>`
- `~/Library/Caches/<id>` and `~/Library/Caches/<id>.ShipIt`
- `~/Library/Preferences/<id>.plist`
- `~/Library/HTTPStorages/<id>`
- `~/Library/WebKit/<id>`
- `~/Library/Saved Application State/<id>.savedState`
- `~/Library/Logs/<app>`
- `~/Library/Cookies/<id>.binarycookies`
- `~/Library/LaunchAgents/<id>.plist` (and `/Library/LaunchAgents`, `/Library/LaunchDaemons` — need admin)

Verify installed-state with more than one signal before deleting: `mdfind
"kMDItemCFBundleIdentifier == '<id>'"`, a look in `/Applications` and
`~/Applications`, or simply ask the user. Dedicated apps (Pearcleaner, AppCleaner)
exist for this; the skill's job is to surface the space and let the user decide,
not to compete on completeness.

## In-app / manual tier (don't delete for the user)

Some large "caches" are really user content the app manages itself. Deleting the
files can lose downloaded media or force a re-login. Point the user to the app's
own control instead:

- **Telegram** — Settings › Data and Storage › Storage Usage › Clear Cache.
- **WhatsApp / Signal** — in-app storage management; the cache holds received media.
- **Slack / Discord / Teams** — the `Cache`/`Code Cache`/`GPUCache` subfolders are
  safe (see safe tier); the rest of their Application Support is real state — leave it.
- **Spotify** — Settings › Storage, or delete `.../Application Support/Spotify/PersistentCache` (safe).
- **Photos / Music** — "Optimize Mac Storage" in the app/System Settings, never manual deletion.

## Reversible deletion

Prefer `trash-items.sh` (moves to Trash via Finder) for anything outside the pure
safe tier. Trade-off: trashed items still occupy disk until the Trash is emptied,
so for pure caches a direct `rm` (clean-safe.sh) is better — space returns now and
reversibility is pointless for a cache. Rule of thumb: **cache → rm; anything a
human might miss → Trash.** Every action is appended to
`~/Library/Logs/mac-storage-cleaner/operations.log` (timestamp, action, size, path).

## Optional: stale-project sweep

Old projects' `node_modules`/`target`/`build` dirs often dwarf every cache combined.
This is **ask** tier — list candidates, let the user pick; deleting is safe (they
rebuild via install/build) but can be surprising. List, sorted by size, without touching:

```bash
find ~/Desktop ~/Documents ~/Developer ~/Projects ~/code -type d \
  \( -name node_modules -o -name target -o -name .next -o -name build -o -name Pods \
     -o -name .expo -o -name .cxx -o -name .turbo -o -name coverage -o -name .venv -o -name __pycache__ \) \
  -prune 2>/dev/null | while read -r d; do du -sh "$d"; done | sort -rh | head -30
```

`npx npkill` is the interactive equivalent if the user prefers a picker.

Any directory containing a valid `CACHEDIR.TAG` signature file (first line
`Signature: 8a477f597d28d172789f06886806bc55`, per the [Cache Directory
Tagging Specification](https://bford.info/cachedir/)) is cache **by
declaration** from the tool that created it — safe to include in sweeps like
this one even if its name isn't on the list above.

## Gotchas

- **TCC / App Management.** `.app` bundles cached under `~/Library/Caches` (some dev
  tools, e.g. dotslash-managed apps) are protected; `rm`/`chmod` return "Operation not
  permitted" even without the sandbox. Skip them and say so — Finder can delete them.
- **Read-only cache files.** Go and some SwiftPM caches are read-only; run
  `chmod -R u+w <dir>` before `rm -rf` (clean-safe.sh already does this).
- **Running apps.** Clearing a live browser/Electron cache can glitch it; prefer the
  app quit. Never delete a database an app has open.
- **`rm -rf a b c` continues past errors** — a failure on one path doesn't imply the
  others failed. Verify with `du`, don't assume.
- **APFS purgeable space.** After large deletions `df` "Avail" may not move: the space
  becomes "purgeable" (freed on demand), especially when Time Machine local snapshots
  reference the deleted files. Report reclaimed *size measured before deletion* rather
  than trusting the df delta, and explain purgeable space if the user expects a bigger jump.
- **Per-user temp** (`/var/folders/.../C`) is usually small and macOS-managed — leave it.
