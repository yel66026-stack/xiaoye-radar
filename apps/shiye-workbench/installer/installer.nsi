# -*- coding: utf-8 -*-
Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

!ifndef APP_EXE
  !error "Build with build-installer.ps1 and supply the verified application EXE."
!endif
!ifndef OUTPUT_FILE
  !error "OUTPUT_FILE is required."
!endif
!ifndef NSIS_LICENSE
  !error "NSIS_LICENSE is required."
!endif

!define APP_NAME "拾页工作台"
!define APP_VERSION "2.2.2"
!define APP_KEY "Software\ShiyeWorkbench"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShiyeWorkbench"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\ShiyeWorkbench"
InstallDirRegKey HKCU "${APP_KEY}" "InstallDir"
RequestExecutionLevel user
ManifestDPIAware true
CRCCheck force
SetCompressor /SOLID lzma
SetCompressorDictSize 32
ShowInstDetails nevershow
ShowUninstDetails nevershow
BrandingText "拾页 · Daylight"
VIProductVersion "2.2.2.1"
VIAddVersionKey /LANG=2052 "ProductName" "拾页工作台安装程序"
VIAddVersionKey /LANG=2052 "ProductVersion" "2.2.2"
VIAddVersionKey /LANG=2052 "FileDescription" "拾页工作台 Windows 安装版"
VIAddVersionKey /LANG=2052 "FileVersion" "2.2.2.1"
VIAddVersionKey /LANG=2052 "LegalCopyright" "拾页工作台"

!define MUI_ICON "..\web\public\app.ico"
!define MUI_UNICON "..\web\public\app.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "安装拾页工作台"
!define MUI_WELCOMEPAGE_TEXT "将拾页工作台安装到此电脑。$\r$\n$\r$\n安装完成后会自动创建桌面快捷方式和开始菜单入口。$\r$\n$\r$\n更新前请先退出正在运行的拾页工作台。"
!define MUI_FINISHPAGE_TITLE "拾页工作台已安装"
!define MUI_FINISHPAGE_TEXT "桌面快捷方式已创建。$\r$\n下次双击桌面上的「拾页工作台」即可打开。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\拾页工作台.exe"
!define MUI_FINISHPAGE_RUN_TEXT "打开拾页工作台"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_UNCONFIRMPAGE_TEXT_TOP "将卸载拾页工作台并移除快捷方式。$\r$\n$\r$\n你的工作区、采集内容、词库、导出文件、备份和登录资料会保留在原安装文件夹中。"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"

Var InstallerMutex

Function .onInit
  SetShellVarContext current
  SetRegView 64
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "此版本需要 64 位 Windows 10 或 Windows 11。" /SD IDOK
    SetErrorLevel 1633
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "此版本需要 Windows 10 或 Windows 11。" /SD IDOK
    SetErrorLevel 1633
    Abort
  ${EndIf}
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\ShiyeWorkbenchInstaller") p .r0 ?e'
  Pop $1
  StrCpy $InstallerMutex $0
  ${If} $1 == 183
    MessageBox MB_OK|MB_ICONINFORMATION "另一个安装或卸载程序正在运行，请先完成它。" /SD IDOK
    SetErrorLevel 1618
    Abort
  ${EndIf}
FunctionEnd

Function .onGUIEnd
  System::Call 'kernel32::CloseHandle(p $InstallerMutex)'
FunctionEnd

Section "拾页工作台" SEC_APP
  SetShellVarContext current
  SetRegView 64
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File /oname=拾页工作台.exe "${APP_EXE}"
  File /oname=安装与使用说明.txt "使用说明.txt"
  SetOutPath "$INSTDIR\第三方许可"
  File /oname=应用依赖许可.txt "..\web\public\THIRD_PARTY_NOTICES.txt"
  File /oname=NSIS许可.txt "${NSIS_LICENSE}"
  SetOutPath "$INSTDIR"
  ClearErrors
  WriteUninstaller "$INSTDIR\卸载拾页工作台.exe"
  CreateDirectory "$SMPROGRAMS\拾页工作台"
  CreateShortCut "$DESKTOP\拾页工作台.lnk" "$INSTDIR\拾页工作台.exe" "" "$INSTDIR\拾页工作台.exe" 0 SW_SHOWNORMAL "" "拾页工作台 · 关键词采集与内容研究"
  CreateShortCut "$SMPROGRAMS\拾页工作台\拾页工作台.lnk" "$INSTDIR\拾页工作台.exe" "" "$INSTDIR\拾页工作台.exe" 0 SW_SHOWNORMAL "" "拾页工作台 · 关键词采集与内容研究"
  CreateShortCut "$SMPROGRAMS\拾页工作台\卸载拾页工作台.lnk" "$INSTDIR\卸载拾页工作台.exe"
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "创建快捷方式或卸载入口失败，请检查桌面与安装文件夹的写入权限后重新安装。" /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  WriteRegStr HKCU "${APP_KEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "拾页工作台"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "拾页工作台"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\拾页工作台.exe,0"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\卸载拾页工作台.exe"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\卸载拾页工作台.exe" /S'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" 55000
SectionEnd

Function un.onInit
  SetShellVarContext current
  SetRegView 64
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\ShiyeWorkbenchInstaller") p .r0 ?e'
  Pop $1
  StrCpy $InstallerMutex $0
  ${If} $1 == 183
    MessageBox MB_OK|MB_ICONINFORMATION "另一个安装或卸载程序正在运行，请先完成它。" /SD IDOK
    SetErrorLevel 1618
    Abort
  ${EndIf}
FunctionEnd

Function un.onGUIEnd
  System::Call 'kernel32::CloseHandle(p $InstallerMutex)'
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  SetRegView 64
  retry_delete:
  ClearErrors
  Delete "$INSTDIR\拾页工作台.exe"
  ${If} ${Errors}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "请先退出拾页工作台，再重试卸载。" /SD IDCANCEL IDRETRY retry_delete
    SetErrorLevel 1
    Abort
  ${EndIf}
  Delete "$DESKTOP\拾页工作台.lnk"
  Delete "$SMPROGRAMS\拾页工作台\拾页工作台.lnk"
  Delete "$SMPROGRAMS\拾页工作台\卸载拾页工作台.lnk"
  RMDir "$SMPROGRAMS\拾页工作台"
  Delete "$INSTDIR\安装与使用说明.txt"
  Delete "$INSTDIR\第三方许可\应用依赖许可.txt"
  Delete "$INSTDIR\第三方许可\NSIS许可.txt"
  RMDir "$INSTDIR\第三方许可"
  Delete "$INSTDIR\卸载拾页工作台.exe"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "${APP_KEY}"
  ; Only remove empty directories. User-created workspaces are never deleted.
  RMDir "$INSTDIR"
SectionEnd
