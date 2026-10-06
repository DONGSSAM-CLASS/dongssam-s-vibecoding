"""선생님용 로컬 웹 화면.

1) 품의 내용을 한두 줄로 입력 → Claude가 초안 작성
2) 초안 확인·수정
3) [에듀파인에 자동 작성] → 브라우저가 열리고 Claude가 로그인부터 저장/결재요청까지 진행

보안: 127.0.0.1에서만 열리고, 실행할 때마다 만든 비밀 토큰이 없으면 /api/* 를 거부합니다.
(다른 웹사이트가 이 프로그램을 몰래 호출하는 것을 막기 위함)
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import dataclasses
import json
import logging
import logging.handlers
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
import webbrowser
from typing import Any

import anthropic
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import __author__, __version__, paths
from .agent import EdufineAgent
from .browser import BrowserController
from .config import MODELS, REGIONS, Settings, load_user_config, save_user_config
from .drafter import MissingApiKey, draft_from_text, make_client
from .housekeeping import add_history, check_update, cleanup_runs, load_history
from .models import PumuiDraft, render_overview

log = logging.getLogger(__name__)
HOST = "127.0.0.1"
PORT_RANGE = range(8765, 8786)
IDLE_EXIT_SEC = 20 * 60
STATIC = paths.resource_dir() / "pumui" / "static"
MOCK = paths.resource_dir() / "mock_edufine"
NO_KEY = "Claude API 키가 설정되지 않았습니다. 화면 오른쪽 위 [설정]에서 API 키를 입력해 주세요."
SETTING_KEYS = {"model", "effort", "region", "portal_url", "cert_owner", "stop_at", "browser",
                "school_notes", "retention_days", "api_key", "cert_password"}


class WebIO:
    """에이전트 이벤트를 SSE로 흘려보내고, 선생님의 답변/승인을 기다립니다."""

    def __init__(self) -> None:
        self.subscribers: set[asyncio.Queue] = set()
        self.pending: dict[str, asyncio.Future] = {}
        self.history: list[dict[str, Any]] = []
        self.last_screen: str | None = None

    async def emit(self, event: dict[str, Any]) -> None:
        if event["type"] == "screen":
            self.last_screen = event["png"]
        else:
            self.history.append(event)
            self.history = self.history[-300:]
        for q in list(self.subscribers):
            if q.qsize() < 200:
                q.put_nowait(event)

    async def log(self, kind: str, text: str) -> None:
        await self.emit({"type": "log", "kind": kind, "text": text})

    async def progress(self, step: int, title: str, message: str) -> None:
        await self.emit({"type": "progress", "step": step, "title": title, "message": message})

    async def screen(self, png: bytes) -> None:
        await self.emit({"type": "screen", "png": base64.b64encode(png).decode()})

    async def _wait(self, kind: str, payload: dict[str, Any]) -> Any:
        rid = uuid.uuid4().hex[:8]
        fut = asyncio.get_running_loop().create_future()
        self.pending[rid] = fut
        await self.emit({"type": kind, "id": rid, **payload})
        try:
            return await fut
        finally:
            self.pending.pop(rid, None)
            await self.emit({"type": "resolved", "id": rid})

    async def ask(self, question: str, png: bytes | None) -> str:
        return await self._wait("ask", {"question": question})

    async def approve(self, summary: str, png: bytes | None) -> tuple[bool, str]:
        ans = await self._wait("approve", {"summary": summary})
        return bool(ans.get("ok")), ans.get("reason", "")

    def resolve(self, rid: str, value: Any) -> None:
        fut = self.pending.get(rid)
        if not fut or fut.done():
            raise KeyError(rid)
        fut.set_result(value)


class State:
    def __init__(self) -> None:
        self.io = WebIO()
        self.browser: BrowserController | None = None
        self.browser_mock: bool | None = None
        self.task: asyncio.Task | None = None
        self.agent: EdufineAgent | None = None
        self.result: dict[str, Any] | None = None
        self.token = secrets.token_urlsafe(24)
        self.port = PORT_RANGE.start
        self.allowed_hosts: set[str] = set()
        self.server: Any = None
        self.last_activity = time.monotonic()
        self.update: dict[str, str] | None = None

    def set_port(self, port: int) -> None:
        self.port = port
        self.allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}

    @property
    def running(self) -> bool:
        return bool(self.task and not self.task.done())


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    if state.server is not None:          # 실제 실행일 때만 (테스트 제외)
        asyncio.create_task(_idle_watch())
        asyncio.create_task(_check_update_bg())
    yield
    if state.browser:
        try:
            await state.browser.close()
        except Exception:  # noqa: BLE001
            pass


app = FastAPI(title="에듀파인 자동 품의", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.mount("/mock", StaticFiles(directory=MOCK, html=True), name="mock")
app.mount("/static", StaticFiles(directory=STATIC), name="static")
state = State()
state.set_port(PORT_RANGE.start)


@app.middleware("http")
async def guard(request: Request, call_next):
    if request.headers.get("host", "") not in state.allowed_hosts:
        return PlainTextResponse("forbidden host", status_code=403)
    path = request.url.path
    if path.startswith("/api/") and path != "/api/ping":
        token = request.headers.get("x-pumui-token") or request.query_params.get("t") or ""
        if not secrets.compare_digest(token, state.token):
            return JSONResponse({"detail": "프로그램을 다시 실행해 주세요 (보안 토큰 불일치)."}, status_code=403)
    state.last_activity = time.monotonic()
    return await call_next(request)


# ── 요청 모델 ────────────────────────────────────────────────
class DraftRequest(BaseModel):
    text: str


class RunRequest(BaseModel):
    draft: PumuiDraft
    mock: bool = False
    stop_at: str = "submit"


class Answer(BaseModel):
    id: str
    answer: str = ""
    ok: bool | None = None
    reason: str = ""


class KeyTest(BaseModel):
    api_key: str = ""


class FolderRequest(BaseModel):
    which: str = "runs"


# ── 화면 / 설정 ──────────────────────────────────────────────
@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/api/ping")
async def ping() -> dict[str, Any]:
    return {"app": "pumui", "version": __version__}


@app.get("/api/config")
async def get_config() -> dict[str, Any]:
    s = Settings()
    cfg = load_user_config()
    return {
        **s.public(),
        "version": __version__, "author": __author__, "agreed": bool(cfg.get("agreed")), "regions": REGIONS, "models": MODELS,
        "running": state.running, "update": state.update, "data_dir": str(paths.data_dir()),
    }


@app.post("/api/settings")
async def post_settings(body: dict[str, Any]) -> dict[str, Any]:
    if state.running:
        raise HTTPException(409, "작업 중에는 설정을 바꿀 수 없습니다.")
    updates = {k: v for k, v in body.items() if k in SETTING_KEYS}
    if "region" in updates and updates["region"] not in REGIONS:
        raise HTTPException(400, "교육청 코드가 올바르지 않습니다.")
    if "model" in updates and updates["model"] not in MODELS:
        raise HTTPException(400, "지원하지 않는 모델입니다.")
    if "stop_at" in updates and updates["stop_at"] not in ("save", "submit"):
        raise HTTPException(400, "진행 범위 값이 올바르지 않습니다.")
    if "browser" in updates and updates["browser"] not in ("auto", "chrome", "msedge"):
        raise HTTPException(400, "브라우저 값이 올바르지 않습니다.")
    if "retention_days" in updates:
        updates["retention_days"] = max(1, min(365, int(updates["retention_days"] or 30)))
    if "portal_url" in updates and updates["portal_url"] and not str(updates["portal_url"]).startswith("https://"):
        raise HTTPException(400, "업무포털 주소는 https:// 로 시작해야 합니다.")
    save_user_config(updates)
    # 브라우저 종류가 바뀌면 다음 실행 때 새로 띄움
    if "browser" in updates and state.browser:
        await state.browser.close()
        state.browser = None
    return Settings().public()


@app.post("/api/agree")
async def agree() -> dict[str, Any]:
    save_user_config({"agreed": True, "agreed_at": time.strftime("%Y-%m-%d %H:%M"), "agreed_version": __version__})
    return {"ok": True}


@app.post("/api/test-key")
async def test_key(body: KeyTest) -> dict[str, Any]:
    """API 키가 맞는지 확인 (토큰을 쓰지 않는 모델 정보 조회)."""
    s = Settings()
    key = body.api_key.strip() or s.api_key
    if not key:
        return {"ok": False, "message": "API 키를 입력해 주세요."}
    try:
        client = anthropic.AsyncAnthropic(api_key=key, max_retries=0, timeout=15)
        await client.models.retrieve(s.model)
    except anthropic.AuthenticationError:
        return {"ok": False, "message": "API 키가 올바르지 않습니다. 복사할 때 앞뒤 공백이 들어가지 않았는지 확인해 주세요."}
    except anthropic.PermissionDeniedError:
        return {"ok": False, "message": "이 API 키로는 선택한 모델을 쓸 수 없습니다. Console에서 결제 수단(크레딧)을 확인해 주세요."}
    except anthropic.NotFoundError:
        return {"ok": False, "message": f"모델 {s.model}을(를) 찾을 수 없습니다. [설정]에서 다른 모델을 골라 주세요."}
    except anthropic.APIConnectionError:
        return {"ok": False, "message": "Claude 서버에 연결하지 못했습니다. 학교 방화벽에서 api.anthropic.com 접속이 막혀 있는지 확인해 주세요."}
    except anthropic.APIStatusError as exc:
        return {"ok": False, "message": f"확인 실패: {exc.message}"}
    return {"ok": True, "message": "연결 성공! 이 API 키를 사용할 수 있습니다."}


@app.post("/api/browser-check")
async def browser_check() -> dict[str, Any]:
    if state.running:
        raise HTTPException(409, "작업 중에는 점검할 수 없습니다.")
    from .cli import browser_selftest

    try:
        r = await browser_selftest(Settings(), f"http://{HOST}:{state.port}/mock/portal.html")
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "message": str(exc)}
    names = {"chrome": "Chrome", "msedge": "Microsoft Edge", "chromium": "내장 Chromium"}
    return {"ok": r["ok"], "message": f"{names.get(r['browser'], r['browser'])} 브라우저로 정상 동작합니다." if r["ok"] else "스크린샷을 찍지 못했습니다."}


@app.get("/api/history")
async def history() -> list[dict[str, Any]]:
    return load_history()


@app.post("/api/open-folder")
async def open_folder(req: FolderRequest) -> dict[str, Any]:
    target = {"runs": paths.runs_dir(), "logs": paths.logs_dir(), "data": paths.data_dir()}.get(req.which)
    if target is None:
        raise HTTPException(400, "알 수 없는 폴더")
    target.mkdir(parents=True, exist_ok=True)
    try:
        if sys.platform == "win32":
            os.startfile(target)  # type: ignore[attr-defined]  # noqa: S606
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(target)])  # noqa: S603, S607
        else:
            subprocess.Popen(["xdg-open", str(target)])  # noqa: S603, S607
    except OSError as exc:
        raise HTTPException(500, f"폴더를 열지 못했습니다: {exc}") from exc
    return {"ok": True, "path": str(target)}


@app.post("/api/shutdown")
async def shutdown_app() -> dict[str, Any]:
    asyncio.get_running_loop().call_later(0.5, _request_exit)
    return {"ok": True}


def _request_exit() -> None:
    if state.server is not None:
        state.server.should_exit = True


# ── 초안 ─────────────────────────────────────────────────────
def _api_error(exc: Exception) -> HTTPException:
    if isinstance(exc, MissingApiKey):
        return HTTPException(401, NO_KEY)
    if isinstance(exc, anthropic.AuthenticationError):
        return HTTPException(401, "Claude API 키가 올바르지 않습니다. [설정]에서 다시 확인해 주세요.")
    if isinstance(exc, anthropic.RateLimitError):
        return HTTPException(429, "요청이 많아 잠시 후 다시 시도해 주세요.")
    if isinstance(exc, anthropic.APIStatusError):
        return HTTPException(502, f"Claude API 오류: {exc.message}")
    if isinstance(exc, anthropic.APIConnectionError):
        return HTTPException(502, "Claude API에 연결하지 못했습니다. 인터넷(학교 방화벽) 연결을 확인하세요.")
    return HTTPException(500, f"오류: {exc}")


@app.post("/api/draft")
async def make_draft(req: DraftRequest) -> dict[str, Any]:
    if not req.text.strip():
        raise HTTPException(400, "품의 내용을 입력해 주세요.")
    try:
        draft = await draft_from_text(req.text, Settings())
    except (MissingApiKey, anthropic.APIError, RuntimeError) as exc:
        raise _api_error(exc) from exc
    return {"draft": json.loads(draft.model_dump_json()), "total": draft.total}


@app.post("/api/overview")
async def overview(draft: PumuiDraft) -> dict[str, Any]:
    """품목/금액을 고친 뒤 개요를 다시 만들 때."""
    return {"overview": render_overview(draft), "total": draft.total}


# ── 자동 작성 실행 ───────────────────────────────────────────
@app.post("/api/run")
async def run(req: RunRequest) -> dict[str, Any]:
    if state.running:
        raise HTTPException(409, "이미 진행 중인 작업이 있습니다.")
    settings = Settings()
    try:
        make_client(settings)
    except MissingApiKey as exc:
        raise HTTPException(401, NO_KEY) from exc
    settings.stop_at = req.stop_at if req.stop_at in ("save", "submit") else "submit"
    if req.mock:
        settings = dataclasses.replace(
            settings, portal_url_override=f"http://{HOST}:{state.port}/mock/portal.html",
            cert_password=settings.cert_password or "1234", cdp_url="", school_notes="",
            profile_dir=paths.profile_dir(mock=True))
    state.io.history.clear()
    state.result = None
    state.task = asyncio.create_task(_run_job(settings, req.draft, req.mock))
    return {"started": True}


async def _run_job(settings: Settings, draft: PumuiDraft, mock: bool) -> None:
    io = state.io
    try:
        await io.progress(0, "준비", "브라우저를 여는 중…")
        if state.browser is None or state.browser_mock != mock:
            if state.browser:
                await state.browser.close()
            state.browser = BrowserController(
                viewport=settings.viewport, channel=settings.browser_channel, profile_dir=str(settings.profile_dir),
                cdp_url=settings.cdp_url, headless=settings.headless, executable_path=settings.browser_path)
            state.browser_mock = mock
            await state.browser.start()
        state.browser.final_approved = False
        state.agent = EdufineAgent(settings, state.browser, io)
        state.result = await state.agent.run(draft)
        if not mock:
            add_history(json.loads(draft.model_dump_json()), state.result["result"], state.result.get("document_number", ""))
        await io.emit({"type": "result", **state.result})
    except asyncio.CancelledError:
        await io.emit({"type": "error", "text": "작업을 중단했습니다."})
    except (MissingApiKey, anthropic.APIError) as exc:
        await io.emit({"type": "error", "text": _api_error(exc).detail})
    except Exception as exc:  # noqa: BLE001
        log.exception("run failed")
        await io.emit({"type": "error", "text": f"오류: {exc}"})
        if state.browser:
            try:
                await state.browser.close()
            except Exception:  # noqa: BLE001
                pass
            state.browser = None


@app.post("/api/answer")
async def answer(ans: Answer) -> dict[str, Any]:
    try:
        if ans.ok is None:
            state.io.resolve(ans.id, ans.answer or "완료했습니다.")
        else:
            state.io.resolve(ans.id, {"ok": ans.ok, "reason": ans.reason})
    except KeyError:
        raise HTTPException(404, "이미 처리된 질문입니다.")
    return {"ok": True}


@app.post("/api/cancel")
async def cancel() -> dict[str, Any]:
    if state.agent:
        state.agent.cancelled = True
    for fut in list(state.io.pending.values()):
        if not fut.done():
            fut.cancel()
    if state.task and not state.task.done():
        state.task.cancel()
    return {"ok": True}


@app.get("/api/events")
async def events() -> StreamingResponse:
    q: asyncio.Queue = asyncio.Queue()
    state.io.subscribers.add(q)

    async def stream():
        try:
            for ev in state.io.history:
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
            if state.io.last_screen:
                yield f"data: {json.dumps({'type': 'screen', 'png': state.io.last_screen})}\n\n"
            while True:
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            state.io.subscribers.discard(q)
            state.last_activity = time.monotonic()

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


# ── 수명 관리 ────────────────────────────────────────────────
async def _idle_watch() -> None:
    """화면을 닫은 채 오래 두면 프로그램을 스스로 종료 (트레이 아이콘 없이도 정리되도록)."""
    while True:
        await asyncio.sleep(30)
        if state.io.subscribers or state.running:
            state.last_activity = time.monotonic()
        elif time.monotonic() - state.last_activity > IDLE_EXIT_SEC:
            log.info("화면이 닫힌 채 %d분이 지나 종료합니다.", IDLE_EXIT_SEC // 60)
            _request_exit()
            return


async def _check_update_bg() -> None:
    state.update = await asyncio.to_thread(check_update)


def setup_logging() -> None:
    handler = logging.handlers.RotatingFileHandler(paths.logs_dir() / "app.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    handlers: list[logging.Handler] = [handler]
    if sys.stderr is not None:
        handlers.append(logging.StreamHandler())
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", handlers=handlers, force=True)


def notify_fatal(message: str) -> None:
    log.error(message)
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, message, paths.APP_NAME, 0x10)
            return
        except Exception:  # noqa: BLE001
            pass
    print(message, file=sys.stderr or sys.stdout)


def _existing_instance() -> dict[str, Any] | None:
    """이미 실행 중이면 그 프로그램의 주소·토큰을 돌려줌."""
    try:
        info = json.loads(paths.instance_file().read_text(encoding="utf-8"))
        with urllib.request.urlopen(f"http://{HOST}:{int(info['port'])}/api/ping", timeout=1.5) as r:  # noqa: S310
            if json.loads(r.read()).get("app") == "pumui":
                return info
    except Exception:  # noqa: BLE001
        return None
    return None


def _free_port() -> int | None:
    for port in PORT_RANGE:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, port))
                return port
            except OSError:
                continue
    return None


def ui_url() -> str:
    return f"http://{HOST}:{state.port}/?t={state.token}"


def main(open_browser: bool = True) -> None:
    import uvicorn

    setup_logging()
    existing = _existing_instance()
    if existing:
        log.info("이미 실행 중 → 화면만 엽니다.")
        webbrowser.open(f"http://{HOST}:{existing['port']}/?t={existing['token']}")
        return
    port = _free_port()
    if port is None:
        notify_fatal(f"사용할 수 있는 포트({PORT_RANGE.start}~{PORT_RANGE.stop - 1})가 없습니다. PC를 다시 시작해 주세요.")
        return
    state.set_port(port)
    inst = paths.instance_file()
    inst.write_text(json.dumps({"port": port, "token": state.token, "pid": os.getpid()}), encoding="utf-8")
    try:
        os.chmod(inst, 0o600)
    except OSError:
        pass
    try:
        removed = cleanup_runs(int(Settings().retention_days))
        if removed:
            log.info("보관 기간이 지난 작업 기록 %d개를 지웠습니다.", removed)
    except Exception:  # noqa: BLE001
        log.exception("기록 정리 실패")

    config = uvicorn.Config(app, host=HOST, port=port, log_config=None, log_level="warning", loop="asyncio")
    server = uvicorn.Server(config)
    state.server = server
    url = ui_url()
    log.info("%s %s (제작자: %s) 시작: http://%s:%d/", paths.APP_NAME, __version__, __author__, HOST, port)
    if sys.stdout is not None:
        print(f"\n  {paths.APP_NAME} v{__version__} · 제작자: {__author__}\n  실행 중 → {url}\n  (종료: 화면의 [종료] 버튼 또는 Ctrl+C)\n")
    if open_browser and os.environ.get("PUMUI_NO_BROWSER") != "1":
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        server.run()
    finally:
        try:
            inst.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    main()
