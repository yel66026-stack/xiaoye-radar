param([string]$PythonExe = 'python', [string]$OutputDir = "$PSScriptRoot\dist")
$ErrorActionPreference = 'Stop'
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
& $PythonExe -m PyInstaller --noconfirm --clean --onefile --windowed --name '拾页工作台' --icon "$PSScriptRoot\ui\app.ico" --version-file "$PSScriptRoot\version_info.txt" --add-data "$PSScriptRoot\ui;ui" --collect-all webview --collect-all pythonnet --collect-all clr_loader --collect-all playwright --exclude-module PyQt5 --exclude-module PyQt6 --exclude-module PySide6 --distpath $OutputDir --workpath "$PSScriptRoot\..\build" --specpath "$PSScriptRoot\..\build" "$PSScriptRoot\main.py"
if ($LASTEXITCODE -ne 0) { throw '构建失败' }
