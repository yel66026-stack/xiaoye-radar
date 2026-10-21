param(
    [Parameter(Mandatory = $true)][string]$AppExe,
    [Parameter(Mandatory = $true)][string]$NsisExe,
    [string]$OutputDir = "$PSScriptRoot\..\dist"
)
$ErrorActionPreference = 'Stop'
$taskAppExe = (Resolve-Path -LiteralPath $AppExe).Path
$taskNsisExe = (Resolve-Path -LiteralPath $NsisExe).Path
$taskNsisHome = Split-Path -Parent $taskNsisExe
$taskNsisLicense = Join-Path $taskNsisHome 'COPYING'
if (-not (Test-Path -LiteralPath $taskNsisLicense)) { throw 'NSIS COPYING license not found beside compiler.' }
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$taskOutput = Join-Path (Resolve-Path -LiteralPath $OutputDir).Path '拾页工作台_2.2.2_Windows安装版.exe'
Push-Location $PSScriptRoot
try {
    & $taskNsisExe /V3 /WX /INPUTCHARSET UTF8 /OUTPUTCHARSET UTF8 "/DAPP_EXE=$taskAppExe" "/DOUTPUT_FILE=$taskOutput" "/DNSIS_LICENSE=$taskNsisLicense" 'installer.nsi'
    if ($LASTEXITCODE -ne 0) { throw "Installer build failed: $LASTEXITCODE" }
} finally {
    Pop-Location
}
Get-FileHash -LiteralPath $taskOutput -Algorithm SHA256
