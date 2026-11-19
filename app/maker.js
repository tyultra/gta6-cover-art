/* Sunset City Cover Maker — editor + renderer, written for this app.
   Photos are read locally with FileReader / Image and drawn on canvas.
   Nothing is uploaded anywhere. Exports are rendered offscreen at
   1080x1080, 1080x1350 or 1920x1080 and downloaded as PNG. */
'use strict';

const GAP = 0.012; // panel gap, as a fraction of the cover side

const LAYOUTS = {
  solo: {
    label: 'Solo', sub: 'one big photo',
    rects: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  duo: {
    label: 'Duo', sub: 'two side by side',
    rects: [
      { x: 0, y: 0, w: 0.5 - GAP / 2, h: 1 },
      { x: 0.5 + GAP / 2, y: 0, w: 0.5 - GAP / 2, h: 1 },
    ],
  },
  trio: {
    label: 'Trio', sub: 'hero + two stacked',
    rects: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62 + GAP, y: 0, w: 1 - 0.62 - GAP, h: 0.5 - GAP / 2 },
      { x: 0.62 + GAP, y: 0.5 + GAP / 2, w: 1 - 0.62 - GAP, h: 0.5 - GAP / 2 },
    ],
  },
  quad: {
    label: 'Quad', sub: 'four equal panels',
    rects: [
      { x: 0, y: 0, w: 0.5 - GAP / 2, h: 0.5 - GAP / 2 },
      { x: 0.5 + GAP / 2, y: 0, w: 0.5 - GAP / 2, h: 0.5 - GAP / 2 },
      { x: 0, y: 0.5 + GAP / 2, w: 0.5 - GAP / 2, h: 0.5 - GAP / 2 },
      { x: 0.5 + GAP / 2, y: 0.5 + GAP / 2, w: 0.5 - GAP / 2, h: 0.5 - GAP / 2 },
    ],
  },
  cover5: {
    label: 'Cover grid', sub: 'GTA-style five',
    rects: [
      { x: 0, y: 0, w: 0.26, h: 0.36 },
      { x: 0.74, y: 0, w: 0.26, h: 0.36 },
      { x: 0.26 + GAP, y: 0.10, w: 0.48 - GAP, h: 0.80 },
      { x: 0, y: 0.64, w: 0.26, h: 0.36 },
      { x: 0.74, y: 0.64, w: 0.26, h: 0.36 },
    ],
  },
};

const GRADES = {
  none: { label: 'Clean', sub: 'no grade' },
  sunset: { label: 'Sunset', sub: 'orange + pink' },
  neon: { label: 'Neon', sub: 'magenta + cyan' },
  noir: { label: 'Noir', sub: 'high contrast' },
};

const RATIOS = {
  '1:1': { w: 1080, h: 1080, cls: '' },
  '4:5': { w: 1080, h: 1350, cls: 'tall' },
  '16:9': { w: 1920, h: 1080, cls: 'wide' },
};

const state = {
  layout: 'cover5',
  grade: 'sunset',
  ratio: '1:1',
  caption: 'SUNSET HEIST',
  tagline: 'ONE LAST SCORE',
  titleColor: '#ffd23e',
  outlineColor: '#101018',
  showTag: true,
  selected: 0,
  panels: [], // { img, name, scale, ox, oy } — ox/oy are fractions of panel size
};

function blankPanels() {
  return LAYOUTS[state.layout].rects.map(() => ({ img: null, name: '', scale: 1, ox: 0, oy: 0 }));
}
state.panels = blankPanels();

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const ctx = canvas.getContext('2d');

/* ---------- rendering ---------- */

