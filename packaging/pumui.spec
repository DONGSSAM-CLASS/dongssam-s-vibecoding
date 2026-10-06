# -*- mode: python ; coding: utf-8 -*-
# 빌드:  pyinstaller packaging/pumui.spec --noconfirm
# 결과:  dist/EdufineAutoPumui/EdufineAutoPumui.exe (폴더째 배포 또는 installer.iss로 설치 파일 생성)
import os

from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))

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
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="EdufineAutoPumui", upx=False)
