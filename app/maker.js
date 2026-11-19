'use strict';

/* Sunset City Cover Maker.
 *
 * A static, offline poster maker: load your own photos, frame each one by
 * dragging and zooming inside a multi-panel grid, pick a colour grade and a
 * caption, then export a PNG at 1080x1080, 1080x1350 or 1920x1080.
 * No network requests, nothing uploaded: photos are read locally only.
 * Fonts ship as files under app/fonts/ (Anton, SIL Open Font License).
 */

const SAMPLE_PHOTOS = ['samples/boulevard.jpg', 'samples/pier.jpg'];

/* Panel rectangles as fractions of the stage. `clip` is a polygon in
 * panel-local fractions, used by the diagonal layout's slanted seams. */
const LAYOUTS = {
  hero: [
    { x: 0, y: 0, w: 1, h: 1 },
  ],
  split: [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
  triptych: [
    { x: 0, y: 0, w: 1 / 3, h: 1 },
    { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
  ],
  grid: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  diagonal: [
    { x: 0, y: 0, w: 0.62, h: 1, clip: [[0, 0], [1, 0], [0.823, 1], [0, 1]] },
    { x: 0.51, y: 0, w: 0.49, h: 0.5, clip: [[0.224, 0], [1, 0], [1, 1], [0.112, 1]] },
    { x: 0.51, y: 0.5, w: 0.49, h: 0.5, clip: [[0.112, 0], [1, 0], [1, 1], [0, 1]] },
  ],
};

const FORMATS = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  wide: { w: 1920, h: 1080 },
};

/* Canvas filter strings mirror the CSS grade filters in style.css. */
const GRADE_FILTERS = {
  sunset: 'saturate(1.3) contrast(1.06) sepia(0.18)',
  neon: 'saturate(1.65) contrast(1.14) hue-rotate(-10deg)',
  dark: 'brightness(0.82) contrast(1.12) saturate(0.85)',
};

const GAP = 3; // white gutter between panels, in pixels

const state = {
  layout: 'grid',
  grade: 'sunset',
  format: 'square',
  title: 'SUNSET CITY',
  tagline: 'VICE CITY • EST. 2026',
  photos: [], // { name, src, img }
  panels: [], // { photo, ox, oy, zoom } — offsets as fractions of panel size
  selected: 0,
};

const stage = document.getElementById('stage');
const panelsBox = document.getElementById('panels');
const gradeOverlay = document.getElementById('gradeOverlay');
const capTitle = document.getElementById('capTitle');
const capTag = document.getElementById('capTag');
const stageHint = document.getElementById('stageHint');
const thumbsBox = document.getElementById('thumbs');
const exportCanvas = document.getElementById('exportCanvas');

let panelNodes = []; // { root, img } per panel index

function rectPx(rect, w, h) {
  return { x: rect.x * w, y: rect.y * h, w: rect.w * w, h: rect.h * h };
}

/* Cover-fit geometry for an image inside a panel, with the user's frame. */
function coverGeom(img, pw, ph, t) {
  const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
  const dw = img.naturalWidth * base * t.zoom;
  const dh = img.naturalHeight * base * t.zoom;
  return {
    dw, dh,
    dx: (pw - dw) / 2 + t.ox * pw,
    dy: (ph - dh) / 2 + t.oy * ph,
  };
}

function clampFrame(i) {
  const t = state.panels[i];
  const rect = LAYOUTS[state.layout][i];
  const box = panelNodes[i].root.getBoundingClientRect();
  const photo = state.photos[t.photo];
  if (!photo) return;
  const g = coverGeom(photo.img, box.width, box.height, t);
  const maxOx = Math.max(0, (g.dw - box.width) / 2 / box.width);
  const maxOy = Math.max(0, (g.dh - box.height) / 2 / box.height);
  t.ox = Math.max(-maxOx, Math.min(maxOx, t.ox));
  t.oy = Math.max(-maxOy, Math.min(maxOy, t.oy));
}

function buildPanels() {
  panelsBox.innerHTML = '';
  panelNodes = [];
  const rects = LAYOUTS[state.layout];
  state.panels = rects.map((rect, i) => {
    const old = state.panels[i];
    return {
      photo: state.photos.length ? (old && old.photo < state.photos.length ? old.photo : i % state.photos.length) : -1,
      ox: old ? old.ox : 0,
      oy: old ? old.oy : 0,
      zoom: old ? old.zoom : 1,
    };
  });
  rects.forEach((rect, i) => {
    const root = document.createElement('div');
    root.className = 'panel';
    root.dataset.index = String(i);
    if (rect.clip) {
      root.style.clipPath = 'polygon(' + rect.clip.map(([cx, cy]) => `${(cx * 100).toFixed(1)}% ${(cy * 100).toFixed(1)}%`).join(', ') + ')';
    }
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    root.appendChild(img);
    attachPanelInput(root, i);
    panelsBox.appendChild(root);
    panelNodes.push({ root, img });
  });
  layoutPanels();
}

function updatePanelGeom(i) {
  const node = panelNodes[i];
  const t = state.panels[i];
  const photo = state.photos[t.photo];
  node.img.style.display = photo ? '' : 'none';
  if (!photo) return;
  const box = node.root.getBoundingClientRect();
  const g = coverGeom(photo.img, box.width, box.height, t);
  node.img.src = photo.src;
  node.img.style.width = `${g.dw}px`;
  node.img.style.height = `${g.dh}px`;
  node.img.style.transform = `translate(${g.dx}px, ${g.dy}px)`;
}

function layoutPanels() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  LAYOUTS[state.layout].forEach((rect, i) => {
    const node = panelNodes[i];
    const r = rectPx(rect, w, h);
    node.root.style.left = `calc(${rect.x * 100}% + ${GAP / 2}px)`;
    node.root.style.top = `calc(${rect.y * 100}% + ${GAP / 2}px)`;
    node.root.style.width = `calc(${rect.w * 100}% - ${GAP}px)`;
    node.root.style.height = `calc(${rect.h * 100}% - ${GAP}px)`;
    node.root.classList.toggle('selected', i === state.selected);
    updatePanelGeom(i);
  });
  stageHint.classList.toggle('hidden', state.photos.length > 0);
}

