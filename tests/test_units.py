from __future__ import annotations

import asyncio
import json

import anthropic
import httpx2

from pumui.browser import GUARD_PATTERN, to_playwright_key
from pumui.config import Settings
from pumui.drafter import draft_from_text
from pumui.models import PumuiDraft, PumuiItem, korean_amount, render_overview, won
from pumui.playbook import build_system_prompt


def test_korean_amount():
    assert korean_amount(30000) == "삼만"
    assert korean_amount(1250000) == "백이십오만"
    assert korean_amount(10) == "십"
    assert korean_amount(110000) == "십일만"
    assert korean_amount(46880) == "사만육천팔백팔십"
    assert korean_amount(100000000) == "일억"
    assert won(30000) == "금30,000원(금삼만원)"


def test_key_mapping():
    assert to_playwright_key("Return") == "Enter"
    assert to_playwright_key("ctrl+a") == "Control+a"
    assert to_playwright_key("ctrl+shift+Tab") == "Control+Shift+Tab"
    assert to_playwright_key("Page_Down") == "PageDown"
    assert to_playwright_key("f5") == "F5"
    assert to_playwright_key("BackSpace") == "Backspace"


def test_guard_pattern():
    for s in ["결재요청", "상신", "결재상신", "기안하기"]:
        assert GUARD_PATTERN.match(s)
    for s in ["결재취소요청", "저장", "결재정보", "확인", "결재요청목록"]:
        assert not GUARD_PATTERN.match(s)


def _draft() -> PumuiDraft:
    return PumuiDraft(
        title="2026학년도 기술 수업 롤링볼 프로젝트 재료 구입",
        purpose="기술 수업 롤링볼 프로젝트 재료를 다음과 같이 구입하고자 합니다.",
        items=[PumuiItem(name="우드락", spec="450x450", quantity=10, unit="장", unit_price=3000),
               PumuiItem(name="글루건 심", quantity=2, unit="봉", unit_price=4500)],
    )


def test_overview_and_total():
    d = _draft()
    assert d.total == 39000
    ov = render_overview(d)
    assert "금39,000원(금삼만구천원)" in ov
    assert "가. 우드락(450x450) 10장 × 3,000원 = 30,000원" in ov
    assert "나. 글루건 심 2봉" in ov
    assert d.title_bytes() < 300


def test_system_prompt_contains_data_not_password():
    d = _draft().ensure_overview()
    sp = build_system_prompt(d, "submit", "홍길동")
    assert "우드락" in sp and "39000" in sp and "request_final_approval" in sp
    assert "홍길동" in sp
    sp2 = build_system_prompt(d, "save", "")
    assert "저장까지만" in sp2


def test_drafter_request_and_parse():
    """실제 API 대신 가짜 HTTP 응답으로 구조화 출력 요청/파싱을 검증."""
    captured = {}
    payload = {
        "title": "2026학년도 기술 수업 롤링볼 프로젝트 재료 구입",
        "purpose": "기술 수업 롤링볼 프로젝트 재료를 다음과 같이 구입하고자 합니다.",
        "category": "물품",
        "budget": {"sub_project": "과학 교과활동", "detail_item": "교과운영", "cost_category": "학습준비물", "calc_note": "기술과실험실습재료비"},
        "items": [{"name": "우드락", "spec": "450x450x5mm", "quantity": 10, "unit": "장", "unit_price": 3000}],
        "request_date": "2026-10-05", "due_date": "2026-11-04", "overview": "", "assumptions": ["규격 두께 5mm 추정"],
    }

    def handler(request: httpx2.Request) -> httpx2.Response:
        captured["body"] = json.loads(request.content)
        captured["beta"] = request.headers.get("anthropic-beta", "")
        return httpx2.Response(200, json={
            "id": "msg_test", "type": "message", "role": "assistant", "model": "claude-opus-5-5",
            "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}],
            "stop_reason": "end_turn", "stop_sequence": None,
            "usage": {"input_tokens": 10, "output_tokens": 10},
        })

    client = anthropic.AsyncAnthropic(api_key="test", http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)))
    draft = asyncio.run(draft_from_text("우드락 10장 3000원", Settings(), client=client))
    assert draft.total == 30000
    assert "금30,000원(금삼만원)" in draft.overview
    body = captured["body"]
    assert body["model"] == "claude-opus-5-5"
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert body["thinking"] == {"type": "adaptive"}
    assert body["fallbacks"] == "default" and "server-side-fallback-2026-07-01" in captured["beta"]
