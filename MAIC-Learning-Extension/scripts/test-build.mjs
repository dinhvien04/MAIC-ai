import { build } from 'esbuild';
await build({ entryPoints: ['src/content/maic.js'], outfile: 'tests/.generated/assistant.mjs', bundle: true, format: 'esm', loader: { '.css': 'text' }, platform: 'node' });
