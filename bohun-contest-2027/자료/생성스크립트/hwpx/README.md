# 공모서식(HWP) → 채워진 HWPX 만들기

1. `Conv.java`: 공모서식 `.hwp`를 `.hwpx`로 변환합니다 ([neolord0/hwp2hwpx](https://github.com/neolord0/hwp2hwpx) + hwplib/hwpxlib 사용, Java 8+).
2. 변환된 `.hwpx`의 압축을 풀고 `python3 fill.py <압축 푼 폴더> <출력.hwpx>`를 실행하면 `content.py`의 내용으로 서식을 채웁니다.
3. 내용 수정은 `content.py`만 고치면 됩니다 (앱 장면명, 성취기준 코드 등).

4. K-SEL 기반 수정본은 `CONTENT=content_ksel python3 fill.py <폴더> <출력.hwpx>`로 만듭니다. (`content.py`는 이전 버전 내용)
