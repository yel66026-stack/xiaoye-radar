param(
    [Parameter(Mandatory = $true)][string]$SetupExe,
    [Parameter(Mandatory = $true)][string]$ExpectedAppExe,
    [Parameter(Mandatory = $true)][string]$QaRoot
)
$ErrorActionPreference = 'Stop'
$taskSetup = (Resolve-Path -LiteralPath $SetupExe).Path
$taskExpectedHash = (Get-FileHash -LiteralPath $ExpectedAppExe -Algorithm SHA256).Hash
$taskQa = [IO.Path]::GetFullPath($QaRoot)
if (Test-Path -LiteralPath $taskQa) { throw 'QA directory must be new.' }
$taskInstall = Join-Path $taskQa '安装测试 工作区'
$taskDesktopLink = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) '拾页工作台.lnk'
$taskStartFolder = Join-Path ([Environment]::GetFolderPath('Programs')) '拾页工作台'
$taskReg = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiyeWorkbench'
if ((Test-Path -LiteralPath $taskDesktopLink) -or (Test-Path -LiteralPath $taskStartFolder) -or
    (Test-Path -LiteralPath $taskReg) -or (Test-Path -LiteralPath 'HKCU:\Software\ShiyeWorkbench')) {
    throw 'Existing installation or shortcut found; test will not overwrite it.'
}
New-Item -ItemType Directory -Path "$taskInstall\data" -Force | Out-Null
Set-Content -LiteralPath "$taskInstall\data\保留验证.txt" -Value 'installer-QA-only' -Encoding UTF8
$taskReport = [ordered]@{ passed = $false; checks = [Collections.Generic.List[string]]::new(); install_dir = $taskInstall }
function Confirm-Check([bool]$Condition, [string]$Name) {
    if (-not $Condition) { throw "Failed: $Name" }
    $taskReport.checks.Add($Name)
    Write-Output "PASS: $Name"
}
function Run-Installer([switch]$UseSavedDirectory) {
    $taskInstallArgs = if ($UseSavedDirectory) { '/S' } else { "/S /D=$taskInstall" }
    $taskProcess = Start-Process -FilePath $taskSetup -ArgumentList $taskInstallArgs -WindowStyle Hidden -PassThru -Wait
    if ($taskProcess.ExitCode -ne 0) { throw "Installer exit code $($taskProcess.ExitCode)" }
}
try {
    Run-Installer
    Confirm-Check ((Get-FileHash -LiteralPath "$taskInstall\拾页工作台.exe" -Algorithm SHA256).Hash -eq $taskExpectedHash) 'Installed application exactly matches the verified 2.2.2 EXE'
    $taskShell = New-Object -ComObject WScript.Shell
    $taskLink = $taskShell.CreateShortcut($taskDesktopLink)
    Confirm-Check ((Test-Path -LiteralPath $taskDesktopLink) -and ($taskLink.TargetPath -eq "$taskInstall\拾页工作台.exe") -and ($taskLink.WorkingDirectory -eq $taskInstall) -and ($taskLink.Arguments -eq '')) 'Desktop shortcut is automatic, resolves to the installed EXE and uses its workspace'
    $taskStartLink = $taskShell.CreateShortcut("$taskStartFolder\拾页工作台.lnk")
    Confirm-Check ((Test-Path -LiteralPath "$taskStartFolder\拾页工作台.lnk") -and ($taskStartLink.TargetPath -eq "$taskInstall\拾页工作台.exe")) 'Start menu shortcut resolves to the installed EXE'
    $taskUninstall = Get-ItemProperty -LiteralPath $taskReg
    Confirm-Check (($taskUninstall.InstallLocation -eq $taskInstall) -and ($taskUninstall.DisplayVersion -eq '2.2.2') -and ($taskUninstall.UninstallString -eq ('"' + "$taskInstall\卸载拾页工作台.exe" + '"'))) 'Windows uninstall registration has the correct version, path and quoted command'
    $taskSmoke = Start-Process -FilePath $taskLink.TargetPath -WorkingDirectory $taskLink.WorkingDirectory -ArgumentList '--ui-smoke' -WindowStyle Hidden -PassThru
    if (-not $taskSmoke.WaitForExit(120000)) { throw 'Installed application native smoke timed out.' }
    $taskNativeReport = Get-Content -LiteralPath "$taskInstall\native-report.json" -Raw | ConvertFrom-Json
    Confirm-Check (($taskSmoke.ExitCode -eq 0) -and $taskNativeReport.passed) 'The installed executable starts and passes real native bridge/settings/backup/license checks'
    $taskDatabaseHash = (Get-FileHash -LiteralPath "$taskInstall\data\workspace.sqlite3" -Algorithm SHA256).Hash
    $taskMarkerHash = (Get-FileHash -LiteralPath "$taskInstall\data\保留验证.txt" -Algorithm SHA256).Hash
    Run-Installer -UseSavedDirectory
    Confirm-Check (((Get-FileHash -LiteralPath "$taskInstall\data\workspace.sqlite3" -Algorithm SHA256).Hash -eq $taskDatabaseHash) -and
        ((Get-FileHash -LiteralPath "$taskInstall\data\保留验证.txt" -Algorithm SHA256).Hash -eq $taskMarkerHash)) 'Reinstallation preserves the actual SQLite workspace and existing user files byte for byte'
    $taskReinstalledLink = $taskShell.CreateShortcut($taskDesktopLink)
    Confirm-Check (((Get-FileHash -LiteralPath "$taskInstall\拾页工作台.exe" -Algorithm SHA256).Hash -eq $taskExpectedHash) -and
        ($taskReinstalledLink.TargetPath -eq "$taskInstall\拾页工作台.exe")) 'Reinstallation automatically reuses the saved installation directory and refreshes shortcuts'
    $taskUninstaller = Join-Path $taskInstall '卸载拾页工作台.exe'
    Start-Process -FilePath $taskUninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait
    $taskDeadline = [DateTime]::UtcNow.AddSeconds(30)
    while (((Test-Path -LiteralPath "$taskInstall\拾页工作台.exe") -or (Test-Path -LiteralPath $taskReg)) -and ([DateTime]::UtcNow -lt $taskDeadline)) {
        Start-Sleep -Milliseconds 250
    }
    Confirm-Check ((-not (Test-Path -LiteralPath "$taskInstall\拾页工作台.exe")) -and
        (-not (Test-Path -LiteralPath $taskReg)) -and
        (-not (Test-Path -LiteralPath $taskDesktopLink)) -and
        (-not (Test-Path -LiteralPath "$taskStartFolder\拾页工作台.lnk"))) 'Uninstallation removes the program, desktop/start-menu shortcuts and Windows application registration'
    Confirm-Check (((Get-FileHash -LiteralPath "$taskInstall\data\workspace.sqlite3" -Algorithm SHA256).Hash -eq $taskDatabaseHash) -and
        ((Get-FileHash -LiteralPath "$taskInstall\data\保留验证.txt" -Algorithm SHA256).Hash -eq $taskMarkerHash)) 'Uninstallation retains the actual SQLite workspace and user files byte for byte'
    $taskReport.passed = $true
} catch {
    $taskReport.error = $_.Exception.ToString()
    throw
} finally {
    $taskReport | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$taskQa\installer-report.json" -Encoding UTF8
}
