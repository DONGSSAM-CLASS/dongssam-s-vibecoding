// assets/players/ 의 학생 사진을 js/photos.js 에 담기 (한 파일 실행본에서도 보이게)
// 사용법: 사진을 male.jpg, female.jpg (얼굴만 자른 male_face.jpg, female_face.jpg 는 선택)로 바꾼 뒤
//         node tools/embed-photos.mjs  →  node tools/build-single.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/players');
const uri = async (f) => 'data:image/jpeg;base64,' + (await readFile(path.join(dir, f))).toString('base64');

let js = '// 캐릭터 선택용 학생 사진(교사 제공). 한 파일 실행본에서도 보이도록 코드에 직접 담음\n// 원본: assets/players/male.jpg, female.jpg (+ _face.jpg)\nexport const PHOTOS = {\n';
for (const g of ['male', 'female']) {
  const card = await uri(`${g}.jpg`);
  const face = existsSync(path.join(dir, `${g}_face.jpg`)) ? await uri(`${g}_face.jpg`) : card;
  js += `  ${g}: {\n    card: '${card}',\n    face: '${face}',\n  },\n`;
}
js += '};\n';
await writeFile(path.join(root, 'js/photos.js'), js);
console.log('js/photos.js 갱신 완료');
