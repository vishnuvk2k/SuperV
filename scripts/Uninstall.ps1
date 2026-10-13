param([switch]$RestoreDebugSettings)
$ErrorActionPreference = 'Stop'
if (Get-Process AfterFX -ErrorAction SilentlyContinue) { throw 'Save your work and close After Effects before uninstalling SuperV.' }
$extensionParent = Join-Path $env:APPDATA 'Adobe/CEP/extensions'
$destinationPath = [IO.Path]::GetFullPath((Join-Path $extensionParent 'SuperV'))
if ((Split-Path -Parent $destinationPath) -ne [IO.Path]::GetFullPath($extensionParent) -or (Split-Path -Leaf $destinationPath) -ne 'SuperV') { throw 'Uninstall path check failed.' }
if (-not (Test-Path -LiteralPath $destinationPath)) { Write-Output 'Extension is not installed.'; exit }
if ($RestoreDebugSettings) {
    $backup = Join-Path $destinationPath 'installation-debug-backup.json'
    if (Test-Path -LiteralPath $backup) {
        foreach ($r in (Get-Content -LiteralPath $backup -Raw | ConvertFrom-Json)) {
            if ($r.Path -notmatch '^HKCU:\\Software\\Adobe\\CSXS\.(11|12|13)$') { throw 'Unexpected registry backup path.' }
            if ($r.Existed) { Set-ItemProperty -LiteralPath $r.Path -Name PlayerDebugMode -Value $r.Value }
            else { Remove-ItemProperty -LiteralPath $r.Path -Name PlayerDebugMode -ErrorAction SilentlyContinue }
        }
    }
}
$backupPath = Join-Path (Join-Path $env:APPDATA 'SuperV-Backups') ('Uninstalled-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path (Split-Path -Parent $backupPath) -Force | Out-Null
Move-Item -LiteralPath $destinationPath -Destination $backupPath
Write-Output "Extension removed from CEP and retained at $backupPath. Restart After Effects."
