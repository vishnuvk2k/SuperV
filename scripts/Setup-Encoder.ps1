param([string]$EncoderPath)
$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$binDirectory = Join-Path $packageRoot 'SuperV/bin'
New-Item -ItemType Directory -Path $binDirectory -Force | Out-Null
if ($EncoderPath) {
    $resolvedEncoder = (Resolve-Path -LiteralPath $EncoderPath).Path
    if ([IO.Path]::GetFileName($resolvedEncoder) -ne 'ffmpeg.exe') { throw 'Select ffmpeg.exe.' }
    Copy-Item -LiteralPath $resolvedEncoder -Destination (Join-Path $binDirectory 'ffmpeg.exe') -Force
    Write-Output 'Encoder copied for personal use. Keep its original license and source information if redistributing.'
} else {
    # Windows binary provider linked from https://ffmpeg.org/download.html
    $encoderUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
    $downloadRoot = Join-Path $env:TEMP ('vk-ffmpeg-download-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $downloadRoot | Out-Null
    $archivePath = Join-Path $downloadRoot 'ffmpeg.zip'
    Write-Output "Downloading FFmpeg from $encoderUrl (approximately 100 MB)…"
    Invoke-WebRequest -Uri $encoderUrl -OutFile $archivePath -UseBasicParsing
    Expand-Archive -LiteralPath $archivePath -DestinationPath (Join-Path $downloadRoot 'expanded')
    $encoderFile = Get-ChildItem -LiteralPath (Join-Path $downloadRoot 'expanded') -Filter 'ffmpeg.exe' -Recurse -File | Select-Object -First 1
    if (-not $encoderFile) { throw 'Downloaded archive did not contain ffmpeg.exe.' }
    Copy-Item -LiteralPath $encoderFile.FullName -Destination (Join-Path $binDirectory 'ffmpeg.exe') -Force
    $buildRoot = Split-Path -Parent (Split-Path -Parent $encoderFile.FullName)
    foreach ($licenseFile in (Get-ChildItem -LiteralPath $buildRoot -File | Where-Object { $_.Name -match 'license|readme' })) {
        Copy-Item -LiteralPath $licenseFile.FullName -Destination $binDirectory -Force
    }
    "Downloaded from $encoderUrl`r`nFFmpeg source: https://ffmpeg.org/download.html`r`nBuild source and configuration: https://www.gyan.dev/ffmpeg/builds/`r`nDownload archive: $archivePath" | Set-Content -LiteralPath (Join-Path $binDirectory 'ENCODER-SOURCE.txt')
    Write-Output "Original archive retained at $archivePath"
}
Write-Output 'Encoder ready. Run Install.ps1 again if already installed, or choose this ffmpeg.exe in panel SETTINGS.'
