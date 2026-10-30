# Removes the temporary git index file an Ultra Mod snapshot or undo used.
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File remove-index.ps1 -Path <path>
# Only the temporary index files Ultra Mod creates are removed (ultramod-index and
# ultramod-restore-index, each with an optional lowercase alphanumeric suffix);
# any other path is left alone.
param(
    [Parameter(Mandatory = $true)][string]$Path
)
$name = Split-Path -Leaf $Path
if ($name -notmatch '^ultramod-(restore-)?index(-[0-9a-z]+)*$') { exit 2 }
Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
