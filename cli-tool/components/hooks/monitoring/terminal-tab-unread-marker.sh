#!/bin/bash
# Marks the Terminal.app tab of a Claude Code session that finished while you
# were looking somewhere else, and clears the mark when you type in it again.
#
#   terminal-tab-unread-marker.sh mark     (wire to Stop)
#   terminal-tab-unread-marker.sh clear    (wire to UserPromptSubmit)
#
# macOS Terminal.app only. Exits silently everywhere else.
#
# Two things here are less obvious than they look, both learned the hard way.
#
# 1. Claude Code pipes stdin to hooks, so `tty` reports "not a tty". The session
#    tty has to be recovered by walking up the process tree instead.
#
# 2. Claude Code re-asserts the terminal title about a second after Stop, when
#    the session transitions to idle, which silently wipes a marker written by a
#    Stop hook. This script writes it repeatedly for a few seconds to outlast
#    that. Setting CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1 is the other way, at the
#    cost of losing the built-in title.
#
# A zero-width WORD JOINER marks our own prefix so it can be stripped without
# storing a copy of your title, which means it cannot clobber a title you set
# with /rename.
#
# Full version (per-project window colours, palette, plugin install):
# https://github.com/dotcomjack/claude-session-tint

set -uo pipefail
[ "$(uname -s)" = "Darwin" ] || exit 0

MARK="${TABTINT_MARK:-●}"
WJ=$(printf '\xe2\x81\xa0')

# A wedged Terminal must not wedge the hook, so cap every Apple Event.
osa() { perl -e 'alarm 15; exec @ARGV' osascript "$@" 2>/dev/null; }

# Walk up the process tree until a real ttys* turns up.
session_tty() {
  local pid=$PPID t i=0
  while [ -n "$pid" ] && [ "$pid" != "1" ] && [ $i -lt 12 ]; do
    t=$(ps -o tty= -p "$pid" 2>/dev/null | tr -d ' ')
    case "$t" in ttys*) printf '%s' "$t"; return 0 ;; esac
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    i=$((i + 1))
  done
  return 1
}

# Returns "<selected>|<frontmost>|<title>" for the tab on this tty.
tab_state() {
  osa - "$1" <<'APPLESCRIPT'
on run argv
	tell application "Terminal"
		set fm to frontmost
		set i to 0
		repeat with w in windows
			set i to i + 1
			repeat with t in tabs of w
				if tty of t is (item 1 of argv) then
					set ttl to ""
					try
						set ttl to custom title of t
					end try
					return ((selected of t) as string) & "|" & ((fm and i is 1) as string) & "|" & ttl
				end if
			end repeat
		end repeat
	end tell
	return ""
end run
APPLESCRIPT
}

set_title() {
  osa - "$1" "$2" <<'APPLESCRIPT' >/dev/null
on run argv
	tell application "Terminal"
		repeat with w in windows
			repeat with t in tabs of w
				if tty of t is (item 1 of argv) then
					set custom title of t to (item 2 of argv)
					return
				end if
			end repeat
		end repeat
	end tell
end run
APPLESCRIPT
}

TTY=$(session_tty) || exit 0
STATE=$(tab_state "/dev/$TTY") || exit 0
[ -n "$STATE" ] || exit 0

SELECTED=${STATE%%|*}
REST=${STATE#*|}
FRONT=${REST%%|*}
TITLE=${REST#*|}

# Strip any marker we previously wrote, without keeping a copy of the title.
BARE="${TITLE##*"$WJ" }"

case "${1:-mark}" in
  mark)
    # You are already looking at it, so there is nothing to tell you.
    [ "$SELECTED" = "true" ] && [ "$FRONT" = "true" ] && exit 0
    # Never replace a title we cannot read; a lone marker is unremovable.
    [ -n "$BARE" ] || exit 0
    # Re-assert past Claude Code's own idle-transition title rewrite. This runs
    # detached so Stop returns immediately instead of stalling the session for
    # the length of the loop.
    (
      for _ in 1 2 3 4 5 6; do
        set_title "/dev/$TTY" "$MARK$WJ $BARE"
        sleep 0.7
      done
    ) >/dev/null 2>&1 &
    disown 2>/dev/null || true
    ;;
  clear)
    [ "$TITLE" = "$BARE" ] && exit 0
    set_title "/dev/$TTY" "$BARE"
    ;;
esac
exit 0