function renderThumbs() {
  thumbsBox.innerHTML = '';
  state.photos.forEach((photo, idx) => {
    const thumb = document.createElement('img');
    thumb.className = 'thumb';
    thumb.src = photo.src;
    thumb.alt = photo.name;
    thumb.title = photo.name;
    if (state.panels.some((p) => p.photo === idx)) thumb.classList.add('in-use');
    thumb.addEventListener('click', () => {
      state.panels[state.selected].photo = idx;
      renderThumbs();
      updatePanelGeom(state.selected);
    });
    thumbsBox.appendChild(thumb);
  });
}

function renderAll() {
  stage.dataset.format = state.format;
  stage.className = `stage grade-${state.grade}`;
  stage.dataset.format = state.format;
  capTitle.textContent = state.title;
  capTag.textContent = state.tagline;
  document.querySelectorAll('#layoutRow button').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#gradeRow button').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('#formatRow button').forEach((b) => b.classList.toggle('active', b.dataset.format === state.format));
  buildPanels();
  renderThumbs();
}

function setLayout(name) {
  if (!LAYOUTS[name]) return;
  state.layout = name;
  state.selected = 0;
  renderAll();
}

function setGrade(name) {
  if (!GRADE_FILTERS[name]) return;
  state.grade = name;
  renderAll();
}

function setFormat(name) {
  if (!FORMATS[name]) return;
  state.format = name;
  renderAll();
  requestAnimationFrame(layoutPanels);
}

/* ---------- photos ---------- */

function loadImage(src, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ name, src, img });
    img.onerror = () => reject(new Error(`could not load ${name}`));
    img.src = src;
  });
}

async function addPhoto(name, src) {
  const photo = await loadImage(src, name);
  state.photos.push(photo);
  state.panels.forEach((p, i) => {
    if (p.photo < 0) p.photo = (state.photos.length - 1 + i) % state.photos.length;
  });
  renderThumbs();
  layoutPanels();
  return photo;
}

async function loadSamples() {
  for (const path of SAMPLE_PHOTOS) {
    if (state.photos.some((p) => p.src === path)) continue;
    try {
      await addPhoto(path.split('/').pop(), path);
    } catch (err) {
      console.warn(err.message);
    }
  }
}

