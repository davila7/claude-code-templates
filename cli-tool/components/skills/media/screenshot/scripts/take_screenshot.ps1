param(
  [string]$Path,
  [ValidateSet("default", "temp")][string]$Mode = "default",
  [string]$Format = "png",
  [string]$Region,
  [switch]$ActiveWindow,
  [int]$WindowHandle
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-Timestamp {
  Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
}

function Get-DefaultDirectory {
  $home = [Environment]::GetFolderPath("UserProfile")
  $pictures = Join-Path $home "Pictures"
  $screenshots = Join-Path $pictures "Screenshots"
  if (Test-Path $screenshots) { return $screenshots }
  if (Test-Path $pictures) { return $pictures }
  return $home
}

function New-DefaultFilename {
  param([string]$Prefix)
  if (-not $Prefix) { $Prefix = "screenshot" }
  "$Prefix-$(Get-Timestamp).$Format"
}

function Resolve-OutputPath {
  if ($Path) {
    $expanded = [Environment]::ExpandEnvironmentVariables($Path)
    $homeDir = [Environment]::GetFolderPath("UserProfile")
    if ($expanded -eq "~") {
      $expanded = $homeDir
    } elseif ($expanded.StartsWith("~/") -or $expanded.StartsWith("~\\")) {
      $expanded = Join-Path $homeDir $expanded.Substring(2)
    }
    $full = [System.IO.Path]::GetFullPath($expanded)
    if ((Test-Path $full) -and (Get-Item $full).PSIsContainer) {
      $full = Join-Path $full (New-DefaultFilename "")
    } elseif (($expanded.EndsWith("\") -or $expanded.EndsWith("/")) -and -not (Test-Path $full)) {
      New-Item -ItemType Directory -Path $full -Force | Out-Null
      $full = Join-Path $full (New-DefaultFilename "")
    } elseif ([System.IO.Path]::GetExtension($full) -eq "") {
      $full = "$full.$Format"
    }
    $parent = Split-Path -Parent $full
    if ($parent) {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    return $full
  }

  if ($Mode -eq "temp") {
    $tmp = [System.IO.Path]::GetTempPath()
    return Join-Path $tmp (New-DefaultFilename "codex-shot")
  }

  $dest = Get-DefaultDirectory
  return Join-Path $dest (New-DefaultFilename "")
}

function Parse-Region {
  if (-not $Region) { return $null }
  $parts = $Region.Split(",") | ForEach-Object { $_.Trim() }
  if ($parts.Length -ne 4) {
    throw "Region must be x,y,w,h"
  }
  $values = $parts | ForEach-Object {
    $out = 0
    if (-not [int]::TryParse($_, [ref]$out)) {
      throw "Region values must be integers"
    }
    $out
  }
  if ($values[2] -le 0 -or $values[3] -le 0) {
    throw "Region width and height must be positive"
  }
  return $values
}

if ($Region -and $ActiveWindow) {
  throw "Choose either -Region or -ActiveWindow"
}
if ($Region -and $WindowHandle) {
  throw "Choose either -Region or -WindowHandle"
}
if ($ActiveWindow -and $WindowHandle) {
  throw "Choose either -ActiveWindow or -WindowHandle"
}

$regionValues = Parse-Region
$outputPath = Resolve-OutputPath

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$imageFormat = switch ($Format.ToLowerInvariant()) {
  "png" { [System.Drawing.Imaging.ImageFormat]::Png }
  "jpg" { [System.Drawing.Imaging.ImageFormat]::Jpeg }
  "jpeg" { [System.Drawing.Imaging.ImageFormat]::Jpeg }
  "bmp" { [System.Drawing.Imaging.ImageFormat]::Bmp }
  default { throw "Unsupported format: $Format" }
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMethods {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@

if ($regionValues) {
  $x = $regionValues[0]
  $y = $regionValues[1]
  $w = $regionValues[2]
  $h = $regionValues[3]
  $bounds = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
} elseif ($ActiveWindow -or $WindowHandle) {
  $handle = if ($WindowHandle) { [IntPtr]$WindowHandle } else { [NativeMethods]::GetForegroundWindow() }
  $rect = New-Object NativeMethods+RECT
  if (-not [NativeMethods]::GetWindowRect($handle, [ref]$rect)) {
    throw "Failed to get window bounds"
  }
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  $bounds = New-Object System.Drawing.Rectangle($rect.Left, $rect.Top, $width, $height)
} else {
  $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bounds = New-Object System.Drawing.Rectangle($vs.Left, $vs.Top, $vs.Width, $vs.Height)
}

$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
  $source = New-Object System.Drawing.Point($bounds.Left, $bounds.Top)
  $target = [System.Drawing.Point]::Empty
  $size = New-Object System.Drawing.Size($bounds.Width, $bounds.Height)
  $graphics.CopyFromScreen($source, $target, $size)
  $bitmap.Save($outputPath, $imageFormat)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output $outputPath
