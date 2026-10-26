// Shared building blocks for mission files.
import * as THREE from 'three';
import { GeoBuilder } from '../../world/geo.js';

export const S = (en, ko) => ({ en, ko });
export const NARR = (en, ko, dur) => ({ text: S(en, ko), kind: 'narr', dur });
export const SAY = (who, en, ko, dur) => ({ who, text: S(en, ko), dur });
export const FACT = (en, ko, dur) => ({ who: S('Historical note', '역사 노트'), text: S(en, ko), kind: 'fact', dur });

// Small visible prop for an interactable (document bundle, sack, crate, radio...)
export function propMesh(g, kind, x, z, y = null) {
  const B = new GeoBuilder();
  if (kind === 'docs') { B.box(0.32, 0.06, 0.24, '#e0d3b0', 0, 0.03, 0); B.box(0.34, 0.02, 0.05, '#7a3a2a', 0, 0.065, 0); }
  else if (kind === 'books') { for (let i = 0; i < 4; i++) B.box(0.3, 0.07, 0.22, ['#6b3a2a', '#3a4a6b', '#7a6a3a', '#4a5a3a'][i], 0, 0.035 + i * 0.07, 0, 0, i * 0.2, 0); B.box(0.04, 0.3, 0.24, '#b39a6a', 0, 0.15, 0); }
  else if (kind === 'sack') B.sphere(0.32, 7, 5, '#b5a67e', 0, 0.28, 0, 1.1, 0.95, 0.85);
  else if (kind === 'crate') { B.boxB(0.6, 0.45, 0.45, '#7d6243'); B.boxB(0.62, 0.06, 0.47, '#5d4630', 0, 0.2, 0); }
  else if (kind === 'ammo') { B.boxB(0.5, 0.28, 0.3, '#5d5a3c'); B.boxB(0.52, 0.04, 0.32, '#3e3c28', 0, 0.26, 0); }
  else if (kind === 'medkit') { B.boxB(0.4, 0.25, 0.25, '#d9d3c2'); B.box(0.2, 0.05, 0.02, '#9a2d2d', 0, 0.13, 0.13); B.box(0.05, 0.18, 0.02, '#9a2d2d', 0, 0.13, 0.13); }
  else if (kind === 'radio') { B.boxB(0.5, 0.4, 0.3, '#4a4f3c'); B.cyl(0.01, 0.01, 1.2, 3, '#222', 0.2, 1.0, 0); }
  else if (kind === 'leaflets') { for (let i = 0; i < 3; i++) B.box(0.3, 0.05, 0.22, '#e8e2d0', 0, 0.025 + i * 0.05, 0, 0, i * 0.3, 0); }
  else if (kind === 'notice') { B.box(1.2, 0.9, 0.05, '#e6dcc4', 0, 1.6, 0); B.box(1.3, 0.08, 0.08, '#4a3a2a', 0, 2.08, 0); B.cyl(0.04, 0.04, 2.2, 4, '#4a3a2a', -0.55, 1.1, -0.04); B.cyl(0.04, 0.04, 2.2, 4, '#4a3a2a', 0.55, 1.1, -0.04); for (let i = 0; i < 6; i++) B.box(0.06, 0.6, 0.01, '#2a2420', -0.4 + i * 0.16, 1.62, 0.03); }
  else if (kind === 'target') { B.cyl(0.4, 0.4, 0.1, 12, '#c9b27a', 0, 1.4, 0, Math.PI / 2, 0, 0); }
  else if (kind === 'clue') { B.box(0.5, 0.02, 0.5, '#3a3026', 0, 0.01, 0); }
  else if (kind === 'loudspeaker') { B.cone(0.3, 0.6, 8, '#5f6158', 0, 0.4, 0, Math.PI / 2, 0, 0); B.boxB(0.3, 0.3, 0.3, '#4a4f3c', 0, 0, -0.35); }
  else if (kind === 'bundle') B.sphere(0.3, 7, 5, '#a89a7a', 0, 0.25, 0, 1.2, 0.8, 0.9);
  const m = new THREE.Mesh(B.build(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.position.set(x, y ?? g.groundY(x, z), z); m.castShadow = true;
  g.scene.add(m);
  return m;
}

// Pick up an item (removed from the world) — sets flag, optional carry visual
export function pickup(g, { id, pos, kind = 'docs', prompt, flag, carry = false, hold = 0, marker = 'item', onUse, enabled, y }) {
  const mesh = propMesh(g, kind, pos[0], pos[1], y);
  return g.addInteractable({ id, pos, prompt, hold, marker, enabled, y, onUse: (gg) => {
    mesh.removeFromParent();
    if (carry) { gg.player.carryItem = { kind, id }; gg.player.model.setCarryItem(kind === 'books' || kind === 'bundle' ? 'sack' : kind); }
    if (flag) gg.mission.flag(flag);
    onUse?.(gg);
  } });
}
// Deliver the carried item at a spot
export function dropoff(g, { id, pos, prompt, flag, kind, onUse, marker = 'item', enabled }) {
  return g.addInteractable({ id, pos, prompt, marker, once: false,
    enabled: (gg) => !!gg.player.carryItem && (!kind || gg.player.carryItem.kind === kind) && (!enabled || enabled(gg)),
    onUse: (gg) => {
      const it = gg.player.carryItem; gg.player.carryItem = null; gg.player.model.setCarryItem(null);
      if (flag) gg.mission.flag(typeof flag === 'function' ? flag(it) : flag);
      gg.stats.supplies++; gg.award('supply', 5, null, true);
      onUse?.(gg, it);
    } });
}
// Talk to an NPC (actor or position). lines play as subtitles.
export function talk(g, { id, actor, pos, prompt = S('Talk', '대화하기'), lines, flag, once = true, enabled, onUse, radius = 2.4, marker = 'item' }) {
  return g.addInteractable({ id, pos: actor ? () => [actor.x, actor.z] : pos, prompt, radius, marker, once, enabled,
    onUse: (gg) => { if (lines) gg.narrate(typeof lines === 'function' ? lines(gg) : lines); if (flag) gg.mission.flag(flag); if (actor) actor.facing = Math.atan2(gg.player.x - actor.x, gg.player.z - actor.z); onUse?.(gg); } });
}
// A clue on the ground (tracks, ash, dropped item) — adds a journal note
export function clue(g, { id, pos, text, prompt = S('Examine', '살펴보기'), flag, xp = 4 }) {
  return g.addInteractable({ id, pos, prompt, marker: 'clue', radius: 2.2, hold: 0.8,
    onUse: (gg) => { gg.journalAdd('clue', null, null, text); gg.hud.toast(text); gg.stats.clues = (gg.stats.clues || 0) + 1; gg.award('intel', xp, null, true); if (flag) gg.mission.flag(flag); } });
}

// Distance helper used in triggers
export const near = (a, x, z, r) => Math.hypot(a.x - x, a.z - z) < r;

// --------------------------------------------------------------------------- hubs
// A walkable base with stations. Each station opens a panel; "Set out" ends the hub.
export function hub({ id, chapter, chapterLabel, title, date, place, unit, protagonist, env, stations, start, squad = [], npcs = [], intro = [], createdNote, historyNote, music = 'hub' }) {
  return {
    id, chapter, chapterLabel, title, date, place, unit, protagonist, env, start, squad: squad.map((s) => ({ ...s, order: 'hold', holdPos: s.pos })), hub: true, music, combatMusic: 'hub',
    createdNote: createdNote || S('Bases, stations and daily routines are game constructions drawn from descriptions of camp life.', '거점과 시설, 일과는 숙영 생활에 관한 기록을 바탕으로 한 게임 구성이다.'),
    historyNote: historyNote || S('', ''),
    briefing: [], after: [], intro,
    civilians: npcs,
    objectives: [{ id: 'base', type: 'flag', flag: 'depart', text: S('Prepare at the base, then set out (time is limited)', '거점에서 준비한 뒤 출발하라 (시간은 한정되어 있다)') }],
    setup(g) {
      const labels = { training: S('Training ground', '훈련장'), maintenance: S('Weapon care', '무기 정비'), tailor: S('Mending', '의복 수선'), kitchen: S('Kitchen', '취사'), infirmary: S('Infirmary', '의무실'), letters: S('Letters', '편지'), talk: S('Comrades', '동료'), supply: S('Supplies', '보급'), depart: S('Set out', '출발') };
      for (const st of stations) {
        g.addInteractable({ id: 'st_' + st.kind, pos: st.pos, prompt: labels[st.kind], label: labels[st.kind], marker: 'station', once: false, radius: 2.6,
          onUse: () => g.app.ui.station(st.kind) });
      }
      g.hud.toast(S('Walk to a station and press interact. Each activity takes part of the day.', '시설로 걸어가 상호작용하세요. 활동마다 하루의 일부가 듭니다.'));
    },
  };
}

// Builds a generic camp: tents/huts, fire, tables, targets
export function campKit(kit, { x = 0, z = 0, style = 'tent', snow = false, flag = null, huts = 4 } = {}) {
  for (let i = 0; i < huts; i++) {
    const a = (i / huts) * Math.PI * 1.4 - 0.7, r = 13;
    const hx = x + Math.sin(a) * r, hz = z + Math.cos(a) * r;
    if (style === 'tent') kit.house('tent', hx, hz, -a + Math.PI, { w: 4, d: 3 });
    else kit.house(style, hx, hz, -a + Math.PI, { snow });
  }
  kit.campfire(x, z);
  if (flag) kit.flag(x + 4, z - 3, flag, 4.5);
}
