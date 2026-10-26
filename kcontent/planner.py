"""소재 영상 정보 → 8분 이상 한국어 영상 기획안 (Claude 구조화 출력)."""

from __future__ import annotations

import os

import anthropic

from .config import Settings
from .models import Candidate, VideoPlan

SYSTEM = """당신은 외국인의 한국 여행·체험 영상을 한국 시청자에게 소개하는 유튜브 채널의 작가입니다.
주어진 소재 영상 정보(제목, 설명, 장소, 길이, 선택적으로 원본 자막/메모)로 한국어 영상 기획안을 씁니다.

조회수가 잘 나오는 구성(3-3-3 규칙)
- 인물: 원작자가 보고 느낀 반응과 표정을 중심으로 이야기를 끌고 갑니다.
- 장소: 등장하는 한국 장소마다 짧은 배경 정보(역사, 특징, 현지인 팁)를 더해 볼거리를 늘립니다.
- 8분 이상: 한국어 내레이션 전체가 최소 2,700자(약 8분 30초)가 되도록 씁니다. 구간은 8~14개.

대본 규칙
- hook: 시청자가 궁금해할 질문으로 시작합니다. 예) "외국인이 한국 편의점에서 가장 먼저 놀라는 건 뭘까요?"
- 한국과 원작자 나라를 비교해 자부심과 호기심을 주되, 확인 가능한 사실만 씁니다. 다른 나라를 깎아내리지 않습니다.
  확인이 필요한 수치·주장은 fact_checks에 그대로 적습니다.
- 원작자가 실제로 하지 않은 말을 지어내지 않습니다. 원본 자막이 없으면 장면 설명은 "원작자가 ~하는 장면" 수준으로만 씁니다.
- 원본을 그대로 이어 붙이는 대신, 매 구간마다 한국어 해설·정보를 더해 새 가치를 만듭니다(유튜브 재사용 콘텐츠 정책).
- closing: "구독·좋아요·알림 설정" 요청을 하지 않습니다. 여운이 남는 한 문장이나 다음 이야기를 궁금하게 하는 질문으로 끝냅니다.
- 내레이션은 TTS로 읽기 좋게 짧은 문장으로 쓰고, 숫자에는 단위를 붙입니다(예: 2026년, 3천 원, 20분).
- source_start/source_end는 원본 영상의 대략적 구간(mm:ss)입니다. 원본 길이를 넘지 않게 고르게 배분합니다.
- description 첫 줄은 비워 두고 둘째 줄부터 영상 소개를 씁니다(프로그램이 첫 줄에 출처를 넣습니다).
- chapters는 내레이션 분량으로 계산한 '00:00 제목' 형식, 첫 줄은 00:00.
- titles는 질문형·비교형·감탄형을 섞고 낚시성 거짓말은 쓰지 않습니다."""


class MissingApiKey(RuntimeError):
    pass


def make_client(settings: Settings) -> anthropic.AsyncAnthropic:
    if settings.anthropic_api_key:
        return anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    if os.environ.get("ANTHROPIC_AUTH_TOKEN") or os.environ.get("ANTHROPIC_PROFILE"):
        return anthropic.AsyncAnthropic()
    raise MissingApiKey("ANTHROPIC_API_KEY가 없습니다. 사용설명서의 'Claude API 키 받기'를 따라 설정해 주세요.")


def build_prompt(c: Candidate, notes: str = "", transcript: str = "", channel_style: str = "") -> str:
    parts = [
        f"소재 영상 제목: {c.title}",
        f"원작자 채널: {c.channel}",
        f"영상 길이: {c.duration_sec // 60}분 {c.duration_sec % 60}초",
        f"언어: {c.language or '알 수 없음'}",
        f"등장 장소(자동 추출): {', '.join(c.places) or '없음'}",
        f"조회수: {c.views:,}",
        f"설명란:\n{c.description[:3000]}",
    ]
    if c.tags:
        parts.append("태그: " + ", ".join(c.tags[:20]))
    if transcript.strip():
        parts.append("원본 자막/대본(원작자가 실제로 한 말):\n" + transcript.strip()[:30000])
    if notes.strip():
        parts.append("제작자 메모(장면 정보 등):\n" + notes.strip())
    if channel_style.strip():
        parts.append("우리 채널 말투/스타일:\n" + channel_style.strip())
    return "\n\n".join(parts)


async def make_plan(c: Candidate, settings: Settings, *, notes: str = "", transcript: str = "",
                    channel_style: str = "", client: anthropic.AsyncAnthropic | None = None) -> VideoPlan:
    client = client or make_client(settings)
    extra = {}
    if settings.use_fallbacks:
        extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
    response = await client.beta.messages.parse(
        model=settings.model,
        max_tokens=16000,
        system=SYSTEM,
        thinking={"type": "adaptive"},
        output_config={"effort": settings.effort},
        messages=[{"role": "user", "content": build_prompt(c, notes, transcript, channel_style)}],
        output_format=VideoPlan,
        **extra,
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("Claude가 이 소재의 대본 작성을 거절했습니다. 다른 소재로 시도해 주세요.")
    if response.parsed_output is None:
        raise RuntimeError(f"기획안을 만들지 못했습니다 (stop_reason={response.stop_reason}).")
    return response.parsed_output
