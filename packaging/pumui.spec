# -*- mode: python ; coding: utf-8 -*-
# 빌드:  pyinstaller packaging/pumui.spec --noconfirm
# 결과:  dist/EdufineAutoPumui/EdufineAutoPumui.exe (폴더째 배포 또는 installer.iss로 설치 파일 생성)
import os
import re

from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))

# 버전·제작자는 pumui/__init__.py 한 곳에서 관리
_init = open(os.path.join(ROOT, "pumui", "__init__.py"), encoding="utf-8").read()
VERSION = re.search(r'__version__ = "([^"]+)"', _init).group(1)
AUTHOR = re.search(r'__author__ = "([^"]+)"', _init).group(1)
_v = tuple(int(x) for x in VERSION.split(".")[:3]) + (0,)

# exe 파일 속성(우클릭 → 속성 → 자세히)에 보이는 정보 (Windows 빌드에서만 사용)
try:
    from PyInstaller.utils.win32.versioninfo import (
        FixedFileInfo, StringFileInfo, StringStruct, StringTable, VarFileInfo, VarStruct, VSVersionInfo,
    )
except ImportError:  # 리눅스 등: pefile 없음
    VSVersionInfo = None
version_info = None if VSVersionInfo is None else VSVersionInfo(
    ffi=FixedFileInfo(filevers=_v, prodvers=_v),
    kids=[
        StringFileInfo([StringTable("041204B0", [
            StringStruct("CompanyName", AUTHOR),
            StringStruct("FileDescription", "에듀파인 자동 품의"),
            StringStruct("FileVersion", VERSION),
            StringStruct("InternalName", "EdufineAutoPumui"),
            StringStruct("LegalCopyright", f"제작자: {AUTHOR}"),
            StringStruct("OriginalFilename", "EdufineAutoPumui.exe"),
            StringStruct("ProductName", "에듀파인 자동 품의"),
            StringStruct("ProductVersion", VERSION),
        ])]),
        VarFileInfo([VarStruct("Translation", [0x0412, 1200])]),
    ],
)

datas = [
    (os.path.join(ROOT, "pumui", "static"), "pumui/static"),
    (os.path.join(ROOT, "mock_edufine"), "mock_edufine"),
]
binaries = []
hiddenimports = collect_submodules("uvicorn") + ["anthropic", "httpx2"]

# Playwright 드라이버(node)는 같이 묶고, 브라우저는 PC에 설치된 크롬/엣지를 씀
pw_datas, pw_bins, pw_hidden = collect_all("playwright")
datas += pw_datas
binaries += pw_bins
hiddenimports += pw_hidden

a = Analysis(
    [os.path.join(SPECPATH, "launcher.py")],
    pathex=[ROOT],
    datas=datas,
    binaries=binaries,
    hiddenimports=hiddenimports,
    excludes=["tkinter", "pytest", "matplotlib", "numpy"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="EdufineAutoPumui",
    console=False,
    icon=os.path.join(SPECPATH, "icon.ico"),
    version=version_info,
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="EdufineAutoPumui", upx=False)