function drawPanelImage(c, panel, rect, W, H) {
  const px = rect.x * W, py = rect.y * H, pw = rect.w * W, ph = rect.h * H;
  c.save();
  c.beginPath();
  c.rect(px, py, pw, ph);
  c.clip();
  if (!panel.img) {
    const g = c.createLinearGradient(px, py, px + pw, py + ph);
    g.addColorStop(0, '#2a1f3d');
    g.addColorStop(1, '#171021');
    c.fillStyle = g;
    c.fillRect(px, py, pw, ph);
    c.strokeStyle = 'rgba(255,255,255,0.18)';
    c.lineWidth = Math.max(1, W * 0.002);
    c.setLineDash([W * 0.012, W * 0.008]);
    c.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
    c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.font = `600 ${Math.round(W * 0.022)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('+ photo', px + pw / 2, py + ph / 2);
    c.restore();
    return;
  }
  const img = panel.img;
  const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
  const s = base * panel.scale;
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  const dx = px + (pw - dw) / 2 + panel.ox * pw;
  const dy = py + (ph - dh) / 2 + panel.oy * ph;
  if (state.grade === 'noir') c.filter = 'grayscale(1) contrast(1.18) brightness(1.06)';
  c.drawImage(img, dx, dy, dw, dh);
  c.filter = 'none';
  c.restore();
}

function drawGrade(c, W, H) {
  if (state.grade === 'sunset') {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,122,26,0.20)');
    g.addColorStop(0.55, 'rgba(255,46,136,0.16)');
    g.addColorStop(1, 'rgba(80,10,90,0.34)');
    c.globalCompositeOperation = 'overlay';
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
  } else if (state.grade === 'neon') {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,46,136,0.30)');
    g.addColorStop(0.5, 'rgba(46,230,255,0.10)');
    g.addColorStop(1, 'rgba(120,40,255,0.30)');
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
  }
  // Vignette, always on, for the poster look.
  const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,4,20,0.42)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
}

function drawCaption(c, W, H) {
  const title = state.caption.trim().toUpperCase();
  const margin = W * 0.045;
  const titleSize = Math.min(W * 0.115, (W - margin * 2) / Math.max(1, title.length) * 1.7);
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const cy = H * 0.905;
  if (state.showTag && state.tagline.trim()) {
    const tag = state.tagline.trim().toUpperCase();
    const tagSize = Math.round(W * 0.026);
    c.font = `700 ${tagSize}px system-ui, sans-serif`;
    const tw = c.measureText(tag).width;
    const pad = tagSize * 0.9;
    const ry = cy - titleSize * 1.35;
    c.fillStyle = '#101018';
    c.beginPath();
    c.roundRect(W / 2 - tw / 2 - pad, ry - tagSize * 0.85, tw + pad * 2, tagSize * 1.7, tagSize * 0.85);
    c.fill();
    c.fillStyle = '#2ee6ff';
    c.fillText(tag, W / 2, ry + tagSize * 0.28);
  }
  c.translate(W / 2, cy);
  c.rotate(-0.028);
  c.font = `${Math.round(titleSize)}px Anton, "Arial Black", sans-serif`;
  c.lineJoin = 'round';
  c.lineWidth = Math.max(2, titleSize * 0.14);
  c.strokeStyle = state.outlineColor;
  c.strokeText(title, 0, 0);
  c.fillStyle = state.titleColor;
  c.fillText(title, 0, 0);
  c.restore();
}

function drawCover(c, W, H, { selection = false } = {}) {
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#241631');
  bg.addColorStop(0.5, '#160f22');
  bg.addColorStop(1, '#0e0a18');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  const rects = LAYOUTS[state.layout].rects;
  rects.forEach((rect, i) => drawPanelImage(c, state.panels[i], rect, W, H));
  drawGrade(c, W, H);
  // Panel frames.
  c.strokeStyle = 'rgba(255,255,255,0.85)';
  c.lineWidth = Math.max(1.5, W * 0.0035);
  rects.forEach((rect) => {
    c.strokeRect(rect.x * W + c.lineWidth / 2, rect.y * H + c.lineWidth / 2,
      rect.w * W - c.lineWidth, rect.h * H - c.lineWidth);
  });
  drawCaption(c, W, H);
  if (selection) {
    const r = rects[state.selected];
    c.save();
    c.strokeStyle = '#2ee6ff';
    c.lineWidth = Math.max(2, W * 0.004);
    c.setLineDash([W * 0.02, W * 0.01]);
    c.strokeRect(r.x * W + 4, r.y * H + 4, r.w * W - 8, r.h * H - 8);
    c.restore();
  }
}

function render() {
  const { w, h } = RATIOS[state.ratio];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.clearRect(0, 0, w, h);
  // In cover-shot mode the preview is the exported artwork itself: no editor chrome.
  const showSelection = !document.body.classList.contains('shot-cover');
  drawCover(ctx, w, h, { selection: showSelection });
  const anyPhoto = state.panels.some((p) => p.img);
  $('empty-hint').style.display = anyPhoto ? 'none' : 'flex';
  const panel = state.panels[state.selected];
  $('panel-label').textContent = `— panel ${state.selected + 1} selected${panel && panel.name ? ` (${panel.name})` : ''}`;
  const zoom = $('zoom');
  if (document.activeElement !== zoom) {
    zoom.value = String(panel ? panel.scale : 1);
    $('zoom-val').textContent = `${Math.round((panel ? panel.scale : 1) * 100)}%`;
  }
}

/* ---------- photo loading ---------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load image'));
    img.src = src;
  });
}

function setPanelPhoto(index, img, name) {
  state.panels[index] = { img, name, scale: 1, ox: 0, oy: 0 };
  render();
}

async function loadFileIntoPanel(file, index) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    setPanelPhoto(index, img, file.name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  return img;
}

async function loadDemo() {
  const names = ['pier', 'boulevard'];
  const rects = LAYOUTS[state.layout].rects;
  for (let i = 0; i < rects.length; i++) {
    try {
      const img = await loadSample(names[i % names.length]);
      state.panels[i] = { img, name: `${names[i % names.length]}.jpg (sample)`, scale: 1, ox: 0, oy: 0 };
    } catch (e) { /* sample missing: leave panel empty */ }
  }
  render();
}

/* ---------- export ---------- */

function exportPNG(sizeLabel) {
  const [w, h] = sizeLabel.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const c = off.getContext('2d');
  drawCover(c, w, h, { selection: false });
  off.toBlob((blob) => {
    if (!blob) { $('export-status').textContent = 'Export failed — please try again.'; return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sunset-city-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('export-status').textContent = `Exported ${w} × ${h} PNG (${(blob.size / 1024).toFixed(0)} KiB).`;
  }, 'image/png');
}

/* ---------- pointer interaction: drag to pan, wheel to zoom ---------- */

function canvasPoint(ev) {
  const r = canvas.getBoundingClientRect();
  const { w, h } = RATIOS[state.ratio];
  return { x: (ev.clientX - r.left) / r.width * w, y: (ev.clientY - r.top) / r.height * h, w, h };
}

function hitPanel(x, y, W, H) {
  const rects = LAYOUTS[state.layout].rects;
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x * W && x <= (r.x + r.w) * W && y >= r.y * H && y <= (r.y + r.h) * H) return i;
  }
  return 0;
}

let drag = null;
canvas.addEventListener('pointerdown', (ev) => {
  const p = canvasPoint(ev);
  const i = hitPanel(p.x, p.y, p.w, p.h);
  state.selected = i;
  canvas.setPointerCapture(ev.pointerId);
  drag = { x: p.x, y: p.y, panel: i };
  render();
});
canvas.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const p = canvasPoint(ev);
  const panel = state.panels[drag.panel];
  const rect = LAYOUTS[state.layout].rects[drag.panel];
  if (panel && panel.img) {
    panel.ox += (p.x - drag.x) / (rect.w * p.w);
    panel.oy += (p.y - drag.y) / (rect.h * p.h);
    panel.ox = Math.max(-1, Math.min(1, panel.ox));
    panel.oy = Math.max(-1, Math.min(1, panel.oy));
  }
  drag = { x: p.x, y: p.y, panel: drag.panel };
  render();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const p = canvasPoint(ev);
  const i = hitPanel(p.x, p.y, p.w, p.h);
  const panel = state.panels[i];
  if (!panel || !panel.img) return;
  state.selected = i;
  const rect = LAYOUTS[state.layout].rects[i];
  const cx = (rect.x + rect.w / 2) * p.w, cy = (rect.y + rect.h / 2) * p.h;
  const oldScale = panel.scale;
  const next = Math.max(0.5, Math.min(4, oldScale * Math.exp(-ev.deltaY * 0.0012)));
  const f = 1 - next / oldScale;
  panel.ox += ((p.x - cx) / (rect.w * p.w)) * f;
  panel.oy += ((p.y - cy) / (rect.h * p.h)) * f;
  panel.scale = next;
  render();
}, { passive: false });
canvas.addEventListener('dblclick', () => {
  const panel = state.panels[state.selected];
  if (panel) { panel.scale = 1; panel.ox = 0; panel.oy = 0; render(); }
});
canvas.addEventListener('dragover', (ev) => ev.preventDefault());
canvas.addEventListener('drop', (ev) => {
  ev.preventDefault();
  const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const p = canvasPoint(ev);
  loadFileIntoPanel(file, hitPanel(p.x, p.y, p.w, p.h)).catch(() => {});
});

/* ---------- controls ---------- */

function buildButtons(container, items, current, onPick) {
  container.innerHTML = '';
  Object.entries(items).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${def.label}<small>${def.sub}</small>`;
    if (key === current) b.classList.add('active');
    b.addEventListener('click', () => { onPick(key); buildButtons(container, items, key, onPick); });
    container.appendChild(b);
  });
}

