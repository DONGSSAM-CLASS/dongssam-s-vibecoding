"""유튜브 영상 → 분석용 마크다운(analysis.md).

yt-dlp로 메타데이터와 자막만 받습니다(영상 파일은 내려받지 않음).
유튜브에 접속할 수 없으면 --transcript-file 로 받은 자막/대본 파일을 같은 형식으로 정리합니다.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

LANG_ORDER = ("ko", "ko-KR", "en", "en-US")
_TIME = re.compile(r"(\d{1,2}:)?(\d{1,2}):(\d{2})[.,](\d{3})\s*-->")
_TAG = re.compile(r"<[^>]+>")


def fmt_time(sec: float) -> str:
    sec = int(sec)
    h, rest = divmod(sec, 3600)
    m, s = divmod(rest, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def parse_subtitles(text: str) -> list[tuple[float, str]]:
    """VTT/SRT → [(시작초, 문장)]. 자동 자막의 겹치는 줄은 한 번만 남깁니다."""
    lines: list[tuple[float, str]] = []
    start: float | None = None
    seen: set[str] = set()
    for raw in text.splitlines():
        m = _TIME.search(raw)
        if m:
            h = int((m.group(1) or "0:")[:-1])
            start = h * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            continue
        line = _TAG.sub("", raw).strip()
        if not line or start is None or line.isdigit() or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")):
            continue
        if line in seen:
            continue
        seen.add(line)
        lines.append((start, line))
    return lines


def plain_transcript(text: str) -> list[tuple[float, str]]:
    """타임스탬프 없는 대본(.txt)은 줄 단위로 그대로 씁니다."""
    return [(-1.0, ln.strip()) for ln in text.splitlines() if ln.strip()]


def group_lines(lines: list[tuple[float, str]], every: int = 30) -> list[str]:
    """자막 조각을 30초 단위 문단으로 묶어 읽기 쉽게 만듭니다."""
    if lines and lines[0][0] < 0:
        return [t for _, t in lines]
    out: list[str] = []
    bucket: list[str] = []
    bucket_start = 0.0
    for start, text in lines:
        if bucket and start - bucket_start >= every:
            out.append(f"[{fmt_time(bucket_start)}] " + " ".join(bucket))
            bucket = []
        if not bucket:
            bucket_start = start
        bucket.append(text)
    if bucket:
        out.append(f"[{fmt_time(bucket_start)}] " + " ".join(bucket))
    return out


def render(info: dict, lines: list[tuple[float, str]], sub_note: str) -> str:
    md = [f"# {info.get('title') or '(제목 없음)'}", ""]
    meta = [
        ("채널", info.get("channel") or info.get("uploader")),
        ("URL", info.get("webpage_url")),
        ("길이", fmt_time(info["duration"]) if info.get("duration") else None),
        ("게시일", info.get("upload_date")),
        ("조회수", f"{info['view_count']:,}" if info.get("view_count") else None),
        ("자막", sub_note),
    ]
    md += [f"- **{k}**: {v}" for k, v in meta if v]
    if info.get("tags"):
        md.append("- **태그**: " + ", ".join(info["tags"][:30]))
    if info.get("chapters"):
        md += ["", "## 챕터", ""]
        md += [f"- [{fmt_time(c['start_time'])}] {c.get('title', '')}" for c in info["chapters"]]
    if info.get("description"):
        md += ["", "## 설명란", "", info["description"].strip()]
    md += ["", "## 자막", ""]
    md += group_lines(lines) or ["(자막 없음 — 설명란과 챕터만으로 분석하거나, 사용자에게 대본을 요청하세요.)"]
    return "\n".join(md) + "\n"


def pick_subtitle(folder: Path, vid: str) -> tuple[Path | None, str]:
    files = sorted(folder.glob(f"{vid}.*.vtt"))
    for lang in LANG_ORDER:
        for f in files:
            if f.name == f"{vid}.{lang}.vtt":
                return f, f"{lang}"
    if files:
        return files[0], files[0].suffixes[-2].lstrip(".")
    return None, "없음"


def from_youtube(url: str, out: Path) -> Path:
    try:
        import yt_dlp
    except ImportError:
        sys.exit("yt-dlp가 없습니다: pip install -r .claude/skills/youtube-analyzer/requirements.txt")

    probe_opts = {"quiet": True, "no_warnings": True, "skip_download": True}
    try:
        with yt_dlp.YoutubeDL(probe_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        msg = str(exc)
        if "403" in msg or "proxy" in msg.lower():
            sys.exit(
                "유튜브에 접속하지 못했습니다(네트워크 정책 차단으로 보임).\n"
                "환경 설정의 Network access에 www.youtube.com, youtube.com, i.ytimg.com 을 허용하거나,\n"
                "--transcript-file 로 자막/대본 파일을 넣어 주세요.\n\n원본 오류: " + msg
            )
        if "not a bot" in msg:
            sys.exit(
                "유튜브가 이 컴퓨터(클라우드 서버 IP)를 봇으로 의심해 막았습니다.\n"
                "선생님 PC에서 이 스크립트를 실행해 나온 analysis.md를 올리거나,\n"
                "영상의 [더보기 → 스크립트 표시] 내용을 붙여 넣어 --transcript-file 로 넣어 주세요.\n\n원본 오류: " + msg
            )
        sys.exit(f"영상 정보를 가져오지 못했습니다: {msg}")

    vid = info["id"]
    folder = out / vid
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "info.json").write_text(
        json.dumps(yt_dlp.YoutubeDL.sanitize_info(info), ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 사람이 단 자막을 먼저, 없을 때만 자동 자막
    manual = set(info.get("subtitles") or {})
    langs = [lg for lg in LANG_ORDER if lg in manual]
    sub_opts = {
        **probe_opts,
        "writesubtitles": True,
        "writeautomaticsub": not langs,
        "subtitleslangs": langs or ["ko", "en"],
        "subtitlesformat": "vtt",
        "outtmpl": str(folder / "%(id)s.%(ext)s"),
    }
    with yt_dlp.YoutubeDL(sub_opts) as ydl:
        ydl.process_ie_result(info, download=True)

    sub, lang = pick_subtitle(folder, vid)
    lines = parse_subtitles(sub.read_text(encoding="utf-8")) if sub else []
    note = f"{lang} ({'수동' if langs else '자동 생성'})" if sub else "없음"
    path = folder / "analysis.md"
    path.write_text(render(info, lines, note), encoding="utf-8")
    return path


def from_file(src: Path, title: str, out: Path) -> Path:
    text = src.read_text(encoding="utf-8", errors="replace")
    lines = parse_subtitles(text) if src.suffix.lower() in (".vtt", ".srt") else plain_transcript(text)
    folder = out / "local"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "analysis.md"
    path.write_text(render({"title": title}, lines, f"파일 {src.name}"), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="유튜브 영상 → 분석용 마크다운")
    ap.add_argument("url", nargs="?", help="유튜브 영상 주소")
    ap.add_argument("--out", type=Path, default=Path("yt"), help="결과 폴더")
    ap.add_argument("--transcript-file", type=Path, help="유튜브 대신 쓸 자막/대본 파일(.vtt/.srt/.txt)")
    ap.add_argument("--title", default="(제목 미상)", help="--transcript-file 사용 시 영상 제목")
    args = ap.parse_args(argv)
    if args.transcript_file:
        path = from_file(args.transcript_file, args.title, args.out)
    elif args.url:
        path = from_youtube(args.url, args.out)
    else:
        ap.error("영상 주소 또는 --transcript-file 이 필요합니다.")
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
