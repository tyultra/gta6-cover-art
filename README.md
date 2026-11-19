# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/tyultra/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/tyultra/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Sunset City Cover Maker turns your own photos into a Vice City-style poster: load photos from your machine, frame each one by dragging and zooming inside a multi-panel grid, pick a colour grade and a caption, then export a print-ready PNG. Everything runs offline in a desktop browser — photos are read locally and never uploaded.

## What it does

- **Your photos, your frames** — add photos from your machine or load the two bundled samples; drag to reposition, scroll to zoom, double-click a panel to swap its photo.
- **Five poster layouts** — single hero, two-panel split, three-panel triptych, four-panel grid, and a diagonal feature layout with slanted seams.
- **Three colour grades** — Vice City sunset, neon, and dark, applied to the live preview and to every export.
- **Editable caption** — a bold display title and tagline in Anton (SIL Open Font License, shipped as a file under `app/fonts/`).
- **One-click exports** — 1080 × 1080, 1080 × 1350 and 1920 × 1080 PNGs, rendered at full resolution from the current layout, grade and caption.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Notes

- Static files only: `app/` holds `index.html`, `style.css`, `maker.js`, the `fonts/` folder and the `samples/` photos. No build step, no network requests.
- The sample photos under `app/samples/` were made with an image model for make.fun and are free to use.
- `main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library:
  `MAKEFUN_OUTPUT_DIR=out node main.ts`

---

<sub>Entered on [make.fun](https://make.fun/?ref=mrr6qfq3&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
