"""영상에서 소개한 3-3-3 규칙(인물 · 장소 · 8분 이상)으로 소재 점수를 매깁니다.

100점 만점: 인물 20 + 장소 20 + 길이 20 + 반응(구독자 대비 조회수) 25 + 재사용 가능 라이선스 15
"""

from __future__ import annotations

import math
import re

from .models import Candidate

# 영어/현지어 표기 → 한국어 이름. 제목·설명·태그에서 찾습니다.
PLACES: dict[str, str] = {
    "seoul": "서울", "busan": "부산", "pusan": "부산", "jeju": "제주", "gyeongju": "경주", "incheon": "인천",
    "jeonju": "전주", "sokcho": "속초", "gangneung": "강릉", "daegu": "대구", "suwon": "수원", "andong": "안동",
    "yeosu": "여수", "tongyeong": "통영", "pohang": "포항", "gwangju": "광주", "daejeon": "대전", "ulsan": "울산",
    "myeongdong": "명동", "hongdae": "홍대", "gangnam": "강남", "itaewon": "이태원", "insadong": "인사동",
    "bukchon": "북촌", "gyeongbokgung": "경복궁", "changdeokgung": "창덕궁", "namsan": "남산",
    "n seoul tower": "N서울타워", "lotte world": "롯데월드", "dmz": "DMZ", "nami island": "남이섬",
    "haeundae": "해운대", "gamcheon": "감천문화마을", "jagalchi": "자갈치시장", "gwangjang": "광장시장",
    "dongdaemun": "동대문", "seongsu": "성수", "everland": "에버랜드", "hallasan": "한라산", "seoraksan": "설악산",
    "han river": "한강", "hangang": "한강", "bukhansan": "북한산", "udo": "우도",
    "seúl": "서울", "séoul": "서울", "σεούλ": "서울", "сеул": "서울", "ソウル": "서울", "釜山": "부산", "済州": "제주",
    "서울": "서울", "부산": "부산", "제주": "제주", "경주": "경주", "전주": "전주", "강릉": "강릉",
}
# 사람이 화면에 나와 이야기하는 브이로그일 가능성이 높은 단어
PERSON_HINTS = re.compile(
    r"\b(vlog|my|our|we|i|i'm|first time|reaction|reacts?|family|couple|wife|husband|girlfriend|boyfriend|"
    r"mein|meine|wir|ich|mon|ma|nous|mi|mis|nosotros|il mio|meu|minha|nós|мой|мы|benim|ilk kez)\b|"
    r"브이로그|우리|처음|가족|부부|커플|私|僕|家族",
    re.IGNORECASE,
)


def find_places(*texts: str) -> list[str]:
    blob = " ".join(texts).lower()
    found: list[str] = []
    for key, name in PLACES.items():
        if key in blob and name not in found:
            found.append(name)
    return found


def score_candidate(c: Candidate) -> Candidate:
    notes: list[str] = []
    text = " ".join([c.title, c.description[:1500], " ".join(c.tags)])

    c.has_person = bool(PERSON_HINTS.search(text))
    person = 20 if c.has_person else 5
    notes.append("인물: 브이로그/1인칭 표현 있음" if c.has_person else "인물: 얼굴이 나오는지 직접 확인 필요")

    c.places = find_places(text)
    place = min(20, 7 * len(c.places))
    notes.append(f"장소 {len(c.places)}곳: {', '.join(c.places[:6])}" if c.places else "장소: 지명 표시 없음")

    minutes = c.duration_sec / 60
    if minutes >= 8:
        length = 20
        notes.append(f"길이 {minutes:.0f}분: 8분 이상(중간 광고 가능)")
    else:
        length = int(20 * minutes / 8)
        notes.append(f"길이 {minutes:.0f}분: 8분 미만")

    # 구독자보다 조회수가 훨씬 많으면 '터진' 소재. 비율 10배면 만점
    ratio = c.views / max(c.subscribers, 100)
    reaction = int(min(25, 25 * math.log10(1 + ratio) / math.log10(11)))
    notes.append(f"반응: 조회수 {c.views:,} / 구독자 {c.subscribers:,} (×{ratio:.1f})")

    rights = 0 if c.rights == "permission_needed" else 15
    notes.append({
        "cc_by": "권리: CC BY — 출처 표기하면 재사용 가능",
        "own": "권리: 직접 촬영/구매한 영상",
        "permission_needed": "권리: 표준 라이선스 — 원작자 허락 필요",
    }[c.rights])

    c.score = person + place + length + reaction + rights
    c.score_notes = notes
    return c
