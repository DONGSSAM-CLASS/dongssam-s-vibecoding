"""Playwright로 실제 크롬(또는 엣지)을 띄우고 마우스·키보드를 조작하는 계층.

Claude의 computer toolset이 요청한 동작(클릭·입력·스크롤·스크린샷)을 여기서 실행합니다.
좌표는 모두 '스크린샷 픽셀' 기준이며, 내부에서 CSS 픽셀로 환산합니다.
"""

from __future__ import annotations

import asyncio
import io
import logging
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image
from playwright.async_api import (
    BrowserContext,
    Dialog,
    Error as PlaywrightError,
    Frame,
    Page,
    Playwright,
    async_playwright,
)

log = logging.getLogger(__name__)

# 교사 승인 없이는 누를 수 없는 버튼 (실제 기안/상신)
GUARD_PATTERN = re.compile(r"^(결재요청|결재\s*상신|상신|상신하기|기안|기안하기|결재올림|발송|발송요청|일괄상신)$")
GUARD_DIALOG_PATTERN = re.compile(r"(상신|결재요청|결재를\s*요청|기안하시겠|발송하시겠)")

# 스크린샷 크기 상한 (Claude 이미지 한도 안쪽, 1080p 수준 권장)
MAX_LONG_EDGE = 1920
MAX_PIXELS = 1920 * 1200

CURSOR_SCRIPT = r"""
(() => {
  if (window !== window.top || window.__claudeCursorInstalled) return;
  window.__claudeCursorInstalled = true;
  const css = `
    #__claude_cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;
      transition:transform .25s ease-out;will-change:transform}
    #__claude_cursor .dot{width:22px;height:22px;border-radius:50%;margin:-11px 0 0 -11px;
      background:radial-gradient(circle at 35% 35%,#fff7c2,#ffc400 55%,#f29d00);
      box-shadow:0 0 10px rgba(255,180,0,.8)}
    #__claude_cursor .lbl{position:absolute;left:14px;top:10px;padding:2px 10px;border-radius:12px;
      font:700 13px/18px sans-serif;color:#fff;background:#d9774b;border:2px solid #fff;white-space:nowrap}
    #__claude_cursor .ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;
      border:3px solid rgba(217,119,75,.8);animation:__cc_ring .5s ease-out forwards}
    @keyframes __cc_ring{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}`;
  const ensure = () => {
    let d = document.getElementById('__claude_cursor');
    if (d) return d;
    if (!document.documentElement) return null;
    const st = document.createElement('style'); st.textContent = css;
    document.documentElement.appendChild(st);
    d = document.createElement('div'); d.id = '__claude_cursor';
    d.innerHTML = '<div class="dot"></div><div class="lbl">Claude</div>';
    document.documentElement.appendChild(d);
    return d;
  };
  window.__claudeCursor = (x, y, click) => {
    const d = ensure(); if (!d) return;
    d.style.transform = `translate(${x}px, ${y}px)`;
    if (click) { const r = document.createElement('div'); r.className = 'ring'; d.appendChild(r);
                 setTimeout(() => r.remove(), 600); }
  };
  window.__claudeCursorVisible = (v) => { const d = ensure(); if (d) d.style.display = v ? '' : 'none'; };
})();
"""

# xdotool 식 키 이름 → Playwright 키 이름
_KEY_MAP = {
    "return": "Enter", "enter": "Enter", "kp_enter": "Enter", "esc": "Escape", "escape": "Escape",
    "tab": "Tab", "backspace": "Backspace", "delete": "Delete", "del": "Delete", "space": " ",
    "page_down": "PageDown", "pagedown": "PageDown", "next": "PageDown",
    "page_up": "PageUp", "pageup": "PageUp", "prior": "PageUp",
    "up": "ArrowUp", "down": "ArrowDown", "left": "ArrowLeft", "right": "ArrowRight",
    "home": "Home", "end": "End", "insert": "Insert",
    "ctrl": "Control", "control": "Control", "control_l": "Control", "control_r": "Control",
    "alt": "Alt", "alt_l": "Alt", "shift": "Shift", "shift_l": "Shift",
    "super": "Meta", "super_l": "Meta", "cmd": "Meta", "meta": "Meta", "win": "Meta",
}


