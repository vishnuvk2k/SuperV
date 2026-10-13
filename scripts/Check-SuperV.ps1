# Check-SuperV.ps1
# Diagnoses (and optionally fixes) the "blank panel" issue for the SuperV CEP extension.
# Run this on the PC where the panel shows blank / locks up AE.
#
# Usage:
#   Double-click, or from PowerShell:  .\Check-SuperV.ps1
#   To auto-apply the safe fixes:      .\Check-SuperV.ps1 -Fix
#
param([switch]$Fix)

$ErrorActionPreference = 'Continue'
$issues = @()
$fixedAny = $false

function Write-Section($title) {
    Write-Output ''
    Write-Output "== $title =="
}

function Write-Ok($msg)   { Write-Output "  [OK]   $msg" }
function Write-Bad($msg)  { Write-Output "  [FAIL] $msg"; $script:issues += $msg }
function Write-Info($msg) { Write-Output "  [ i ]  $msg" }

Write-Output 'SuperV diagnostic'
Write-Output '------------------'
Write-Info "Running as user: $env:USERNAME"
Write-Info "Computer: $env:COMPUTERNAME"

# 1. Is this session elevated?
Write-Section 'Elevation check'
$isAdmin = ([Security.Principal.WindowsIdentity]::GetCurrent().Groups -contains 'S-1-5-32-544')
if ($isAdmin) {
    Write-Bad "This script (and, more importantly, the installer if you ran it the same way) is running as Administrator. If INSTALL.cmd was ever run as Administrator on this PC, the registry flag below gets written to the ADMIN account's profile, not the one that opens After Effects, which produces exactly a blank panel."
    Write-Info 'Re-run INSTALL.cmd by double-clicking it normally (no "Run as administrator") once you have closed this.'
} else {
    Write-Ok 'Not running elevated. Good — run INSTALL.cmd the same way (plain double-click).'
}

# 2. Extension folder present and complete for THIS user
Write-Section 'Extension files (this user)'
$extRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions\SuperV'
if (Test-Path -LiteralPath $extRoot) {
    Write-Ok "Found: $extRoot"
    $required = @('index.html', 'CSXS\manifest.xml', 'js\panel.js', 'jsx\host.jsx', 'jsx\bridge-ai.jsx')
    foreach ($rel in $required) {
        $p = Join-Path $extRoot $rel
        if (Test-Path -LiteralPath $p) { Write-Ok "  $rel present" }
        else { Write-Bad "  $rel is MISSING — install may be incomplete or extracted from a partial ZIP" }
    }
} else {
    Write-Bad "Not found at $extRoot — SuperV was never installed for THIS Windows user ($env:USERNAME). If the installer was run under a different login (or elevated, landing in the Administrator profile), this is expected and is the root cause."
}

# 3. PlayerDebugMode registry flag — the actual gate CEP checks
Write-Section 'PlayerDebugMode registry flag (HKCU, this user)'
foreach ($cepVersion in @('11', '12')) {
    $regPath = "HKCU:\Software\Adobe\CSXS.$cepVersion"
    $val = $null
    try { $val = (Get-ItemProperty -LiteralPath $regPath -Name PlayerDebugMode -ErrorAction Stop).PlayerDebugMode } catch {}
    if ($val -eq '1') {
        Write-Ok "CSXS.$cepVersion PlayerDebugMode = 1"
    } else {
        Write-Bad "CSXS.$cepVersion PlayerDebugMode is NOT set to 1 for $env:USERNAME (current value: $(if ($val) { $val } else { '<missing>' }))"
        if ($Fix) {
            New-Item -Path $regPath -Force | Out-Null
            New-ItemProperty -LiteralPath $regPath -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null
            Write-Info "  -> Fixed: set $regPath\PlayerDebugMode = 1"
            $fixedAny = $true
        }
    }
}

