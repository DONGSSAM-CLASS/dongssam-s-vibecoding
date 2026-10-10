// Meshy AI로 게임용 3D 모델 만들기 (Meshy MCP가 없을 때 REST API를 직접 부름)
//
// 준비: Meshy 웹사이트 → API 메뉴에서 API 키 발급 → 환경 변수 MESHY_API_KEY 로 설정
//       (키를 코드나 저장소에 적지 마세요)
// 사용:  node tools/meshy-generate.mjs students        학생 사진 2장 → 사실적인 3D 캐릭터 + 뼈대 + 걷기 동작
//        node tools/meshy-generate.mjs relics          유물 7점 → 사실적인 3D 모델(참고 사진이 있으면 사진 기반)
//        node tools/meshy-generate.mjs relics censer   유물 하나만
//
// 결과: assets/players/<성별>.glb, <성별>_walk.glb, assets/players/models.json
//       assets/relics/<유물>.glb, assets/relics/manifest.json
// 유물 참고 사진: assets/relics/ref/<유물>.jpg 를 넣으면 그 사진으로 만듦(없으면 아래 설명문으로 만듦)
// 크레딧이 듭니다. 실행 전에 Meshy 요금을 확인하세요.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.MESHY_API_KEY;
const API = 'https://api.meshy.ai';
if (!KEY) {
  console.error('MESHY_API_KEY 환경 변수가 없습니다. Meshy에서 API 키를 발급해 환경 변수로 설정하세요.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 400)}`);
  return json;
}

async function waitTask(kind, id, label) {
  for (;;) {
    const t = await call('GET', `${kind}/${id}`);
    process.stdout.write(`\r  ${label}: ${t.status} ${t.progress ?? ''}%   `);
    if (t.status === 'SUCCEEDED') { process.stdout.write('\n'); return t; }
    if (t.status === 'FAILED' || t.status === 'CANCELED' || t.status === 'EXPIRED') {
      process.stdout.write('\n');
      throw new Error(`${label} 실패: ${JSON.stringify(t.task_error || t).slice(0, 400)}`);
    }
    await sleep(8000);
  }
}

async function download(url, out) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`내려받기 실패 ${res.status}: ${url}`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log('  저장:', path.relative(root, out));
}

