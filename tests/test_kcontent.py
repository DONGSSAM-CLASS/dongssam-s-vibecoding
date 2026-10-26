"""K-콘텐츠 스튜디오: API 키 없이 가짜 응답으로 전체 흐름을 검증합니다."""

from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import tempfile
import urllib.parse
import zipfile

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient
from PIL import Image

os.environ.setdefault("KCONTENT_DATA_DIR", tempfile.mkdtemp(prefix="kcontent-test-"))
os.environ.pop("YOUTUBE_API_KEY", None)

from kcontent import project, rights, subtitles, thumbnail  # noqa: E402
from kcontent.config import Settings  # noqa: E402
from kcontent.models import Candidate, Segment, VideoPlan  # noqa: E402
from kcontent.planner import make_plan  # noqa: E402
from kcontent.scoring import find_places, score_candidate  # noqa: E402
from kcontent.youtube import YouTubeClient, YouTubeError, parse_duration  # noqa: E402


def _cand(**kw) -> Candidate:
    base = dict(video_id="abcdefghijk", title="My first time in Seoul and Busan! Korea travel vlog", channel="Anna Travels",
                channel_id="UC123", duration_sec=14 * 60, views=250_000, subscribers=12_000, license="creativeCommon",
                description="We visited Gyeongbokgung, Myeongdong and Haeundae beach.")
    return Candidate(**{**base, **kw})


def _plan() -> VideoPlan:
    segs = [Segment(source_start=f"0{i}:00", source_end=f"0{i}:50", scene=f"장면 {i}",
                    narration="한국에 처음 온 안나는 지하철역에서 깜짝 놀랍니다. 왜 그랬을까요? " * 9, caption=f"놀란 이유 {i}")
            for i in range(8)]
    return VideoPlan(
        titles=["외국인이 서울 지하철에서 놀란 이유", "한국 지하철, 유럽과 이렇게 달랐다", "처음 온 한국, 첫날부터 감동"],
        thumbnail_texts=["외국인이 놀란\n서울 지하철", "이게 한국\n지하철?"],
        hook="외국인이 한국에 오자마자 가장 먼저 놀라는 건 뭘까요?",
        segments=segs,
        closing="다음 여행지에서 안나는 또 무엇을 보게 될까요?",
        comparison_points=["서울 지하철은 스크린도어가 대부분 역에 설치돼 있다"],
        description="\n외국인 여행자 안나의 첫 서울 여행기입니다.",
        tags=["한국여행", "외국인반응", "서울"],
        fact_checks=["스크린도어 설치 비율 확인"],
    )


# ── 단위 ─────────────────────────────────────────────────────
def test_parse_duration():
    assert parse_duration("PT1H2M3S") == 3723
    assert parse_duration("PT8M") == 480
    assert parse_duration("PT45S") == 45
    assert parse_duration("P1DT1M") == 86460
    assert parse_duration("") == 0


def test_scoring_333():
    c = score_candidate(_cand())
    assert c.has_person
    assert {"서울", "부산", "경복궁", "명동", "해운대"} <= set(c.places)
    assert c.score >= 85
    std = score_candidate(_cand(license="youtube"))
    assert std.rights == "permission_needed" and std.score == c.score - 15
    short = score_candidate(_cand(duration_sec=4 * 60))
    assert short.score < c.score
    assert any("8분 미만" in n for n in short.score_notes)
    assert find_places("ταξίδι στη Σεούλ") == ["서울"]


def test_rights_and_email():
    std = _cand(license="youtube")
    assert "허락 필요" in rights.verdict(std)
    mail = rights.permission_email(std, "동쌤TV", "Kim")
    assert std.url in mail and "Anna Travels" in mail and "동쌤TV" in mail
    assert "CC BY" in rights.attribution(_cand())
    assert rights.attribution(_cand(license="own")) == ""


