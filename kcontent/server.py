"""K-콘텐츠 스튜디오 로컬 웹 화면.

① 소재 찾기(YouTube Data API) → ② 대본·제목·자막(Claude) → ③ 썸네일 → ④ 프로젝트 폴더/ZIP 내보내기

보안: 127.0.0.1에서만 열리고, 실행할 때마다 만든 비밀 토큰이 없으면 /api/* 를 거부합니다.
"""

from __future__ import annotations

import asyncio
import base64
import re
import secrets
import socket
import threading
import urllib.request
import webbrowser
from pathlib import Path
from typing import Any

import anthropic
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from pydantic import BaseModel, Field

from . import __version__, project, rights, subtitles, thumbnail
from .config import Settings, projects_dir
from .models import Candidate, VideoPlan
from .planner import MissingApiKey, make_plan
from .scoring import score_candidate
from .youtube import KEYWORDS, LANG_NAMES, YouTubeClient, YouTubeError, to_candidate

HOST = "127.0.0.1"
PORT_RANGE = range(8790, 8810)
STATIC = Path(__file__).resolve().parent / "static"
THUMB_HOSTS = ("https://i.ytimg.com/", "https://i9.ytimg.com/")


class State:
    def __init__(self) -> None:
        self.token = secrets.token_urlsafe(24)
        self.allowed_hosts: set[str] = set()
        self.set_port(PORT_RANGE.start)

    def set_port(self, port: int) -> None:
        self.port = port
        self.allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}


state = State()
app = FastAPI(title="K-콘텐츠 스튜디오", docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def guard(request: Request, call_next):
    if request.headers.get("host", "") not in state.allowed_hosts:
        return PlainTextResponse("forbidden host", status_code=403)
    if request.url.path.startswith("/api/"):
        token = request.headers.get("x-kc-token") or request.query_params.get("t") or ""
        if not secrets.compare_digest(token, state.token):
            return JSONResponse({"detail": "프로그램을 다시 실행해 주세요 (보안 토큰 불일치)."}, status_code=403)
    return await call_next(request)


# ── 요청 모델 ────────────────────────────────────────────────
class SearchRequest(BaseModel):
    keywords: list[str] = Field(min_length=1, max_length=20)
    cc_only: bool = False
    min_minutes: int = Field(default=8, ge=0, le=180)
    per_keyword: int = Field(default=20, ge=5, le=50)
    published_after: str = ""


class UrlRequest(BaseModel):
    url: str


class ManualRequest(BaseModel):
    title: str
    channel: str = ""
    duration_min: int = Field(default=10, ge=1, le=600)
    description: str = ""
    own: bool = True


class PlanRequest(BaseModel):
    candidate: Candidate
    notes: str = ""
    transcript: str = ""
    channel_style: str = ""


class ThumbRequest(BaseModel):
    text: str
    badge: str = ""
    theme: str = "yellow"
    background_b64: str = ""
    background_url: str = ""


class ExportRequest(BaseModel):
    candidate: Candidate
    plan: VideoPlan
    thumbnail_b64: str = ""


def _yt(settings: Settings) -> YouTubeClient:
    try:
        return YouTubeClient(settings.youtube_api_key)
    except YouTubeError as exc:
        raise HTTPException(400, str(exc)) from exc


def _cand_json(c: Candidate) -> dict[str, Any]:
    return {**c.model_dump(), "url": c.url, "rights": c.rights, "verdict": rights.verdict(c)}


def _api_error(exc: Exception) -> HTTPException:
    if isinstance(exc, MissingApiKey):
        return HTTPException(401, str(exc))
    if isinstance(exc, anthropic.AuthenticationError):
        return HTTPException(401, "Claude API 키가 올바르지 않습니다.")
    if isinstance(exc, anthropic.RateLimitError):
        return HTTPException(429, "요청이 많아 잠시 후 다시 시도해 주세요.")
    if isinstance(exc, anthropic.APIStatusError):
        return HTTPException(502, f"Claude API 오류: {exc.message}")
    if isinstance(exc, anthropic.APIConnectionError):
        return HTTPException(502, "Claude API에 연결하지 못했습니다. 인터넷 연결을 확인하세요.")
    return HTTPException(500, f"오류: {exc}")


# ── 화면 / 설정 ──────────────────────────────────────────────
@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/api/config")
async def get_config() -> dict[str, Any]:
    return {
        **Settings().public(), "version": __version__, "keywords": KEYWORDS, "lang_names": LANG_NAMES,
        "font_warning": thumbnail.font_warning(), "projects_dir": str(projects_dir()), "checklist": rights.CHECKLIST,
    }


# ── ① 소재 찾기 ──────────────────────────────────────────────
@app.post("/api/search")
async def search(req: SearchRequest) -> list[dict[str, Any]]:
    yt = _yt(Settings())
    try:
        found = await asyncio.to_thread(
            yt.find, [k.strip() for k in req.keywords if k.strip()], cc_only=req.cc_only,
            min_minutes=req.min_minutes, per_keyword=req.per_keyword, published_after=req.published_after,
        )
    except YouTubeError as exc:
        raise HTTPException(400, str(exc)) from exc
    return [_cand_json(c) for c in found]


@app.post("/api/video")
async def video_from_url(req: UrlRequest) -> dict[str, Any]:
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})", req.url) or re.fullmatch(r"([\w-]{11})", req.url.strip())
    if not m:
        raise HTTPException(400, "유튜브 영상 주소를 확인해 주세요.")
    yt = _yt(Settings())
    try:
        items = await asyncio.to_thread(yt.videos, [m.group(1)])
        if not items:
            raise HTTPException(404, "영상을 찾지 못했습니다(비공개·삭제 영상일 수 있음).")
        subs = await asyncio.to_thread(yt.subscribers, [items[0]["snippet"]["channelId"]])
    except YouTubeError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _cand_json(score_candidate(to_candidate(items[0], subs)))


