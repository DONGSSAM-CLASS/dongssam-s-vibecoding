/* Firebase 설정.
   비워 두면(null) 학습지는 지금처럼 이 기기 안에서만 작동하고, 수업방과 진행자 화면은 꺼집니다.
   채우는 법: Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹)의 firebaseConfig 값을 그대로 붙여 넣습니다.
   이 값은 공개되어도 괜찮습니다. 누가 무엇을 읽고 쓸지는 firestore.rules가 지킵니다. */
window.WS_FIREBASE = {
  apiKey: 'AIzaSyANlhc3UF-5Wyj6PzhxX1ODdnI_G1JkvcA',
  authDomain: 'vibecoding-dongssam.firebaseapp.com',
  projectId: 'vibecoding-dongssam',
  storageBucket: 'vibecoding-dongssam.firebasestorage.app',
  messagingSenderId: '97678049399',
  appId: '1:97678049399:web:d6e07881812dc656b94672'
};

/* 진행자 화면에 들어올 수 있는 구글 계정. firestore.rules의 isAdmin()과 똑같이 맞춰 주세요. */
window.WS_ADMINS = ['dongssamplay@gmail.com'];

/* 내 컴퓨터에서 테스트할 때: localhost 주소 끝에 ?emu 를 붙이면 Firebase 에뮬레이터에 연결합니다. */
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu\b/.test(location.search)) {
  window.WS_FIREBASE = { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-worksheet', emulator: true };
}
