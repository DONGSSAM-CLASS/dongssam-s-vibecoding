"""기록 정리, 최근 품의 목록, 새 버전 확인."""

from __future__ import annotations

import json
import logging
import re
import shutil
import time
import urllib.request
from datetime import datetime
from typing import Any

from . import __version__, paths

log = logging.getLogger(__name__)

UPDATE_REPO = "DONGSSAM-CLASS/dongssam-s-vibecoding"
HISTORY_LIMIT = 30


def cleanup_runs(retention_days: int) -> int:
    """보관 기간이 지난 작업 기록(스크린샷 포함)을 지웁니다. 지운 개수를 돌려줌."""
    if retention_days <= 0:
        return 0
    root = paths.runs_dir()
    if not root.exists():
        return 0
    cutoff = time.time() - retention_days * 86400
    removed = 0
    for d in root.iterdir():
        try:
            if d.is_dir() and d.stat().st_mtime < cutoff:
                shutil.rmtree(d, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed


def load_history() -> list[dict[str, Any]]:
    try:
        data = json.loads(paths.history_file().read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def add_history(draft: dict[str, Any], result: str = "", document_number: str = "") -> None:
    items = load_history()
    entry = {
        "at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "title": draft.get("title", ""),
        "total": sum(int(i.get("quantity", 0)) * int(i.get("unit_price", 0)) for i in draft.get("items", [])),
        "result": result,
        "document_number": document_number,
        "draft": draft,
    }
    items.insert(0, entry)
    paths.history_file().write_text(json.dumps(items[:HISTORY_LIMIT], ensure_ascii=False, indent=1), encoding="utf-8")


def _ver(tag: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", tag)[:3]) or (0,)


def check_update(timeout: float = 4.0) -> dict[str, str] | None:
    """GitHub 최신 릴리스가 현재 버전보다 새로우면 {version, url}. 확인 실패는 조용히 무시."""
    url = f"https://api.github.com/repos/{UPDATE_REPO}/releases/latest"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "EdufineAutoPumui"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 — 고정된 https 주소
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        log.info("업데이트 확인 실패: %s", exc)
        return None
    tag = data.get("tag_name", "")
    if tag and _ver(tag) > _ver(__version__):
        return {"version": tag, "url": data.get("html_url", f"https://github.com/{UPDATE_REPO}/releases")}
    return None
