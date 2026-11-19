// Sunset City Cover Maker — the gta6-cover-art-01 entry point (Node 22, stdlib only).
//
// The app is this directory's app/ folder: plain static files a desktop browser
// loads offline (app/index.html plus its own script, styles and fonts — no library,
// no network request). This program hands it in: it copies app/ and screenshots/
// from beside this file into the output directory and writes dossier.json, the
// summary the judge reads, using the vendored make.fun library.
//
// The maker itself: a multi-panel GTA-style cover art editor. Load your own photos
// (read locally, never uploaded), drag to crop and scroll to zoom each panel,
// pick a five-panel cover grid or a simpler layout, edit the caption, apply a
// Vice-City sunset or neon colour grade, and export 1080x1080, 1080x1350 or
// 1920x1080 PNGs. Two sample photos under app/samples/ were made for make.fun
// with an image model and are free to use.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Resolve the repository root from this file's location, so the script works
// no matter which working directory it is launched from.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const appSource = join(repoRoot, 'app');
const shotsSource = join(repoRoot, 'screenshots');
const appTarget = join(outputDir, 'app');
const shotsTarget = join(outputDir, 'screenshots');

mkdirSync(outputDir, { recursive: true });
cpSync(appSource, appTarget, { recursive: true });
mkdirSync(shotsTarget, { recursive: true });
if (existsSync(shotsSource)) {
  cpSync(shotsSource, shotsTarget, { recursive: true });
}

// The scorer's caps (reference/gate.json): text_max_bytes is the only cap that
// shapes the dossier bytes; the rest refuse an entry the scorer would refuse —
// more than 4 screenshots, or one over 256 KiB; more than 993 files in app/ or
// 48 MiB of app files in total; or any path under app/ over 1000 bytes. app/
// counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
