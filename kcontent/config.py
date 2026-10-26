"""설정: 환경변수/.env → 기본값. API 키는 각자 본인 것을 씁니다."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path.cwd() / ".env")

APP_ID = "KContentStudio"
MODELS = {"claude-opus-5-5": "Claude Opus 5.5 (기본)", "claude-sonnet-5-5": "Claude Sonnet 5.5 (저렴·빠름)"}


def data_dir() -> Path:
    override = os.environ.get("KCONTENT_DATA_DIR")
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


def projects_dir() -> Path:
    d = data_dir() / "projects"
    d.mkdir(parents=True, exist_ok=True)
    return d


@dataclass
class Settings:
    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    youtube_api_key: str = field(default_factory=lambda: os.environ.get("YOUTUBE_API_KEY", ""))
    model: str = field(default_factory=lambda: os.environ.get("KCONTENT_MODEL", "claude-opus-5-5"))
    effort: str = field(default_factory=lambda: os.environ.get("KCONTENT_EFFORT", "medium"))
    font_path: str = field(default_factory=lambda: os.environ.get("KCONTENT_FONT", ""))
    use_fallbacks: bool = True

    def public(self) -> dict:
        return {
            "has_anthropic_key": bool(self.anthropic_api_key or os.environ.get("ANTHROPIC_AUTH_TOKEN")),
            "has_youtube_key": bool(self.youtube_api_key),
            "model": self.model,
            "models": MODELS,
        }
