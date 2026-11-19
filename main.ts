// Sunset City Cover Maker — hand-in program (Node 22, standard library only).
//
// The entry is a static web app, so handing it in is copying: the app/ folder
// and the screenshots/ folder go to the output directory, and dossier.json is
// written there with the kit's vendored library, so the judge can read the
// app's source and screenshots. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output, e.g. `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function checkScreenshots(dir) {
  if (!existsSync(dir)) return [];
  const shots = readdirSync(dir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`expected 3 or 4 screenshots in screenshots/, found ${shots.length}`);
  }
  return shots;
}

mkdirSync(outputDir, { recursive: true });
copyTree(join(repoRoot, 'app'), join(outputDir, 'app'));
const shotNames = checkScreenshots(join(repoRoot, 'screenshots'));
copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of
// app files in all, or a path under app/ over 1000 bytes).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
if (!dossier || dossier.length === 0) {
  throw new Error('buildDossier wrote an empty dossier');
}
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`handed in ${shotNames.length} screenshots, wrote ${join(outputDir, 'dossier.json')}`);