def test_subtitles():
    p = _plan()
    for line in subtitles.split_lines(p.segments[0].narration):
        assert len(line) <= subtitles.MAX_LINE + 6
    srt = subtitles.to_srt(p)
    blocks = srt.strip().split("\n\n")
    assert blocks[0].startswith("1\n00:00:00,000 --> ")
    times = [b.split("\n")[1].split(" --> ")[0] for b in blocks]
    assert times == sorted(times)
    assert p.estimated_minutes() >= 8
    assert subtitles.chapters_from_plan(p)[0] == "00:00 시작"
    assert "구독" not in subtitles.tts_script(p)


def test_thumbnail_render():
    bg = io.BytesIO()
    Image.new("RGB", (640, 480), "#3366aa").save(bg, "JPEG")
    png = thumbnail.render("외국인이 놀란\n한국 편의점", bg.getvalue(), badge="반응", theme="red")
    img = Image.open(io.BytesIO(png))
    assert img.size == (1280, 720) and img.format == "PNG"
    assert Image.open(io.BytesIO(thumbnail.render("Only text"))).size == (1280, 720)


def test_project_files_and_zip(tmp_path):
    c, p = _cand(license="youtube"), _plan()
    files = project.build_files(c, p, b"PNG")
    assert {"script.md", "narration_tts.txt", "subtitles_ko.srt", "description.txt", "permission_email.txt", "thumbnail.png"} <= set(files)
    desc = files["description.txt"].decode()
    assert desc.startswith("🎬 원본 영상") and c.url in desc and "#한국여행" in desc
    assert "permission_email.txt" not in project.build_files(_cand(), p)
    folder = project.save(c, p, root=tmp_path)
    assert (folder / "script.md").read_text(encoding="utf-8").startswith("# 외국인이 서울 지하철에서 놀란 이유")
    with zipfile.ZipFile(io.BytesIO(project.to_zip(c, p))) as z:
        assert "subtitles_ko.srt" in z.namelist()


# ── YouTube API (가짜 응답) ─────────────────────────────────
def _fake_youtube(calls: list[dict]):
    videos = {
        "vid_long_cc": ("PT12M30S", "creativeCommon", "Our first time in Seoul vlog", "UCa", 900_000),
        "vid_short__": ("PT5M", "creativeCommon", "Busan in 5 minutes", "UCa", 50_000),
        "vid_long_st": ("PT25M", "youtube", "Jeju island road trip", "UCb", 30_000),
    }

    def opener(url: str) -> dict:
        parsed = urllib.parse.urlparse(url)
        q = dict(urllib.parse.parse_qsl(parsed.query))
        path = parsed.path.rsplit("/", 1)[-1]
        calls.append({"path": path, **q})
        assert q["key"] == "test-key"
        if path == "search":
            return {"items": [{"id": {"videoId": v}} for v in videos]}
        if path == "videos":
            return {"items": [{
                "id": v, "snippet": {"title": t, "channelTitle": "ch", "channelId": ch, "publishedAt": "2026-05-01T00:00:00Z",
                                     "description": "", "thumbnails": {"high": {"url": f"https://i.ytimg.com/vi/{v}/hq.jpg"}}},
                "contentDetails": {"duration": d}, "statistics": {"viewCount": str(views)}, "status": {"license": lic},
            } for v, (d, lic, t, ch, views) in videos.items() if v in q["id"].split(",")]}
        if path == "channels":
            return {"items": [{"id": "UCa", "statistics": {"subscriberCount": "10000"}},
                              {"id": "UCb", "statistics": {"hiddenSubscriberCount": True}}]}
        raise AssertionError(path)

    return opener


