"""품의서 데이터 구조."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["물품", "용역", "공사", "수당", "업무추진비", "기타"]


class PumuiItem(BaseModel):
    """품목내역 한 줄."""

    name: str = Field(description="품명/내용. 예: 우드락")
    spec: str = Field(default="", description="규격. 예: 450x450x5mm")
    quantity: int = Field(ge=1, description="수량")
    unit: str = Field(default="개", description="단위. 예: 개, 장, 권, 세트, 식")
    unit_price: int = Field(ge=0, description="예상단가(원, 부가세 포함)")

    @property
    def amount(self) -> int:
        return self.quantity * self.unit_price


class BudgetHint(BaseModel):
    """예산선택 창에서 찾을 세부항목 단서. 정확한 이름을 몰라도 키워드면 충분."""

    sub_project: str = Field(default="", description="세부사업 키워드. 예: 과학 교과활동")
    detail_item: str = Field(default="", description="세부항목 키워드. 예: 교과운영")
    cost_category: str = Field(default="", description="원가통계비목 키워드. 예: 학습준비물")
    calc_note: str = Field(default="", description="산출내역 키워드. 예: 기술과실험실습재료비")


class PumuiDraft(BaseModel):
    """K-에듀파인 품의 한 건을 작성하는 데 필요한 모든 값."""

    title: str = Field(description="품의 제목 (300Byte 이내)")
    purpose: str = Field(description="개요 첫 문장. '~을/를 다음과 같이 구입하고자 합니다.' 형식")
    category: Category = Field(default="물품", description="품의기본문구 유형")
    budget: BudgetHint = Field(default_factory=BudgetHint)
    items: list[PumuiItem] = Field(min_length=1)
    request_date: str = Field(default_factory=lambda: date.today().isoformat(), description="요구일자 YYYY-MM-DD")
    due_date: str = Field(
        default_factory=lambda: (date.today() + timedelta(days=30)).isoformat(),
        description="완료요구일자 YYYY-MM-DD",
    )
    overview: str = Field(default="", description="개요 전문. 비워두면 자동 작성")
    assumptions: list[str] = Field(default_factory=list, description="원문에 없어 임의로 정한 값들")

    @property
    def total(self) -> int:
        return sum(i.amount for i in self.items)

    def ensure_overview(self) -> "PumuiDraft":
        if not self.overview.strip():
            self.overview = render_overview(self)
        return self

    def title_bytes(self) -> int:
        # K-에듀파인 바이트 계산: 한글 2Byte, 영문/숫자 1Byte 기준
        return sum(2 if ord(c) > 127 else 1 for c in self.title)


_DIGITS = "영일이삼사오육칠팔구"
_SMALL = ["", "십", "백", "천"]
_LARGE = ["", "만", "억", "조"]


def korean_amount(n: int) -> str:
    """30000 -> '삼만' (공문서 금액 한글 표기)."""
    if n == 0:
        return "영"
    out = []
    group = 0
    while n > 0:
        chunk = n % 10000
        if chunk:
            s = ""
            for pos in range(3, -1, -1):
                d = (chunk // (10**pos)) % 10
                if d:
                    s += ("" if d == 1 and pos > 0 else _DIGITS[d]) + _SMALL[pos]
            out.append(s + _LARGE[group])
        n //= 10000
        group += 1
    return "".join(reversed(out))


def won(n: int) -> str:
    return f"금{n:,}원(금{korean_amount(n)}원)"


def render_overview(d: PumuiDraft) -> str:
    lines = [d.purpose.strip(), ""]
    lines.append(f"1. 소요예산: {won(d.total)}")
    lines.append("2. 구입내역")
    for idx, it in enumerate(d.items):
        mark = "가나다라마바사아자차카타파하"[idx] if idx < 14 else str(idx + 1)
        spec = f"({it.spec})" if it.spec else ""
        lines.append(f"  {mark}. {it.name}{spec} {it.quantity}{it.unit} × {it.unit_price:,}원 = {it.amount:,}원")
    lines.append("3. 예산과목: " + (" / ".join(x for x in [d.budget.sub_project, d.budget.detail_item, d.budget.calc_note] if x) or "해당 세부항목"))
    lines.append("4. 납품요구일: " + d.due_date)
    return "\n".join(lines)
