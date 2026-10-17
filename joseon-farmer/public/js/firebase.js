// Firebase 연결. 설정값은 firebase-config.js → 없으면 Hosting의 /__/firebase/init.json.
// localhost에서 열면 로컬 에뮬레이터(8080)에 붙습니다. 실제 DB로 시험하려면 주소 끝에 ?live 를 붙이세요.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, query, where, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, serverTimestamp };

const filled = (c) => c && c.apiKey && c.projectId;

export async function openDb() {
  let cfg = filled(firebaseConfig) ? firebaseConfig : null;
  if (!cfg) {
    try {
      const r = await fetch('/__/firebase/init.json', { cache: 'no-store' });
      if (r.ok) cfg = await r.json();
    } catch (e) { /* Hosting 밖에서 연 경우 */ }
  }
  if (!filled(cfg)) throw new Error('NO_CONFIG');
  const db = getFirestore(initializeApp(cfg));
  const p = new URLSearchParams(location.search);
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (p.has('emu') || (local && !p.has('live'))) {
    connectFirestoreEmulator(db, location.hostname, Number(p.get('emu')) || 8080);
  }
  return db;
}
