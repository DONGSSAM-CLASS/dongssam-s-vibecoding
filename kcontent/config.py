"""설정: 환경변수/.env → 기본값. API 키는 각자 본인 것을 씁니다."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path.cwd() / ".env")

APP_ID = "KContentStudio"
MODELS = {"claude-opus-5-5": "Claude Opus 5.5", "claude-sonnet-5-5": "Claude Sonnet 5.5 (더 저렴)"}


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
    # 대본 AI: manual(무료 채팅 복사·붙여넣기) | gemini(무료 등급) | ollama(내 PC) | claude(유료)
    provider: str = field(default_factory=lambda: os.environ.get("KCONTENT_PROVIDER", "manual"))
    gemini_api_key: str = field(default_factory=lambda: os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", ""))
    gemini_model: str = field(default_factory=lambda: os.environ.get("KCONTENT_GEMINI_MODEL", ""))
    ollama_host: str = field(default_factory=lambda: os.environ.get("OLLAMA_HOST_URL", "http://127.0.0.1:11434"))
    ollama_model: str = field(default_factory=lambda: os.environ.get("KCONTENT_OLLAMA_MODEL", "exaone3.5:7.8b"))
    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    youtube_api_key: str = field(default_factory=lambda: os.environ.get("YOUTUBE_API_KEY", ""))
    model: str = field(default_factory=lambda: os.environ.get("KCONTENT_MODEL", "claude-opus-5-5"))
    effort: str = field(default_factory=lambda: os.environ.get("KCONTENT_EFFORT", "medium"))
    font_path: str = field(default_factory=lambda: os.environ.get("KCONTENT_FONT", ""))
    use_fallbacks: bool = True

    def public(self) -> dict:
        from .llm import PROVIDERS

        return {
            "provider": self.provider if self.provider in PROVIDERS else "manual",
            "providers": PROVIDERS,
            "has_gemini_key": bool(self.gemini_api_key),
            "ollama_model": self.ollama_model,
            "has_anthropic_key": bool(self.anthropic_api_key or os.environ.get("ANTHROPIC_AUTH_TOKEN")),
            "has_youtube_key": bool(self.youtube_api_key),
            "model": self.model,
            "models": MODELS,
        }