@app.post("/api/manual")
async def manual(req: ManualRequest) -> dict[str, Any]:
    """직접 촬영했거나 허락 받은 영상을 손으로 등록 (YouTube 키 없이도 사용 가능)."""
    c = Candidate(video_id="manual", title=req.title, channel=req.channel, description=req.description,
                  duration_sec=req.duration_min * 60, license="own" if req.own else "youtube")
    return _cand_json(score_candidate(c))


# ── ② 대본 ──────────────────────────────────────────────────
@app.post("/api/plan")
async def plan(req: PlanRequest) -> dict[str, Any]:
    try:
        p = await make_plan(req.candidate, Settings(), notes=req.notes, transcript=req.transcript,
                            channel_style=req.channel_style)
    except Exception as exc:  # noqa: BLE001
        raise _api_error(exc) from exc
    return {
        "plan": p.model_dump(), "chars": p.narration_chars(), "minutes": p.estimated_minutes(),
        "srt": subtitles.to_srt(p), "description": project.full_description(req.candidate, p),
        "permission_email": rights.permission_email(req.candidate) if req.candidate.rights == "permission_needed" else "",
    }


# ── ③ 썸네일 ────────────────────────────────────────────────
def _fetch_thumb(url: str) -> bytes:
    if not url.startswith(THUMB_HOSTS):
        raise HTTPException(400, "배경은 유튜브 썸네일 주소나 직접 올린 사진만 쓸 수 있습니다.")
    with urllib.request.urlopen(url, timeout=20) as resp:  # noqa: S310
        return resp.read(8_000_000)


@app.post("/api/thumbnail")
async def make_thumbnail(req: ThumbRequest) -> dict[str, Any]:
    bg = None
    if req.background_b64:
        bg = base64.b64decode(req.background_b64.split(",", 1)[-1])
    elif req.background_url:
        try:
            bg = await asyncio.to_thread(_fetch_thumb, req.background_url)
        except OSError as exc:
            raise HTTPException(502, f"배경 이미지를 가져오지 못했습니다: {exc}") from exc
    try:
        png = await asyncio.to_thread(thumbnail.render, req.text, bg, badge=req.badge, theme=req.theme,
                                      font_path=Settings().font_path)
    except OSError as exc:
        raise HTTPException(400, f"이미지를 읽지 못했습니다: {exc}") from exc
    return {"png": base64.b64encode(png).decode(), "warning": thumbnail.font_warning()}


# ── ④ 내보내기 ──────────────────────────────────────────────
def _thumb_bytes(b64: str) -> bytes | None:
    return base64.b64decode(b64.split(",", 1)[-1]) if b64 else None


@app.post("/api/export")
async def export(req: ExportRequest) -> dict[str, Any]:
    folder = await asyncio.to_thread(project.save, req.candidate, req.plan, _thumb_bytes(req.thumbnail_b64))
    return {"folder": str(folder), "files": sorted(p.name for p in folder.iterdir())}


@app.post("/api/export.zip")
async def export_zip(req: ExportRequest) -> Response:
    data = await asyncio.to_thread(project.to_zip, req.candidate, req.plan, _thumb_bytes(req.thumbnail_b64))
    return Response(data, media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="kcontent_project.zip"'})


# ── 실행 ────────────────────────────────────────────────────
def _free_port() -> int:
    for port in PORT_RANGE:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"{PORT_RANGE.start}~{PORT_RANGE.stop - 1} 포트가 모두 사용 중입니다.")


def main(open_browser: bool = True) -> None:
    import uvicorn

    port = _free_port()
    state.set_port(port)
    url = f"http://{HOST}:{port}/?t={state.token}"
    print(f"K-콘텐츠 스튜디오 {__version__}: {url}")
    if open_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=HOST, port=port, log_level="warning")
