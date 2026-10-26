"""콘솔 모드.

python -m kcontent                       웹 화면 실행
python -m kcontent search [키워드...] --cc  소재 찾기 (키워드 없으면 기본 다국어 키워드)
python -m kcontent plan <영상주소> [--transcript 자막.txt]   기획안·자막·설명란 만들기 → 프로젝트 폴더
python -m kcontent thumb "외국인이 놀란\\n한국 편의점" [--bg 사진.jpg] [--badge 반응] [-o thumb.png]
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path

from . import project, thumbnail
from .config import Settings
from .scoring import score_candidate
from .youtube import KEYWORDS, YouTubeClient, YouTubeError, to_candidate


def _default_keywords(langs: str) -> list[str]:
    return [kw for lang in langs.split(",") for kw in KEYWORDS.get(lang.strip(), [])]


def cmd_search(args: argparse.Namespace) -> int:
    keywords = args.keywords or _default_keywords(args.langs)
    yt = YouTubeClient(Settings().youtube_api_key)
    found = yt.find(keywords, cc_only=args.cc, min_minutes=args.min_minutes, per_keyword=args.per_keyword)
    for c in found[: args.top]:
        rights = "CC BY" if c.rights == "cc_by" else "허락 필요"
        print(f"[{c.score:3d}점] {c.title[:60]}")
        print(f"        {c.url} · {c.channel} · {c.duration_sec // 60}분 · 조회 {c.views:,} · {rights}")
        print(f"        장소: {', '.join(c.places[:6]) or '-'}  (키워드: {c.keyword})")
    print(f"\n총 {len(found)}개 (8분 이상, 점수순). 상위 {min(args.top, len(found))}개를 보여 줬습니다.")
    return 0


def cmd_plan(args: argparse.Namespace) -> int:
    from .planner import make_plan

    s = Settings()
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})", args.url)
    if not m:
        print("유튜브 영상 주소를 확인해 주세요.", file=sys.stderr)
        return 2
    yt = YouTubeClient(s.youtube_api_key)
    items = yt.videos([m.group(1)])
    if not items:
        print("영상을 찾지 못했습니다.", file=sys.stderr)
        return 1
    c = score_candidate(to_candidate(items[0], yt.subscribers([items[0]["snippet"]["channelId"]])))
    transcript = Path(args.transcript).read_text(encoding="utf-8") if args.transcript else ""
    print(f"대본 작성 중: {c.title} ({s.model}) ...", file=sys.stderr)
    plan = asyncio.run(make_plan(c, s, transcript=transcript, notes=args.notes))
    png = thumbnail.render(plan.thumbnail_texts[0], badge=args.badge, font_path=s.font_path)
    folder = project.save(c, plan, png)
    print(f"내레이션 {plan.narration_chars():,}자 · 약 {plan.estimated_minutes()}분")
    print(f"프로젝트 폴더: {folder}")
    if c.rights == "permission_needed":
        print("⚠ 표준 라이선스 영상입니다. permission_email.txt로 원작자 허락을 먼저 받으세요.")
    return 0


def cmd_thumb(args: argparse.Namespace) -> int:
    bg = Path(args.bg).read_bytes() if args.bg else None
    png = thumbnail.render(args.text, bg, badge=args.badge, theme=args.theme, font_path=Settings().font_path)
    Path(args.output).write_bytes(png)
    if (warn := thumbnail.font_warning()):
        print(warn, file=sys.stderr)
    print(args.output)
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m kcontent", description="K-콘텐츠 스튜디오")
    sub = ap.add_subparsers(dest="cmd")

    p = sub.add_parser("search", help="소재 영상 찾기")
    p.add_argument("keywords", nargs="*")
    p.add_argument("--langs", default="en,de,el", help="키워드를 비웠을 때 쓸 언어 (예: en,de,el,fr)")
    p.add_argument("--cc", action="store_true", help="CC BY(재사용 가능) 영상만")
    p.add_argument("--min-minutes", type=int, default=8)
    p.add_argument("--per-keyword", type=int, default=20)
    p.add_argument("--top", type=int, default=20)

    p = sub.add_parser("plan", help="기획안·자막·설명란·썸네일 만들기")
    p.add_argument("url")
    p.add_argument("--transcript", help="원본 자막/대본 파일 (있으면 더 정확)")
    p.add_argument("--notes", default="", help="장면 메모")
    p.add_argument("--badge", default="", help="썸네일 왼쪽 위 배지 문구")

    p = sub.add_parser("thumb", help="썸네일만 만들기")
    p.add_argument("text", help="두 줄은 \\n 으로 구분")
    p.add_argument("--bg", help="배경 사진")
    p.add_argument("--badge", default="")
    p.add_argument("--theme", default="yellow", choices=sorted(thumbnail.THEMES))
    p.add_argument("-o", "--output", default="thumbnail.png")

    p = sub.add_parser("serve", help="웹 화면 실행")
    p.add_argument("--no-browser", action="store_true")

    args = ap.parse_args(argv)
    try:
        if args.cmd == "search":
            return cmd_search(args)
        if args.cmd == "plan":
            return cmd_plan(args)
        if args.cmd == "thumb":
            return cmd_thumb(args)
    except YouTubeError as exc:
        print(exc, file=sys.stderr)
        return 1
    from .server import main as serve

    serve(open_browser=not getattr(args, "no_browser", False))
    return 0