function onFiles(files) {
  [...files].forEach((file) => {
    const url = URL.createObjectURL(file);
    addPhoto(file.name, url).catch(() => URL.revokeObjectURL(url));
  });
}

/* ---------- panel input: drag to pan, wheel to zoom, double-click to swap ---------- */

function attachPanelInput(root, i) {
  let drag = null;

  root.addEventListener('pointerdown', (e) => {
    state.selected = i;
    panelNodes.forEach((n, j) => n.root.classList.toggle('selected', j === i));
    const t = state.panels[i];
    if (!state.photos[t.photo]) return;
    drag = { x: e.clientX, y: e.clientY, ox: t.ox, oy: t.oy };
    root.setPointerCapture(e.pointerId);
  });

  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const box = root.getBoundingClientRect();
    const t = state.panels[i];
    t.ox = drag.ox + (e.clientX - drag.x) / box.width;
    t.oy = drag.oy + (e.clientY - drag.y) / box.height;
    clampFrame(i);
    updatePanelGeom(i);
  });

  root.addEventListener('pointerup', () => { drag = null; });
  root.addEventListener('pointercancel', () => { drag = null; });

  root.addEventListener('wheel', (e) => {
    e.preventDefault();
    const t = state.panels[i];
    if (!state.photos[t.photo]) return;
    t.zoom = Math.max(1, Math.min(4, t.zoom * Math.exp(-e.deltaY * 0.0012)));
    clampFrame(i);
    updatePanelGeom(i);
  }, { passive: false });

  root.addEventListener('dblclick', () => swapPanelPhoto(i));
}

function swapPanelPhoto(i) {
  const t = state.panels[i];
  if (state.photos.length < 2) return;
  t.photo = (t.photo + 1) % state.photos.length;
  t.ox = 0;
  t.oy = 0;
  t.zoom = 1;
  renderThumbs();
  updatePanelGeom(i);
}

/* ---------- export ---------- */

