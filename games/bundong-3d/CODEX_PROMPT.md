너는 지금부터 '번동중 퇴마록' 프로젝트를 이어서 맡는다. 이 게임은 번동중학교를 배경으로 한 1인칭 3D 브라우저 게임(three.js)이다. 나는 이 학교 교사이고, 대화와 화면 문구는 모두 한국어로 해 줘.

## 먼저 읽을 것
1. 저장소 https://github.com/DONGSSAM-CLASS/dongssam-s-vibecoding 의 브랜치 `claude/upbeat-hypatia-m5gnyz` 를 사용해. (압축파일로 받았다면 `bundong-3d/` 폴더가 같은 내용이다.)
2. `games/bundong-3d/HANDOFF.md` 를 끝까지 읽어. 구조, 완료된 것, 남은 일, 비용, 작업 규칙이 정리되어 있다.
3. `games/bundong-3d/README.md` 로 실행법과 조작법을 확인해.
4. 참고 영상 `handoff/reference/reference.mp4`(학교 실제 모습)와 학생 사진 2장(`handoff/reference/student_*.webp`)이 이 게임의 기준 자료다.

## 이번에 할 일 (우선순위 순)
1. **Meshy AI로 사실적인 3D 모델 만들기**
   - Meshy는 API 키(환경 변수 `MESHY_API_KEY`)로 작동한다. 키는 내가 환경 설정에 넣을 테니, 채팅에 붙여 넣으라고 하지 말고 코드·커밋에도 절대 적지 마.
   - Meshy MCP(`.mcp.json` 의 `@meshy-ai/meshy-mcp-server`)를 쓸 수 있으면 그걸 쓰고, 안 되면 `games/bundong-3d/tools/meshy-generate.mjs`(REST API, 아직 실제 호출은 안 해 봤음)를 고쳐서 써.
   - 시작 전에 잔액을 확인하고, 만들 목록과 크레딧 비용을 표로 보여 준 다음 내가 확인하면 생성해. (예상: 학생 2명 + 뼈대 약 70, 유물 7점 약 210, 합계 약 280 크레딧)
   - 학생: `assets/players/male.jpg`, `female.jpg` → 실사 질감 3D + 사람 뼈대 + 걷기 동작 → `assets/players/*.glb` 와 `models.json`
   - 유물 7점(sword, mirror, censer, jade, bomb, rocket, sundial) → `assets/relics/*.glb` 와 `manifest.json`. 웹용으로 파일당 10MB 이하, 2~3만 삼각형 정도.
   - 넣은 뒤 게임에서 크기·방향·손에 쥐는 위치(`js/relics.js` 의 `hold`)와 친구 NPC 걷기 동작이 자연스러운지 스크린샷으로 확인하고 조정해.
2. 기대치 설명: 사진 한 장으로는 실물과 '완전히 똑같이'는 어렵다는 점, 옆·뒤 사진이나 실제 유물 사진이 있으면 더 정확해진다는 점, 학교 건물은 3D 스캔이 필요하다는 점을 짧게 알려 주고 필요한 자료를 요청해.
3. (선택) 내 몸(그림자·내려다본 다리)도 GLB 학생 모델로 바꾸기.
4. GLB가 들어간 버전을 학생들이 쓸 수 있게 공개하는 방법 제안(GitHub Pages 등). 공개 전에 나에게 먼저 물어봐.

## 지켜 줄 것
- 기존 기능(퀘스트, 저장, 날씨, 낮밤, 소리, 조작)을 깨지 마. 고친 뒤 `node --check games/bundong-3d/js/*.js`, 브라우저(주소 끝 `?test=1`)로 직접 확인해.
- 바꾼 뒤 `node tools/build-single.mjs` 로 `dist/bundong3d.html` 을 갱신해(esbuild 필요).
- 커밋 메시지는 한국어로, 같은 브랜치에 커밋·푸시해. PR은 내가 말할 때만 만들어.
- 비용이 드는 생성, 외부 공개, 삭제는 내 확인을 받은 뒤에만 해.
- 끝나면 무엇을 바꿨는지, 무엇을 확인했고 무엇을 확인하지 못했는지 한국어로 짧게 보고해.
