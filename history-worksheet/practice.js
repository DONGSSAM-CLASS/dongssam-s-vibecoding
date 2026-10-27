'use strict';
(function () {
  const W = window.WS;
  if (!W) return;
  const { $, $$, esc, store, setValue } = W;
  const DRAFTS = 'blue-hist-ws-tool-drafts';
  const TOOLS = {
    canva: {
      name: 'Canva AI', group: 'free', sub: '코드 기능이 제공되는 계정에서 실습',
      url: 'https://www.canva.com/', docs: 'https://www.canva.com/ai-code-generator/',
      note: 'Canva의 코드 기능은 계정별로 제공 여부와 AI 사용량이 다릅니다. 교육용 계정 등 현재 계정에서 추가 결제 없이 사용할 수 있을 때 선택하세요. 코드 메뉴가 없으면 Gemini로 바꾸어 이어가면 됩니다.',
      ready: '<ol><li>Canva를 열고 평소 쓰는 계정으로 로그인하세요.</li><li>교육용 계정은 학교 팀에 들어와 있는지 확인하세요.</li><li>무료로 제공되는 AI 사용량이 남아 있는지 확인하세요. 이 실습 때문에 유료 결제를 할 필요는 없습니다.</li></ol>',
      open: '<ol><li>홈에서 <strong>코드(Code)</strong>를 누르세요. 화면에 따라 <strong>Canva AI → 코드</strong>에 있습니다.</li><li>만들고 싶은 것을 설명하는 입력칸을 찾으세요. 일반 디자인의 텍스트 상자가 아닙니다.</li><li>새 코드 대화에 아래 예제 프롬프트를 붙여 넣고 생성하세요.</li></ol><p class="stage-done">확인: 글을 입력할 수 있는 코드 만들기 화면이 보이면 준비됐습니다.</p>',
      finish: '퀴즈가 완성되면 7쪽의 ‘Canva에서 게시’를 따라 웹사이트 주소를 만드세요. 편집 링크가 아닌 게시한 주소를 8쪽에 넣습니다.',
      fail: '코드 메뉴가 없으면 로그인한 계정과 학교 팀을 확인하세요. 관리자가 AI 기능을 제한했거나 해당 계정에 아직 제공되지 않을 수 있습니다. 결제를 반복하지 말고 Gemini 실습으로 전환하세요.',
      deployment: 'canva'
    },
    gemini: {
      name: 'Gemini', group: 'free', sub: '설치 없이 Canvas로 시작',
      url: 'https://gemini.google.com/', docs: 'https://support.google.com/gemini/answer/16047321?hl=ko',
      note: '유료 업그레이드 없이 현재 계정의 무료 사용 한도 안에서 실습합니다. 학교 계정은 관리자 설정에 따라 Canvas와 공유 기능이 다를 수 있습니다.',
      ready: '<ol><li>Gemini를 열고 사용이 허용된 Google 계정으로 로그인하세요.</li><li>유료 업그레이드는 선택하지 않아도 됩니다.</li><li>학교 계정에서 Canvas를 사용할 수 있는지 먼저 확인하세요.</li></ol>',
      open: '<ol><li>새 채팅의 입력창 주변에서 <strong>Canvas</strong>를 선택하세요. 화면에 따라 ‘도구’ 또는 더보기 안에 있습니다.</li><li>아래 예제 프롬프트를 붙여 넣고 전송하세요.</li><li>옆에 제작 화면이 열리면 <strong>미리보기</strong>에서 직접 눌러 보세요.</li></ol><p class="stage-done">확인: 설명문이 아닌, 답을 고를 수 있는 퀴즈 화면이 보이면 됩니다.</p>',
      finish: '7쪽에서 Canvas 공유 링크를 만들거나, HTML 파일을 받아 별도 웹사이트로 배포하세요. Canvas 공유 링크는 Gemini에서 열리며, 접속 권한은 다른 기기에서도 확인해야 합니다.',
      fail: '문서만 나오면 “버튼을 눌러 실행하는 웹앱으로 만들어 주세요”라고 요청하세요. 사용 한도에 도달했다면 화면에 표시된 재이용 시점을 확인하고, 아래 예제 파일로 점검 연습을 이어가세요.',
      deployment: 'gemini'
    },
    codex: {
      name: 'Codex', group: 'paid', sub: '작업 폴더의 파일을 만들고 수정',
      url: 'https://learn.chatgpt.com/docs/quickstart', docs: 'https://learn.chatgpt.com/docs/quickstart',
      note: '이 코스는 Codex를 사용할 수 있는 구독 계정을 기준으로 합니다. 실제 이용 가능 범위와 한도는 계정에서 확인하세요. 첫 작품은 HTML 파일 하나로 만듭니다.',
      ready: '<ol><li>공식 시작 안내에서 내 운영체제에 맞는 ChatGPT 데스크톱 앱을 준비하세요.</li><li>평소 쓰는 ChatGPT 계정으로 로그인하세요.</li><li>새 작업을 열고 Codex를 선택하세요. 화면 이름이 다르면 앱의 안내에서 Codex 작업을 여는 방법을 확인하세요.</li></ol>',
      open: '<ol><li>PC에 <strong>my-class-app</strong>이라는 새 폴더를 만드세요.</li><li>Codex 작업에서 폴더나 로컬 프로젝트를 선택해 해당 폴더를 연결하세요. 바탕화면 전체를 선택할 필요는 없습니다.</li><li>선택한 작업 위치를 확인한 뒤 아래 프롬프트를 입력하세요.</li></ol><p class="stage-done">확인: 결과가 설명으로만 끝나지 않고, 선택한 작업 위치에 index.html 파일이 생성되면 됩니다.</p>',
      finish: '7쪽에서 Firebase 배포 요청문을 Codex에 보내세요. 프로젝트 ID와 로그인 계정을 확인한 뒤, 작업 결과로 받은 실제 사이트 주소를 다른 기기에서 열어 봅니다.',
      fail: '일반 ChatGPT 대화에서 코드만 나왔다면 Codex 작업을 열었는지 확인하세요. “설명만 하지 말고 선택한 작업 위치에 index.html 파일을 실제로 만들어 주세요”라고 요청할 수 있습니다. 학교 PC에서 설치가 막히면 무료 도구 실습으로 전환하세요.',
      deployment: 'firebase'
    },
    claude: {
      name: 'Claude Code', group: 'paid', sub: 'Claude 앱의 Code에서 폴더 작업',
      url: 'https://claude.ai/download', docs: 'https://code.claude.com/docs/en/desktop',
      note: 'Claude Code를 사용할 수 있는 구독 계정으로 실습합니다. 처음이라면 터미널보다 Claude 데스크톱 앱의 Code 탭으로 시작하기 편합니다. 일반 Claude 채팅과 Code 탭을 구분하세요.',
      ready: '<ol><li>공식 다운로드 페이지에서 Claude 데스크톱 앱을 설치하세요.</li><li>Claude Code를 사용할 수 있는 계정으로 로그인하세요.</li><li>앱에서 <strong>Code</strong> 탭을 선택하세요.</li></ol>',
      open: '<ol><li>PC에 <strong>my-class-app</strong> 폴더를 만드세요.</li><li>Code에서 새 작업을 열고, 내 컴퓨터에서 작업하도록 선택한 뒤 프로젝트 폴더로 my-class-app을 고르세요.</li><li>아래 프롬프트를 입력하세요. 파일 수정 승인이 나오면 대상 폴더와 내용을 확인하고 진행하세요.</li></ol><details><summary>강사가 터미널 방식으로 진행한다면</summary><p>공식 설치 안내에서 내 운영체제에 맞는 설치를 먼저 마치세요. 작업 폴더에서 명령 창을 열고 <code>claude</code>를 실행한 뒤 로그인합니다. 설치 명령은 Windows PowerShell과 Mac용이 서로 다르므로 섞어 쓰지 마세요.</p><a href="https://code.claude.com/docs/en/quickstart" target="_blank" rel="noopener noreferrer">공식 터미널 시작 안내 ↗</a></details><p class="stage-done">확인: 선택한 프로젝트 폴더에 index.html이 생기면 됩니다.</p>',
      finish: '7쪽에서 Firebase 배포 요청문을 같은 Code 작업에 보내세요. 로그인과 권한 승인을 직접 마친 뒤, 배포 주소가 실제로 열리는지 확인합니다.',
      fail: '일반 채팅의 결과물 화면만 보고 있다면 앱의 Code 탭으로 이동하세요. 프로젝트 폴더가 맞는지 확인하고 “현재 폴더에 index.html 파일을 만들어 주세요”라고 요청하세요. 설치가 막힌 PC에서는 Gemini로 실습을 이어갈 수 있습니다.',
      deployment: 'firebase'
    }
  };
  let current = Object.hasOwn(TOOLS, W.answers.tool) ? W.answers.tool : 'gemini';
  const draftMap = () => { const d=store.get(DRAFTS,{}); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; };
  const draftSignature = () => JSON.stringify(Object.keys(W.answers).filter(k => ['pk','pl','pg','pm','ps','p1','p5','p6'].includes(k) || /^(pg|pm|ps)-own$/.test(k) || k.startsWith('x-')).sort().map(k => [k,W.answers[k]]));
  function sample(key) {
    const body = `중학생이 혼자 풀어 보는 '역사 연도 퀴즈'를 만들어 주세요.
다음 3문제만 사용하고, 보기와 정답을 바꾸지 마세요.
1. 임진왜란이 시작된 해는? 보기: 1392년 / 1592년 / 1919년. 정답: 1592년. 해설: 임진왜란은 1592년에 시작됐습니다.
2. 훈민정음이 반포된 해는? 보기: 1446년 / 1592년 / 1945년. 정답: 1446년. 해설: 훈민정음은 1446년에 반포됐습니다.
3. 우리나라가 광복을 맞은 해는? 보기: 1910년 / 1919년 / 1945년. 정답: 1945년. 해설: 1945년 8월 15일 광복을 맞았습니다.
시작 → 한 문제씩 풀기 → 정답과 해설 → 다음 문제 → 마지막 점수 순서로 진행해 주세요.
한 문제는 한 번만 채점하고, 다시 풀면 점수와 선택을 초기화해 주세요.
본문 18px 이상, 큰 버튼, 푸른 계열의 읽기 쉬운 화면으로 만들고 휴대폰에서도 잘리지 않게 해 주세요.
로그인, 이름 입력, 서버 저장, 외부 AI 호출은 넣지 마세요.`;
    if (key === 'canva') return body + '\nCanva Code 안에서 바로 눌러 볼 수 있는 퀴즈로 만들어 주세요. 설명이나 코드 목록만 보여 주지 말고 실행 화면을 만들어 주세요.';
    if (key === 'gemini') return body + '\nCSS와 JavaScript를 모두 포함한 index.html 하나로 작성하고 Canvas에서 미리보기를 보여 주세요. React, npm, API 키, 외부 파일 없이 브라우저에서 실행되게 해 주세요.';
    return body + '\n선택한 작업 위치에 CSS와 JavaScript를 포함한 index.html 파일 하나를 실제로 만들어 주세요. 설명만 하지 말고 파일을 작성하고, 시작·정답·오답·마지막 점수·다시 풀기를 확인해 주세요. 직접 확인하지 못한 부분은 구분해 알려 주세요.';
  }
  const fix = `방금 만든 퀴즈를 아래 순서로 고쳐 주세요.
정답과 해설을 확인한 다음에만 '다음 문제'를 누를 수 있게 해 주세요.
마지막 문제에서는 결과 화면으로 이동하고, '다시 풀기'를 누르면 점수와 선택을 모두 지워 주세요.
문항, 정답, 해설과 현재 색상은 그대로 유지해 주세요.
고친 뒤에는 정답과 오답을 각각 골라 보고, 마지막 문제와 다시 풀기도 확인해 주세요.`;
  function copyBlock(id, text) {
    return `<div class="practice-prompt"><div><b>그대로 복사해 입력하세요</b><button type="button" class="pill" data-practice-copy="${id}">복사</button></div><pre id="${id}">${esc(text)}</pre></div>`;
  }
  function stage(n, title, content, open = false) {
    const id = `guide-${current}-${n}`;
    return `<details class="tool-stage"${open ? ' open' : ''}><summary><span>${n}</span>${title}</summary><div class="tool-stage-body">${content}<label class="guide-check"><input type="checkbox" data-guide-check="${id}"${W.answers['chk-' + id] === '1' ? ' checked' : ''}> ${n}단계까지 해 봤어요</label></div></details>`;
  }
  function renderPickers() {
    $$('[data-tool-picker]').forEach(host => {
      host.innerHTML = `<div class="practice-modes" role="group" aria-label="무료 또는 유료 실습 선택">` +
        [['free','무료 도구 실습','Canva AI · Gemini'],['paid','유료 도구 실습','Codex · Claude Code']].map(([id,name,desc]) => `<button type="button" data-practice-mode="${id}" aria-pressed="${TOOLS[current].group === id}"><b>${name}</b><small>${desc}</small></button>`).join('') + '</div><div class="practice-tools" role="group" aria-label="실습 도구 선택">' +
        Object.entries(TOOLS).filter(([,t]) => t.group === TOOLS[current].group).map(([key,t]) => `<button type="button" data-practice-tool="${key}" aria-pressed="${key === current}"><strong>${t.name}</strong><small>${t.sub}</small></button>`).join('') + `</div><p class="practice-note">${esc(TOOLS[current].note)}</p>`;
    });
    $$('[data-current-tool]').forEach(el => { el.textContent = `선택한 도구: ${TOOLS[current].name}`; });
  }
  function renderGuide() {
    const t = TOOLS[current];
    $('#toolGuide').innerHTML = `<div class="guide-heading"><p class="practice-eyebrow">한 도구로 처음부터 끝까지</p><h3>${t.name}로 첫 퀴즈 만들기</h3><p>아래 제목을 눌러 펼치고, 단계가 끝날 때마다 체크하세요. 막힌 화면에서는 새 작업을 계속 만들기보다 같은 대화에서 해결하는 편이 좋습니다.</p><p id="toolGuideProgress" role="status"></p></div>` +
      stage(1,'계정과 준비물 확인하기', t.ready + `<a class="btn ghost" href="${t.url}" target="_blank" rel="noopener noreferrer">${t.name} ${t.group === 'paid' ? '시작 안내' : '열기'} ↗</a>`,true) +
      stage(2,'명령을 입력할 화면 열기',t.open) +
      stage(3,'오늘 만들 기능 세 가지 정하기','<p>첫 작품은 <strong>문제 풀기, 해설 확인, 다시 풀기</strong>만 있는 작은 퀴즈입니다. 처음부터 학생 로그인이나 반 전체 점수판을 만들지 않아도 됩니다.</p><p>누가 쓰나요? 중학생 / 언제 쓰나요? 수업 마무리 / 끝나면 무엇이 보여야 하나요? 3문제 중 맞힌 개수.</p>') +
      stage(4,'첫 요청을 보내고 실행하기',copyBlock('practiceFirstPrompt',sample(current))+'<p class="stage-done">확인: 시작 버튼과 답 보기를 직접 눌러 보세요. 설명문만 나오거나 코드만 보이면 실행 가능한 화면을 요청하세요.</p>') +
      stage(5,'직접 확인하고 한 가지 고치기','<ol><li>일부러 오답을 골라 해설이 나오는지 확인하세요.</li><li>3문제를 모두 풀고 맞힌 개수를 확인하세요.</li><li>같은 답을 여러 번 눌러도 점수가 중복해서 오르지 않는지 확인하세요.</li><li>다시 풀기를 누르면 첫 문제와 0점으로 돌아가는지 확인하세요.</li><li>화면 폭을 줄여 버튼과 문장이 잘리지 않는지 확인하세요.</li></ol>'+copyBlock('practiceFixPrompt',fix)) +
      stage(6,'내 수업의 주제로 바꾸기','<p>예제가 작동하면 같은 대화에서 “제목을 ○○ 단원 퀴즈로 바꾸고, 다음 교사 검토 문항으로 교체해 주세요”라고 요청하세요. 정답과 해설까지 함께 넣으면 내용이 달라지는 것을 줄일 수 있습니다.</p><p>아래 프롬프트 만들기를 펼치면 방탈출, 카드, 연표 등으로도 확장할 수 있습니다.</p><button type="button" class="btn ghost" data-open-builder>내 수업에 맞는 프롬프트 만들기</button>') +
      stage(7,'인터넷에 올리고 작품 주소 남기기',`<p>${t.finish}</p><button type="button" class="btn" data-go-step="deploy">7쪽 배포 안내로 이동 →</button>`) +
      `<details class="practice-help"><summary>막혔을 때 먼저 확인하세요</summary><p>${t.fail}</p><p><b>계정이나 인터넷 문제로 AI를 쓸 수 없다면:</b> 아래 예제 파일을 받아 퀴즈의 정답, 오답, 점수, 다시 풀기를 확인하고 개선할 점을 적어 보세요. 연결이 돌아오면 그 내용을 AI에게 수정 요청으로 보내면 됩니다.</p><a class="btn ghost" href="starter-quiz.html" download="index.html">실습용 예제 HTML 받기</a><p><a href="${t.docs}" target="_blank" rel="noopener noreferrer">${t.name} 공식 안내 ↗</a></p><p class="hint">안내 확인일: 2026.10.27. 화면 이름과 사용량은 계정과 버전에 따라 달라질 수 있습니다.</p></details>`;
    updateProgress();
  }
  function updateProgress() {
    const checks = $$('[data-guide-check]', $('#toolGuide'));
    $('#toolGuideProgress').textContent = `${checks.filter(c=>c.checked).length} / 7단계 확인`;
  }
  function paintToolUI() {
    renderPickers();renderGuide();
    const paid = TOOLS[current].group === 'paid';
    $('#pkLevel [data-pl="adv"]').hidden = !paid;
    $('#toolLevelNote').textContent = paid ? '첫 작품은 기초로 완성해 보세요. 심화는 학생별 응답 저장과 교사 화면까지 함께 만들고 점검할 때 선택합니다.' : '무료 도구 첫 실습은 로그인과 서버 저장이 없는 기초로 진행합니다. 여러 학생의 답을 실시간으로 모으는 기능은 Codex·Claude Code 심화 실습에서 다룹니다.';
    const link = $('#openPracticeTool');link.href=TOOLS[current].url;link.textContent=TOOLS[current].group==='paid'?`${TOOLS[current].name} 시작 안내 ↗`:`${TOOLS[current].name} 열기 ↗`;
    $('#toolDeployNote').textContent=TOOLS[current].finish;
    const allowed = current === 'canva' ? ['canva'] : current === 'gemini' ? ['gemini','netlify'] : ['firebase','netlify'];
    $$('[data-dtab]').forEach(b=>{b.hidden=!allowed.includes(b.dataset.dtab);});
    if(!allowed.includes(W.answers.dtab)){setValue('dtab',TOOLS[current].deployment);}
    W.paintDeploy();
  }
  function chooseTool(key) {
    if(!Object.hasOwn(TOOLS,key)||key===current)return;
    const drafts=draftMap();if(W.answers.p9)drafts[current]={text:W.answers.p9,signature:draftSignature()};store.set(DRAFTS,drafts);
    current=key;setValue('tool',key);
    if(TOOLS[key].group==='free'&&W.answers.pl==='adv')setValue('pl','basic');
    W.paintPromptBuilder();
    if(drafts[key]?.signature===draftSignature() && typeof drafts[key].text==='string'){setValue('p9',drafts[key].text);W.paintPromptLength();}
    else W.buildPrompt();
    // On an explicit tool change, start its own publishing guide.
    setValue('dtab',TOOLS[key].deployment);
    paintToolUI();
  }
  document.addEventListener('click',e=>{
    const tool=e.target.closest('[data-practice-tool]'),mode=e.target.closest('[data-practice-mode]');
    if(tool)chooseTool(tool.dataset.practiceTool);
    if(mode&&mode.dataset.practiceMode!==TOOLS[current].group)chooseTool(mode.dataset.practiceMode==='free'?'gemini':'codex');
    const copy=e.target.closest('[data-practice-copy]');
    if(copy){const src=document.getElementById(copy.dataset.practiceCopy);if(src)W.copyText(src.textContent,null).then(ok=>W.toast(ok?'복사했어요. 선택한 도구의 입력창에 붙여 넣으세요.':'복사 창에서 내용을 직접 복사해 주세요.'));}
    const jump=e.target.closest('[data-go-step]');if(jump)W.goToStep(jump.dataset.goStep);
    if(e.target.closest('[data-open-builder]')){$('#customBuilder').open=true;$('#customBuilder').scrollIntoView({behavior:'smooth',block:'start'});}
  });
  document.addEventListener('change',e=>{if(e.target.matches('[data-guide-check]')){setValue('chk-'+e.target.dataset.guideCheck,e.target.checked?'1':'');updateProgress();}});
  document.addEventListener('ws:cleared',()=>{store.del(DRAFTS);current='gemini';setValue('tool',current);W.paintPromptBuilder();W.buildPrompt();paintToolUI();});
  let printedDetails=[];
  window.addEventListener('beforeprint',()=>{printedDetails=$$('details').map(d=>[d,d.open]);printedDetails.forEach(([d])=>{d.open=true;});});
  window.addEventListener('afterprint',()=>{printedDetails.forEach(([d,open])=>{d.open=open;});});
  paintToolUI();
}());
