"""1280×720 유튜브 썸네일: 배경 사진 + 굵은 두 줄 문구(둘째 줄 강조색) + 선택 배지."""

from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1280, 720
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\malgunbd.ttf",
    r"C:\Windows\Fonts\malgun.ttf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "/Library/Fonts/NanumGothicExtraBold.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/nanum/NanumGothicExtraBold.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]
THEMES = {
    "yellow": ("#FFFFFF", "#FFE14D"),
    "red": ("#FFFFFF", "#FF4D4D"),
    "sky": ("#FFFFFF", "#5CE1FF"),
}


def find_font(preferred: str = "") -> str | None:
    for p in [preferred, *FONT_CANDIDATES]:
        if p and Path(p).exists():
            return p
    return None


def _font(path: str | None, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if path:
        return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def _cover(img: Image.Image) -> Image.Image:
    """배경을 16:9로 가운데 잘라 꽉 채웁니다."""
    img = img.convert("RGB")
    scale = max(W / img.width, H / img.height)
    img = img.resize((max(W, round(img.width * scale)), max(H, round(img.height * scale))), Image.LANCZOS)
    left, top = (img.width - W) // 2, (img.height - H) // 2
    return img.crop((left, top, left + W, top + H))


def _gradient() -> Image.Image:
    img = Image.new("RGB", (W, H), "#1B2A4A")
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(27 + 40 * t), int(42 + 20 * t), int(74 + 60 * t)))
    return img


def render(text: str, background: bytes | None = None, *, badge: str = "", theme: str = "yellow",
           font_path: str = "") -> bytes:
    """text의 줄바꿈(\\n)으로 두 줄을 나눕니다. 결과는 PNG 바이트."""
    base = _cover(Image.open(io.BytesIO(background))) if background else _gradient()

    # 글자가 잘 보이도록 아래쪽을 어둡게
    shade = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(shade)
    for y in range(H):
        sd.line([(0, y), (W, y)], fill=int(200 * max(0.0, (y - H * 0.35) / (H * 0.65))))
    base = Image.composite(Image.new("RGB", (W, H), "black"), base, shade.filter(ImageFilter.GaussianBlur(8)))

    draw = ImageDraw.Draw(base)
    path = find_font(font_path)
    main, accent = THEMES.get(theme, THEMES["yellow"])
    lines = [ln.strip() for ln in text.replace("\\n", "\n").split("\n") if ln.strip()][:3] or [" "]

    y = H - 40
    for idx, line in reversed(list(enumerate(lines))):
        size = 150
        while size > 40:
            f = _font(path, size)
            box = draw.textbbox((0, 0), line, font=f, stroke_width=size // 12)
            if box[2] - box[0] <= W - 100:
                break
            size -= 6
        f = _font(path, size)
        box = draw.textbbox((0, 0), line, font=f, stroke_width=size // 12)
        y -= box[3] - box[1] + 10
        color = accent if idx == len(lines) - 1 and len(lines) > 1 else main
        draw.text((50 - box[0], y - box[1]), line, font=f, fill=color, stroke_width=size // 12, stroke_fill="black")

    if badge:
        f = _font(path, 52)
        box = draw.textbbox((0, 0), badge, font=f)
        bw, bh = box[2] - box[0] + 48, box[3] - box[1] + 28
        draw.rounded_rectangle([40, 40, 40 + bw, 40 + bh], radius=18, fill="#E53935")
        draw.text((64 - box[0], 54 - box[1]), badge, font=f, fill="white")

    out = io.BytesIO()
    base.save(out, "PNG", optimize=True)
    return out.getvalue()


def font_warning() -> str:
    if find_font():
        return ""
    hint = "맑은 고딕" if sys.platform == "win32" else "Noto Sans CJK 또는 나눔고딕"
    return f"한글 글꼴을 찾지 못해 기본 글꼴로 그립니다(한글이 네모로 보일 수 있음). {hint}을 설치하거나 KCONTENT_FONT에 글꼴 경로를 지정하세요."
