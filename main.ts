// Sunset City Cover Maker — entry program (Node 22, standard library only).
//
// Hands the app in: copies the app/ folder and the screenshots/ folder from
// beside this file into the output directory, then writes
// /output/dossier.json with the vendored make.fun library, which is what
// the judge reads. Outside the grader's container, MAKEFUN_OUTPUT_DIR
// stands in for /output, so try it with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyFolder(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

copyFolder(join(rootDir, 'app'), join(outDir, 'app'));
if (existsSync(join(rootDir, 'screenshots'))) {
  copyFolder(join(rootDir, 'screenshots'), join(outDir, 'screenshots'));
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of
// app files in all; or a path under app/ over 1000 bytes.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, dossierCaps));

console.error(`handed in ${outDir} (app/ + screenshots/ + dossier.json)`);
