"""Claude computer-use 에이전트 루프: 스크린샷을 보고 K-에듀파인을 직접 조작합니다."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from datetime import datetime
from typing import Any, Protocol

import anthropic

from .browser import BrowserController, GuardBlocked
from .config import Settings
from .drafter import make_client
from .models import PumuiDraft
from .playbook import STEPS, build_system_prompt

log = logging.getLogger(__name__)

NOT_EXECUTED = "Not executed: an earlier computer action in this turn failed."
COMPUTER = "computer"

CUSTOM_TOOLS: list[dict[str, Any]] = [
    {
        "name": "report_progress",
        "description": "교사 화면의 진행 단계 표시를 바꾸고 짧은 상황 메시지를 보여줍니다. 각 단계를 시작할 때 호출하세요. "
                       "step: 1 로그인, 2 메인·팝업, 3 품의목록·신규, 4 제목·개요, 5 예산선택, 6 품목·저장, 7 결재요청, 8 완료",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "step": {"type": "integer", "enum": [1, 2, 3, 4, 5, 6, 7, 8]},
                "message": {"type": "string", "description": "교사에게 보여줄 한 줄 (한국어)"},
            },
            "required": ["step", "message"],
            "additionalProperties": False,
        },
    },
    {
        "name": "type_secret",
        "description": "저장된 비밀값(인증서 암호)을 현재 키보드 포커스 위치에 입력합니다. 값 자체는 당신에게 보이지 않습니다. "
                       "먼저 암호 입력칸을 클릭한 뒤 호출하세요.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {"secret": {"type": "string", "enum": ["cert_password"]}},
            "required": ["secret"],
            "additionalProperties": False,
        },
    },
    {
        "name": "ask_teacher",
        "description": "교사에게 질문하거나 직접 해야 할 일을 부탁하고, 교사가 답하거나 완료를 누를 때까지 기다립니다. "
                       "예: 인증서 암호 직접 입력, 예산 행 선택이 애매할 때, 보안프로그램 설치 안내가 떴을 때.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {"question": {"type": "string"}},
            "required": ["question"],
            "additionalProperties": False,
        },
    },
    {
        "name": "request_final_approval",
        "description": "품의를 저장한 뒤, 실제 결재요청(상신)을 누르기 직전에 호출해 교사의 최종 승인을 받습니다. "
                       "승인되기 전에는 결재요청/상신 버튼 클릭이 차단됩니다.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "제목, 총액, 선택한 예산(세부사업/산출내역), 품목 요약, 품의번호"},
            },
            "required": ["summary"],
            "additionalProperties": False,
        },
    },
    {
        "name": "browser_tabs",
        "description": "브라우저 창/탭 목록 보기, 전환, 닫기. 새 창이 열리면 자동으로 그 창으로 전환되므로 보통은 필요 없습니다. "
                       "팝업 공지 창을 닫거나 원래 창으로 돌아갈 때 사용하세요. list일 때 index는 -1.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["list", "switch", "close"]},
                "index": {"type": "integer"},
            },
            "required": ["action", "index"],
            "additionalProperties": False,
        },
    },
    {
        "name": "finish",
        "description": "작업을 끝내고 결과를 보고합니다.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "result": {"type": "string", "enum": ["submitted", "saved", "failed", "cancelled"]},
                "summary": {"type": "string", "description": "무엇을 했는지 한국어 요약"},
                "document_number": {"type": "string", "description": "품의번호 (모르면 빈 문자열)"},
            },
            "required": ["result", "summary", "document_number"],
            "additionalProperties": False,
        },
    },
]


class AgentIO(Protocol):
    """에이전트 ↔ 교사 화면(웹 UI 또는 콘솔) 연결."""

    async def log(self, kind: str, text: str) -> None: ...
    async def progress(self, step: int, title: str, message: str) -> None: ...
    async def screen(self, png: bytes) -> None: ...
    async def ask(self, question: str, png: bytes | None) -> str: ...
    async def approve(self, summary: str, png: bytes | None) -> tuple[bool, str]: ...


def _image_block(png: bytes) -> dict[str, Any]:
    return {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(png).decode()}}


# Claude Opus 5.5 기준 단가 (USD / 1M tokens) — 대략적인 비용 표시용
_PRICE = {"claude-opus-5-5": (4.0, 20.0), "claude-sonnet-5-5": (2.0, 10.0), "claude-fable-5-1": (10.0, 50.0)}


class EdufineAgent:
    def __init__(self, settings: Settings, browser: BrowserController, io: AgentIO,
                 client: anthropic.AsyncAnthropic | None = None) -> None:
        self.s = settings
        self.browser = browser
        self.io = io
        self.client = client or make_client(settings)
        self.result: dict[str, Any] | None = None
        self.usage = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
        self.run_dir = settings.runs_dir / datetime.now().strftime("%Y%m%d-%H%M%S")
        self._shot_no = 0
        self.cancelled = False

    # ── 요청 파라미터 ───────────────────────────────────────
    def _request_kwargs(self, system: str) -> dict[str, Any]:
        betas = ["context-management-2025-06-27", "thinking-display-updates-2026-08-18"]
        extra: dict[str, Any] = {}
        if self.s.use_fallbacks:
            betas.append("server-side-fallback-2026-07-01")
            extra["fallbacks"] = "default"
        return dict(
            model=self.s.model,
            max_tokens=16000,
            system=system,
            tools=[{"type": "computer_toolset_20260801"}, *CUSTOM_TOOLS],
            thinking={"type": "adaptive", "display": "updates"},
            output_config={"effort": self.s.effort},
            cache_control={"type": "ephemeral"},
            # 오래된 스크린샷은 서버에서 정리 (클라이언트에서 지우면 사고 블록이 무효화됨)
            context_management={"edits": [{
                "type": "clear_tool_uses_20250919",
                "trigger": {"type": "input_tokens", "value": 60000},
                "keep": {"type": "tool_uses", "value": 12},
                "clear_at_least": {"type": "input_tokens", "value": 15000},
                "exclude_tools": ["ask_teacher", "request_final_approval"],
            }]},
            betas=betas,
            **extra,
        )

    # ── 실행 ───────────────────────────────────────────────
    async def run(self, draft: PumuiDraft) -> dict[str, Any]:
        draft.ensure_overview()
        self.run_dir.mkdir(parents=True, exist_ok=True)
        (self.run_dir / "draft.json").write_text(draft.model_dump_json(indent=2), encoding="utf-8")
        system = build_system_prompt(draft, self.s.stop_at, self.s.cert_owner, self.s.school_notes)
        kwargs = self._request_kwargs(system)

        if self.browser.page.url in ("about:blank", "", "chrome://newtab/"):
            await self.io.log("info", f"업무포털 접속: {self.s.portal_url}")
            try:
                await self.browser.goto(self.s.portal_url)
            except Exception as exc:  # noqa: BLE001 — 접속 실패해도 Claude가 화면을 보고 판단
                await self.io.log("warn", f"업무포털 자동 접속 실패: {exc}")

        png = await self._shot()
        messages: list[dict[str, Any]] = [{
            "role": "user",
            "content": [
                {"type": "text", "text": "K-에듀파인 품의 작성을 시작하세요. 아래는 현재 브라우저 화면입니다. "
                                         f"(소속: {self.s.region_name}교육청, 진행 범위: {self.s.stop_at})"},
                _image_block(png),
            ],
        }]

        started = time.monotonic()
        nudged = False
        for step in range(self.s.max_steps):
            if self.cancelled:
                self.result = {"result": "cancelled", "summary": "교사가 중단했습니다.", "document_number": ""}
                break
            response = await self.client.beta.messages.create(messages=messages, **kwargs)
            self._track_usage(response)
            messages.append({"role": "assistant", "content": response.content})

            for block in response.content:
                if block.type == "thinking" and getattr(block, "thinking", ""):
                    await self.io.log("claude", block.thinking)
                elif block.type == "text" and block.text.strip():
                    await self.io.log("claude", block.text)
                elif block.type == "fallback":
                    await self.io.log("info", "요청이 대체 모델로 이어서 처리되었습니다.")

            if response.stop_reason == "refusal":
                self.result = {"result": "failed", "summary": "Claude가 이 작업 진행을 거절했습니다.", "document_number": ""}
                break

            tool_uses = [b for b in response.content if b.type == "tool_use"]
            if not tool_uses:
                if response.stop_reason == "max_tokens" or not nudged:
                    nudged = True
                    messages.append({"role": "user", "content": "계속 진행하세요. 작업이 끝났다면 finish 도구로 결과를 보고하세요."})
                    continue
                text = " ".join(b.text for b in response.content if b.type == "text")
                self.result = {"result": "failed", "summary": text or "Claude가 작업을 멈췄습니다.", "document_number": ""}
                break

            results = await self._run_tools(tool_uses)
            if self.result is not None:
                break
            messages.append({"role": "user", "content": results})
        else:
            self.result = {"result": "failed", "summary": f"최대 단계({self.s.max_steps})를 넘어 중단했습니다.", "document_number": ""}

        self.result["elapsed_sec"] = round(time.monotonic() - started, 1)
        self.result["usage"] = self.usage
        self.result["cost_usd"] = self._cost()
        self.result["run_dir"] = str(self.run_dir)
        await self._shot()
        (self.run_dir / "result.json").write_text(json.dumps(self.result, ensure_ascii=False, indent=2), encoding="utf-8")
        await self.io.progress(8, STEPS[8], self.result["summary"])
        return self.result

    # ── 도구 실행 ───────────────────────────────────────────
    async def _run_tools(self, tool_uses: list[Any]) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        failed = False
        last_computer_idx = max((i for i, b in enumerate(tool_uses) if getattr(b, "toolset_name", None) == COMPUTER), default=-1)

        for idx, block in enumerate(tool_uses):
            is_computer = getattr(block, "toolset_name", None) == COMPUTER
            res: dict[str, Any] = {"type": "tool_result", "tool_use_id": block.id}
            if is_computer:
                res["toolset_name"] = COMPUTER
            if failed:
                res["content"] = NOT_EXECUTED
                res["is_error"] = True
                results.append(res)
                continue
            try:
                if is_computer:
                    content = await self._computer(block.name, block.input or {})
                    # 묶음의 마지막 동작 뒤에는 화면을 자동으로 첨부해 왕복 횟수를 줄입니다
                    if idx == last_computer_idx and block.name not in ("screenshot", "zoom"):
                        png = await self._shot()
                        content = [{"type": "text", "text": content}, _image_block(png)]
                else:
                    content = await self._custom(block.name, block.input or {})
                    if self.result is not None:
                        return results
                events = self.browser.drain_events()
                if events:
                    note = "알림: " + " / ".join(events)
                    if isinstance(content, str):
                        content = f"{content}\n{note}"
                    else:
                        content = [*content, {"type": "text", "text": note}]
                res["content"] = content
            except GuardBlocked as exc:
                await self.io.log("warn", str(exc))
                res["content"], res["is_error"] = str(exc), True
                failed = True
            except Exception as exc:  # noqa: BLE001 — 오류는 Claude에게 돌려줘 스스로 복구하게 함
                log.exception("tool %s failed", block.name)
                res["content"], res["is_error"] = f"Error: {exc}", True
                failed = True
            results.append(res)
        return results

    async def _computer(self, name: str, inp: dict[str, Any]) -> Any:
        b = self.browser
        coord = inp.get("coordinate")
        if name == "screenshot":
            return [_image_block(await self._shot())]
        if name == "zoom":
            return [_image_block(await b.zoom(inp["region"]))]
        if name in ("left_click", "right_click", "middle_click", "double_click", "triple_click"):
            button = {"right_click": "right", "middle_click": "middle"}.get(name, "left")
            count = {"double_click": 2, "triple_click": 3}.get(name, 1)
            if coord is None:
                coord = list(b.cursor_position())
            msg = await b.click(coord[0], coord[1], button=button, count=count, modifiers=inp.get("text", ""))
            await self.io.log("action", f"{msg} @({int(coord[0])},{int(coord[1])})")
            return msg
        if name == "left_click_drag":
            await b.drag(inp["start_coordinate"], coord)
            return "OK"
        if name == "mouse_move":
            await b.move(*coord)
            return "OK"
        if name == "left_mouse_down":
            await b.mouse_down()
            return "OK"
        if name == "left_mouse_up":
            await b.mouse_up()
            return "OK"
        if name == "cursor_position":
            x, y = b.cursor_position()
            return f"X={x}, Y={y}"
        if name == "scroll":
            x, y = (coord or [None, None])
            await b.scroll(inp["scroll_direction"], int(inp.get("scroll_amount", 3)), x, y)
            return "OK"
        if name == "type":
            await b.type_text(inp["text"])
            await self.io.log("action", f"입력: {inp['text'][:60]}")
            return "OK"
        if name == "key":
            await b.key(inp["text"], int(inp.get("repeat", 1)))
            return "OK"
        if name == "hold_key":
            await b.hold_key(inp["text"], float(inp.get("duration", 1)))
            return "OK"
        if name == "wait":
            await asyncio.sleep(min(float(inp.get("duration", 1)), 10))
            return "OK"
        raise ValueError(f"지원하지 않는 동작: {name}")

    async def _custom(self, name: str, inp: dict[str, Any]) -> str:
        if name == "report_progress":
            step = int(inp["step"])
            await self.io.progress(step, STEPS.get(step, ""), inp["message"])
            return "OK"
        if name == "type_secret":
            if not self.s.cert_password:
                return "설정된 암호 없음 — ask_teacher로 교사에게 직접 입력을 부탁하세요."
            await self.browser.type_text(self.s.cert_password)
            await self.io.log("action", "인증서 암호 입력 (●●●●)")
            return "입력 완료 (값은 표시하지 않음)"
        if name == "ask_teacher":
            await self.io.log("ask", inp["question"])
            answer = await self.io.ask(inp["question"], await self._shot())
            await self.io.log("teacher", answer)
            return f"교사 답변: {answer}"
        if name == "request_final_approval":
            if self.s.stop_at != "submit":
                return "이번 실행은 '저장까지만'으로 설정되어 있습니다. 결재요청을 누르지 말고 finish(result='saved')로 마치세요."
            ok, reason = await self.io.approve(inp["summary"], await self._shot())
            if ok:
                self.browser.final_approved = True
                await self.io.log("teacher", "최종 승인 ✔")
                return "교사가 승인했습니다. 결재요청(상신)을 진행하세요."
            await self.io.log("teacher", f"승인 거절: {reason}")
            return f"교사가 승인하지 않았습니다 ({reason}). 결재요청을 누르지 말고, 요청된 수정이 있으면 반영 후 다시 승인을 요청하거나 finish(result='saved')로 마치세요."
        if name == "browser_tabs":
            action, index = inp["action"], int(inp.get("index", -1))
            if action == "switch":
                await self.browser.switch_tab(index)
            elif action == "close":
                await self.browser.close_tab(index)
            return json.dumps(await self.browser.list_tabs(), ensure_ascii=False)
        if name == "finish":
            self.result = {"result": inp["result"], "summary": inp["summary"], "document_number": inp.get("document_number", "")}
            await self.io.log("done", inp["summary"])
            return "OK"
        raise ValueError(f"알 수 없는 도구: {name}")

    # ── 보조 ───────────────────────────────────────────────
    async def _shot(self) -> bytes:
        png, _, _ = await self.browser.screenshot()
        self._shot_no += 1
        try:
            (self.run_dir / f"screen_{self._shot_no:03d}.png").write_bytes(png)
        except OSError:
            pass
        await self.io.screen(png)
        return png

    def _track_usage(self, response: Any) -> None:
        u = getattr(response, "usage", None)
        if not u:
            return
        self.usage["input"] += getattr(u, "input_tokens", 0) or 0
        self.usage["output"] += getattr(u, "output_tokens", 0) or 0
        self.usage["cache_read"] += getattr(u, "cache_read_input_tokens", 0) or 0
        self.usage["cache_write"] += getattr(u, "cache_creation_input_tokens", 0) or 0

    def _cost(self) -> float:
        pin, pout = _PRICE.get(self.s.model, (4.0, 20.0))
        u = self.usage
        cost = (u["input"] * pin + u["cache_write"] * pin * 1.25 + u["cache_read"] * pin * 0.1 + u["output"] * pout) / 1e6
        return round(cost, 3)

