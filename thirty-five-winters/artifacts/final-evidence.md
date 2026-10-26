# Thirty-Five Winters — final evidence

Everything below was run in this environment: headless Chromium, SwiftShader WebGL at about 2 FPS, Playwright, and the static server at `http://127.0.0.1:5188`.
Because rendering is that slow, the bots step the game with `App.simulate(sec, dt)`. This runs the real update loop with a fixed 1/30 s step and real keyboard and mouse state.

## 1. What exists

| Area | Content |
|---|---|
| Chapters | Prologue and chapters 1–8 (1910 → 1945). Every chapter has playable missions. Nothing is marked "complete" without play. |
| Missions | 18 field missions and 5 base hubs: m0, m1a, m1b, m2, m3, m4a, m4b, m5a, m5b, m5c, m6a, m6b, m7, m8a, m8b, m8c, m8d, plus hubs h1, h3, h4, h6, h7, h8 |
| Flow | title → chapter card (year, region, unit) → travel map (period place names, route, km) → briefing (history vs construction, loadout, sources) → mission → results → hub → … → ending → credits |
| Systems | Stealth and vision cones, observation journal (records only what was seen), cover, period rifles with reload and jams, limited melee, squad orders (follow, hold, cover, fall back), companion roles (scout, comm, medic, marksman), bleeding, treatment, carrying, civilians, ammo and food logistics, checkpoints and autosave, XP by Rescue / Intel / Supply / Training / Combat, five skills, organisation resources, companion fates |
| UI | Title, chapter select, pause, mission log (objectives, journal, tactical map, squad), archive (people, units, events, equipment, taegukgi, timeline, chapter notes, references, fact vs construction), settings (gameplay, controls with rebinding, accessibility, audio, graphics), hub stations, results, failure and retry, ending, credits. English by default with a Korean toggle. |
| Input | Keyboard and mouse, standard-mapping gamepad, landscape phone touch (joystick, drag-look, large action buttons, squad cycle, toggle aim) |

## 2. Automated playtests (latest runs)

### `tests/run_all.mjs all`

A generic bot plays each mission:
- It teleports between objectives and acts with real input: interact, observe, carry, treat, signal and shoot.
- It reports any objective it had to force ("assist") and all console errors.

Result of the last full run, plus the targeted reruns after the fixes in §4:

| Mission | Result | Assists |
|---|---|---|
| m0, m1b, m2, m3, m4b, m5a, m5b, m5c, m6a, m6b, m7, m8a, m8b, m8c, m8d | COMPLETE | none |
| h1, h3, h4, h6, h7, h8 (hubs, through the station UI and "Set out") | COMPLETE | none |
| m1a | COMPLETE | `shoot`, `squad` (the bot cannot aim at targets or read the tutorial order prompts). Verified with real input by `tests/play_m1a.mjs`. |
| m4a | COMPLETE | `evac` (the bot does not path carriers). Verified with real input: treat, then carry to the stretcher. |

Console or page errors: **0** across all missions.

In one full run, m8d failed once. The bot teleports into an instructor's field of view during the stealth exercise, so "caught" is the correct outcome there and the mission offers a checkpoint retry. Three reruns passed.

### Real-input playthroughs
- `tests/play_m3.mjs` (봉오동): observe the vanguard, fire one lure shot, retreat, climb, wait for the column, signal, then fight, rout, carry wounded Yong-dal and extract. Result: **COMPLETE**. It passes with the signal on **G** and also on **F (interact)**; the latter shows that gamepad and touch players can signal.
- `tests/play_m0.mjs`: prologue stealth route and delivery. **COMPLETE.**
- `tests/play_m1a.mjs`: drills, aimed shots at targets, squad orders. **COMPLETE.**
- Toggle-aim check:
  - Hold mode: releasing RMB stops aiming.
  - Toggle mode: the first press aims and the second press stops.

### `tests/flow.mjs`: new journey through every screen

| Run | Viewport | Language | Steps | Reached | Errors |
|---|---|---|---|---|---|
| desktop | 1280×720 | EN | 81 | ending → credits | 0 |
| desktop | 1280×720 | KO (toggled on the title screen) | 81 | ending → credits | 0 |
| phone | 844×390, touch, DPR 2 | KO | 81 | ending → credits | 0 |

Each run clicks the real buttons on every chapter card, travel map, briefing, results screen and hub. Missions are completed by script here, because mission play is covered above.

## 3. Captures (`artifacts/screens/`)

- **In-mission, one per era** (`en_era_*.jpg`):
  - `m0` Hanseong 1910 (dusk)
  - `m1a` West Gando storehouse school
  - `m3` Bongo-dong valley
  - `m4a` Cheongsan-ri gorge in autumn
  - `m5a` Gando winter refugees
  - `m6a` Yeongneung-ga fortress
  - `m7` Hubei front at night in rain
  - `m8b` India–Burma front
  - `h8` Dugok OSS camp with the 1940s taegukgi
