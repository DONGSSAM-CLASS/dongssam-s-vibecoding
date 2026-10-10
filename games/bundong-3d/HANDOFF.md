# 최신 고증 수정 (2026-10-10)

공식 자료를 반영한 무료 유물 GLB 7점과 출처가 기본 적용됩니다. 기존 Meshy 원본과 학생 GLB는 보존합니다. 학교 외관은 제공 영상에서 보이는 계단탑·간판·차양을 보정했습니다. 확인되지 않은 실내·치수는 재구성입니다. 상세 근거·한계·재현법은 HISTORICAL_ACCURACY.md를 읽으세요. 이 아래의 Meshy 비용·초기 완료 상태는 이전 작업 이력입니다.

# 번동중 퇴마록 — 인수인계 문서

> 작성: 2026-10-10 · 이전 작업 도구: Claude Code(클라우드 세션)
> 저장소: https://github.com/DONGSSAM-CLASS/dongssam-s-vibecoding · 브랜치 `claude/upbeat-hypatia-m5gnyz` (PR 없음)
> 게임 위치: `games/bundong-3d/` · 웹 미리보기(비공개 claude.ai 아티팩트): https://claude.ai/artifact/J8RQW2VvxAsXH8oD5Ki3FH

> **Codex 후속 작업(2026-10-10):** Meshy MCP 잔액 조회 성공(692), 사용자 승인 후 학생 2명·뼈대·걷기 및 유물 7점 생성 완료. 실제 사용 280, 완료 잔액 412크레딧. GLB 11개 모두 10MB 이하로 로컬 최적화. 친구 걷기·기립 자세·텍스처 경계 및 검·곡옥·해시계 손 위치 보정. 기존 퀘스트·저장·날씨·낮밤·조작과 단일 HTML 실행 검증 통과. 상세는 `VALIDATION.md`, 생성 작업 ID는 `assets/meshy-report.json` 참조. 아래 원래 계획 중 유료 생성 부분은 완료되었고, 추가 사진을 통한 정확도 개선·선택 사항인 내 몸 GLB 교체·외부 웹 배포는 남아 있습니다.

## 1. 프로젝트 한눈에 보기

번동중학교(서울 강북구)를 배경으로 한 **1인칭 3D 브라우저 게임**. 학교 곳곳에 숨은 실제 한국사 유물 7점을 찾아 유물 스킬로 악령을 정화한다.
교사(동쌤)가 학생 수업·행사용으로 요청. 사용자와의 대화는 한국어, 화면 문구도 전부 한국어.

- 엔진: three.js r169 (`vendor/`에 포함, 빌드 도구 없이 ES 모듈 + importmap)
- 텍스처·소리: 전부 코드로 생성(캔버스, Web Audio). 외부 이미지는 학생 사진뿐
- 실행: `dist/bundong3d.html` 더블클릭(한 파일 빌드) 또는 폴더를 로컬 서버로 열고 `index.html`
- 코드 약 7,900줄(JS 26개 모듈)

## 2. 원래 요구사항과 반영 상태

| # | 요구 | 상태 |
|---|---|---|
| 0 | 참고 영상(7초, 운동장→본관→계단탑·등나무 쉼터→소나무 정원 패닝)의 색·구도·분위기 | ✅ 배치·색·아침 08:20 빛 재현. 타이틀 카메라가 영상과 같은 방향으로 회전. 영상: `handoff/reference/reference.mp4` |
| 1 | 바닥·물·식물·바위 | ✅ 인조잔디·트랙·벽돌, 연못, 소나무·등나무·잔디·코스모스(바람에 흔들림), 바위 |
| 2 | 중심 장소 번동중학교 | ✅ 본관(체크 유리 외벽, "희망과 감동을 주는 번동중학교" 간판), 1층 실내 탐험 |
| 3 | 남/여 학생 선택(사진 반영) | ✅ 사진 카드·HUD 얼굴, 교복 맞춘 3D 모델·1인칭 팔, 고르지 않은 쪽은 친구 NPC |
| 4 | 유물 습득 → 스킬로 악령 퇴치 | ✅ 유물 7점·스킬, 악령 4종(보스 어둑시니), 퀘스트, 저장 |
| 5 | 들고 쓰는 유물(사인참사검, 곡도, 금동대향로 등) | ✅ "곡도"는 신라 **곡옥**으로 해석(사용자 확인 안 됨) |
| 6 | **Meshy AI로 사실적인 유물·캐릭터** | ✅ **GLB 적용 완료** — 학생 2명·걷기, 유물 7점. 실물 정확도 개선에는 추가 자료 필요 |
| 7 | 상자·채집·가방 | ✅ 반닫이, 쑥·팥 채집, 책가방, 사물함, 가방 칸 확장, 만들기(팥죽·부적) |
| 8 | 날씨 변화 | ✅ 맑음·흐림·비·뇌우·안개·눈 확률 전환, 젖은 바닥, 번개 |
| 9 | 낮·밤 | ✅ 하루 6/12/24분, 해·달·별·노을, 창문·가로등 |
| 10 | 그래픽 | ✅ 그림자, ACES, 블룸, 환경맵, 하늘 셰이더 |
| 11 | 소리 | ✅ 바람·비·천둥·새·풀벌레·연못·재질별 발소리·악령·국악풍 효과음 (학교라 파도 대신 연못) |
| 12 | 조작키 | ✅ WASD·마우스·E·좌/우클릭·1~7·G/H/J·F·I/Tab·M·Esc |

