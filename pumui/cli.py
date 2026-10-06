"""콘솔 모드.

  python -m pumui                       # 웹 화면 실행 (기본)
  python -m pumui run "우드락 10장 3000원 구입" [--mock] [--stop-at save|submit]
  python -m pumui draft "우드락 10장 3000원 구입"   # 초안만 만들어 보기
"""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from .agent import EdufineAgent
from .browser import BrowserController
from . import paths
from .config import ROOT, Settings
from .drafter import draft_from_text
from .models import PumuiDraft, won


class ConsoleIO:
    async def log(self, kind: str, text: str) -> None:
        print(f"[{kind}] {text}", flush=True)

    async def progress(self, step: int, title: str, message: str) -> None:
        print(f"\n=== ({step}) {title} — {message}", flush=True)

    async def screen(self, png: bytes) -> None:
        pass

    async def ask(self, question: str, png: bytes | None) -> str:
        print(f"\n🙋 Claude의 요청: {question}")
        return (await asyncio.to_thread(input, "답변 (직접 처리했으면 Enter): ")).strip() or "완료했습니다."

    async def approve(self, summary: str, png: bytes | None) -> tuple[bool, str]:
        print(f"\n✅ 결재요청(상신) 최종 승인 요청\n{summary}")
        ans = (await asyncio.to_thread(input, "실제로 상신할까요? [y/N]: ")).strip().lower()
        if ans in ("y", "yes", "예", "ㅇ"):
            return True, ""
        reason = (await asyncio.to_thread(input, "보류 사유/수정 사항: ")).strip()
        return False, reason or "교사가 보류함"


def print_draft(d: PumuiDraft) -> None:
    print(f"\n제목: {d.title}\n유형: {d.category}  요구일자: {d.request_date}  완료요구일자: {d.due_date}")
    print(f"예산 단서: {d.budget.model_dump()}")
    for i in d.items:
        print(f"  - {i.name} {i.spec} {i.quantity}{i.unit} × {i.unit_price:,} = {i.amount:,}")
    print(f"합계: {won(d.total)}\n\n[개요]\n{d.overview}")
    for a in d.assumptions:
        print(f"  (추정) {a}")


def serve_mock() -> str:
    """연습용 모의 에듀파인을 로컬에서 띄우고 주소를 돌려줍니다."""
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self, *args) -> None:
            pass

    handler = partial(Quiet, directory=str(ROOT / "mock_edufine"))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}/portal.html"


async def cmd_run(args: argparse.Namespace) -> int:
    s = Settings()
    if args.stop_at:
        s.stop_at = args.stop_at
    if args.mock:
        s = dataclasses.replace(s, portal_url_override=serve_mock(), cert_password=s.cert_password or "1234",
                                cdp_url="", school_notes="", profile_dir=paths.profile_dir(mock=True))
    if args.draft_file:
        draft = PumuiDraft.model_validate_json(open(args.draft_file, encoding="utf-8").read()).ensure_overview()
    else:
        print("Claude가 품의 초안을 작성하는 중…")
        draft = await draft_from_text(args.text, s)
    print_draft(draft)
    if not args.yes:
        ok = (await asyncio.to_thread(input, "\n이 내용으로 에듀파인에 작성할까요? [Y/n]: ")).strip().lower()
        if ok in ("n", "no", "아니오"):
            return 1
    browser = BrowserController(viewport=s.viewport, channel=s.browser_channel, profile_dir=str(s.profile_dir),
                                cdp_url=s.cdp_url, headless=s.headless, executable_path=s.browser_path)
    await browser.start()
    try:
        result = await EdufineAgent(s, browser, ConsoleIO()).run(draft)
        print("\n" + json.dumps(result, ensure_ascii=False, indent=2))
        if not s.headless:
            await asyncio.to_thread(input, "\n브라우저를 닫으려면 Enter…")
        return 0 if result["result"] in ("saved", "submitted") else 2
    finally:
        await browser.close()


async def browser_selftest(settings: Settings, mock_url: str) -> dict:
    """브라우저를 띄워 모의 포털을 열고 스크린샷까지 찍어 봅니다 (API 키 불필요)."""
    browser = BrowserController(viewport=settings.viewport, channel=settings.browser_channel,
                                profile_dir=str(paths.profile_dir(mock=True)), headless=True,
                                executable_path=settings.browser_path)
    await browser.start()
    try:
        await browser.goto(mock_url)
        png, w, h = await browser.screenshot()
        target = await browser.target_at(w / 2, h / 2)
        return {"ok": png[:4] == b"\x89PNG", "browser": browser.channel_used, "size": [w, h], "center": target.label()}
    finally:
        await browser.close()


async def cmd_selftest(args: argparse.Namespace) -> int:
    result = await browser_selftest(Settings(), serve_mock())
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["ok"] else 1


async def cmd_draft(args: argparse.Namespace) -> int:
    draft = await draft_from_text(args.text, Settings())
    print_draft(draft)
    if args.out:
        open(args.out, "w", encoding="utf-8").write(draft.model_dump_json(indent=2))
        print(f"\n저장: {args.out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="pumui", description="K-에듀파인 자동 품의")
    sub = p.add_subparsers(dest="cmd")
    sub.add_parser("serve", help="웹 화면 실행 (기본)")
    r = sub.add_parser("run", help="콘솔에서 바로 실행")
    r.add_argument("text", nargs="?", default="", help="품의 내용 (한두 줄)")
    r.add_argument("--draft-file", help="초안 JSON 파일로 실행 (Claude 초안 생략)")
    r.add_argument("--mock", action="store_true", help="연습용 모의 에듀파인에서 실행")
    r.add_argument("--stop-at", choices=["save", "submit"])
    r.add_argument("-y", "--yes", action="store_true", help="초안 확인 질문 생략")
    sub.add_parser("selftest", help="브라우저 점검 (API 키 불필요)")
    d = sub.add_parser("draft", help="초안만 만들기")
    d.add_argument("text")
    d.add_argument("-o", "--out")
    args = p.parse_args(argv)

    if args.cmd in (None, "serve"):
        from .server import main as serve
        serve()
        return 0
    if args.cmd == "run":
        if not args.text and not args.draft_file:
            p.error("품의 내용 또는 --draft-file 이 필요합니다.")
        return asyncio.run(cmd_run(args))
    if args.cmd == "selftest":
        return asyncio.run(cmd_selftest(args))
    return asyncio.run(cmd_draft(args))


if __name__ == "__main__":
    sys.exit(main())
