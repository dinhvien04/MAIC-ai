import webExt from 'web-ext';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
// Snap Firefox cannot use web-ext's ordinary /tmp profile across its sandbox.
// A fresh profile under its common directory avoids touching the real profile.
const base = `${homedir()}/snap/firefox/common`;
await mkdir(base, { recursive: true });
const profile = await mkdtemp(`${base}/maic-extension-smoke-`);
let runner;
try {
  runner = await webExt.cmd.run({ sourceDir: `${root}dist/firefox`, artifactsDir: `${root}artifacts`,
    firefox: process.env.MAIC_TEST_FIREFOX || '/usr/bin/firefox', firefoxProfile: profile, keepProfileChanges: true,
    noReload: true, noInput: true, startUrl: ['about:blank'], args: ['-headless'], target: ['firefox-desktop'] });
  // run() resolves only after Firefox's installTemporaryAddon response succeeds.
  const installed = ['maic-learning-assistant@local.invalid'];
  assert.ok(runner);
  const report = { installed, result: 'Firefox accepted the unpacked MV3 extension via its remote debugger.',
    profile: 'Fresh disposable profile; no personal browser session used.', liveMAIC: false };
  await mkdir(`${root}artifacts`, { recursive: true });
  await writeFile(`${root}artifacts/firefox-smoke.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (runner) await runner.exit();
  // Firefox may still be flushing its profile; this directory is solely this test's.
  await new Promise(resolve => setTimeout(resolve, 1000));
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
}
