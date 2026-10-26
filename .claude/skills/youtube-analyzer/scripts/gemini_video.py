"""유튜브 영상을 Gemini가 직접 보고(화면+음성) 분석합니다.

영상은 구글 서버가 가져가므로, 유튜브가 막는 클라우드 서버에서도 동작합니다.
필요한 것: GEMINI_API_KEY (https://aistudio.google.com/apikey 에서 무료 발급)
표준 라이브러리만 씁니다.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://generativelanguage.googleapis.com/v1beta"

PROMPT = """이 유튜브 영상을 처음부터 끝까지 보고(화면과 음성 모두) 한국어 마크다운으로 분석해 주세요.
영상에서 실제로 보이거나 들리는 것만 적고, 확인할 수 없는 것은 "영상에서 확인 안 됨"이라고 쓰세요.
영상이 주장하는 수익·조회수 같은 수치는 "(영상 주장)"이라고 표시하세요.

## 1. 영상 정보
제목(화면/설명에 보이면), 채널, 대략 길이, 말하는 사람

## 2. 영상 요지
3~5줄

## 3. 소개된 프로그램/서비스
각각: 이름, 무엇을 하는지, 가격·결제 방식(구독/일회성/크레딧), 판매 경로

## 4. 프로그램 화면 상세 (가장 중요)
화면에 나오는 순서대로, 타임스탬프 [mm:ss]와 함께:
- 화면/메뉴 이름, 입력 칸(무엇을 입력하는지), 버튼, 옵션(드롭다운 값까지)
- 버튼을 누르면 나오는 결과물의 형태(대본, 이미지, 음성, 영상, 자막, 썸네일, 업로드 등)
- 내부에서 쓰는 것으로 보이는 AI/외부 서비스(언급되거나 화면에 보이면)

## 5. 전체 작업 흐름
입력 → 처리 단계 → 최종 결과물 → 업로드/배포까지 번호 목록

## 6. 수익화 방식
어떤 플랫폼(유튜브 쇼츠, 틱톡, 블로그 등)에서 어떤 구조(광고, 제휴, 판매)로 돈이 된다고 하는지

## 7. 다룬 K-콘텐츠 종류
예: K-드라마 요약, K-팝, 한국 여행, 한식, 한국어 학습 등. 원본 영상·음원을 그대로 쓰는지 새로 만드는지

## 8. 직접 만들기 위한 기능 명세
위 프로그램을 똑같이 재현하려면 필요한 기능을 체크리스트로

## 9. 위험 요소
저작권(방송·드라마 클립·음원), 플랫폼의 '재사용/반복 콘텐츠' 수익 제한, 초상권, AI 생성물 표시 의무
"""


def _request(url: str, body: dict | None = None, timeout: int = 900) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        try:
            detail = json.loads(detail)["error"]["message"]
        except (ValueError, KeyError):
            pass
        sys.exit(f"Gemini API 오류 {exc.code}: {detail}")


def pick_model(key: str) -> str:
    """generateContent를 지원하는 모델 중 가장 새 버전의 flash(없으면 pro)를 고릅니다."""
    names = []
    url = f"{API}/models?pageSize=1000&key={key}"
    for m in _request(url, timeout=30).get("models", []):
        if "generateContent" in m.get("supportedGenerationMethods", []):
            names.append(m["name"].removeprefix("models/"))

    def score(name: str) -> tuple:
        ver = tuple(int(x) for x in re.findall(r"\d+", name.split("-")[1])) if name.count("-") else (0,)
        stable = not re.search(r"preview|exp|\d{2}-\d{2}|latest|tts|image|live|audio|embedding", name)
        return (stable, "flash" in name and "lite" not in name, ver)

    gemini = [n for n in names if n.startswith("gemini-")]
    if not gemini:
        sys.exit("사용할 수 있는 Gemini 모델을 찾지 못했습니다. --model 로 직접 지정해 주세요.")
    return max(gemini, key=score)


def analyze(url: str, key: str, model: str, prompt: str) -> str:
    body = {
        "contents": [{
            "parts": [
                {"file_data": {"file_uri": url}},
                {"text": prompt},
            ],
        }],
        "generationConfig": {"temperature": 0.2},
    }
    res = _request(f"{API}/models/{model}:generateContent?key={key}", body)
    cands = res.get("candidates") or []
    if not cands:
        sys.exit("Gemini가 결과를 돌려주지 않았습니다: " + json.dumps(res.get("promptFeedback", res), ensure_ascii=False)[:500])
    parts = cands[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        sys.exit(f"빈 결과 (finishReason={cands[0].get('finishReason')})")
    return text


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Gemini로 유튜브 영상 분석")
    ap.add_argument("url", help="유튜브 영상 주소")
    ap.add_argument("--out", type=Path, default=Path("yt"), help="결과 폴더")
    ap.add_argument("--model", default="", help="Gemini 모델 (비우면 자동 선택)")
    ap.add_argument("--prompt-file", type=Path, help="기본 분석 지시문 대신 쓸 파일")
    args = ap.parse_args(argv)

    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY 환경변수가 없습니다. https://aistudio.google.com/apikey 에서 무료로 발급해 넣어 주세요.")
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})", args.url)
    vid = m.group(1) if m else "video"
    url = f"https://www.youtube.com/watch?v={vid}" if m else args.url

    model = args.model or pick_model(key)
    prompt = args.prompt_file.read_text(encoding="utf-8") if args.prompt_file else PROMPT
    print(f"모델: {model} — 영상 길이에 따라 1~5분 걸립니다...", file=sys.stderr)
    text = analyze(url, key, model, prompt)

    folder = args.out / vid
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "gemini_analysis.md"
    path.write_text(f"<!-- {url} · {model} -->\n\n{text}\n", encoding="utf-8")
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