function gradeOverlayCanvas(ctx, w, h) {
  if (state.grade === 'sunset') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255, 170, 60, 0.16)');
    g.addColorStop(1, 'rgba(255, 45, 130, 0.30)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (state.grade === 'neon') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255, 0, 190, 0.24)');
    g.addColorStop(1, 'rgba(0, 210, 255, 0.20)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    const v = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.3, w / 2, h * 0.42, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0, 0, 16, 0)');
    v.addColorStop(1, 'rgba(0, 0, 16, 0.55)');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5, 5, 20, 0.18)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawCaption(ctx, w, h) {
  const min = Math.min(w, h);
  const pad = w * 0.05;
  const titleSize = min * 0.115;
  const tagSize = min * 0.031;

  const shade = ctx.createLinearGradient(0, h * 0.72, 0, h);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  let size = titleSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (size > 20 && ctx.measureText(state.title).width > w * 0.9) {
    size *= 0.92;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  const titleY = h - min * 0.05;
  const tagY = titleY - size * 1.18;

  try { ctx.letterSpacing = `${min * 0.008}px`; } catch (err) { /* older canvas: no letter spacing */ }
  ctx.font = `${tagSize}px Anton, sans-serif`;
  ctx.fillStyle = '#ffb347';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(state.tagline.toUpperCase(), pad, tagY);
  try { ctx.letterSpacing = '0px'; } catch (err) { /* ignore */ }

  ctx.font = `${size}px Anton, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.14);
  ctx.strokeStyle = '#ff2e88';
  ctx.fillStyle = '#ffffff';
  ctx.shadowOffsetX = Math.round(size * 0.03);
  ctx.shadowOffsetY = Math.round(size * 0.03);
  ctx.strokeText(state.title.toUpperCase(), pad, titleY);
  ctx.fillText(state.title.toUpperCase(), pad, titleY);
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

async function renderExport(formatName) {
  const size = FORMATS[formatName];
  if (!size) throw new Error(`unknown format ${formatName}`);
  await document.fonts.load('100px Anton', 'SUNSET CITY');
  const { w, h } = size;
  exportCanvas.width = w;
  exportCanvas.height = h;
  const ctx = exportCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  LAYOUTS[state.layout].forEach((rect, i) => {
    const t = state.panels[i];
    const photo = state.photos[t.photo];
    if (!photo) return;
    const r = rectPx(rect, w, h);
    const inset = GAP / 2;
    ctx.save();
    ctx.beginPath();
    if (rect.clip) {
      rect.clip.forEach(([cx, cy], k) => {
        const px = r.x + inset + cx * (r.w - GAP);
        const py = r.y + inset + cy * (r.h - GAP);
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
    } else {
      ctx.rect(r.x + inset, r.y + inset, r.w - GAP, r.h - GAP);
    }
    ctx.clip();
    ctx.filter = GRADE_FILTERS[state.grade];
    const g = coverGeom(photo.img, r.w - GAP, r.h - GAP, t);
    ctx.drawImage(photo.img, r.x + inset + g.dx, r.y + inset + g.dy, g.dw, g.dh);
    ctx.filter = 'none';
    ctx.restore();
  });

  gradeOverlayCanvas(ctx, w, h);
  drawCaption(ctx, w, h);
  return exportCanvas;
}

function canvasDataURL(formatName) {
  return renderExport(formatName).then((canvas) => canvas.toDataURL('image/png'));
}

async function exportPNG(formatName) {
  const size = FORMATS[formatName];
  const url = await canvasDataURL(formatName);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sunset-city-${formatName}-${size.w}x${size.h}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- wire up controls ---------- */

document.getElementById('btnSamples').addEventListener('click', loadSamples);
document.getElementById('fileInput').addEventListener('change', (e) => {
  onFiles(e.target.files);
  e.target.value = '';
});

document.getElementById('layoutRow').addEventListener('click', (e) => {
  if (e.target.dataset.layout) setLayout(e.target.dataset.layout);
});
document.getElementById('gradeRow').addEventListener('click', (e) => {
  if (e.target.dataset.grade) setGrade(e.target.dataset.grade);
});
document.getElementById('formatRow').addEventListener('click', (e) => {
  if (e.target.dataset.format) setFormat(e.target.dataset.format);
});

document.getElementById('titleInput').addEventListener('input', (e) => {
  state.title = e.target.value.trim() || 'SUNSET CITY';
  capTitle.textContent = state.title;
});
document.getElementById('tagInput').addEventListener('input', (e) => {
  state.tagline = e.target.value.trim() || 'VICE CITY';
  capTag.textContent = state.tagline;
});

document.getElementById('btnSwap').addEventListener('click', () => swapPanelPhoto(state.selected));
document.getElementById('btnZoomIn').addEventListener('click', () => {
  const t = state.panels[state.selected];
  t.zoom = Math.max(1, Math.min(4, t.zoom * 1.2));
  clampFrame(state.selected);
  updatePanelGeom(state.selected);
});
document.getElementById('btnZoomOut').addEventListener('click', () => {
  const t = state.panels[state.selected];
  t.zoom = Math.max(1, Math.min(4, t.zoom / 1.2));
  clampFrame(state.selected);
  updatePanelGeom(state.selected);
});
document.getElementById('btnReset').addEventListener('click', () => {
  const t = state.panels[state.selected];
  t.ox = 0;
  t.oy = 0;
  t.zoom = 1;
  updatePanelGeom(state.selected);
});

document.getElementById('expSquare').addEventListener('click', () => exportPNG('square'));
document.getElementById('expPortrait').addEventListener('click', () => exportPNG('portrait'));
document.getElementById('expWide').addEventListener('click', () => exportPNG('wide'));

window.addEventListener('resize', layoutPanels);

/* ---------- demo parameters for deterministic screenshots ---------- */

const params = new URLSearchParams(location.search);
if (params.get('layout')) setLayout(params.get('layout'));
if (params.get('grade')) setGrade(params.get('grade'));
if (params.get('format')) setFormat(params.get('format'));
if (params.get('title')) {
  state.title = params.get('title');
  document.getElementById('titleInput').value = state.title;
}
if (params.get('tagline')) {
  state.tagline = params.get('tagline');
  document.getElementById('tagInput').value = state.tagline;
}

renderAll();
if (params.get('demo') === '1') loadSamples();

/* Test hooks: used by the Playwright verification pass. */
window.__maker = { state, LAYOUTS, FORMATS, setLayout, setGrade, setFormat, loadSamples, canvasDataURL, exportPNG, renderAll };
