"""데이터 구조: 소재 후보, 권리 판정, 영상 기획안."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Rights = Literal["cc_by", "permission_needed", "own"]


class Candidate(BaseModel):
    """유튜브에서 찾은 소재 영상 한 개와 3-3-3 점수."""

    video_id: str
    title: str
    channel: str = ""
    channel_id: str = ""
    published_at: str = ""
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    language: str = ""
    duration_sec: int = 0
    views: int = 0
    likes: int = 0
    comments: int = 0
    subscribers: int = 0
    license: str = "youtube"          # "creativeCommon" | "youtube" | "own"(직접 촬영·구매)
    thumbnail: str = ""
    keyword: str = ""

    places: list[str] = Field(default_factory=list)
    has_person: bool = False
    score: int = 0
    score_notes: list[str] = Field(default_factory=list)

    @property
    def url(self) -> str:
        return f"https://www.youtube.com/watch?v={self.video_id}"

    @property
    def rights(self) -> Rights:
        if self.license == "own":
            return "own"
        return "cc_by" if self.license == "creativeCommon" else "permission_needed"


class Segment(BaseModel):
    """대본의 한 구간. 원본 영상의 어느 부분 위에 어떤 한국어 해설을 얹을지."""

    source_start: str = Field(description="원본 영상에서 쓸 구간 시작 mm:ss. 원본이 없으면 빈 문자열")
    source_end: str = Field(default="", description="원본 구간 끝 mm:ss")
    scene: str = Field(description="화면에 나오는 장면 설명(원본/직접 촬영/스톡 영상)")
    narration: str = Field(description="한국어 내레이션(읽을 문장 그대로)")
    caption: str = Field(default="", description="화면에 크게 띄울 짧은 자막/강조 문구")


class VideoPlan(BaseModel):
    """영상 한 편을 만들기 위한 기획안 전체."""

    titles: list[str] = Field(min_length=3, max_length=6, description="제목 후보. 질문형·비교형 섞기, 40자 이내")
    thumbnail_texts: list[str] = Field(min_length=2, max_length=4, description="썸네일 문구 후보. 두 줄은 '\\n'으로 구분, 줄당 10자 이내")
    hook: str = Field(description="첫 15초 내레이션. 질문으로 시작")
    segments: list[Segment] = Field(min_length=6)
    closing: str = Field(description="마무리 내레이션. 구독·좋아요 요청 없이 여운을 남김")
    comparison_points: list[str] = Field(default_factory=list, description="한국과 다른 나라를 비교한 사실 포인트")
    description: str = Field(description="영상 설명란(출처 표기 자리 포함)")
    tags: list[str] = Field(default_factory=list, max_length=20)
    chapters: list[str] = Field(default_factory=list, description="'00:00 제목' 형식")
    fact_checks: list[str] = Field(default_factory=list, description="올리기 전에 사실 확인해야 할 문장들")

    def narration_chars(self) -> int:
        return len(self.hook) + len(self.closing) + sum(len(s.narration) for s in self.segments)

    def estimated_minutes(self, chars_per_min: int = 330) -> float:
        """한국어 내레이션 평균 속도(분당 약 330자)로 계산한 예상 길이."""
        return round(self.narration_chars() / chars_per_min, 1)
