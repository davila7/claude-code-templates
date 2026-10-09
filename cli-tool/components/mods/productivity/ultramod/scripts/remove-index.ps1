# Removes the temporary git index file an Ultra Mod snapshot or undo used.
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File remove-index.ps1 -Path <path>
# Only the two index files Ultra Mod creates are removed; any other path is left alone.
param(
    [Parameter(Mandatory = $true)][string]$Path
)
$name = Split-Path -Leaf $Path
if ($name -ne 'ultramod-index' -and $name -ne 'ultramod-restore-index') { exit 2 }
Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
