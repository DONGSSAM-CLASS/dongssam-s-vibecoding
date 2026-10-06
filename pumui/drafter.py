"""교사가 대충 적은 한두 줄 → K-에듀파인 품의 초안 (Claude 구조화 출력)."""

from __future__ import annotations

import os
from datetime import date

import anthropic

from .config import Settings
from .models import PumuiDraft

SYSTEM = """당신은 한국 초·중·고등학교 행정실 업무에 능숙한 교사 도우미입니다.
교사가 짧게 적은 요청을 K-에듀파인 '품의' 작성에 필요한 값으로 정리합니다.

작성 규칙
- 제목: "[학년도] [교과/행사] [목적] [물품] 구입" 형태로 간결하게. 예) "2026학년도 기술 수업 롤링볼 프로젝트 재료 구입". 한글 기준 60자 이내.
- purpose: 개요 첫 문장. "OO을(를) 위하여 OO을(를) 다음과 같이 구입하고자 합니다." 같은 공문체.
- items: 품명(name)·규격(spec)·수량(quantity)·단위(unit)·예상단가(unit_price, 원, 부가세 포함 정수)로 나눕니다.
  수량·단가가 없으면 학교 현장의 일반적인 값으로 추정하고 assumptions에 무엇을 추정했는지 적습니다.
  총액만 주어지면 단가 = 총액 ÷ 수량으로 맞춥니다.
- category: 물품 구입이면 "물품", 강사료 등은 "수당", 협의회 다과·식비는 "업무추진비", 그 외 "용역"/"공사"/"기타".
- budget: 예산선택 창에서 찾을 단서. 교과·활동명으로 세부사업(sub_project), 세부항목(detail_item),
  원가통계비목(cost_category; 학습준비물/교육운영비/운영수당/일반업무추진비 등), 산출내역 키워드(calc_note)를 추정합니다.
  모르면 빈 문자열로 둡니다.
- request_date는 오늘, due_date는 특별한 말이 없으면 오늘부터 30일 뒤.
- overview는 빈 문자열로 둡니다(프로그램이 금액을 계산해 자동 작성).
- 원문에 없는 값을 지어냈다면 반드시 assumptions에 한 줄씩 적습니다."""


class MissingApiKey(RuntimeError):
    pass


def make_client(settings: Settings) -> anthropic.AsyncAnthropic:
    """설정 화면에 저장한 API 키(없으면 환경변수)로 클라이언트를 만듭니다."""
    if settings.api_key:
        return anthropic.AsyncAnthropic(api_key=settings.api_key)
    if os.environ.get("ANTHROPIC_AUTH_TOKEN") or os.environ.get("ANTHROPIC_PROFILE"):
        return anthropic.AsyncAnthropic()
    raise MissingApiKey("Claude API 키가 설정되지 않았습니다. [설정]에서 API 키를 입력해 주세요.")


async def draft_from_text(text: str, settings: Settings, client: anthropic.AsyncAnthropic | None = None) -> PumuiDraft:
    client = client or make_client(settings)
    extra = {}
    if settings.use_fallbacks:
        extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
    response = await client.beta.messages.parse(
        model=settings.model,
        max_tokens=16000,
        system=SYSTEM,
        thinking={"type": "adaptive"},
        output_config={"effort": "low"},
        messages=[{
            "role": "user",
            "content": f"오늘 날짜: {date.today().isoformat()}\n\n교사 요청:\n{text.strip()}",
        }],
        output_format=PumuiDraft,
        **extra,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("Claude가 이 요청의 처리를 거절했습니다. 내용을 바꿔 다시 시도해 주세요.")
    if response.parsed_output is None:
        raise RuntimeError(f"품의 초안을 만들지 못했습니다 (stop_reason={response.stop_reason}).")
    draft: PumuiDraft = response.parsed_output
    draft.overview = ""
    return draft.ensure_overview()
