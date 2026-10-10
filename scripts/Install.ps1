param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $packageRoot 'SuperV'
if (-not (Test-Path -LiteralPath (Join-Path $sourcePath 'CSXS/manifest.xml'))) { throw 'Extension folder is missing. Extract the full ZIP first.' }
$extensionParent = Join-Path $env:APPDATA 'Adobe/CEP/extensions'
$destinationPath = Join-Path $extensionParent 'SuperV'
if (Get-Process AfterFX -ErrorAction SilentlyContinue) { throw 'Save your work and close After Effects before installing SuperV.' }
$originalDebugBackup = $null
# Update packages may omit FFmpeg (it is over 100 MB). Reuse the encoder from the current installation.
$bundledEncoder = Join-Path $sourcePath 'bin/ffmpeg.exe'
$keptEncoder = $null
if (-not (Test-Path -LiteralPath $bundledEncoder)) {
    foreach ($folderName in @('SuperV','GetShitDoneByVK')) {
        $candidate = Join-Path (Join-Path $env:APPDATA 'Adobe/CEP/extensions') (Join-Path $folderName 'bin/ffmpeg.exe')
        if (Test-Path -LiteralPath $candidate) { $keptEncoder = Join-Path $env:TEMP ('superv-ffmpeg-' + [guid]::NewGuid().ToString('N') + '.exe'); Copy-Item -LiteralPath $candidate -Destination $keptEncoder; break }
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
if ($keptEncoder) { Move-Item -LiteralPath $keptEncoder -Destination (Join-Path $destinationPath 'bin/ffmpeg.exe') -Force; Write-Output 'Kept your existing FFmpeg encoder.' }
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
        if ((Get-Item -LiteralPath $encoderExe).Length -gt 1MB) { Write-Output 'FFmpeg ready.' }
        else { Remove-Item -LiteralPath $encoderExe -Force -ErrorAction SilentlyContinue; Write-Output 'FFmpeg did not unpack. Run scripts\Setup-Encoder.ps1 for GIF export and Exact crop.' }
    }
    elseif (-not (Test-Path -LiteralPath $encoderExe)) { Write-Output 'FFmpeg is not included. Run scripts\Setup-Encoder.ps1, then INSTALL.cmd again, for GIF export and Exact crop.' }
}
# Personal, unsigned CEP extension: enable Adobe's development loading for this Windows user.
# Record previous values so Uninstall.ps1 -RestoreDebugSettings can restore them explicitly.
$debugRecords = @()
foreach ($cepVersion in @('11','12')) {
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
Write-Output "Installed: $destinationPath"
Write-Output 'Restart AE 2025 or 2026. Open Window > Extensions > SuperV.'
Write-Output 'Enable Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network for GIF rendering.'
Write-Output 'This installer enables unsigned CEP extension loading (PlayerDebugMode) for your Windows user.'
if (-not $Quiet) { Read-Host 'Press Enter to finish' | Out-Null }
