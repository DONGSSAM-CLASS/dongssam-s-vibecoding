"""교사용 로컬 웹 화면 (http://127.0.0.1:8765).

1) 품의 내용을 한두 줄로 입력 → Claude가 초안 작성
2) 초안 확인·수정
3) [에듀파인에 자동 작성] → 크롬이 열리고 Claude가 로그인부터 저장/결재요청까지 진행
"""

from __future__ import annotations

import asyncio
import base64
import dataclasses
import json
import logging
import os
import uuid
import webbrowser
from pathlib import Path
from typing import Any

import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .agent import EdufineAgent
from .browser import BrowserController
from .config import REGIONS, ROOT, Settings
from .drafter import draft_from_text
from .models import PumuiDraft, render_overview

log = logging.getLogger(__name__)
HERE = Path(__file__).resolve().parent
HOST, PORT = "127.0.0.1", 8765
NO_KEY = "Claude API 키가 설정되지 않았습니다. 프로그램 폴더의 .env 파일에 ANTHROPIC_API_KEY=sk-ant-... 를 넣고 다시 실행하세요."


class WebIO:
    """에이전트 이벤트를 SSE로 흘려보내고, 교사의 답변/승인을 기다립니다."""

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


app = FastAPI(title="K-에듀파인 자동 품의")
app.mount("/mock", StaticFiles(directory=ROOT / "mock_edufine", html=True), name="mock")
app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")
state = State()


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


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(HERE / "static" / "index.html")


@app.get("/api/config")
async def get_config() -> dict[str, Any]:
    s = Settings()
    return {
        "model": s.model, "region": s.region, "region_name": s.region_name, "portal_url": s.portal_url,
        "stop_at": s.stop_at, "has_api_key": bool(_has_key()), "has_cert_password": bool(s.cert_password),
        "regions": REGIONS, "running": bool(state.task and not state.task.done()),
    }


def _has_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


@app.post("/api/draft")
async def make_draft(req: DraftRequest) -> dict[str, Any]:
    if not req.text.strip():
        raise HTTPException(400, "품의 내용을 입력해 주세요.")
    try:
        draft = await draft_from_text(req.text, Settings())
    except anthropic.AuthenticationError:
        raise HTTPException(401, "Claude API 키가 올바르지 않습니다. .env의 ANTHROPIC_API_KEY를 확인하세요.")
    except anthropic.RateLimitError:
        raise HTTPException(429, "요청이 많아 잠시 후 다시 시도해 주세요.")
    except anthropic.APIStatusError as exc:
        raise HTTPException(502, f"Claude API 오류: {exc.message}")
    except anthropic.APIConnectionError:
        raise HTTPException(502, "Claude API에 연결하지 못했습니다. 인터넷 연결을 확인하세요.")
    except TypeError as exc:
        if "authentication" not in str(exc):
            raise
        raise HTTPException(401, NO_KEY)
    return {"draft": json.loads(draft.model_dump_json()), "total": draft.total}


@app.post("/api/overview")
async def overview(draft: PumuiDraft) -> dict[str, Any]:
    """품목/금액을 고친 뒤 개요를 다시 만들 때."""
    return {"overview": render_overview(draft), "total": draft.total}


@app.post("/api/run")
async def run(req: RunRequest) -> dict[str, Any]:
    if state.task and not state.task.done():
        raise HTTPException(409, "이미 진행 중인 작업이 있습니다.")
    settings = Settings()
    settings.stop_at = req.stop_at if req.stop_at in ("save", "submit") else "submit"
    if req.mock:
        settings = dataclasses.replace(settings, portal_url_override=f"http://{HOST}:{PORT}/mock/portal.html",
                                       cert_password=settings.cert_password or "1234", cdp_url="")
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
            profile = settings.profile_dir.with_name(".browser-profile-mock") if mock else settings.profile_dir
            state.browser = BrowserController(
                viewport=settings.viewport, channel=settings.browser_channel, profile_dir=str(profile),
                cdp_url=settings.cdp_url, headless=settings.headless,
                executable_path=settings.browser_path)
            state.browser_mock = mock
            await state.browser.start()
        state.browser.final_approved = False
        state.agent = EdufineAgent(settings, state.browser, io)
        state.result = await state.agent.run(draft)
        await io.emit({"type": "result", **state.result})
    except anthropic.AuthenticationError:
        await io.emit({"type": "error", "text": "Claude API 키가 올바르지 않습니다. .env의 ANTHROPIC_API_KEY를 확인하세요."})
    except anthropic.RateLimitError:
        await io.emit({"type": "error", "text": "Claude API 사용량 한도에 걸렸습니다. 잠시 후 다시 시도하세요."})
    except anthropic.APIStatusError as exc:
        await io.emit({"type": "error", "text": f"Claude API 오류: {exc.message}"})
    except anthropic.APIConnectionError:
        await io.emit({"type": "error", "text": "Claude API에 연결하지 못했습니다. 인터넷 연결(학교 방화벽)을 확인하세요."})
    except TypeError as exc:
        if "authentication" not in str(exc):
            raise
        await io.emit({"type": "error", "text": NO_KEY})
    except asyncio.CancelledError:
        await io.emit({"type": "error", "text": "작업을 중단했습니다."})
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
    for rid, fut in list(state.io.pending.items()):
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

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.on_event("shutdown")
async def _shutdown() -> None:
    if state.browser:
        await state.browser.close()


def main() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    url = f"http://{HOST}:{PORT}/"
    print(f"\n  K-에듀파인 자동 품의 프로그램이 시작되었습니다 → {url}\n  (종료: Ctrl+C)\n")
    try:
        webbrowser.open(url)
    except Exception:  # noqa: BLE001
        pass
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning", loop="asyncio")


if __name__ == "__main__":
    main()
