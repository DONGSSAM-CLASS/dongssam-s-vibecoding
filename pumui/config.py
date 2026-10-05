"""실행 설정 (.env 또는 환경변수에서 읽음)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# 시·도교육청 업무포털 (eduptl.kr) 지역 코드
REGIONS: dict[str, str] = {
    "sen": "서울", "pen": "부산", "dge": "대구", "ice": "인천", "gen": "광주",
    "dje": "대전", "use": "울산", "sje": "세종", "goe": "경기", "gwe": "강원",
    "cbe": "충북", "cne": "충남", "jbe": "전북", "jne": "전남", "gbe": "경북",
    "gne": "경남", "jje": "제주",
}


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _viewport(raw: str) -> tuple[int, int]:
    try:
        w, h = raw.lower().split("x")
        return int(w), int(h)
    except ValueError:
        return 1440, 900


@dataclass
class Settings:
    model: str = field(default_factory=lambda: _env("PUMUI_MODEL", "claude-opus-5-5"))
    effort: str = field(default_factory=lambda: _env("PUMUI_EFFORT", "medium"))
    region: str = field(default_factory=lambda: _env("PUMUI_REGION", "sen"))
    portal_url_override: str = field(default_factory=lambda: _env("PUMUI_PORTAL_URL"))
    cert_password: str = field(default_factory=lambda: _env("PUMUI_CERT_PASSWORD"), repr=False)
    cert_owner: str = field(default_factory=lambda: _env("PUMUI_CERT_OWNER"))
    stop_at: str = field(default_factory=lambda: _env("PUMUI_STOP_AT", "submit"))
    browser_channel: str = field(default_factory=lambda: _env("PUMUI_BROWSER_CHANNEL", "chrome"))
    cdp_url: str = field(default_factory=lambda: _env("PUMUI_CDP_URL"))
    browser_path: str = field(default_factory=lambda: _env("PUMUI_BROWSER_PATH"))
    viewport: tuple[int, int] = field(default_factory=lambda: _viewport(_env("PUMUI_VIEWPORT", "1440x900")))
    headless: bool = field(default_factory=lambda: _env("PUMUI_HEADLESS") == "1")
    profile_dir: Path = field(default_factory=lambda: ROOT / ".browser-profile")
    runs_dir: Path = field(default_factory=lambda: ROOT / "runs")
    max_steps: int = field(default_factory=lambda: int(_env("PUMUI_MAX_STEPS", "150")))
    use_fallbacks: bool = field(default_factory=lambda: _env("PUMUI_FALLBACKS", "on") != "off")

    @property
    def portal_url(self) -> str:
        if self.portal_url_override:
            return self.portal_url_override
        return f"https://{self.region}.eduptl.kr/"

    @property
    def region_name(self) -> str:
        return REGIONS.get(self.region, self.region)