## 3. 코드 구조

```
index.html / css/style.css   화면(UI) 구성
js/main.js        시작·게임 루프·상태(title/select/play/ui/paused/dead/victory)·저장(localStorage)
js/layout.js      학교 배치 좌표(x=동, z=남, 단위 m) — 모든 배치의 기준
js/world.js       바닥(큰 캔버스 텍스처 1장)·트랙·코트·골대·스탠드·광장·연못·가로등·아파트
js/school.js      본관 외벽·간판·체육관 지붕·계단탑·별관·동관·1층 실내(교실·도서실·역사교실·과학실)
js/vegetation.js  나무(잎 카드)·등나무·잔디(인스턴스)·꽃
js/sky.js         하늘 셰이더·해/달 방향광·안개·환경맵(PMREM)
js/weather.js     날씨 상태 기계·비/눈 입자·번개
js/player.js      1인칭 이동·충돌·시점 팔(별도 장면, 2번째 RenderPass)·내 몸(그림자+내려다본 다리)
js/student.js     교복 학생 3D 모델(관절)·걷기 동작·1인칭 팔·기본 초상화
js/photos.js      학생 사진 base64(자동 생성: tools/embed-photos.mjs)
js/models.js      외부 학생 GLB(Meshy 등) 불러오기·키 맞춤·AnimationMixer 걷기
js/relics.js      유물 7점 데이터(역사 설명)·스킬·투사체·GLB 교체(assets/relics/manifest.json)
js/relicModels.js 유물 절차적 3D 모델
js/ghosts.js      악령(원귀·도깨비불·그림자 악령·보스 어둑시니) AI·생성
js/interact.js    상호작용 물건 전부 + 친구 NPC
js/inventory.js / quest.js / ui.js / audio.js / fx.js / collision.js / materials.js / textures.js / input.js / settings.js / util.js
tools/build-single.mjs   한 파일 HTML 빌드(esbuild 필요: npm i -D esbuild)
tools/embed-photos.mjs   assets/players/*.jpg → js/photos.js
tools/meshy-generate.mjs Meshy REST API로 학생·유물 GLB 생성(MESHY_API_KEY 필요, 실제 호출은 아직 한 번도 안 해 봄)
```

**테스트용 훅**: 주소에 `?test=1`을 붙이면 포인터 잠금 없이 조작되고 `window.__game`으로 상태에 접근할 수 있다. `?quality=low|medium|high`.
`handoff/tools/shot.mjs`는 Playwright로 단계(JSON)를 실행하며 스크린샷을 찍는 스크립트다(예시 단계 파일 포함). 그래픽 카드 없는 환경(SwiftShader)에서는 2~3fps라 게임 시간이 느리게 흐른다.

## 4. 이어서 할 일 (우선순위 순)

### 4-1. Meshy AI로 사실적인 3D 모델 만들기 (사용자 핵심 요청)
사용자 요청: "Meshy AI 계정(dongssam94@gmail.com)이랑 MCP해서 3D 모델링 진행해서 더 사실감 있게. 현실이랑 완전히 똑같이."

- Meshy는 계정 로그인이 아니라 **API 키**(환경 변수 `MESHY_API_KEY`)로 작동한다. 키·비밀번호는 절대 채팅·코드·커밋에 넣지 말 것.
- 저장소 루트 `.mcp.json`에 Meshy 공식 MCP 서버(`@meshy-ai/meshy-mcp-server`)가 설정되어 있다.
- 지난 세션 상태: 마지막에 Meshy MCP가 연결되었지만 잔액 조회에서 `Permission denied. Your API key may not have access to this resource.` 오류. **키가 올바른지·API 권한이 있는지 먼저 확인**할 것.
- Meshy MCP 규칙: **크레딧이 드는 호출은 반드시 비용을 먼저 보여 주고 사용자 확인을 받은 뒤 실행.** 출력 형식은 `target_formats: ["glb"]`(웹 게임용)으로 생성 시점에 지정.
- 예상 비용(Meshy 2026-10-05 가격표 기준, meshy-7.1/latest):
  - 이미지→3D + 텍스처 2K/4K = 30, 뼈대(rig, 걷기·달리기 포함) = 5
  - 학생 2명: (30 + 5) × 2 = **70**
  - 유물 7점: 30 × 7 = **210** (설명문→3D면 미리보기 20 + 정제 10 = 30)
  - 합계 약 **280 크레딧**
