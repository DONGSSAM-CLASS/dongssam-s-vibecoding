; 에듀파인 자동 품의 — Windows 설치 파일 (Inno Setup 6)
; 빌드:  iscc /DAppVersion=1.0.0 packaging\installer.iss   (먼저 pyinstaller로 dist\EdufineAutoPumui 생성)
; 관리자 권한 없이 사용자 폴더(%LOCALAPPDATA%\Programs)에 설치합니다 — 학교 PC에서도 설치 가능.

#define AppName "에듀파인 자동 품의"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#define AppExe "EdufineAutoPumui.exe"

[Setup]
AppId={{8F3C2A51-6B7E-4E0B-9C1D-5A2E7F4B9D10}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=동쌤(김동은 선생님)
AppCopyright=제작자: 동쌤(김동은 선생님)
VersionInfoCompany=동쌤(김동은 선생님)
VersionInfoDescription=에듀파인 자동 품의 설치 프로그램 (제작자: 동쌤(김동은 선생님))
VersionInfoVersion={#AppVersion}
AppPublisherURL=https://github.com/DONGSSAM-CLASS/dongssam-s-vibecoding
DefaultDirName={localappdata}\Programs\EdufineAutoPumui
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=EdufineAutoPumui-Setup-{#AppVersion}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 바로가기 만들기"; GroupDescription: "바로가기:"

[Files]
Source: "..\dist\EdufineAutoPumui\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; 이전 버전의 프로그램 파일 정리 (선생님 설정·기록은 %LOCALAPPDATA%\EdufineAutoPumui 에 따로 있어 유지됨)
Type: filesandordirs; Name: "{app}\_internal"

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "지금 실행하기"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM {#AppExe}"; Flags: runhidden; RunOnceId: "StopApp"