def test_youtube_find():
    calls: list[dict] = []
    yt = YouTubeClient("test-key", opener=_fake_youtube(calls))
    found = yt.find(["Seoul trip", "Korea Reise"], cc_only=True)
    assert [c.video_id for c in found] == ["vid_long_cc", "vid_long_st"]      # 5분짜리는 제외, 점수순
    assert found[0].keyword == "Seoul trip" and found[0].rights == "cc_by"
    assert found[1].subscribers == 0
    searches = [c for c in calls if c["path"] == "search"]
    assert len(searches) == 4                                                  # 키워드 2 × (medium, long)
    assert all(c["videoLicense"] == "creativeCommon" and c["type"] == "video" for c in searches)
    assert {c["videoDuration"] for c in searches} == {"medium", "long"}


def test_youtube_requires_key():
    with pytest.raises(YouTubeError, match="YOUTUBE_API_KEY"):
        YouTubeClient("")


# ── Claude 요청 (가짜 HTTP) ─────────────────────────────────
def test_planner_request_and_parse():
    captured = {}

    def handler(request: httpx2.Request) -> httpx2.Response:
        captured["body"] = json.loads(request.content)
        captured["beta"] = request.headers.get("anthropic-beta", "")
        return httpx2.Response(200, json={
            "id": "msg_test", "type": "message", "role": "assistant", "model": "claude-opus-5-5",
            "content": [{"type": "text", "text": _plan().model_dump_json()}],
            "stop_reason": "end_turn", "stop_sequence": None, "usage": {"input_tokens": 10, "output_tokens": 10},
        })

    client = anthropic.AsyncAnthropic(api_key="test", http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)))
    plan = asyncio.run(make_plan(score_candidate(_cand()), Settings(anthropic_api_key="test"),
                                 transcript="Wow, the subway is so clean!", client=client))
    assert plan.titles[0].startswith("외국인이")
    body = captured["body"]
    assert body["model"] == "claude-opus-5-5"
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert body["output_config"]["effort"] == "medium"
    assert body["thinking"] == {"type": "adaptive"}
    assert body["fallbacks"] == "default" and "server-side-fallback-2026-07-01" in captured["beta"]
    prompt = body["messages"][0]["content"]
    assert "Wow, the subway is so clean!" in prompt and "서울" in prompt
    assert "구독" in body["system"]                       # 구독 요청 금지 규칙이 들어갔는지


# ── 로컬 서버 ────────────────────────────────────────────────
@pytest.fixture()
def api():
    from kcontent.server import app, state

    state.set_port(8790)
    client = TestClient(app, base_url="http://127.0.0.1:8790")
    client.headers["X-KC-Token"] = state.token
    return client


def test_server_guard(api):
    from kcontent.server import app

    assert api.get("/").status_code == 200
    assert TestClient(app, base_url="http://127.0.0.1:8790").get("/api/config").status_code == 403
    assert TestClient(app, base_url="http://evil.example").get("/").status_code == 403


def test_server_flow(api):
    cfg = api.get("/api/config").json()
    assert cfg["has_youtube_key"] is False and "en" in cfg["keywords"]

    r = api.post("/api/search", json={"keywords": ["Seoul trip"]})
    assert r.status_code == 400 and "YOUTUBE_API_KEY" in r.json()["detail"]

    cand = api.post("/api/manual", json={"title": "부산 해운대 외국인 친구와 하루", "duration_min": 12}).json()
    assert cand["rights"] == "own" and "부산" in cand["places"]

    t = api.post("/api/thumbnail", json={"text": "부산에서\n생긴 일", "badge": "브이로그"}).json()
    assert Image.open(io.BytesIO(base64.b64decode(t["png"]))).size == (1280, 720)
    assert api.post("/api/thumbnail", json={"text": "x", "background_url": "http://127.0.0.1/secret"}).status_code == 400

    body = {"candidate": cand, "plan": _plan().model_dump(), "thumbnail_b64": t["png"]}
    z = api.post("/api/export.zip", json=body)
    assert z.status_code == 200
    with zipfile.ZipFile(io.BytesIO(z.content)) as f:
        assert "thumbnail.png" in f.namelist() and "permission_email.txt" not in f.namelist()
    saved = api.post("/api/export", json=body).json()
    assert "script.md" in saved["files"]