- 입력 자료:
  - 학생: `assets/players/male.jpg`, `female.jpg`(원본: `handoff/reference/student_male.webp`, `student_female.webp`). 옆·뒤 사진을 받으면 multi-image-to-3d로 더 정확하게(사용자에게 요청 권장).
  - 유물: 실제 사진이 없다. 국립중앙박물관 e뮤지엄 등 공공누리 사진을 사용자가 구하면 `assets/relics/ref/<id>.jpg`로 두고 이미지→3D, 없으면 `tools/meshy-generate.mjs` 안의 영어 설명문으로 text-to-3d.
  - 유물 id: `sword`(사인참사검) `mirror`(다뉴세문경) `censer`(백제 금동대향로) `jade`(곡옥) `bomb`(비격진천뢰) `rocket`(신기전) `sundial`(앙부일구)
- 결과물을 넣는 곳(코드는 이미 대응됨):
  - 학생: `assets/players/<male|female>.glb`, 걷기 `<g>_walk.glb`, `assets/players/models.json` → `{ "male": { "model": "male.glb", "walk": "male_walk.glb", "height": 1.72, "rotY": 0 } }` (모델이 뒤를 보면 rotY 3.14)
  - 유물: `assets/relics/<id>.glb`, `assets/relics/manifest.json` → `{ "censer": "censer.glb" }`
  - 넣으면 친구 NPC와 손에 든 유물·바닥에 놓는 향로·진열장 유물이 GLB로 바뀐다(서버 실행 시. `file://`에서는 fetch가 안 돼 절차적 모델 유지).
- 할 일:
  1. 키 권한 확인(`meshy_check_balance`) → 비용 안내 → 사용자 확인
  2. 학생 2명 생성(이미지→3D, 텍스처·PBR, `pose_mode: "a-pose"`) → `meshy_rig`(height 1.72 / 1.64) → GLB 내려받기
  3. 유물 7점 생성 → GLB 내려받기 → 각 파일 10MB 이하로(필요하면 `meshy_remesh`로 폴리곤 줄이기, 웹용 2~3만 삼각형 권장)
  4. 게임에서 확인: 크기·방향·손에 쥐는 위치(`js/relics.js`의 각 유물 `hold.pos/rot/scale`), 친구 NPC 걷기 동작
  5. (선택) 내 몸(그림자·내려다본 다리)도 GLB로 바꾸기 — 지금은 `js/player.js`에서 절차적 모델 사용. 머리·윗몸이 카메라를 가리지 않게 층(layer) 분리 필요
  6. 한 파일 실행본·웹 미리보기: GLB가 커서 `dist`에는 안 넣었다. 웹 미리보기에 넣으려면 아티팩트 보조 파일(각 15MB 이하) 또는 GitHub Pages 같은 정적 호스팅 필요

### 4-2. "현실과 완전히 똑같이"에 대한 기대치 조율 (사용자에게 설명 필요)
- 사진 한 장 기반 3D는 뒷면을 AI가 추정 → 옆·뒤 사진이 있으면 크게 좋아짐
- 학교 건물은 Meshy(한 물체용)로 재현 불가. 실물 수준은 드론·사진 3D 스캔(포토그래메트리)이 필요 → 별도 제안

### 4-3. 그 밖에 남은 일
- 실제 GPU PC에서 성능 확인(지금까지 SwiftShader에서만 테스트). 느리면 `settings.js`의 QUALITY 조정
- 휴대폰·태블릿 터치 조작 없음
- 본관 2층 이상 출입 불가(계단 통제)
- "곡도" 해석(곡옥으로 넣음) 사용자 확인
- 웹 미리보기 아티팩트는 비공개 — 학생에게 쓰려면 사용자가 공유를 켜야 함

## 5. 작업 규칙(지난 세션에서 지킨 것)
- 커밋 메시지·화면 문구·주석은 한국어. 학생 눈높이의 쉬운 말
- 유물 설명은 확인된 사실만(지정 번호 등 불확실한 건 빼기)
- 변경 후: `node --check js/*.js` → Playwright 스크린샷 확인 → `node tools/build-single.mjs`로 dist 갱신 → 커밋·푸시
- 루트 `.gitignore`가 `dist/`를 무시하지만 `games/bundong-3d/.gitignore`의 `!dist/`로 dist를 포함시킨다
- 크레딧·비용이 드는 외부 생성은 사용자 확인 후에만