# 4. Look for the same flag set under OTHER loaded user profiles (HKEY_USERS)
#    This can only see profiles currently loaded (i.e. other logged-in users), but it
#    catches the common case of "installed while logged in as a different account".
Write-Section 'Other Windows profiles (best-effort check)'
try {
    $otherHives = Get-ChildItem 'Registry::HKEY_USERS' -ErrorAction SilentlyContinue |
        Where-Object { $_.PSChildName -match '^S-1-5-21-.*[0-9]$' -and $_.PSChildName -ne ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value) }
    if ($otherHives) {
        foreach ($hive in $otherHives) {
            $p11 = "Registry::HKEY_USERS\$($hive.PSChildName)\Software\Adobe\CSXS.11"
            $p12 = "Registry::HKEY_USERS\$($hive.PSChildName)\Software\Adobe\CSXS.12"
            $found = $false
            foreach ($p in @($p11, $p12)) {
                if (Test-Path $p) {
                    $v = (Get-ItemProperty -LiteralPath $p -Name PlayerDebugMode -ErrorAction SilentlyContinue).PlayerDebugMode
                    if ($v -eq '1') { Write-Info "  Flag IS set under another loaded profile ($($hive.PSChildName)) at $p — if that's not the account that runs AE, re-run the installer logged in as the right user."; $found = $true }
                }
            }
            if (-not $found) { Write-Info "  Checked profile $($hive.PSChildName): flag not set there either" }
        }
    } else {
        Write-Info '  No other user profiles currently loaded to compare against.'
    }
} catch { Write-Info '  Could not enumerate other profiles (non-fatal).' }

# 5. Mark-of-the-web / blocked files (GitHub ZIP not unblocked before extracting)
Write-Section 'Blocked-file check (Zone.Identifier)'
if (Test-Path -LiteralPath $extRoot) {
    $blocked = @()
    Get-ChildItem -LiteralPath $extRoot -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
        $zone = Get-Item -LiteralPath $_.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue
        if ($zone) { $blocked += $_.FullName }
    }
    if ($blocked.Count -gt 0) {
        Write-Bad "$($blocked.Count) file(s) still carry the Windows 'blocked' mark (downloaded-from-internet flag). This can prevent CEP's embedded Chromium from loading them."
        if ($Fix) {
            $blocked | ForEach-Object { Unblock-File -LiteralPath $_ -ErrorAction SilentlyContinue }
            Write-Info '  -> Fixed: unblocked all flagged files under the installed extension folder.'
            $fixedAny = $true
        } else {
            Write-Info '  Re-run with -Fix to unblock them automatically, or right-click the original ZIP > Properties > Unblock, then reinstall.'
        }
    } else {
        Write-Ok 'No blocked files found under the installed extension folder.'
    }
} else {
    Write-Info '  Skipped — extension folder not present for this user (see above).'
}

# 6. After Effects version sanity check against the manifest's supported range (25.0–27.0)
Write-Section 'After Effects version'
try {
    $aeKeys = Get-ChildItem 'HKLM:\SOFTWARE\Adobe\After Effects' -ErrorAction SilentlyContinue
    if ($aeKeys) {
        $versions = $aeKeys | ForEach-Object { $_.PSChildName } | Where-Object { $_ -match '^\d+\.\d+$' }
        if ($versions) { Write-Info ("  Installed AE version key(s) found: " + ($versions -join ', ') + " (SuperV supports 25.0–26.x)") }
        else { Write-Info '  Could not read a version number from the registry (not fatal — just informational).' }
    } else {
        Write-Info '  Could not find After Effects registry keys (not fatal — just informational).'
    }
} catch { Write-Info '  Version check skipped (non-fatal).' }

# Summary
Write-Section 'Summary'
if ($issues.Count -eq 0) {
    Write-Output 'No problems found for this Windows user. If the panel is still blank:'
    Write-Output '  1. Fully quit After Effects (check Task Manager for a lingering AfterFX.exe), then reopen it.'
    Write-Output '  2. Confirm you are opening AE logged in as THIS Windows user (shown above).'
    Write-Output '  3. Try Window > Extensions > SuperV again.'
} else {
    Write-Output "Found $($issues.Count) issue(s):"
    $issues | ForEach-Object { Write-Output "  - $_" }
    if (-not $Fix) {
        Write-Output ''
        Write-Output 'Run again as:  .\Check-SuperV.ps1 -Fix'
        Write-Output 'to have this script apply the safe fixes (registry flag + unblocking files) automatically.'
    } elseif ($fixedAny) {
        Write-Output ''
        Write-Output 'Fixes applied. Fully restart After Effects now and try Window > Extensions > SuperV.'
    }
}

Read-Host 'Press Enter to close'