function setLayout(key) {
  const old = state.panels;
  state.layout = key;
  const next = blankPanels();
  for (let i = 0; i < Math.min(old.length, next.length); i++) next[i] = old[i];
  state.panels = next;
  state.selected = 0;
  render();
}

buildButtons($('layouts'), LAYOUTS, state.layout, setLayout);
buildButtons($('grades'), GRADES, state.grade, (key) => { state.grade = key; render(); });

$('ratio').addEventListener('change', (ev) => {
  state.ratio = ev.target.value;
  $('stage').classList.remove('wide', 'tall');
  $('stage').classList.add(RATIOS[state.ratio].cls);
  $('stage-size-label').textContent = `Preview ${RATIOS[state.ratio].w} × ${RATIOS[state.ratio].h}`;
  render();
});

$('btn-load').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (file) loadFileIntoPanel(file, state.selected).catch(() => {});
  ev.target.value = '';
});
$('btn-fill-all').addEventListener('click', () => {
  const src = state.panels[state.selected];
  if (!src || !src.img) return;
  state.panels = state.panels.map(() => ({ img: src.img, name: src.name, scale: 1, ox: 0, oy: 0 }));
  render();
});
$('btn-remove-photo').addEventListener('click', () => {
  state.panels[state.selected] = { img: null, name: '', scale: 1, ox: 0, oy: 0 };
  render();
});
$('btn-reset-crop').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  if (panel) { panel.scale = 1; panel.ox = 0; panel.oy = 0; render(); }
});
$('zoom').addEventListener('input', (ev) => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.scale = Number(ev.target.value);
  $('zoom-val').textContent = `${Math.round(panel.scale * 100)}%`;
  render();
});
$('caption').addEventListener('input', (ev) => { state.caption = ev.target.value; render(); });
$('tagline').addEventListener('input', (ev) => { state.tagline = ev.target.value; render(); });
$('title-color').addEventListener('input', (ev) => { state.titleColor = ev.target.value; render(); });
$('outline-color').addEventListener('input', (ev) => { state.outlineColor = ev.target.value; render(); });
$('show-tag').addEventListener('change', (ev) => { state.showTag = ev.target.checked; render(); });
$('btn-demo').addEventListener('click', loadDemo);
$('btn-clear').addEventListener('click', () => { state.panels = blankPanels(); render(); });
document.querySelectorAll('[data-export]').forEach((b) => {
  b.addEventListener('click', () => exportPNG(b.dataset.export));
});

