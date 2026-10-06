"""모의 에듀파인에서 에이전트 루프 전체를 검증합니다.

실제 Claude 대신 '각본대로 움직이는 가짜 Claude'를 써서, Claude가 보낼 것과 같은 형태의
computer toolset 호출을 EdufineAgent → BrowserController → 크롬으로 실행합니다.
API 키 없이도 로그인 → 팝업 → 신규 → 입력 → 예산 → 품목 → 저장 → (차단) → 승인 → 상신 흐름을 확인합니다.
"""

from __future__ import annotations

import asyncio
import dataclasses
import itertools
import json
import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from pumui.agent import EdufineAgent
from pumui.browser import BrowserController
from pumui.cli import serve_mock
from pumui.config import Settings
from pumui.models import BudgetHint, PumuiDraft, PumuiItem

DEFAULT_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
_ids = itertools.count(1)


def computer(name: str, **inp) -> SimpleNamespace:
    return SimpleNamespace(type="tool_use", id=f"toolu_{next(_ids):04d}", name=name, input=inp, toolset_name="computer")


def tool(name: str, **inp) -> SimpleNamespace:
    return SimpleNamespace(type="tool_use", id=f"toolu_{next(_ids):04d}", name=name, input=inp, toolset_name=None)


class FakeIO:
    def __init__(self) -> None:
        self.logs: list[tuple[str, str]] = []
        self.steps: list[int] = []
        self.approvals: list[str] = []

    async def log(self, kind, text):
        self.logs.append((kind, text))

    async def progress(self, step, title, message):
        self.steps.append(step)

    async def screen(self, png):
        assert png[:4] == b"\x89PNG"

    async def ask(self, question, png):
        return "완료했습니다."

    async def approve(self, summary, png):
        self.approvals.append(summary)
        return True, ""


class ScriptedClaude:
    """client.beta.messages.create(...) 를 흉내 내는 가짜 클라이언트."""

    def __init__(self, browser: BrowserController, draft: PumuiDraft) -> None:
        self.b = browser
        self.d = draft
        self.requests: list[dict] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))
        self._script = self.script()

    async def at(self, selector: str, frame: bool = False, nth: int = 0) -> list[int]:
        page = self.b.page
        loc = page.frame_locator("#contentFrame").locator(selector) if frame else page.locator(selector)
        box = await loc.nth(nth).bounding_box()
        assert box, f"요소를 찾을 수 없음: {selector}"
        return [int(box["x"] + box["width"] / 2), int(box["y"] + box["height"] / 2)]

    def last_results(self) -> list[dict]:
        last = self.requests[-1]["messages"][-1]
        return last["content"] if isinstance(last["content"], list) else []

    async def create(self, **kwargs):
        self.requests.append(kwargs)
        try:
            blocks = await self._script.__anext__()
        except StopAsyncIteration:
            blocks = [SimpleNamespace(type="text", text="끝")]
        stop = "tool_use" if any(b.type == "tool_use" for b in blocks) else "end_turn"
        usage = SimpleNamespace(input_tokens=1000, output_tokens=100, cache_read_input_tokens=0, cache_creation_input_tokens=0)
        return SimpleNamespace(content=blocks, stop_reason=stop, usage=usage)

    async def script(self):
        d, at = self.d, self.at
        # ① 로그인
        yield [tool("report_progress", step=1, message="인증서 로그인"), computer("left_click", coordinate=await at("#btnCertLogin"))]
        yield [computer("left_click", coordinate=await at("#certRows tr[data-user='홍길동']")),
               computer("left_click", coordinate=await at("#certPw")),
               tool("type_secret", secret="cert_password"),
               computer("left_click", coordinate=await at("#certOk"))]
        # ② 메인 → K-에듀파인 (새 창) → 팝업 닫기
        yield [tool("report_progress", step=2, message="팝업 정리"), computer("left_click", coordinate=await at("#tileEdufine"))]
        assert any("새 창" in json.dumps(r, ensure_ascii=False) for r in self.last_results()), "새 창 전환 알림이 없음"
        yield [computer("left_click", coordinate=await at("#pop1 .ft button")),
               computer("left_click", coordinate=await at("#pop2 .ft button"))]
        # ③ 품의목록 → 신규
        yield [tool("report_progress", step=3, message="품의목록"), computer("left_click", coordinate=await at("#menuPumui"))]
        yield [computer("left_click", coordinate=await at("#btnNew", frame=True))]
        # ④ 제목·개요 (iframe 안의 입력칸, 여러 줄 한글)
        yield [tool("report_progress", step=4, message="제목·개요"),
               computer("left_click", coordinate=await at("#fTitle", frame=True)), computer("type", text=d.title),
               computer("left_click", coordinate=await at("#fOverview", frame=True)), computer("type", text=d.overview)]
        # ⑤ 예산선택
        yield [tool("report_progress", step=5, message="예산"), computer("left_click", coordinate=await at("#btnBudget", frame=True))]
        yield [computer("left_click", coordinate=await at(".bchk[data-i='5']", frame=True)),
               computer("left_click", coordinate=await at("#budgetOk1", frame=True))]
        # ⑥ 품목 → 저장
        yield [tool("report_progress", step=6, message="품목"), computer("left_click", coordinate=await at("#btnAddRow", frame=True))]
        it = d.items[0]
        yield [computer("left_click", coordinate=await at("#itemRows input[data-k=name]", frame=True)), computer("type", text=it.name),
               computer("left_click", coordinate=await at("#itemRows input[data-k=spec]", frame=True)), computer("type", text=it.spec),
               computer("left_click", coordinate=await at("#itemRows input[data-k=qty]", frame=True)), computer("type", text=str(it.quantity)),
               computer("triple_click", coordinate=await at("#itemRows input[data-k=unit]", frame=True)), computer("type", text=it.unit),
               computer("left_click", coordinate=await at("#itemRows input[data-k=price]", frame=True)), computer("type", text=str(it.unit_price))]
        yield [computer("zoom", region=[0, 0, 400, 200]), computer("left_click", coordinate=await at("#btnSave", frame=True))]
        assert any("저장하시겠습니까" in json.dumps(r, ensure_ascii=False) for r in self.last_results()), "확인창 처리 알림 없음"
        yield [computer("left_click", coordinate=await at("#alertOk", frame=True))]
        # ⑦ 승인 전 결재요청 → 차단되어야 함
        yield [tool("report_progress", step=7, message="결재요청"),
               computer("left_click", coordinate=await at("#btnApproveReq", frame=True)),
               computer("screenshot")]
        res = self.last_results()
        assert res[1]["is_error"] and "승인" in res[1]["content"], f"상신 차단 실패: {res[1]}"
        assert res[2]["content"] == "Not executed: an earlier computer action in this turn failed."
        assert res[2]["toolset_name"] == "computer"
        yield [tool("request_final_approval", summary=f"{d.title} / {d.total:,}원")]
        assert "승인했습니다" in self.last_results()[0]["content"]
        yield [computer("left_click", coordinate=await at("#btnApproveReq", frame=True))]
        yield [computer("left_click", coordinate=await at("#btnSubmit", frame=True))]
        yield [computer("left_click", coordinate=await at("#alertOk", frame=True)),
               tool("finish", result="submitted", summary="모의 에듀파인 상신 완료", document_number="00874")]


