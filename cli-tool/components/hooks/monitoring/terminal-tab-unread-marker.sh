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

# Strip our own marker prefix, and only ours. The marker is always
# "<glyph><WJ><space>" at position 0, so a WORD JOINER later in a title cannot
# be ours. An unanchored longest-match would truncate a user title that happened
# to contain a WJ-space sequence. Requiring it inside the first few bytes stays
# glyph-agnostic, so TABTINT_MARK can be a multi-byte emoji.
strip_mark() {
  local s="$1" pre
  pre=${s%%"$WJ" *}
  if [ "$pre" != "$s" ] && [ ${#pre} -le 8 ]; then
    printf '%s' "${s#*"$WJ" }"
  else
    printf '%s' "$s"
  fi
}

BARE=$(strip_mark "$TITLE")

case "${1:-mark}" in
  mark)
    # You are already looking at it, so there is nothing to tell you.
    [ "$SELECTED" = "true" ] && [ "$FRONT" = "true" ] && exit 0
    # Never replace a title we cannot read; a lone marker is unremovable.
    [ -n "$BARE" ] || exit 0
    # Re-assert past Claude Code's own idle-transition title rewrite, detached so
    # Stop returns immediately.
    #
    # Every iteration re-reads the tab rather than replaying the title captured
    # at Stop. Two reasons, both real:
    #   - If you focus the tab and submit a prompt inside this window, `clear`
    #     strips the marker and the next tick would put it straight back, so the
    #     tab you are actively using shows a stale unread mark. Re-reading lets
    #     the loop see `selected` and stop.
    #   - If you /rename inside this window, replaying the captured title would
    #     silently overwrite the name you just set.
    (
      for _ in 1 2 3 4 5 6; do
        st=$(tab_state "/dev/$TTY") || exit 0
        [ -n "$st" ] || exit 0
        sel=${st%%|*}; rest=${st#*|}; fr=${rest%%|*}; ttl=${rest#*|}
        # You are looking at it now, so the signal has done its job.
        [ "$sel" = "true" ] && [ "$fr" = "true" ] && exit 0
        bare=$(strip_mark "$ttl")
        [ -n "$bare" ] || exit 0
        [ "$ttl" = "$MARK$WJ $bare" ] || set_title "/dev/$TTY" "$MARK$WJ $bare"
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