async function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,` + (await readFile(file)).toString('base64');
}

async function imageTo3d(file, label, extra = {}) {
  const created = await call('POST', '/openapi/v1/image-to-3d', {
    image_url: await dataUri(file),
    ai_model: 'latest',
    should_texture: true,
    enable_pbr: true,
    should_remesh: true,
    topology: 'triangle',
    target_polycount: 30000,
    ...extra,
  });
  const id = created.result;
  console.log(`  ${label}: 작업 ${id}`);
  return { id, task: await waitTask('/openapi/v1/image-to-3d', id, label) };
}

async function textTo3d(prompt, label) {
  const pre = await call('POST', '/openapi/v2/text-to-3d', { mode: 'preview', prompt, art_style: 'realistic', should_remesh: true, target_polycount: 30000 });
  await waitTask('/openapi/v2/text-to-3d', pre.result, label + ' (형태)');
  const ref = await call('POST', '/openapi/v2/text-to-3d', { mode: 'refine', preview_task_id: pre.result, enable_pbr: true });
  return waitTask('/openapi/v2/text-to-3d', ref.result, label + ' (질감)');
}

// ---------------- 학생 ----------------
async function students() {
  const dir = path.join(root, 'assets/players');
  const man = existsSync(path.join(dir, 'models.json')) ? JSON.parse(await readFile(path.join(dir, 'models.json'), 'utf8')) : {};
  for (const g of ['male', 'female']) {
    // 정면 사진 1장. 옆·뒤 사진(<성별>_side.jpg, <성별>_back.jpg)이 있으면 여러 장으로 더 정확하게
    const views = [`${g}.jpg`, `${g}_side.jpg`, `${g}_back.jpg`].map((f) => path.join(dir, f)).filter(existsSync);
    let id;
    if (views.length > 1) {
      const created = await call('POST', '/openapi/v1/multi-image-to-3d', {
        image_urls: await Promise.all(views.map(dataUri)), ai_model: 'latest', should_texture: true, enable_pbr: true, should_remesh: true, target_polycount: 30000,
      });
      id = created.result;
      await waitTask('/openapi/v1/multi-image-to-3d', id, g + ' 캐릭터');
    } else {
      ({ id } = await imageTo3d(views[0], g + ' 캐릭터'));
    }
    // 사람 뼈대 + 기본 걷기·달리기 동작
    const rig = await call('POST', '/openapi/v1/rigging', { input_task_id: id, height_meters: g === 'male' ? 1.72 : 1.64 });
    const r = await waitTask('/openapi/v1/rigging', rig.result, g + ' 뼈대');
    const res = r.result || {};
    await download(res.rigged_character_glb_url, path.join(dir, `${g}.glb`));
    const walk = res.basic_animations?.walking_glb_url;
    if (walk) await download(walk, path.join(dir, `${g}_walk.glb`));
    man[g] = { model: `${g}.glb`, walk: walk ? `${g}_walk.glb` : null, height: g === 'male' ? 1.72 : 1.64 };
    await writeFile(path.join(dir, 'models.json'), JSON.stringify(man, null, 2) + '\n');
  }
}

// ---------------- 유물 ----------------
const RELIC_PROMPTS = {
  sword: 'Saingeom four-tiger sword of the Joseon dynasty, Korean National Museum, long straight double-edged steel blade with gold-inlaid constellation dots and lines and Chinese inscriptions, small oval gilt bronze guard, dark cord-wrapped grip with red tassel, museum artifact, photorealistic',
  mirror: 'Dagyu Sesemungyeong, Korean Bronze Age fine-lined bronze mirror, 21 cm disc, back covered with extremely fine geometric triangle hatching in concentric zones, two small loop knobs near center, green patina, museum artifact, photorealistic',
  censer: 'Gilt-bronze Incense Burner of Baekje, Korean national treasure, 62 cm tall, dragon coiled base holding lotus stem, lotus bud body with petals, lid of layered mountain peaks with tiny figures and five musicians, phoenix standing on top, gold gilding with patina, museum artifact, photorealistic',
  jade: 'Silla gogok comma-shaped curved jade bead, translucent green jadeite, gold cap on the head with tiny granulation, small hole for hanging, museum artifact, photorealistic',
  bomb: 'Bigyeok jincheonroe, Joseon dynasty iron time bomb shell, cast iron sphere about 21 cm diameter, rusty dark iron, small fuse hole on top with a short wooden fuse, museum artifact, photorealistic',
  rocket: 'Singijeon, Joseon dynasty rocket arrow, long bamboo arrow shaft with a paper gunpowder tube tied near the head with red cord, iron arrowhead, feather fletching, museum replica, photorealistic',
  sundial: 'Angbu ilgu, Joseon dynasty hemispherical bronze sundial, bowl-shaped scaphe with engraved hour and season grid lines inside, slanted gnomon needle, four curved dragon legs on cross-shaped base, dark bronze, museum artifact, photorealistic',
};

async function relics(only) {
  const dir = path.join(root, 'assets/relics');
  const manPath = path.join(dir, 'manifest.json');
  const man = existsSync(manPath) ? JSON.parse(await readFile(manPath, 'utf8')) : {};
  for (const [id, prompt] of Object.entries(RELIC_PROMPTS)) {
    if (only && id !== only) continue;
    const ref = ['jpg', 'jpeg', 'png'].map((e) => path.join(dir, 'ref', `${id}.${e}`)).find(existsSync);
    const task = ref ? (await imageTo3d(ref, id)).task : await textTo3d(prompt, id);
    await download(task.model_urls.glb, path.join(dir, `${id}.glb`));
    man[id] = `${id}.glb`;
    await writeFile(manPath, JSON.stringify(man, null, 2) + '\n');
  }
}

const [what, only] = process.argv.slice(2);
if (what === 'students') await students();
else if (what === 'relics') await relics(only);
else console.log('사용법: node tools/meshy-generate.mjs students | relics [유물이름]');