- **Menus in Korean** (`ko_*.jpg`): title, chapter select, chapter card, travel map, briefing, mission-log tactical map, results, hub station, archive, settings.
- **Phone, landscape, Korean** (`phone_*.jpg`): title, briefing (sticky Begin button), HUD with the touch layout.

Renderer counters (medium quality, shadows on, 1280×720):

| View | Draw calls | Triangles |
|---|---|---|
| m0 | 413 | 79k |
| m1a | 257 | 212k |
| m3 | 677 | 139k |
| m4a | 893 | 157k |
| m5a | 265 | 92k |
| m6a | 392 | 137k |
| m7 | 390 | 236k |
| m8b | 280 | 152k |
| h8 | 226 | 318k |

Draw calls include the shadow pass. Low quality, the default on phones, turns shadows and ink outlines off.

## 4. Defects found in this QA pass and fixed

1. The title and pause **language buttons did nothing**: the global `lang` UI action had no handler. It is now wired to `setSetting('lang')`, and the flow test switches to Korean through the real button.
2. **Signals were impossible on gamepad and touch.** The `signal` action had no pad binding and no touch button, although the objective text said "G / interact".
   - With nothing in reach, interact now gives the signal, and the HUD shows a "Give the signal" prompt.
   - Ambushes signalled by the commander (Cheongsan-ri, where the player is a medic) no longer accept a player signal.
   - A post-signal callback can no longer be triggered a second time.
3. **The phone HUD overlapped**: the Sprint, Squad and Log buttons covered the objective, vitals and tutorial, and the pause button covered "Use".
   - These are now laid out as a joystick column, bottom-centre readouts, the tutorial under the objective, and pause at the top.
   - The `body.touchmode` class is actually set now.
4. **The briefing's Begin button sat below the fold on phones.** Panel footers are now sticky.
5. **The travel map's "Skip" button overlapped the caption.** It was removed because it duplicated "Continue".
6. **The toggle-aim setting existed in the menu but had no effect.** It is now implemented for keyboard/mouse and gamepad; touch always toggles.
7. **The scene re-rendered at full cost behind menus.** It now redraws four times a second while paused, which saves battery on phones.
8. **Archive source lines read "한국민족문화대백과사전 · 한국민족문화대백과사전".** They now show each entry title with its link.
9. **Some wording read awkwardly.** "1 bandages" became "Bandages: 1", and "3 time left today" became "Time left today: 3".
10. **Yeongneung-ga assault:**
    - The allies could not win without help.
    - Korean companies now assault the east gate and Chinese volunteers the south wall, matching the briefing.
    - The garrison routs at 50% losses.
    - The bot now completes it with no assists.
11. **Test harness:** `run_all` now sets the journey step before each mission, so a hub's departure advances correctly. It also records the failure reason.

## 5. Asset sourcing

- External generation was in scope, but there was no budget for it:
  - The Higgsfield account had **0.3 credits**.
  - No TRIPO, GEMINI or ELEVENLABS keys were set.
- Everything is therefore original procedural work authored in code:
  - Terrain, buildings (choga, giwa, Manchu, brick, barracks and more), people with period outfits by year and side, period rifles and props.
  - The three taegukgi variants (1910s, 1919, 1940s).
  - The post-process look.
  - All music: pentatonic pyeongjo and gyemyeonjo modes with daegeum, haegeum, gayageum and buk voices.
  - All ambience and SFX.
- No commercial assets were copied.

## 6. History safeguards (checked in data and UI)

- Every chapter separates "확인된 역사적 사실" from "게임을 위해 구성한 장면".
- Real people never speak. Commanders appear only through orders relayed by fictional characters.
- 3·1 is shown only as unarmed protest. 자유시참변 is shown as a command dispute. 간도참변 is shown as refugee protection and testimony, never as violence.
- The 1942 split of the 조선의용대 is shown as Chongqing → 광복군 제1지대 and North China → 조선의용군.
- 한국독립군 (지청천) and 조선혁명군 (양세봉) are separate units in separate regions.
- The 인면전구공작대 and the OSS training are separate missions.
- The finale is the 15 August broadcast during training. It shows no invasion and no recaptured Seoul, and the ending gives the international context.
- Casualty numbers are not stated. Where sources differ, the archive says so.
- References are linked in the archive: 한국민족문화대백과사전, 국사편찬위원회, 독립기념관, 임정기념관.

## 7. Known limitations

- Performance was measured only headless (SwiftShader). Real-device frame rates on phones are unmeasured. Low quality exists for weak devices.
- The generic bot cannot aim at moving targets or route stretcher carriers. Those objectives are covered by the real-input scripts instead (m1a, m4a, m3).
- Art is stylised low-poly procedural work. There are no generated hero models or textures, because no credits or keys were available.
- Some period map coastlines and rivers are simplified hand traces, for orientation rather than cartographic accuracy.
- Voice acting is absent; dialogue is subtitled.
