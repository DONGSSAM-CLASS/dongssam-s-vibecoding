"""기획안의 내레이션 → SRT 자막과 TTS용 대본.

자막은 한 줄 18자 안팎으로 끊고, 초당 약 5.5자(분당 330자) 속도로 시간을 매깁니다.
실제 녹음 후 편집 프로그램(캡컷, 브루, 프리미어 등)에서 싱크만 조금 맞추면 됩니다.
"""

from __future__ import annotations

import re

from .models import VideoPlan

CHARS_PER_SEC = 5.5
MAX_LINE = 18


def _ts(sec: float) -> str:
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def split_lines(text: str, max_len: int = MAX_LINE) -> list[str]:
    """문장 부호 기준으로 나누고, 긴 문장은 어절 단위로 max_len 근처에서 끊습니다."""
    out: list[str] = []
    for sent in re.split(r"(?<=[.!?。…])\s+|\n+", text.strip()):
        sent = sent.strip()
        if not sent:
            continue
        line = ""
        for word in sent.split():
            if line and len(line) + 1 + len(word) > max_len:
                out.append(line)
                line = word
            else:
                line = f"{line} {word}".strip()
        if line:
            out.append(line)
    return out


def narration_blocks(plan: VideoPlan) -> list[str]:
    return [plan.hook, *(s.narration for s in plan.segments), plan.closing]


def to_srt(plan: VideoPlan) -> str:
    t = 0.0
    entries = []
    for block in narration_blocks(plan):
        for line in split_lines(block):
            dur = max(1.2, len(line) / CHARS_PER_SEC)
            entries.append(f"{len(entries) + 1}\n{_ts(t)} --> {_ts(t + dur)}\n{line}\n")
            t += dur
        t += 0.4  # 구간 사이 숨 고르기
    return "\n".join(entries)


def chapters_from_plan(plan: VideoPlan) -> list[str]:
    """내레이션 분량으로 계산한 챕터. Claude가 만든 챕터와 비교해 보세요."""
    t = len(plan.hook) / CHARS_PER_SEC
    out = ["00:00 시작"]
    for s in plan.segments:
        label = (s.caption or s.scene)[:24]
        out.append(f"{int(t // 60):02d}:{int(t % 60):02d} {label}")
        t += len(s.narration) / CHARS_PER_SEC + 0.4
    return out


def tts_script(plan: VideoPlan) -> str:
    """TTS(클로바더빙, 타입캐스트, 무료 Edge TTS 등)에 그대로 붙여 넣을 대본."""
    return "\n\n".join(b.strip() for b in narration_blocks(plan) if b.strip()) + "\n"
