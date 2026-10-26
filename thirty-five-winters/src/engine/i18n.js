// Language switching. Every authored text is either a key into STRINGS or an {en, ko} object.
import { STRINGS } from '../data/strings.js';

let lang = 'en';
const listeners = new Set();

export function getLang() { return lang; }
export function setLang(l) {
  lang = l === 'ko' ? 'ko' : 'en';
  document.documentElement.lang = lang;
  listeners.forEach((f) => f(lang));
}
export function onLang(f) { listeners.add(f); return () => listeners.delete(f); }

// L({en, ko}) or L('key') or L('key', {n: 3})
export function L(v, vars) {
  if (v == null) return '';
  let s;
  if (typeof v === 'string') {
    const e = STRINGS[v];
    s = e ? (e[lang] ?? e.en) : v;
  } else if (typeof v === 'object') {
    s = v[lang] ?? v.en ?? '';
  } else s = String(v);
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? L(vars[k]) : ''));
  return s;
}
