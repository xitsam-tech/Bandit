// Baut eine eigenständige Ein-Datei-Fassung (dist/einarmiger-bandit.html): CSS und alle Module inline.
// Nutzung: npm run build:single   (braucht die devDependency esbuild)
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, out] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('css/style.css', root), 'utf8'),
  build({ entryPoints: [new URL('js/main.js', root).pathname], bundle: true, format: 'esm', minifySyntax: true, write: false }),
]);
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const single = html
  .replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="js/main.js"></script>', () => `<script type="module">\n${js}</script>`);
if (single === html) throw new Error('Platzhalter in index.html nicht gefunden');
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/einarmiger-bandit.html', root), single);
console.log('dist/einarmiger-bandit.html', (single.length / 1024).toFixed(0), 'KB');
