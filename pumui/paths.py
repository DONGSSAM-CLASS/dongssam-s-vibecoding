"""파일 위치.

- 리소스(웹 화면, 모의 에듀파인): 설치 폴더 안 (PyInstaller로 묶였으면 sys._MEIPASS)
- 사용자 데이터(설정, 기록, 로그): 선생님 계정의 AppData — 설치 폴더에 쓰기 권한이 없어도 동작
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

APP_ID = "EdufineAutoPumui"
APP_NAME = "에듀파인 자동 품의"


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def resource_dir() -> Path:
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent.parent


def data_dir() -> Path:
    override = os.environ.get("PUMUI_DATA_DIR")
    if override:
        base = Path(override)
    elif sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local") / APP_ID
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / APP_ID
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share") / APP_ID
    base.mkdir(parents=True, exist_ok=True)
    return base


def config_file() -> Path:
    return data_dir() / "config.json"


def runs_dir() -> Path:
    return data_dir() / "runs"


def logs_dir() -> Path:
    d = data_dir() / "logs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def profile_dir(mock: bool = False) -> Path:
    return data_dir() / ("browser-profile-mock" if mock else "browser-profile")


def instance_file() -> Path:
    return data_dir() / "instance.json"


def history_file() -> Path:
    return data_dir() / "history.json"
