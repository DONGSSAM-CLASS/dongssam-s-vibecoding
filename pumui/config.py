"""실행 설정.

우선순위: 프로그램 설정 화면에서 저장한 값(AppData/config.json) → 환경변수/.env(개발자용) → 기본값.
API 키와 인증서 암호는 secret_store로 암호화해 저장합니다.
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from . import paths
from .secret_store import seal, unseal

ROOT = paths.resource_dir()
load_dotenv(Path.cwd() / ".env")
load_dotenv(ROOT / ".env")

# 시·도교육청 업무포털 (eduptl.kr) 지역 코드
REGIONS: dict[str, str] = {
    "sen": "서울", "pen": "부산", "dge": "대구", "ice": "인천", "gen": "광주",
    "dje": "대전", "use": "울산", "sje": "세종", "goe": "경기", "gwe": "강원",
    "cbe": "충북", "cne": "충남", "jbe": "전북", "jne": "전남", "gbe": "경북",
    "gne": "경남", "jje": "제주",
}
MODELS = {"claude-opus-5-5": "Claude Opus 5.5 (정확, 기본)", "claude-sonnet-5-5": "Claude Sonnet 5.5 (저렴·빠름)"}
SECRET_KEYS = ("api_key", "cert_password")

# 설정 화면 키 → (환경변수, 기본값)
_FIELDS: dict[str, tuple[str, Any]] = {
    "model": ("PUMUI_MODEL", "claude-opus-5-5"),
    "effort": ("PUMUI_EFFORT", "medium"),
    "region": ("PUMUI_REGION", "sen"),
    "portal_url": ("PUMUI_PORTAL_URL", ""),
    "cert_owner": ("PUMUI_CERT_OWNER", ""),
    "stop_at": ("PUMUI_STOP_AT", "submit"),
    "browser": ("PUMUI_BROWSER_CHANNEL", "auto"),
    "browser_path": ("PUMUI_BROWSER_PATH", ""),
    "cdp_url": ("PUMUI_CDP_URL", ""),
    "school_notes": ("PUMUI_SCHOOL_NOTES", ""),
    "retention_days": ("PUMUI_RETENTION_DAYS", 30),
    "api_key": ("ANTHROPIC_API_KEY", ""),
    "cert_password": ("PUMUI_CERT_PASSWORD", ""),
}

_lock = threading.Lock()


def load_user_config() -> dict[str, Any]:
    try:
        return json.loads(paths.config_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_user_config(updates: dict[str, Any]) -> dict[str, Any]:
    """설정 화면에서 받은 값을 저장. 비밀값은 암호화, 빈 문자열이 아닌 None은 '변경 없음'."""
    with _lock:
        cfg = load_user_config()
        for key, value in updates.items():
            if value is None:
                continue
            if key in SECRET_KEYS:
                if value == "":
                    cfg.pop(key, None)
                else:
                    cfg[key] = seal(str(value))
            else:
                cfg[key] = value
        path = paths.config_file()
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, path)
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        return cfg


def _value(cfg: dict[str, Any], key: str) -> Any:
    env, default = _FIELDS[key]
    if key in SECRET_KEYS:
        stored = unseal(cfg.get(key))
        return stored or os.environ.get(env, default).strip()
    if key in cfg and cfg[key] not in ("", None):
        return cfg[key]
    raw = os.environ.get(env)
    if raw is None or raw.strip() == "":
        return default
    return type(default)(raw.strip()) if isinstance(default, int) else raw.strip()


def _viewport(raw: str) -> tuple[int, int]:
    try:
        w, h = raw.lower().split("x")
        return int(w), int(h)
    except ValueError:
        return 1440, 900


def _cfg_field(key: str):
    return field(default_factory=lambda: _value(load_user_config(), key))


@dataclass
class Settings:
    model: str = _cfg_field("model")
    effort: str = _cfg_field("effort")
    region: str = _cfg_field("region")
    portal_url_override: str = _cfg_field("portal_url")
    cert_owner: str = _cfg_field("cert_owner")
    stop_at: str = _cfg_field("stop_at")
    browser_channel: str = _cfg_field("browser")
    browser_path: str = _cfg_field("browser_path")
    cdp_url: str = _cfg_field("cdp_url")
    school_notes: str = _cfg_field("school_notes")
    retention_days: int = _cfg_field("retention_days")
    api_key: str = field(default_factory=lambda: _value(load_user_config(), "api_key"), repr=False)
    cert_password: str = field(default_factory=lambda: _value(load_user_config(), "cert_password"), repr=False)
    viewport: tuple[int, int] = field(default_factory=lambda: _viewport(os.environ.get("PUMUI_VIEWPORT", "1440x900")))
    headless: bool = field(default_factory=lambda: os.environ.get("PUMUI_HEADLESS") == "1")
    profile_dir: Path = field(default_factory=paths.profile_dir)
    runs_dir: Path = field(default_factory=paths.runs_dir)
    max_steps: int = field(default_factory=lambda: int(os.environ.get("PUMUI_MAX_STEPS", "150")))
    use_fallbacks: bool = field(default_factory=lambda: os.environ.get("PUMUI_FALLBACKS", "on") != "off")

    @property
    def portal_url(self) -> str:
        if self.portal_url_override:
            return self.portal_url_override
        return f"https://{self.region}.eduptl.kr/"

    @property
    def region_name(self) -> str:
        return REGIONS.get(self.region, self.region)

    def public(self) -> dict[str, Any]:
        """설정 화면에 보여줄 값 (비밀값은 저장 여부와 끝 4자리만)."""
        return {
            "model": self.model, "effort": self.effort, "region": self.region,
            "portal_url": self.portal_url_override, "portal_url_effective": self.portal_url,
            "cert_owner": self.cert_owner, "stop_at": self.stop_at, "browser": self.browser_channel,
            "school_notes": self.school_notes, "retention_days": self.retention_days,
            "api_key_saved": bool(self.api_key), "api_key_hint": ("…" + self.api_key[-4:]) if self.api_key else "",
            "cert_password_saved": bool(self.cert_password),
        }
