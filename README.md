# 에듀파인 자동 품의 with Claude

선생님이 **"기술 수업 롤링볼 재료로 우드락 450x450 10장, 장당 3천원"** 처럼 한두 줄만 적으면,
Claude가 품의서 초안을 만들고 → 브라우저를 직접 조작해 **업무포털 인증서 로그인 → K-에듀파인 품의 작성·저장 → 결재요청(기안)** 까지 진행합니다.

> 마우스 잡은 건 선생님이 아니라 **Claude** 입니다.

---

## 선생님들께 — 설치와 사용

1. **[Releases](https://github.com/DONGSSAM-CLASS/dongssam-s-vibecoding/releases)** 에서 `EdufineAutoPumui-Setup-버전.exe` 내려받아 실행 (관리자 권한 불필요)
2. 바탕화면 **에듀파인 자동 품의** 아이콘 실행 → 처음 설정 마법사(동의 → API 키 → 교육청)
3. 처음엔 **연습 모드**로 한 번 → 그다음 실제 품의

자세한 내용은 **[사용설명서](docs/사용설명서.md)** 를 보세요. (API 키 발급, 문제 해결 포함)

---

## 무엇을 하나요 (시연 영상 기반)

| 영상 단계 | 프로그램이 하는 일 |
|---|---|
| ① 인증서로 로그인 | 업무포털 「교육행정 전자서명 인증서 로그인」 → 본인 인증서 선택 → 암호는 프로그램이 직접 입력(Claude에게 안 보임) |
| ② 메인 화면 · 팝업 정리 | K-에듀파인 진입, 새 창 자동 전환, 공지 팝업 닫기 |
| ③ 품의목록 → 신규 작성 | 학교회계 › 사업관리 › 사업담당 › 품의/정산 › 품의목록 → [신규] |
| ④ 제목 · 개요 입력 | 제목·개요(`금30,000원(금삼만원)` 표기)·품의기본문구 유형·요구일자 |
| ⑤ 예산(세부항목) 선택 | 「예산선택」 창에서 예산 단서와 맞는 행 선택, 애매하면 선생님께 질문 |
| ⑥ 품목 입력 → 저장 | 행추가 → 내용·규격·수량·단위·예상단가 → 요구금액 검증 → 저장 |
| 실제 기안 | **선생님 최종 승인 후에만** 결재요청·상신 (승인 전에는 버튼 클릭 자체가 차단) |

## 배포용으로 신경 쓴 점

| 항목 | 내용 |
|---|---|
| 설치 | 파이썬 없이 설치 파일 하나. 사용자 폴더 설치라 **관리자 권한 불필요**, 바탕화면 바로가기 |
| 설정 | `.env` 편집 없이 **설정 화면**에서. API 키·인증서 암호는 **Windows DPAPI로 암호화**해 `%LOCALAPPDATA%\EdufineAutoPumui`에 저장 |
| 첫 실행 | 4단계 마법사: 정보보안·책임 고지 동의 → API 키 연결 테스트 → 교육청 선택 → 연습 모드 |
| 브라우저 | 크롬 → 엣지 → 내장 Chromium 자동 선택 (엣지는 모든 Windows에 있음), **브라우저 점검** 버튼 |
| 로컬 서버 보안 | `127.0.0.1`에만 열림, 실행마다 바뀌는 **비밀 토큰** + Host 헤더 검사 → 다른 웹사이트가 프로그램을 몰래 호출하지 못함 |
| 수명 관리 | 중복 실행 시 기존 화면만 다시 열기, 포트 충돌 시 자동으로 다른 포트, 화면을 닫고 20분 뒤 자동 종료, [종료] 버튼 |
| 기록·개인정보 | 작업 기록(스크린샷)은 보관 기간(기본 30일) 후 자동 삭제. 제작자에게 아무것도 전송하지 않음(텔레메트리 없음) |
| 학교마다 다른 화면 | 설정의 **우리 학교 참고사항**이 Claude의 작업 절차에 추가됨 |
| 업데이트 | 시작할 때 GitHub 최신 릴리스를 확인해 새 버전 안내 |
| 재현 가능한 빌드 | 의존성 버전 고정, GitHub Actions에서 테스트(Windows·Linux) → exe 빌드 → 실행 점검 → 설치 파일 생성 |

---

## 배포 담당자용 — 새 버전 내기

1. `pumui/__init__.py` 의 `__version__` 을 올리고 `docs/RELEASE_NOTES.md` 를 고칩니다.
2. 태그를 붙여 푸시합니다.
   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```
3. GitHub Actions(`.github/workflows/build.yml`)가 자동으로
   테스트 → PyInstaller로 exe 빌드 → exe 실행 점검 → **Setup.exe**(Inno Setup)·**portable.zip** 생성 → **Releases에 게시**합니다.
   태그 없이 `main`에 푸시하면 Actions의 Artifacts에서 시험용 빌드를 받을 수 있습니다.

   태그를 직접 푸시하기 어려우면: **Actions → build → Run workflow** 에서 **release** 를 체크하고 실행하면,
   테스트·빌드가 통과한 그 커밋에 `v<버전>` 태그와 릴리스가 자동으로 만들어집니다.

> **저장소 공개 여부**: 다른 선생님들이 Releases에서 내려받고 프로그램이 새 버전을 확인하려면 저장소가 **공개(public)** 여야 합니다.
> 비공개로 둘 경우 Setup.exe를 다른 경로(학교 메신저, 드라이브 등)로 나눠 주세요. 업데이트 안내는 동작하지 않습니다.
>
> 코드 서명 인증서가 없으면 Windows SmartScreen 경고가 뜹니다(사용설명서에 안내 포함). 널리 배포할 계획이면 코드 서명 인증서를 고려하세요.

로컬에서 직접 빌드 (Windows):
```bat
pip install -r requirements.txt pyinstaller
pyinstaller packaging\pumui.spec --noconfirm
"%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" /DAppVersion=1.0.0 packaging\installer.iss
```

## 개발자용

```bash
pip install -r requirements.txt pytest
python -m playwright install chromium   # 테스트용 브라우저
python -m pytest -q                     # 모의 에듀파인 E2E + 배포 기능 + 단위 테스트 (API 키 불필요)
python -m pumui                         # 웹 화면 실행
python -m pumui selftest                # 브라우저 점검
python -m pumui run "우드락 10장 3000원" --mock   # 콘솔 모드 (연습)
```

개발 중에는 `.env`(→ `.env.example` 참고)로도 설정할 수 있습니다. 설정 화면에 저장한 값이 `.env`보다 우선합니다.
Windows에서 소스로 바로 쓰려면 `setup.bat` → `run.bat`.

### 구조

```
선생님 ──(한두 줄)──▶ [로컬 웹 화면 127.0.0.1] ─ 토큰 인증
                         │ ① 초안: Claude 구조화 출력 → 제목/개요/품목/예산단서 (pumui/drafter.py)
                         │ ② 선생님 확인·수정
                         ▼
                    [에이전트 루프] Claude computer use — computer_toolset_20260801 (pumui/agent.py)
                         ▼
                    [브라우저 제어] Playwright + 크롬/엣지 (pumui/browser.py)
                         │  상신 버튼 승인 전 차단 · iframe 안 클릭 대상 판별 · 'Claude' 커서 표시
                         ▼
                    업무포털 · K-에듀파인
```

| 경로 | 역할 |
|---|---|
| `pumui/server.py`, `pumui/static/index.html` | 로컬 웹 화면·API (토큰, 설정, 마법사, 실행, 최근 품의) |
| `pumui/config.py`, `pumui/secret_store.py`, `pumui/paths.py` | 설정 저장(AppData), DPAPI 암호화, 파일 위치 |
| `pumui/drafter.py`, `pumui/models.py` | 품의 초안 생성, 금액·개요 |
| `pumui/agent.py`, `pumui/playbook.py` | Claude 작업 루프, K-에듀파인 절차서 |
| `pumui/browser.py` | Playwright 조작·안전장치 |
| `pumui/housekeeping.py` | 기록 자동 삭제, 최근 품의, 업데이트 확인 |
| `pumui/cli.py` | 콘솔 모드, 브라우저 점검 |
| `mock_edufine/` | 연습용 모의 업무포털·K-에듀파인 |
| `packaging/` | PyInstaller spec, Inno Setup 스크립트, 아이콘 |
| `.github/workflows/build.yml` | 테스트·빌드·릴리스 자동화 |

## 알아두실 점

- 작업 중 화면 스크린샷이 Claude API(Anthropic)로 전송됩니다. 소속 교육청의 정보보안 지침을 확인하세요.
- 각 선생님이 **본인 Claude API 키**를 씁니다(사용량만큼 본인 계정에 과금, 품의 1건 대략 1~3달러). 배포하는 쪽의 키를 프로그램에 넣어 나눠 주면 키가 유출되니 절대 그렇게 하지 마세요.
- 교육청·버전마다 화면이 조금씩 다를 수 있습니다. Claude가 화면을 보고 판단하고, 막히면 선생님께 질문합니다.
- 이 프로그램은 교육청·한국교육학술정보원의 공식 프로그램이 아닌 교사 제작 도구입니다.
