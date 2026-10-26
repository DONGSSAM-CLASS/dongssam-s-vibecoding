"""영상 한 편 = 프로젝트 폴더 하나. 편집에 필요한 파일을 모두 만들어 줍니다."""

from __future__ import annotations

import io
import json
import re
import zipfile
from datetime import datetime
from pathlib import Path

from . import rights, subtitles
from .config import projects_dir
from .models import Candidate, VideoPlan


def slug(text: str) -> str:
    s = re.sub(r"[^\w가-힣-]+", "_", text).strip("_")
    return s[:40] or "project"


def full_description(c: Candidate, plan: VideoPlan) -> str:
    chapters = plan.chapters or subtitles.chapters_from_plan(plan)
    tags = " ".join("#" + t.replace(" ", "") for t in plan.tags[:5])
    return "\n\n".join(x for x in [
        rights.attribution(c),
        plan.description.strip(),
        "\n".join(chapters),
        tags,
    ] if x)


def script_markdown(c: Candidate, plan: VideoPlan) -> str:
    md = [f"# {plan.titles[0]}", "",
          f"- 소재: {c.title} (직접 촬영)" if c.rights == "own" else f"- 소재: [{c.title}]({c.url}) — {c.channel}",
          f"- 권리: {rights.verdict(c)}",
          f"- 내레이션 {plan.narration_chars():,}자 · 예상 길이 약 {plan.estimated_minutes()}분", "",
          "## 제목 후보", *[f"{i}. {t}" for i, t in enumerate(plan.titles, 1)], "",
          "## 썸네일 문구", *[f"- {t.replace(chr(10), ' / ')}" for t in plan.thumbnail_texts], "",
          "## 오프닝(첫 15초)", plan.hook, ""]
    for i, s in enumerate(plan.segments, 1):
        rng = f"원본 {s.source_start}~{s.source_end}" if s.source_start else "직접 촬영/스톡"
        md += [f"### {i}. {s.caption or s.scene[:30]}  `{rng}`", f"> 화면: {s.scene}", "", s.narration, ""]
    md += ["## 마무리", plan.closing, ""]
    if plan.comparison_points:
        md += ["## 한국 vs 해외 비교 포인트", *[f"- {p}" for p in plan.comparison_points], ""]
    if plan.fact_checks:
        md += ["## 올리기 전 사실 확인", *[f"- [ ] {p}" for p in plan.fact_checks], ""]
    md += ["## 업로드 전 권리 체크리스트", *[f"- [ ] {p}" for p in rights.CHECKLIST], ""]
    return "\n".join(md)


def build_files(c: Candidate, plan: VideoPlan, thumbnail_png: bytes | None = None) -> dict[str, bytes]:
    files = {
        "script.md": script_markdown(c, plan),
        "narration_tts.txt": subtitles.tts_script(plan),
        "subtitles_ko.srt": subtitles.to_srt(plan),
        "description.txt": full_description(c, plan),
        "tags.txt": ", ".join(plan.tags),
        "plan.json": json.dumps({"candidate": c.model_dump(), "plan": plan.model_dump()}, ensure_ascii=False, indent=2),
    }
    if c.rights == "permission_needed":
        files["permission_email.txt"] = rights.permission_email(c)
    out = {k: v.encode("utf-8") for k, v in files.items()}
    if thumbnail_png:
        out["thumbnail.png"] = thumbnail_png
    return out


def save(c: Candidate, plan: VideoPlan, thumbnail_png: bytes | None = None, root: Path | None = None) -> Path:
    folder = (root or projects_dir()) / f"{datetime.now():%Y%m%d-%H%M}_{slug(plan.titles[0])}"
    folder.mkdir(parents=True, exist_ok=True)
    for name, data in build_files(c, plan, thumbnail_png).items():
        (folder / name).write_bytes(data)
    return folder


def to_zip(c: Candidate, plan: VideoPlan, thumbnail_png: bytes | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in build_files(c, plan, thumbnail_png).items():
            z.writestr(name, data)
    return buf.getvalue()
