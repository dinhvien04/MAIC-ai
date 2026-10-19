import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const browser of ['chrome', 'firefox']) {
  const outdir = `${root}dist/${browser}`;
  await mkdir(`${outdir}/popup`, { recursive: true });
  await build({ absWorkingDir: root, entryPoints: { background: 'src/background/background.js', content: 'src/content/maic.js', 'popup/popup': 'src/popup/popup.js' }, outdir,
    bundle: true, format: 'iife', target: ['chrome109', 'firefox115'], loader: { '.css': 'text' }, legalComments: 'none' });
  await writeFile(`${outdir}/manifest.json`, await readFile(`${root}manifests/${browser}.json`));
  for (const file of ['popup.html', 'popup.css']) await copyFile(`${root}src/popup/${file}`, `${outdir}/popup/${file}`);
  console.log(`Built dist/${browser}`);
}
