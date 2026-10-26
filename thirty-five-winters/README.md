# 서른다섯 번의 겨울 · Thirty-Five Winters

1910년 국권 피탈부터 1945년 광복까지를 따라가는 3인칭 역사 체험 액션 RPG입니다.
A third-person historical action RPG that follows the independence movement from 1910 to 1945.

Players do not take the role of famous figures. They follow fictional ordinary people of each era and region, such as a liaison, a rifleman, a medic, a signaller or a propagandist.
Real people and events keep their historical roles. Missions and dialogue are game constructions and are labelled as such everywhere: briefings, results and the archive use the badges **"확인된 역사적 사실 / Confirmed history"** and **"게임을 위해 구성한 장면 / Game construction"**.

## 실행 / Run

No build step is needed. It is a static site using ES modules, with three.js r170 vendored (MIT licence, see `vendor/three-LICENSE.txt`).

```bash
cd thirty-five-winters
python3 -m http.server 5188
# open http://127.0.0.1:5188
```

Any static host works, such as Netlify or GitHub Pages. Opening `index.html` directly from a `file://` URL does not work, because ES modules need a server.

## 장 구성 / Chapters (all playable)

| 장 | 시기 | 지역 | 시점 인물 · 부대 | 임무 |
|---|---|---|---|---|
| 프롤로그 | 1910.8.29 | 한성 | 책방 견습생 (비무장 연락) | 편지 전달 잠입 (튜토리얼) |
| 1 | 1911 · 1919 | 서간도 류허·퉁화 | 신흥강습소 → 신흥무관학교 생도 | 창고 학교와 목총 훈련, 무관학교 야간 기동 연습 |
| 2 | 1919 | 안동(단둥) | 임시정부 교통국 연락원 | 독립신문 꾸러미 전달 (3·1운동은 비무장 시위로만 다룸) |
| 3 | 1920.6 | 왕청현 봉오동 | 연합 부대 유인조 소총수 | 유인 → 고지 매복 신호 → 부상 동료 구출 |
| 4 | 1920.10 | 화룡현 청산리 일대 | 북로군정서 의무병 · 보급 | 백운평 부상자 처치와 후송, 어랑촌 탄약·식량 분배 |
| 5 | 1920–1925 | 간도 · 스보보드니 · 남만주 | 연락원 · 병사 | 간도참변 피란민 보호와 증언 기록, 자유시참변(지휘권 분쟁), 정의부 연락 |
| 6 | 1932–1933 | 남만주 · 북만주 | 조선혁명군 정찰병 / 한국독립군 전령 | 영릉가성(양세봉), 대전자령(지청천) — 각각 다른 부대·지역 |
| 7 | 1938–1942 | 후베이 전선 | 조선의용대 선전대원 | 표어·전단·방송 공작, 1942년 분화(충칭→광복군 제1지대 / 화북→조선의용군) |
| 8 | 1940–1945 | 충칭 · 푸양 · 임팔 · 두취 | 한국광복군 | 1940.9.17 창설, 인면전구공작대, 탈출 학도병 맞이, OSS 훈련과 8월 15일 방송 |

The ending explains liberation in its international context. The game never shows a domestic invasion that did not happen, or the recapture of Seoul.

## 조작 / Controls

| | 키보드·마우스 | 게임패드 | 터치 (가로 화면) |
|---|---|---|---|
| 이동 / 시점 | WASD / 마우스 | 왼쪽 / 오른쪽 스틱 | 왼쪽 조이스틱 / 오른쪽 드래그 |
| 달리기 · 웅크리기 · 엄폐 | Shift · C · Space | L3 · B · Y | 질주 · 웅크리기 · 엄폐 버튼 |
| 상호작용 (치료·운반·전달·신호) | F / E | A | 행동 버튼 |
| 조준 · 사격 · 재장전 | 우클릭 · 좌클릭 · R | LT · RT · X | 조준(전환) · 사격 · 재장전 |
| 관찰(쌍안경) · 붕대 · 근접 | Z · H · V | LB · RB · R3 | 관찰 · 붕대 |
| 분대: 따라와·대기·엄호·후퇴 | 1 · 2 · 3 · 4 | 십자키 ↑ · ← · → · ↓ | 동료 버튼 (순환) |
| 신호 | G (또는 F) | A | 행동 버튼 |
| 임무 기록 · 지도 · 일시정지 | Tab · M · Esc | View · — · Menu | 기록 버튼 · ⏸ |

Settings let you:
- remap every key and gamepad button;
- turn on aim assist and choose a difficulty (Story, Standard or Hard);
- adjust subtitle size and background, colour-blind filters (deutan, protan, tritan) and screen-shake strength;
- toggle reduced motion, high contrast, toggle aim and classroom mode (all chapters open).

The game defaults to English, with a Korean toggle on the title and pause screens.

## 구조 / Layout

```
index.html            importmap + containers
src/engine/           renderer (post shader, grading), input, audio (procedural WebAudio), i18n, util
src/world/            terrain, props kit, characters (procedural rigs/outfits), effects, level
src/game/             collision, nav, actor, player, ai (enemy/ally/civilian), mission runtime, progress
src/ui/               HUD, screens, tactical & travel maps, icons
src/data/             strings (EN/KO), chapters, codex & references, geography, missions/
tests/                Playwright bot playtests (see below)
dev/sandbox.html      model/prop viewer for development
vendor/               three.js r170 (MIT)
artifacts/            design notes, final evidence, screenshots
```

## 테스트 / Tests

The tests need a running server on port 5188 and Playwright with Chromium.

```bash
node tests/run_all.mjs all /tmp/out     # every mission and hub, driven by a bot (reports assists / errors)
node tests/flow.mjs /tmp/shots [--mobile] [--ko]   # new journey through every screen to the ending
node tests/play_m0.mjs | play_m1a.mjs | play_m3.mjs   # real-input playthroughs of key missions
node tests/smoke.mjs m3 /tmp/out
```

## 자료 / Sources

The history text is cross-checked against the following:
- 한국민족문화대백과사전 (encykorea.aks.ac.kr)
- 국사편찬위원회 우리역사넷
- 독립기념관 한국독립운동정보시스템
- 대한민국임시정부기념관

Links for each entry are in the in-game archive under "참고 자료". AI output was not used as a historical source.

Casualty numbers vary between sources, so the game does not state any as fact. Where it mentions them, it says that they differ.

## 제작 / Credits

Code, models, textures, music and sound effects are all original and authored procedurally in code.
External generative AI (image, 3D or audio) could not be used for lack of credits and API keys, so none is included.
