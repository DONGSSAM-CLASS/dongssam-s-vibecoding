"""YouTube Data API v3 (공식 API, 무료 하루 10,000 단위)로 소재 영상을 찾습니다.

검색 1회 = 100단위, 영상·채널 상세 조회 = 1단위. 키워드 10개를 검색해도 하루 할당량의 10% 정도입니다.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable

from .models import Candidate
from .scoring import score_candidate

API = "https://www.googleapis.com/youtube/v3"

# 영상에서 소개한 방식: "Korea trip", "Seoul trip"처럼 영어로 찾고, 독일어·그리스어 등 다른 언어로 넓히기
KEYWORDS: dict[str, list[str]] = {
    "en": ["Korea trip", "Seoul trip", "Busan trip", "Jeju island vlog", "first time in Korea", "Korea travel vlog"],
    "de": ["Korea Reise", "Seoul Reise", "Südkorea Vlog"],
    "el": ["ταξίδι Κορέα", "Σεούλ ταξίδι"],
    "fr": ["voyage en Corée", "Séoul vlog"],
    "es": ["viaje a Corea", "Seúl vlog"],
    "pt": ["viagem Coreia do Sul", "Seul vlog"],
    "it": ["viaggio in Corea", "Seoul vlog italiano"],
    "nl": ["reis Zuid-Korea"],
    "pl": ["podróż do Korei"],
    "ru": ["поездка в Корею", "Сеул влог"],
    "tr": ["Kore gezisi", "Seul vlog"],
    "ja": ["韓国旅行 vlog", "ソウル旅行"],
    "vi": ["du lịch Hàn Quốc"],
    "th": ["เที่ยวเกาหลี"],
    "id": ["liburan ke Korea"],
}
LANG_NAMES = {
    "en": "영어", "de": "독일어", "el": "그리스어", "fr": "프랑스어", "es": "스페인어", "pt": "포르투갈어",
    "it": "이탈리아어", "nl": "네덜란드어", "pl": "폴란드어", "ru": "러시아어", "tr": "튀르키예어",
    "ja": "일본어", "vi": "베트남어", "th": "태국어", "id": "인도네시아어",
}

Opener = Callable[[str], dict]


class YouTubeError(RuntimeError):
    pass


def parse_duration(iso: str) -> int:
    """'PT1H2M3S' → 3723초."""
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _http_get(url: str) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        try:
            err = json.loads(exc.read().decode())["error"]
            reason = (err.get("errors") or [{}])[0].get("reason", "")
            message = err.get("message", "")
        except (ValueError, KeyError):
            reason, message = "", str(exc)
        if reason in ("quotaExceeded", "dailyLimitExceeded"):
            raise YouTubeError("오늘의 YouTube API 무료 할당량을 다 썼습니다. 내일(태평양 시간 자정 이후) 다시 시도해 주세요.") from exc
        if exc.code in (400, 403) and ("API key" in message or reason in ("keyInvalid", "forbidden", "accessNotConfigured")):
            raise YouTubeError("YouTube API 키가 올바르지 않거나 'YouTube Data API v3'가 사용 설정되지 않았습니다. 사용설명서의 키 발급 단계를 확인해 주세요.") from exc
        raise YouTubeError(f"YouTube API 오류 {exc.code}: {message}") from exc
    except urllib.error.URLError as exc:
        raise YouTubeError(f"YouTube API에 연결하지 못했습니다: {exc.reason}") from exc


class YouTubeClient:
    def __init__(self, api_key: str, opener: Opener | None = None) -> None:
        if not api_key:
            raise YouTubeError("YOUTUBE_API_KEY가 없습니다. 사용설명서의 'YouTube API 키 받기'를 따라 발급해 주세요.")
        self.api_key = api_key
        self.opener = opener or _http_get

    def _get(self, path: str, **params: str | int) -> dict:
        query = urllib.parse.urlencode({**{k: v for k, v in params.items() if v not in ("", None)}, "key": self.api_key})
        return self.opener(f"{API}/{path}?{query}")

    def search(self, keyword: str, *, cc_only: bool = False, max_results: int = 25, order: str = "viewCount",
               published_after: str = "", region: str = "", language: str = "") -> list[str]:
        """키워드로 8분 이상(medium=4~20분, long=20분+) 영상을 찾아 영상 ID 목록을 돌려줍니다."""
        ids: list[str] = []
        for duration in ("medium", "long"):
            data = self._get(
                "search", part="id", type="video", q=keyword, maxResults=min(50, max_results), order=order,
                videoDuration=duration, videoLicense="creativeCommon" if cc_only else "",
                publishedAfter=published_after, regionCode=region, relevanceLanguage=language,
            )
            ids += [it["id"]["videoId"] for it in data.get("items", []) if it.get("id", {}).get("videoId")]
        return list(dict.fromkeys(ids))

    def videos(self, ids: Iterable[str]) -> list[dict]:
        out: list[dict] = []
        ids = list(ids)
        for i in range(0, len(ids), 50):
            data = self._get("videos", part="snippet,contentDetails,statistics,status", id=",".join(ids[i:i + 50]))
            out += data.get("items", [])
        return out

    def subscribers(self, channel_ids: Iterable[str]) -> dict[str, int]:
        out: dict[str, int] = {}
        ids = list(dict.fromkeys(channel_ids))
        for i in range(0, len(ids), 50):
            data = self._get("channels", part="statistics", id=",".join(ids[i:i + 50]))
            for it in data.get("items", []):
                st = it.get("statistics", {})
                out[it["id"]] = 0 if st.get("hiddenSubscriberCount") else int(st.get("subscriberCount", 0))
        return out

    def find(self, keywords: Iterable[str], *, cc_only: bool = False, min_minutes: int = 8,
             per_keyword: int = 25, published_after: str = "") -> list[Candidate]:
        """여러 키워드를 검색해 중복을 없애고 3-3-3 점수 순으로 정렬합니다."""
        found: dict[str, str] = {}
        for kw in keywords:
            for vid in self.search(kw, cc_only=cc_only, max_results=per_keyword, published_after=published_after):
                found.setdefault(vid, kw)
        if not found:
            return []
        items = self.videos(found)
        subs = self.subscribers(it["snippet"]["channelId"] for it in items)
        cands = []
        for it in items:
            c = to_candidate(it, subs, found.get(it["id"], ""))
            if c.duration_sec >= min_minutes * 60:
                cands.append(score_candidate(c))
        return sorted(cands, key=lambda c: c.score, reverse=True)


def to_candidate(item: dict, subs: dict[str, int], keyword: str = "") -> Candidate:
    sn, st = item.get("snippet", {}), item.get("statistics", {})
    thumbs = sn.get("thumbnails", {})
    thumb = next((thumbs[k]["url"] for k in ("maxres", "high", "medium", "default") if k in thumbs), "")
    return Candidate(
        video_id=item["id"],
        title=sn.get("title", ""),
        channel=sn.get("channelTitle", ""),
        channel_id=sn.get("channelId", ""),
        published_at=sn.get("publishedAt", "")[:10],
        description=sn.get("description", ""),
        tags=sn.get("tags", [])[:30],
        language=sn.get("defaultAudioLanguage") or sn.get("defaultLanguage") or "",
        duration_sec=parse_duration(item.get("contentDetails", {}).get("duration", "")),
        views=int(st.get("viewCount", 0)),
        likes=int(st.get("likeCount", 0)),
        comments=int(st.get("commentCount", 0)),
        subscribers=subs.get(sn.get("channelId", ""), 0),
        license=item.get("status", {}).get("license", "youtube"),
        thumbnail=thumb,
        keyword=keyword,
    )