@pytest.fixture()
def draft() -> PumuiDraft:
    return PumuiDraft(
        title="[연습] 2026학년도 기술 수업 롤링볼 프로젝트 재료 구입",
        purpose="기술 수업 롤링볼 프로젝트 재료를 다음과 같이 구입하고자 합니다.",
        budget=BudgetHint(sub_project="과학 교과활동", detail_item="교과운영", cost_category="학습준비물", calc_note="기술과실험실습재료비"),
        items=[PumuiItem(name="우드락", spec="450x450x5mm", quantity=10, unit="장", unit_price=3000)],
    ).ensure_overview()


def test_full_flow_on_mock(tmp_path: Path, draft: PumuiDraft) -> None:
    exe = os.environ.get("PUMUI_BROWSER_PATH") or (DEFAULT_CHROME if Path(DEFAULT_CHROME).exists() else "")
    settings = dataclasses.replace(
        Settings(), portal_url_override=serve_mock(), cert_password="1234", stop_at="submit",
        runs_dir=tmp_path / "runs", use_fallbacks=True)

    async def go():
        browser = BrowserController(viewport=(1440, 900), channel="chromium", executable_path=exe,
                                    profile_dir=str(tmp_path / "profile"), headless=True)
        await browser.start()
        try:
            io = FakeIO()
            fake = ScriptedClaude(browser, draft)
            result = await EdufineAgent(settings, browser, io, client=fake).run(draft)
            frame = browser.page.frame_locator("#contentFrame")
            docs = await browser.page.frames[-1].evaluate("JSON.parse(localStorage.getItem('mock_pumui') || '[]')")
            status = await frame.locator("#fStatus").input_value()
            return result, io, fake, docs, status
        finally:
            await browser.close()

    result, io, fake, docs, status = asyncio.run(go())

    assert result["result"] == "submitted", result
    assert status == "결재진행"
    assert len(docs) == 1
    doc = docs[0]
    assert doc["title"] == draft.title
    assert doc["overview"] == draft.overview          # 여러 줄 한글 개요가 그대로 들어갔는지
    assert doc["total"] == 30000
    assert doc["budget"][4] == "기술과실험실습재료비"
    assert doc["items"][0]["unit"] == "장"
    assert io.approvals and io.steps[:7] == [1, 2, 3, 4, 5, 6, 7]
    assert any("인증서 암호 입력" in t for _, t in io.logs)
    assert not any("1234" in t for _, t in io.logs)   # 암호가 로그에 남지 않음

    # 요청 형태 검증: toolset 항목, 베타, 사고 설정, 비밀번호 비노출
    req = fake.requests[0]
    assert req["tools"][0] == {"type": "computer_toolset_20260801"}
    assert req["thinking"] == {"type": "adaptive", "display": "updates"}
    assert "context-management-2025-06-27" in req["betas"] and req["fallbacks"] == "default"
    assert "1234" not in json.dumps(req["system"], ensure_ascii=False)
    for r in fake.requests[1:]:
        for block in r["messages"][-1]["content"]:
            if isinstance(block, dict) and block.get("type") == "tool_result":
                assert "tool_use_id" in block
    # 작업 기록 저장
    run_dirs = list((tmp_path / "runs").iterdir())
    assert run_dirs and (run_dirs[0] / "result.json").exists()


def test_save_only_mode_refuses_approval(tmp_path: Path, draft: PumuiDraft) -> None:
    settings = dataclasses.replace(Settings(), stop_at="save", runs_dir=tmp_path)
    agent = EdufineAgent(settings, BrowserController(), FakeIO(), client=SimpleNamespace())
    out = asyncio.run(agent._custom("request_final_approval", {"summary": "x"}))
    assert "저장까지만" in out
    assert agent.browser.final_approved is False
