"""Claude in Chrome 안내서를 책자형 PDF(A5)로 만듭니다.

    python docs/booklet/build_booklet.py --fonts <서체 폴더>

- 지시문 전문은 docs/Claude_in_Chrome_사용법.md 의 코드 블록에서 가져옵니다(내용이 항상 일치).
- 두 번 렌더링해 차례의 쪽 번호를 채우고, 제본 인쇄를 위해 전체 쪽수를 4의 배수로 맞춥니다.

서체(모두 SIL Open Font License) 준비:
    npm pack pretendard@1.3.9 @fontsource/noto-serif-kr
    → Pretendard-*.otf (dist/public/static) 와 noto-serif-kr-{korean,latin}-{400,600,700,900}-normal.woff2 (files)
      를 한 폴더에 모아 --fonts 로 지정
"""

from __future__ import annotations

import argparse
import html
import io
import re
import tempfile
import urllib.parse
from pathlib import Path

import qrcode
import qrcode.image.svg
from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
GUIDE = ROOT / "docs" / "Claude_in_Chrome_사용법.md"
OUT = ROOT / "docs" / "에듀파인_자동품의_Claude_in_Chrome_안내서.pdf"
GUIDE_URL = ("https://github.com/DONGSSAM-CLASS/dongssam-s-vibecoding/blob/main/docs/"
             + urllib.parse.quote("Claude_in_Chrome_사용법.md"))
GUIDE_URL_SHORT = "github.com/DONGSSAM-CLASS/dongssam-s-vibecoding<br>› docs › Claude_in_Chrome_사용법.md"
EDITION = "2026. 10. 초판"
CHAPTERS = ["01", "02", "03", "04", "05", "06"]
OPENER_LABELS = {
    "01": "CHOOSE YOUR WAY", "02": "GETTING READY", "03": "SAVE THE SHORTCUT",
    "04": "HOW IT WORKS", "05": "TROUBLESHOOTING", "06": "BEFORE YOU START",
}


def extract_prompt() -> str:
    text = GUIDE.read_text(encoding="utf-8")
    m = re.search(r"```text\n(.*?)```", text, re.S)
    if not m:
        raise SystemExit("안내서에서 지시문 코드 블록(```text)을 찾지 못했습니다.")
    return m.group(1).rstrip("\n")


def qr_svg(url: str) -> str:
    img = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=1,
                      error_correction=qrcode.constants.ERROR_CORRECT_M)
    buf = io.BytesIO()
    img.save(buf)
    svg = buf.getvalue().decode("utf-8")
    svg = re.sub(r"<\?xml[^>]*\?>", "", svg).strip()
    # 고정 크기 대신 상자에 맞게 늘어나도록
    svg = re.sub(r'\swidth="[^"]+"', "", svg, count=1)
    svg = re.sub(r'\sheight="[^"]+"', "", svg, count=1)
    return svg


NOTE_PAGE = """
<section class="notes page-break">
  <div class="eyebrow">NOTES</div>
  <h3>메모</h3>
  <p class="muted small">우리 학교 메뉴 위치, 자주 쓰는 예산 항목 등을 적어 두세요.</p>
  <div class="lines">""" + "<div></div>" * 15 + """</div>
</section>
"""


def render(template: str, fonts: Path, pages: dict[str, int], notes: int) -> str:
    out = template
    out = out.replace("{{FONT_DIR}}", fonts.resolve().as_uri())
    out = out.replace("{{PROMPT}}", html.escape(extract_prompt()))
    out = out.replace("{{QR_SVG}}", qr_svg(GUIDE_URL))
    out = out.replace("{{GUIDE_URL_SHORT}}", GUIDE_URL_SHORT)
    out = out.replace("{{EDITION}}", EDITION)
    out = out.replace("{{NOTES}}", NOTE_PAGE * notes)
    for ch in CHAPTERS:
        out = out.replace("{{PG_%s}}" % ch, str(pages.get(ch, "")))
    return out


def print_pdf(page_html: str, dest: Path, browser_path: str | None) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(page_html)
        tmp = Path(f.name)
    try:
        with sync_playwright() as p:
            kw = {"executable_path": browser_path} if browser_path else {}
            browser = p.chromium.launch(**kw)
            page = browser.new_page()
            page.goto(tmp.as_uri(), wait_until="networkidle")
            page.evaluate("document.fonts.ready")
            page.pdf(path=str(dest), prefer_css_page_size=True, print_background=True,
                     display_header_footer=False, tagged=True, outline=True)
            browser.close()
    finally:
        tmp.unlink(missing_ok=True)


def find_chapter_pages(pdf: Path) -> dict[str, int]:
    found: dict[str, int] = {}
    reader = PdfReader(str(pdf))
    for idx, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        for ch, label in OPENER_LABELS.items():
            if ch not in found and label in text:
                found[ch] = idx
    return found


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fonts", required=True, type=Path, help="서체 파일 폴더")
    ap.add_argument("--browser", default=None, help="크로미움 실행 파일 경로(선택)")
    ap.add_argument("--out", default=OUT, type=Path)
    args = ap.parse_args()

    template = (HERE / "booklet.html").read_text(encoding="utf-8")
    with tempfile.TemporaryDirectory() as td:
        draft = Path(td) / "draft.pdf"
        print_pdf(render(template, args.fonts, {}, 0), draft, args.browser)
        pages = find_chapter_pages(draft)
        total = len(PdfReader(str(draft)).pages)
    missing = [c for c in CHAPTERS if c not in pages]
    if missing:
        raise SystemExit(f"장 시작 쪽을 찾지 못했습니다: {missing}")
    notes = (-total) % 4  # 제본용 4의 배수
    # 메모 쪽은 뒤표지 바로 앞에 들어가므로 장 쪽 번호는 바뀌지 않음
    print_pdf(render(template, args.fonts, pages, notes), args.out, args.browser)
    final = len(PdfReader(str(args.out)).pages)
    print(f"완료: {args.out} ({final}쪽, 메모 {notes}쪽 추가, 장 시작 쪽 {pages})")


if __name__ == "__main__":
    main()