/* ---------- deterministic screenshot parameters ---------- */

async function applyShotParams() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  const photo = q.get('photo') || 'pier';
  const caption = q.get('caption');
  const layout = q.get('layout');
  const grade = q.get('grade');
  const ratio = q.get('ratio');
  if (caption) { state.caption = caption; $('caption').value = caption; }
  if (layout && LAYOUTS[layout]) setLayout(layout);
  if (grade && GRADES[grade]) { state.grade = grade; buildButtons($('grades'), GRADES, grade, (k) => { state.grade = k; render(); }); }
  if (ratio && RATIOS[ratio]) {
    state.ratio = ratio;
    $('ratio').value = ratio;
    $('stage').classList.add(RATIOS[ratio].cls);
    $('stage-size-label').textContent = `Preview ${RATIOS[ratio].w} × ${RATIOS[ratio].h}`;
  }
  try {
    const img = await loadSample(photo);
    state.panels = state.panels.map((p, i) => (i === 0 ? { img, name: `${photo}.jpg (sample)`, scale: 1, ox: 0, oy: 0 } : p));
    if (shot === 'cover' || shot === 'editor') {
      // Fill every panel so the grid reads as a finished cover.
      const names = ['pier', 'boulevard'];
      for (let i = 0; i < state.panels.length; i++) {
        const im = await loadSample(names[i % names.length]);
        state.panels[i] = { img: im, name: `${names[i % names.length]}.jpg (sample)`, scale: 1, ox: 0, oy: 0 };
      }
    }
  } catch (e) { /* sample missing: render without photos */ }
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.title = 'Cover — Sunset City Cover Maker';
  } else if (shot === 'editor') {
    document.body.classList.add('shot-editor');
  }
  render();
}

document.fonts.load('40px Anton').catch(() => {}).finally(() => render());
applyShotParams().then(() => render());
render();
