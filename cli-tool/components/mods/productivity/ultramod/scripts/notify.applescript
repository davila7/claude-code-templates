-- Shows a macOS notification. Usage: osascript notify.applescript <title> <body>
-- Title and body arrive as arguments, so no text is ever read as script source.
on run argv
	display notification (item 2 of argv) with title (item 1 of argv)
end run
