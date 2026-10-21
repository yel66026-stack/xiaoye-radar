param(
    [string]$PythonExe = 'python',
    [string]$PnpmExe = 'pnpm',
    [string]$OutputDir = "$PSScriptRoot\dist"
)
$ErrorActionPreference = 'Stop'
Push-Location "$PSScriptRoot\web"
try {
    & $PnpmExe install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw '前端依赖安装失败' }
    & $PnpmExe test
    if ($LASTEXITCODE -ne 0) { throw '前端验证失败' }
    & $PnpmExe build
    if ($LASTEXITCODE -ne 0) { throw '前端构建失败' }
} finally {
    Pop-Location
}
& "$PSScriptRoot\src\build.ps1" -PythonExe $PythonExe -OutputDir $OutputDir
