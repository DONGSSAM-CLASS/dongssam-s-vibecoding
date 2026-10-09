// 한 파일짜리 HTML 만들기: 서버 없이 더블클릭으로 실행할 수 있게 모든 코드를 한 파일에 담음
// 사용법:  npm i -D esbuild  →  node tools/build-single.mjs
//   (esbuild 위치를 직접 알려 주려면 ESBUILD=/경로/esbuild/lib/main.js node tools/build-single.mjs)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esbuildPath = process.env.ESBUILD;
const esbuild = await import(esbuildPath ? pathToFileURL(esbuildPath).href : 'esbuild');

const threePlugin = {
  name: 'three-vendor',
  setup(build) {
    build.onResolve({ filter: /^three$/ }, () => ({ path: path.join(root, 'vendor/three.module.min.js') }));
    build.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: path.join(root, 'vendor/addons', a.path.slice('three/addons/'.length)) }));
  },
};

const res = await esbuild.build({
  entryPoints: [path.join(root, 'js/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2020',
  plugins: [threePlugin],
  legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile(path.join(root, 'css/style.css'), 'utf8');
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="js/main.js"></script>', () => `<script type="module">\n${js}\n</script>`);
await mkdir(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/bundong3d.html');
await writeFile(out, html);
console.log('완성:', out, (html.length / 1024 / 1024).toFixed(2) + ' MB');
