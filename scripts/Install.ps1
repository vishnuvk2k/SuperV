param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $packageRoot 'SuperV'
if (-not (Test-Path -LiteralPath (Join-Path $sourcePath 'CSXS/manifest.xml'))) { throw 'Extension folder is missing. Extract the full ZIP first.' }
$extensionParent = Join-Path $env:APPDATA 'Adobe/CEP/extensions'
$destinationPath = Join-Path $extensionParent 'SuperV'
if (Get-Process AfterFX -ErrorAction SilentlyContinue) { throw 'Save your work and close After Effects before installing SuperV.' }
# The unsigned-extension flag and the files are stored per Windows user. Running elevated can put both in the
# wrong profile, which gives a panel that opens blank. Stop unless the person confirms this is the right account.
$isElevated = ([Security.Principal.WindowsIdentity]::GetCurrent().Groups -contains 'S-1-5-32-544')
if ($isElevated -and -not $Quiet) {
    Write-Warning "This installer is running as Administrator ($env:USERNAME). SuperV installs for the Windows user who runs it."
    Write-Warning 'If you open After Effects as a different, normal user, the panel will be blank. Close this window and double-click INSTALL.cmd normally.'
    $answer = Read-Host 'Type YES to install for this account anyway'
    if ($answer -ne 'YES') { throw 'Install cancelled. Run INSTALL.cmd again without "Run as administrator".' }
}
$originalDebugBackup = $null
# Update packages may omit FFmpeg (it is over 100 MB). Reuse the encoder from the current installation.
$bundledEncoder = Join-Path $sourcePath 'bin/ffmpeg.exe'
$keptEncoder = $null
if (-not (Test-Path -LiteralPath $bundledEncoder)) {
    $candidates = @()
    foreach ($folderName in @('SuperV','GetShitDoneByVK')) {
        $candidates += (Join-Path (Join-Path $env:APPDATA 'Adobe/CEP/extensions') (Join-Path $folderName 'bin/ffmpeg.exe'))
    }
    # Installing straight after an uninstall leaves the encoder only in the backups, newest first.
    $backupRoot = Join-Path $env:APPDATA 'SuperV-Backups'
    if (Test-Path -LiteralPath $backupRoot) {
        $candidates += @(Get-ChildItem -LiteralPath $backupRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin/ffmpeg.exe' })
    }
    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        if ((Get-Item -LiteralPath $candidate).Length -lt 1MB) { continue }
        $keptEncoder = Join-Path $env:TEMP ('superv-ffmpeg-' + [guid]::NewGuid().ToString('N') + '.exe')
        Copy-Item -LiteralPath $candidate -Destination $keptEncoder
        break
    }
}
New-Item -ItemType Directory -Path $extensionParent -Force | Out-Null
foreach ($folderName in @('SuperV','GetShitDoneByVK')) {
    $resolved = [IO.Path]::GetFullPath((Join-Path $extensionParent $folderName))
    if ((Split-Path -Parent $resolved) -ne [IO.Path]::GetFullPath($extensionParent) -or (Split-Path -Leaf $resolved) -ne $folderName) { throw 'Installation path check failed.' }
    if (-not (Test-Path -LiteralPath $resolved)) { continue }
    $debugBackup = Join-Path $resolved 'installation-debug-backup.json'
    if (-not $originalDebugBackup -and (Test-Path -LiteralPath $debugBackup)) { $originalDebugBackup = Get-Content -LiteralPath $debugBackup -Raw }
    $backupPath = Join-Path (Join-Path $env:APPDATA 'SuperV-Backups') ($folderName + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    New-Item -ItemType Directory -Path (Split-Path -Parent $backupPath) -Force | Out-Null
    Move-Item -LiteralPath $resolved -Destination $backupPath
    Write-Output "Previous installation backed up to $backupPath"
}
Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse
# A ZIP downloaded from GitHub marks every file as "from the internet". Clear that so the panel can load them.
Get-ChildItem -LiteralPath $destinationPath -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
if ($keptEncoder) {
    # An update package may not contain bin\ at all, so create it before moving the encoder in.
    New-Item -ItemType Directory -Path (Join-Path $destinationPath 'bin') -Force | Out-Null
    Move-Item -LiteralPath $keptEncoder -Destination (Join-Path $destinationPath 'bin/ffmpeg.exe') -Force
    Get-ChildItem -LiteralPath (Join-Path $destinationPath 'bin') -Filter 'ffmpeg.gz.*' -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Output 'Kept your existing FFmpeg encoder.'
}
else {
    # The encoder ships as gzip parts so no single file is too large to distribute.
    $binDest = Join-Path $destinationPath 'bin'
    $encoderExe = Join-Path $binDest 'ffmpeg.exe'
    $parts = @(Get-ChildItem -LiteralPath $binDest -Filter 'ffmpeg.gz.*' -File -ErrorAction SilentlyContinue | Sort-Object Name)
    if (-not (Test-Path -LiteralPath $encoderExe) -and $parts.Count) {
        Write-Output 'Unpacking the included FFmpeg...'
        $tempGz = Join-Path $env:TEMP ('superv-ffmpeg-' + [guid]::NewGuid().ToString('N') + '.gz')
        $joined = [IO.File]::Create($tempGz)
        try { foreach ($part in $parts) { $reader = [IO.File]::OpenRead($part.FullName); try { $reader.CopyTo($joined) } finally { $reader.Dispose() } } } finally { $joined.Dispose() }
        $source = [IO.File]::OpenRead($tempGz); $target = [IO.File]::Create($encoderExe)
        try {
            $unzip = New-Object IO.Compression.GzipStream($source, [IO.Compression.CompressionMode]::Decompress)
            try { $unzip.CopyTo($target) } finally { $unzip.Dispose() }
        } finally { $target.Dispose(); $source.Dispose() }
        Remove-Item -LiteralPath $tempGz -Force -ErrorAction SilentlyContinue
        if ((Get-Item -LiteralPath $encoderExe).Length -gt 1MB) {
            foreach ($part in $parts) { Remove-Item -LiteralPath $part.FullName -Force -ErrorAction SilentlyContinue }
            Write-Output 'FFmpeg ready.'
        }
        else { Remove-Item -LiteralPath $encoderExe -Force -ErrorAction SilentlyContinue; Write-Output 'FFmpeg did not unpack. Run scripts\Setup-Encoder.ps1 for GIF export and Exact crop.' }
    }
    elseif (-not (Test-Path -LiteralPath $encoderExe)) { Write-Output 'FFmpeg is not included. Run scripts\Setup-Encoder.ps1, then INSTALL.cmd again, for GIF export and Exact crop.' }
}
# Personal, unsigned CEP extension: enable Adobe's development loading for this Windows user.
# Record previous values so Uninstall.ps1 -RestoreDebugSettings can restore them explicitly.
$debugRecords = @()
foreach ($cepVersion in @('11','12','13')) {
    $regPath = "HKCU:\Software\Adobe\CSXS.$cepVersion"
    $previous = Get-ItemProperty -LiteralPath $regPath -Name PlayerDebugMode -ErrorAction SilentlyContinue
    $debugRecords += [pscustomobject]@{ Path=$regPath; Existed=($null -ne $previous); Value= if ($previous) { $previous.PlayerDebugMode } else { $null } }
    New-Item -Path $regPath -Force | Out-Null
    New-ItemProperty -LiteralPath $regPath -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null
}
if ($originalDebugBackup) {
    $originalDebugBackup | Set-Content -LiteralPath (Join-Path $destinationPath 'installation-debug-backup.json') -Encoding UTF8
} else {
    $debugRecords | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destinationPath 'installation-debug-backup.json') -Encoding UTF8
}
# Read everything back so a bad install is reported now, not discovered as a blank panel later.
$problems = @()
foreach ($required in @('index.html','CSXS/manifest.xml','js/panel.js','js/encoder.cjs','jsx/host.jsx','jsx/more.jsx','jsx/features.jsx','jsx/ease.jsx')) {
    if (-not (Test-Path -LiteralPath (Join-Path $destinationPath $required))) { $problems += "Missing file: $required" }
}
foreach ($cepVersion in @('11','12')) {
    $flag = (Get-ItemProperty -LiteralPath "HKCU:\Software\Adobe\CSXS.$cepVersion" -Name PlayerDebugMode -ErrorAction SilentlyContinue).PlayerDebugMode
    if ($flag -ne '1') { $problems += "PlayerDebugMode is not 1 under CSXS.$cepVersion" }
}
if ($problems.Count) {
    $problems | ForEach-Object { Write-Warning $_ }
    throw 'Install finished with problems. Run scripts\Check-SuperV.ps1 -Fix and send me its report.'
}
Write-Output "Installed: $destinationPath"
Write-Output "Verified for Windows user: $env:USERNAME (files and PlayerDebugMode are both in this user's profile)."
Write-Output 'Restart AE 2025 or 2026. Open Window > Extensions > SuperV.'
Write-Output 'Enable Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network for GIF rendering.'
Write-Output 'This installer enables unsigned CEP extension loading (PlayerDebugMode) for your Windows user.'
if (-not $Quiet) { Read-Host 'Press Enter to finish' | Out-Null }
