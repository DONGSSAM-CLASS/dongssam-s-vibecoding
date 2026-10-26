---
name: youtube-analyzer
description: 유튜브 영상(URL)의 제목·채널·설명란·챕터·자막을 받아 분석용 마크다운으로 정리한다. "이 영상 분석해줘", "유튜브 영상 내용 정리", "영상 자막 가져와" 같은 요청에 사용한다. 영상 속 프로그램·기능·가격을 뽑아 따라 만들기 계획을 세울 때 먼저 실행한다.
---

# 유튜브 영상 분석

오픈소스 [yt-dlp](https://github.com/yt-dlp/yt-dlp)로 영상 정보와 자막을 받아, 분석에 바로 쓸 수 있는
`analysis.md`(메타데이터 + 타임스탬프 자막)를 만든다. 영상 파일 자체는 내려받지 않는다.

## 0. 어느 방법을 쓸까

| 상황 | 방법 |
|---|---|
| 사용자 PC(가정·학교 인터넷)에서 실행 | 아래 2번 yt-dlp (자막 원문까지 받음) |
| 클라우드 세션 + Higgsfield 커넥터 연결됨 | **Higgsfield `video_analysis_create`(youtube_url)** → `video_analysis_status`를 1분 간격으로 확인. 키 없이 장면별(화면+음성) 분석. 가끔 "Something went wrong"으로 실패하면 `https://www.youtube.com/watch?v=ID` 형태로 한 번 더 시도 |
| 클라우드 세션(유튜브가 서버 IP를 "not a bot"으로 막음) | **Gemini 직접 시청** — 구글 서버가 영상을 가져가므로 막히지 않음 |
| 둘 다 안 됨 | 사용자에게 [더보기 → 스크립트 표시] 내용을 받아 `--transcript-file` |

### Gemini 직접 시청 (클라우드에서 권장)

환경변수 `GEMINI_API_KEY`가 있어야 한다(https://aistudio.google.com/apikey, 무료 등급 있음).
키는 채팅에 붙여 넣게 하지 말고 환경 설정의 환경변수/시크릿으로 넣게 한다. 표준 라이브러리만 쓰므로 venv가 필요 없다.

```bash
python3 -I .claude/skills/youtube-analyzer/scripts/gemini_video.py "https://youtu.be/<영상ID>" --out "$SCRATCH/yt"
# → $SCRATCH/yt/<영상ID>/gemini_analysis.md  (화면 구성·버튼·작업 흐름·수익 구조·기능 명세)
```

`--model`로 모델을 고정할 수 있고, 비우면 사용 가능한 최신 안정판 flash 모델을 고른다.
`--prompt-file`로 분석 지시문을 바꿀 수 있다.

같은 저장소의 `youtube-content` 스킬(fairchild/dotclaude에서 가져옴)도 yt-dlp 기반이라 클라우드에서는 같은 이유로 막힌다.

## 1. 준비 (한 번만)

```bash
python3 -m venv "$SCRATCH/ytenv"
"$SCRATCH/ytenv/bin/pip" install -q -r .claude/skills/youtube-analyzer/requirements.txt
```

`$SCRATCH`는 스크래치패드 폴더(없으면 아무 임시 폴더). 저장소 안에 venv를 만들지 않는다.

## 2. 실행

```bash
"$SCRATCH/ytenv/bin/python" -I .claude/skills/youtube-analyzer/scripts/yt_analyze.py \
  "https://youtu.be/<영상ID>" --out "$SCRATCH/yt"
```

- 결과: `$SCRATCH/yt/<영상ID>/analysis.md`, `info.json`, 원본 자막 파일
- 자막 우선순위: 사람이 단 한국어 자막 → 자동 생성 한국어 → 영어
- 자막이 없는 영상이면 설명란·챕터만 정리되고, 그 사실이 `analysis.md`에 적힌다.

### 유튜브에 접속할 수 없을 때

`Tunnel connection failed: 403` / `Unable to connect to proxy`가 나오면 **환경의 네트워크 정책이
`www.youtube.com`을 막고 있는 것**이다. 우회하려 하지 말고 사용자에게 알린다:
클라우드 환경 설정 → Network access에서 `www.youtube.com`, `youtube.com`, `i.ytimg.com`을
Allowed domains에 추가하거나 접근 수준을 넓힌다.

`Sign in to confirm you're not a bot`이 나오면 유튜브가 클라우드 서버 IP를 막은 것이다.
다른 클라이언트 흉내·키 바꾸기 같은 우회를 시도하지 말고, 아래 대체 경로 중 하나를 사용자에게 안내한다.
가장 쉬운 방법은 사용자 PC(가정·학교 인터넷)에서 같은 명령을 실행해 `analysis.md`를 올려 받는 것이다.

```bash
# 사용자 PC (Windows는 python, macOS/Linux는 python3)
pip install -r .claude/skills/youtube-analyzer/requirements.txt
python .claude/skills/youtube-analyzer/scripts/yt_analyze.py "https://youtu.be/<영상ID>" --out yt
```

대체 경로:

```bash
# 사용자가 붙여 넣거나 올린 자막/대본 파일(.vtt/.srt/.txt)로 같은 형식의 analysis.md 만들기
"$SCRATCH/ytenv/bin/python" -I .claude/skills/youtube-analyzer/scripts/yt_analyze.py \
  --transcript-file 자막.vtt --title "영상 제목" --out "$SCRATCH/yt"
```

## 3. 분석

`analysis.md`를 읽고 다음 순서로 정리한다. 지어내지 않는다 — 자막에 없는 내용은 "영상에서 확인 안 됨"으로 적는다.

1. **영상 요지** 3~5줄
2. **소개된 프로그램/서비스**: 이름, 하는 일, 가격·결제 방식, 입력→출력 흐름
3. **기능 목록**: 타임스탬프와 함께 (예: `[03:12] 키워드 입력하면 대본 자동 생성`)
4. **수익화 방식**: 어떤 플랫폼에서 어떻게 돈이 되는지, 영상이 주장하는 수치는 "주장"으로 표시
5. **직접 만들기 설계**: 각 기능을 무료/저가 도구(Claude API, 오픈소스 TTS, ffmpeg 등)로 대체하는 방법
6. **주의점**: 저작권(방송·음원·드라마 클립 재사용), 플랫폼 정책(반복·재사용 콘텐츠 수익 제한), 초상권

영상의 자막 전문을 그대로 옮겨 배포하지 않는다. 분석에는 요약과 짧은 인용만 쓴다.
