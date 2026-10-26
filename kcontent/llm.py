"""대본을 만드는 AI 고르기. 기본은 돈이 들지 않는 방식입니다.

- manual : 프로그램이 만든 프롬프트를 무료 AI 채팅(claude.ai, gemini.google.com, chatgpt.com)에 붙여 넣고
           답을 다시 붙여 넣습니다. 키·요금 없음.
- gemini : Google AI Studio 무료 등급 키(GEMINI_API_KEY). 결제 수단 등록 없이 하루 사용량 한도 안에서 무료.
- ollama : 내 PC에서 돌리는 무료 AI(https://ollama.com). 인터넷·키 없이 동작.
- claude : Claude API(유료, 사용한 만큼 과금). 원할 때만 고릅니다.

manual·gemini·ollama는 같은 프롬프트(규칙 + JSON 형식)를 쓰고, 답을 VideoPlan으로 검증합니다.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from collections.abc import Callable

from pydantic import ValidationError

from .models import VideoPlan

PROVIDERS = {
    "manual": "복사·붙여넣기 (무료 AI 채팅, 0원)",
    "gemini": "Gemini API 무료 등급 (0원, 키 필요)",
    "ollama": "Ollama — 내 PC의 무료 AI (0원)",
    "claude": "Claude API (유료)",
}
FREE = ("manual", "gemini", "ollama")
GEMINI_API = "https://generativelanguage.googleapis.com/v1beta"

Poster = Callable[[str, dict | None, int], dict]


class PlanParseError(ValueError):
    pass


def _schema_text() -> str:
    return json.dumps(VideoPlan.model_json_schema(), ensure_ascii=False, indent=1)


def full_prompt(system: str, user: str) -> str:
    """무료 채팅창에 그대로 붙여 넣을 수 있는 한 덩어리 프롬프트."""
    return (
        f"{system}\n\n"
        "출력 형식\n"
        "- 아래 JSON 스키마에 맞는 JSON 객체 하나만 출력하세요. 설명 문장이나 ``` 표시는 쓰지 마세요.\n"
        "- 모든 문자열은 한국어로 씁니다(태그 제외 영어 금지).\n\n"
        f"JSON 스키마:\n{_schema_text()}\n\n"
        f"──────── 소재 정보 ────────\n{user}"
    )


def parse_plan_text(text: str) -> VideoPlan:
    """AI가 돌려준 글에서 JSON을 꺼내 검증합니다. ```json 울타리나 앞뒤 설명이 섞여 있어도 됩니다."""
    s = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", s, re.DOTALL)
    if fence:
        s = fence.group(1)
    start, end = s.find("{"), s.rfind("}")
    if start < 0:
        raise PlanParseError("답에서 JSON을 찾지 못했습니다. AI 답변 전체를 복사해 붙여 넣었는지 확인해 주세요.")
    cut = "답변이 중간에 끊겼다면 채팅에 '계속'이라고 보내 끝까지 받은 뒤, 이어진 부분까지 함께 붙여 넣으세요."
    if end <= start:
        raise PlanParseError("JSON이 끝나지 않았습니다. " + cut)
    try:
        data = json.loads(s[start:end + 1])
    except json.JSONDecodeError as exc:
        raise PlanParseError(f"JSON 형식이 깨져 있습니다({exc.msg}, {exc.lineno}번째 줄). {cut}") from exc
    try:
        return VideoPlan.model_validate(data)
    except ValidationError as exc:
        problems = "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()[:5])
        raise PlanParseError(f"형식이 조금 다릅니다 — {problems}") from exc


def _post(url: str, body: dict | None, timeout: int) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        try:
            err = json.loads(detail).get("error", detail)       # Gemini: {"error": {"message"}}, Ollama: {"error": "..."}
            detail = err.get("message", detail) if isinstance(err, dict) else err
        except (ValueError, AttributeError):
            pass
        if exc.code == 429:
            raise RuntimeError("무료 사용량 한도에 걸렸습니다. 1분쯤 기다리거나 내일 다시 시도해 주세요. (요금은 나가지 않습니다)") from exc
        raise RuntimeError(f"AI 서버 오류 {exc.code}: {str(detail)[:300]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"AI 서버에 연결하지 못했습니다: {exc.reason}") from exc


def _with_retry(ask: Callable[[str], str], prompt: str) -> VideoPlan:
    """한 번 형식이 틀리면 무엇이 틀렸는지 알려 주고 한 번 더 받습니다."""
    text = ask(prompt)
    try:
        return parse_plan_text(text)
    except PlanParseError as exc:
        retry = f"{prompt}\n\n앞선 답은 형식 오류가 있었습니다: {exc}\nJSON 스키마에 정확히 맞춘 JSON 하나만 다시 출력하세요."
        return parse_plan_text(ask(retry))


# ── Gemini (무료 등급) ───────────────────────────────────────
def gemini_pick_model(key: str, post: Poster = _post) -> str:
    """generateContent를 지원하는 최신 안정판 flash 모델(무료 등급 대상)을 고릅니다."""
    names = [m["name"].removeprefix("models/") for m in post(f"{GEMINI_API}/models?pageSize=1000&key={key}", None, 30).get("models", [])
             if "generateContent" in m.get("supportedGenerationMethods", [])]

    def score(name: str) -> tuple:
        ver = tuple(int(x) for x in re.findall(r"\d+", name.split("-")[1])) if name.count("-") else (0,)
        stable = not re.search(r"preview|exp|\d{2}-\d{2}|latest|tts|image|live|audio|embedding", name)
        return (stable, "flash" in name and "lite" not in name, ver)

    gemini = [n for n in names if n.startswith("gemini-")]
    if not gemini:
        raise RuntimeError("사용할 수 있는 Gemini 모델을 찾지 못했습니다. KCONTENT_GEMINI_MODEL로 지정해 주세요.")
    return max(gemini, key=score)


def gemini_plan(prompt: str, key: str, model: str = "", post: Poster = _post) -> VideoPlan:
    if not key:
        raise RuntimeError("GEMINI_API_KEY가 없습니다. https://aistudio.google.com/apikey 에서 무료로 받아 .env에 넣어 주세요.")
    model = model or gemini_pick_model(key, post)

    def ask(text: str) -> str:
        res = post(f"{GEMINI_API}/models/{model}:generateContent?key={key}", {
            "contents": [{"role": "user", "parts": [{"text": text}]}],
            "generationConfig": {"responseMimeType": "application/json", "maxOutputTokens": 16000},
        }, 300)
        cands = res.get("candidates") or []
        if not cands:
            raise RuntimeError("Gemini가 답을 주지 않았습니다: " + json.dumps(res.get("promptFeedback", res), ensure_ascii=False)[:300])
        return "".join(p.get("text", "") for p in cands[0].get("content", {}).get("parts", []))

    return _with_retry(ask, prompt)


# ── Ollama (내 PC) ───────────────────────────────────────────
def ollama_plan(prompt: str, host: str, model: str, post: Poster = _post) -> VideoPlan:
    def ask(text: str) -> str:
        try:
            res = post(f"{host.rstrip('/')}/api/chat", {
                "model": model, "stream": False,
                "messages": [{"role": "user", "content": text}],
                "format": VideoPlan.model_json_schema(),
                "options": {"num_ctx": 16384},
            }, 900)
        except RuntimeError as exc:
            if "연결하지 못했습니다" in str(exc):
                raise RuntimeError(f"Ollama({host})가 꺼져 있습니다. Ollama를 설치·실행하고 `ollama pull {model}`로 모델을 받아 주세요.") from exc
            if "404" in str(exc):
                raise RuntimeError(f"Ollama에 {model} 모델이 없습니다. 명령 창에서 `ollama pull {model}`을 실행해 주세요.") from exc
            raise
        return res.get("message", {}).get("content", "")

    return _with_retry(ask, prompt)
