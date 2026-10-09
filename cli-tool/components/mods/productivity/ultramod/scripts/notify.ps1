# Shows a Windows balloon notification.
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File notify.ps1 -BodyBase64 <base64 of the UTF-8 body>
# The body arrives as base64 data, so no text is ever read as script source.
param(
    [Parameter(Mandatory = $true)][string]$BodyBase64
)
$body = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($BodyBase64))
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.Visible = $true
$n.ShowBalloonTip(5000, 'Claude Code', $body, 'Info')
# Disposing the icon removes its balloon, so it stays for the time asked above.
Start-Sleep -Seconds 6
$n.Dispose()