def to_playwright_key(combo: str) -> str:
    parts = [p for p in combo.strip().split("+") if p]
    out = []
    for p in parts:
        low = p.lower()
        if low in _KEY_MAP:
            out.append(_KEY_MAP[low])
        elif re.fullmatch(r"f\d{1,2}", low):
            out.append(low.upper())
        elif len(p) == 1:
            out.append(p)
        else:
            out.append(p[:1].upper() + p[1:])
    return "+".join(out)


@dataclass
class ClickTarget:
    tag: str = ""
    text: str = ""
    button_text: str = ""
    frame_url: str = ""

    def label(self) -> str:
        return (self.button_text or self.text or self.tag)[:40]


class GuardBlocked(Exception):
    """교사 승인 전에 상신/결재요청 버튼을 누르려 할 때."""


@dataclass
class BrowserController:
    viewport: tuple[int, int] = (1440, 900)
    channel: str = "auto"
    profile_dir: str = ".browser-profile"
    cdp_url: str = ""
    headless: bool = False
    show_cursor: bool = True
    executable_path: str = ""
    channel_used: str = ""

    final_approved: bool = False
    events: list[str] = field(default_factory=list)

    _pw: Playwright | None = None
    _context: BrowserContext | None = None
    _page: Page | None = None
    _scale: float = 1.0
    _cursor: tuple[float, float] = (0.0, 0.0)

    # ── 시작/종료 ──────────────────────────────────────────
    async def start(self) -> None:
        self._pw = await async_playwright().start()
        if self.cdp_url:
            browser = await self._pw.chromium.connect_over_cdp(self.cdp_url)
            self._context = browser.contexts[0] if browser.contexts else await browser.new_context()
        else:
            kwargs = dict(
                headless=self.headless,
                viewport={"width": self.viewport[0], "height": self.viewport[1]},
                locale="ko-KR",
                timezone_id="Asia/Seoul",
                args=["--disable-features=Translate", "--lang=ko-KR"],
                accept_downloads=True,
            )
            self._context = await self._launch(kwargs)
        if self.show_cursor:
            await self._context.add_init_script(CURSOR_SCRIPT)
        self._context.on("page", self._on_new_page)
        for p in self._context.pages:
            self._wire_page(p)
            if self.show_cursor:
                try:
                    await p.evaluate(CURSOR_SCRIPT)
                except PlaywrightError:
                    pass
        self._page = self._context.pages[-1] if self._context.pages else await self._context.new_page()

    def _candidates(self) -> list[str | None]:
        if self.executable_path:
            return [None]
        ch = (self.channel or "auto").lower()
        if ch == "auto":
            return ["chrome", "msedge", None]
        if ch == "chromium":
            return [None]
        return [ch, None]

    async def _launch(self, kwargs: dict) -> BrowserContext:
        """크롬 → 엣지 → 내장 Chromium 순으로 실행. 브라우저마다 프로필 폴더를 따로 씁니다."""
        if self.executable_path:
            kwargs = {**kwargs, "executable_path": self.executable_path}
        errors = []
        for channel in self._candidates():
            name = channel or "chromium"
            try:
                ctx = await self._pw.chromium.launch_persistent_context(
                    str(Path(self.profile_dir) / name), channel=channel, **kwargs)
                self.channel_used = name
                if errors:
                    self.events.append(f"{name} 브라우저로 실행했습니다.")
                return ctx
            except PlaywrightError as exc:
                msg = str(exc)
                log.warning("%s 실행 실패: %s", name, msg.splitlines()[0] if msg else exc)
                if "ProcessSingleton" in msg or "user data directory is already in use" in msg:
                    raise RuntimeError("자동 작성용 브라우저 창이 이미 열려 있습니다. 그 창을 닫고 다시 시도해 주세요.") from exc
                errors.append(name)
        raise RuntimeError("크롬이나 엣지를 실행하지 못했습니다. Chrome 또는 Microsoft Edge가 설치되어 있는지 확인해 주세요.")

    async def close(self) -> None:
        try:
            if self._context and not self.cdp_url:
                await self._context.close()
        finally:
            if self._pw:
                await self._pw.stop()

    # ── 탭/창 관리 ─────────────────────────────────────────
    def _wire_page(self, page: Page) -> None:
        page.on("dialog", lambda d: asyncio.ensure_future(self._on_dialog(d)))
        page.on("close", lambda p: self._on_close(p))

    def _on_new_page(self, page: Page) -> None:
        self._wire_page(page)
        self._page = page
        self.events.append(f"새 창/탭이 열려 그 창으로 전환했습니다: {page.url}")

    def _on_close(self, page: Page) -> None:
        if page is self._page:
            remaining = [p for p in self._context.pages if not p.is_closed()] if self._context else []
            self._page = remaining[-1] if remaining else None
            self.events.append("현재 창이 닫혀 남은 창으로 전환했습니다.")

    async def _on_dialog(self, dialog: Dialog) -> None:
        msg = dialog.message.strip()
        if dialog.type in ("confirm", "beforeunload") and GUARD_DIALOG_PATTERN.search(msg) and not self.final_approved:
            await dialog.dismiss()
            self.events.append(f"[차단] 교사 승인 전이라 확인창을 취소했습니다: \"{msg}\"")
            return
        if dialog.type == "prompt":
            await dialog.accept(dialog.default_value)
        else:
            await dialog.accept()
        self.events.append(f"브라우저 {dialog.type} 창 \"{msg}\" → 확인 처리함")

    @property
    def page(self) -> Page:
        if self._page is None or self._page.is_closed():
            pages = [p for p in self._context.pages if not p.is_closed()] if self._context else []
            if not pages:
                raise RuntimeError("열려 있는 브라우저 창이 없습니다.")
            self._page = pages[-1]
        return self._page

    async def list_tabs(self) -> list[dict]:
        tabs = []
        for i, p in enumerate(p for p in self._context.pages if not p.is_closed()):
            try:
                title = await p.title()
            except PlaywrightError:
                title = ""
            tabs.append({"index": i, "title": title, "url": p.url, "active": p is self._page})
        return tabs

    async def switch_tab(self, index: int) -> None:
        pages = [p for p in self._context.pages if not p.is_closed()]
        self._page = pages[index]
        await self._page.bring_to_front()

    async def close_tab(self, index: int) -> None:
        pages = [p for p in self._context.pages if not p.is_closed()]
        await pages[index].close()

    def drain_events(self) -> list[str]:
        ev, self.events = self.events, []
        return ev

    async def goto(self, url: str) -> None:
        if not re.match(r"^https?://", url):
            raise ValueError("http(s) 주소만 열 수 있습니다.")
        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)

    # ── 화면 ───────────────────────────────────────────────
    async def _css_viewport(self) -> tuple[int, int]:
        vp = self.page.viewport_size
        if vp:
            return vp["width"], vp["height"]
        w, h = await self.page.evaluate("[window.innerWidth, window.innerHeight]")
        return int(w), int(h)

    async def screenshot(self) -> tuple[bytes, int, int]:
        """현재 창 스크린샷(PNG)과 그 크기. 큰 화면은 축소하고 좌표 배율을 기억합니다."""
        await self._cursor_visible(False)
        try:
            png = await self.page.screenshot(type="png", scale="css", timeout=15000)
        finally:
            await self._cursor_visible(True)
        img = Image.open(io.BytesIO(png))
        w, h = img.size
        css_w, _ = await self._css_viewport()
        scale = min(1.0, MAX_LONG_EDGE / max(w, h), math.sqrt(MAX_PIXELS / (w * h)))
        if scale < 1.0:
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            png = buf.getvalue()
        self._scale = img.size[0] / css_w if css_w else 1.0
        return png, img.size[0], img.size[1]

    async def zoom(self, region: list[float]) -> bytes:
        x0, y0, x1, y1 = [v / self._scale for v in region]
        clip = {"x": min(x0, x1), "y": min(y0, y1), "width": max(1, abs(x1 - x0)), "height": max(1, abs(y1 - y0))}
        await self._cursor_visible(False)
        try:
            png = await self.page.screenshot(type="png", clip=clip, scale="device", timeout=15000)
        finally:
            await self._cursor_visible(True)
        img = Image.open(io.BytesIO(png))
        factor = min(4.0, 1400 / max(img.size))
        if factor > 1.0:
            img = img.resize((int(img.size[0] * factor), int(img.size[1] * factor)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    async def _cursor_visible(self, visible: bool) -> None:
        if not self.show_cursor:
            return
        try:
            await self.page.evaluate("v => window.__claudeCursorVisible && window.__claudeCursorVisible(v)", visible)
        except PlaywrightError:
            pass

    async def _cursor_show(self, x: float, y: float, click: bool = False) -> None:
        if not self.show_cursor:
            return
        try:
            await self.page.evaluate("([x,y,c]) => window.__claudeCursor && window.__claudeCursor(x,y,c)", [x, y, click])
        except PlaywrightError:
            pass

    # ── 좌표 → 요소 판별 (iframe 안까지) ────────────────────
    async def target_at(self, x: float, y: float) -> ClickTarget:
        """스크린샷 좌표 (x, y)에 있는 요소의 글자를 iframe 안쪽까지 따라가며 읽습니다."""
        cx, cy = x / self._scale, y / self._scale
        frame: Frame = self.page.main_frame
        ox = oy = 0.0
        js = """([x, y]) => {
            const el = document.elementFromPoint(x, y);
            if (!el) return null;
            const isFrame = el.tagName === 'IFRAME' || el.tagName === 'FRAME';
            const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
            const own = clean(el.innerText || el.value || el.getAttribute('title') || el.getAttribute('alt'));
            const btn = el.closest('button, a, [role=button], input[type=button], input[type=submit], input[type=image]');
            const btext = btn ? clean(btn.innerText || btn.value || btn.getAttribute('title') || btn.getAttribute('alt')) : '';
            return {tag: el.tagName, isFrame, text: own.slice(0, 120), button: btext.slice(0, 120)};
        }"""
        for _ in range(6):
            try:
                info = await frame.evaluate(js, [cx - ox, cy - oy])
            except PlaywrightError:
                return ClickTarget(frame_url=frame.url)
            if not info:
                return ClickTarget(frame_url=frame.url)
            if not info["isFrame"]:
                return ClickTarget(info["tag"], info["text"], info["button"], frame.url)
            handle = await frame.evaluate_handle("([x, y]) => document.elementFromPoint(x, y)", [cx - ox, cy - oy])
            el = handle.as_element()
            child = await el.content_frame() if el else None
            box = await el.bounding_box() if el else None
            if not child or not box:
                return ClickTarget("IFRAME", frame_url=frame.url)
            frame, ox, oy = child, box["x"], box["y"]
        return ClickTarget(frame_url=frame.url)

    async def _guard(self, x: float, y: float) -> ClickTarget:
        target = await self.target_at(x, y)
        candidates = [target.button_text, target.text if len(target.text) <= 20 else ""]
        if not self.final_approved and any(GUARD_PATTERN.match(c.replace(" ", "")) for c in candidates if c):
            raise GuardBlocked(
                f"'{target.label()}' 버튼은 실제 결재 상신 버튼이라 교사 승인 없이는 누를 수 없습니다. "
                "request_final_approval 도구로 먼저 승인을 받으세요.")
        return target

    # ── 마우스 ─────────────────────────────────────────────
    async def _settle(self) -> None:
        await asyncio.sleep(0.35)
        try:
            await self.page.wait_for_load_state("domcontentloaded", timeout=5000)
        except PlaywrightError:
            pass

    async def click(self, x: float, y: float, button: str = "left", count: int = 1, modifiers: str = "") -> str:
        target = await self._guard(x, y)
        cx, cy = x / self._scale, y / self._scale
        mods = [to_playwright_key(m) for m in modifiers.split("+") if m] if modifiers else []
        await self._cursor_show(cx, cy)
        await self.page.mouse.move(cx, cy, steps=4)
        for m in mods:
            await self.page.keyboard.down(m)
        try:
            await self.page.mouse.click(cx, cy, button=button, click_count=count, delay=30)
        finally:
            for m in reversed(mods):
                await self.page.keyboard.up(m)
        self._cursor = (cx, cy)
        await self._cursor_show(cx, cy, click=True)
        await self._settle()
        return f"클릭함: '{target.label()}'" if target.label() else "클릭함"

    async def move(self, x: float, y: float) -> None:
        cx, cy = x / self._scale, y / self._scale
        await self.page.mouse.move(cx, cy, steps=4)
        self._cursor = (cx, cy)
        await self._cursor_show(cx, cy)

    async def drag(self, start: list[float], end: list[float]) -> None:
        await self.move(*start)
        await self.page.mouse.down()
        await self.move(*end)
        await self.page.mouse.up()
        await self._settle()

    async def mouse_down(self) -> None:
        await self.page.mouse.down()

    async def mouse_up(self) -> None:
        await self.page.mouse.up()
        await self._settle()

    def cursor_position(self) -> tuple[int, int]:
        return int(self._cursor[0] * self._scale), int(self._cursor[1] * self._scale)

    async def scroll(self, direction: str, amount: int, x: float | None = None, y: float | None = None) -> None:
        if x is not None and y is not None:
            await self.move(x, y)
        step = 120 * max(1, amount)
        dx, dy = {"up": (0, -step), "down": (0, step), "left": (-step, 0), "right": (step, 0)}[direction]
        await self.page.mouse.wheel(dx, dy)
        await asyncio.sleep(0.3)

    # ── 키보드 ─────────────────────────────────────────────
    async def type_text(self, text: str) -> None:
        """한글은 insert_text(IME 우회), 영문·숫자는 실제 키 입력으로 넣습니다."""
        kb = self.page.keyboard
        for i, line in enumerate(text.split("\n")):
            if i:
                await kb.press("Enter")
            if not line:
                continue
            if line.isascii():
                await kb.type(line, delay=15)
            else:
                await kb.insert_text(line)
        await asyncio.sleep(0.15)

    async def focused_label(self) -> str:
        """키보드 포커스가 있는 요소의 글자 (iframe 안쪽까지)."""
        frame: Frame = self.page.main_frame
        for _ in range(6):
            try:
                info = await frame.evaluate("""() => {
                    const el = document.activeElement;
                    if (!el) return null;
                    const isFrame = el.tagName === 'IFRAME' || el.tagName === 'FRAME';
                    const t = (el.innerText || el.value || el.getAttribute('title') || '').replace(/\\s+/g, '');
                    return {isFrame, text: t.slice(0, 40)};
                }""")
            except PlaywrightError:
                return ""
            if not info:
                return ""
            if not info["isFrame"]:
                return info["text"]
            handle = await frame.evaluate_handle("() => document.activeElement")
            el = handle.as_element()
            child = await el.content_frame() if el else None
            if not child:
                return ""
            frame = child
        return ""

    async def key(self, combo: str, repeat: int = 1) -> None:
        if not self.final_approved and re.search(r"(?i)\b(return|enter|kp_enter|space)\b", combo):
            label = await self.focused_label()
            if label and GUARD_PATTERN.match(label):
                raise GuardBlocked(
                    f"포커스가 '{label}' 버튼에 있어 Enter/Space를 누를 수 없습니다. "
                    "request_final_approval 도구로 먼저 교사 승인을 받으세요.")
        for _ in range(max(1, repeat)):
            for part in combo.split():
                await self.page.keyboard.press(to_playwright_key(part))
        await self._settle()

    async def hold_key(self, combo: str, duration: float) -> None:
        keys = [to_playwright_key(k) for k in combo.split("+")]
        for k in keys:
            await self.page.keyboard.down(k)
        await asyncio.sleep(min(duration, 30))
        for k in reversed(keys):
            await self.page.keyboard.up(k)
