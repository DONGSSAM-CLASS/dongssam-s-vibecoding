# Thirty-Five Winters (서른다섯 번의 겨울) — production notes

## Intent and constraints
- Third-person historical action RPG, 1910 → 1945, omnibus of fictional viewpoint characters
  (rifleman / liaison / medic / signaller / recruiter / propagandist).
- Real people and events keep their historical roles; real people never speak invented lines.
  Mission details and dialogue are labelled as game constructions.
- Mission completion and survival over kill count; observation and cooperation beat frontal charges.
- English UI by default, Korean toggle with accurate names. Desktop KB/M + gamepad + landscape phone touch.
- Static site (no build step): `index.html` + ES modules + vendored three.js r170.
- External generation: Higgsfield account had 0.3 credits; no TRIPO/GEMINI/ELEVENLABS keys.
  All models, textures, music and SFX are procedural and original (authored in code).

## Design brief
- Player promise: you are one of many ordinary people who kept the movement alive.
- Primary verb: observe → decide → act together. Secondary: move/sneak, shoot from cover, carry, treat, deliver.
- 5–30 s loop: read patrol/vision/terrain, reposition, issue a squad order, take a shot or slip past.
- 1–5 min loop: one objective chain (scout → prepare → move → execute → rescue → extract).
- Lose / learn: downed without help, courier caught, refugees discovered → checkpoint retry with the cause stated.
- Rewards: XP by Rescue / Intel / Supply / Training / Combat, organisation resources, equipment that opens new methods.
- Better player: scouts first, uses cover lines and concealment, waits for the signal, keeps the squad alive, rations ammo.

## Core loop contract
Player observes enemy routes and terrain to complete a mission objective while patrols, limited ammo/food and
wounded comrades create risk; success gives XP, supplies and companion survival; failure returns to the last
checkpoint with the reason shown.

## Chapter / mission plan (all playable)
| # | Years | Region | Unit / role | Mission(s) |
|---|---|---|---|---|
| P | 1910.8.29 | Hanseong | civilian courier | Letter through the city (stealth tutorial) |
| 1 | 1911–1919 | West Gando (Liuhe/Tonghua) | Sinheung trainee | 1911 storehouse school & drills; 1919 night exercise |
| 2 | 1919 | Andong (Dandong) | Liaison of the Provisional Govt. Communications Bureau | Newspaper bundle relay |
| 3 | 1920.6 | Bongo-dong, Wangqing | Rifleman, joint force (Hong Beom-do / Choe Jin-dong / An Mu) | Lure + ridge ambush |
| 4 | 1920.10 | Cheongsan-ri, Helong | Medic, Northern Military Administration Office Army | Baegunpyeong; Eorang-chon |
| 5 | 1920–25 | Gando / Svobodny / South Manchuria | Liaison, soldier | Gyeongsin massacre refugees & testimony; Free City 1921; Jeongui-bu courier 1925 |
| 6 | 1932–33 | South & North Manchuria | Korean Revolutionary Army scout; Korean Independence Army signaller | Yeongneung-ga; Daejeonjaryeong |
| 7 | 1938–42 | Hubei front | Korean Volunteer Corps propagandist | Leaflets & broadcast; split of 1942 |
| 8 | 1940–45 | Chongqing / Fuyang / Imphal / Dugok | Korean Liberation Army | Founding 1940; recruiting 1944; India-Burma 1944; OSS training & 15 Aug 1945 |

## Status
See `final-evidence.md` for tests and captures.
