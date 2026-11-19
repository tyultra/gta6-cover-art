'use strict';
/* Sunset City Cover Maker.
   A static, offline cover-art maker: load your own photos, arrange them in
   a multi-panel poster, grade the colours, write a bold caption, export a
   share-ready PNG. Photos never leave the machine. */

const SAMPLE_PHOTOS = [
  { name: 'Pier', url: 'samples/pier.jpg' },
  { name: 'Boulevard', url: 'samples/boulevard.jpg' },
];

/* Layouts are fractions of the poster. A panel is either a rectangle
   (x, y, w, h) or a polygon (poly of [fx, fy] corners). */
const LAYOUTS = {
  hero: {
    label: 'Single hero',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  split: {
    label: 'Two-panel split',
    panels: [
      { x: 0, y: 0, w: 0.54, h: 1 },
      { x: 0.54, y: 0, w: 0.46, h: 1 },
    ],
  },
  triptych: {
    label: 'Three-panel triptych',
    panels: [
      { x: 0, y: 0, w: 0.3, h: 1 },
      { x: 0.3, y: 0, w: 0.4, h: 1 },
      { x: 0.7, y: 0, w: 0.3, h: 1 },
    ],
  },
  grid: {
    label: 'Four-panel grid',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  diagonal: {
    label: 'Diagonal feature',
    panels: [
      { poly: [[0, 0], [0.66, 0], [0.42, 1], [0, 1]] },
      { poly: [[0.66, 0], [1, 0], [1, 0.5], [0.54, 0.5]] },
      { poly: [[0.54, 0.5], [1, 0.5], [1, 1], [0.42, 1]] },
    ],
  },
};

/* Colour grades: a CSS filter for the photos plus a canvas overlay pass. */
const GRADES = {
  sunset: {
    label: 'Vice City sunset',
    canvasFilter: 'saturate(1.35) contrast(1.08) sepia(0.22)',
    titleColor: '#ffd23e',
  },
  neon: {
    label: 'Neon',
    canvasFilter: 'saturate(1.6) contrast(1.15) hue-rotate(-10deg)',
    titleColor: '#37f4ff',
  },
  dark: {
    label: 'Dark',
    canvasFilter: 'brightness(0.85) contrast(1.25) saturate(0.9)',
    titleColor: '#ffffff',
  },
};

const state = {
  photos: [], // { name, img, url }
  panels: [], // { photo, zoom, dxF, dyF } — one per layout panel
  layout: 'triptych',
  grade: 'sunset',
  title: 'SUNSET HEIST',
  subtitle: 'ONE LAST SCORE',
  tag: 'SUNSET CITY',
  previewSize: '1080x1080',
  selected: 0,
};

const posterEl = document.getElementById('poster');
const panelsEl = document.getElementById('panels');
const titleEl = document.getElementById('titleText');
const subtitleEl = document.getElementById('subtitleText');
const tagEl = document.getElementById('tagText');

/* ---------- geometry (shared by the live preview and the export) ---------- */

function panelGeom(def, W, H) {
  if (def.poly) {
    const pts = def.poly.map(([fx, fy]) => [fx * W, fy * H]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x;
    const h = Math.max(...ys) - y;
    const clip = pts
      .map(([px, py]) => `${(((px - x) / w) * 100).toFixed(2)}% ${(((py - y) / h) * 100).toFixed(2)}%`)
      .join(', ');
    return { x, y, w, h, clip, pts };
  }
  return { x: def.x * W, y: def.y * H, w: def.w * W, h: def.h * H, clip: null, pts: null };
}

/* Cover-fit placement of an image inside a panel rect, with zoom and pan.
   Offsets are fractions of the panel size, so they survive resizing. */
function imagePlacement(rect, img, zoom, dxF, dyF) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const w = img.naturalWidth * base * zoom;
  const h = img.naturalHeight * base * zoom;
  return {
    w,
    h,
    x: rect.x + (rect.w - w) / 2 + dxF * rect.w,
    y: rect.y + (rect.h - h) / 2 + dyF * rect.h,
  };
}

function ensurePanels() {
  const defs = LAYOUTS[state.layout].panels;
  const firstPhoto = state.panels[0] ? state.panels[0].photo : 0;
  while (state.panels.length < defs.length) {
    state.panels.push({ photo: firstPhoto, zoom: 1, dxF: 0, dyF: 0 });
  }
  state.panels.length = defs.length;
  if (state.selected >= defs.length) state.selected = 0;
}

/* ---------- live preview ---------- */

function renderPoster() {
  ensurePanels();
  const W = posterEl.clientWidth || 640;
  const H = posterEl.clientHeight || 640;
  posterEl.className = `poster grade-${state.grade}` +
    (state.previewSize === '1920x1080' ? ' wide' : state.previewSize === '1080x1350' ? ' tall' : '');
  if (document.body.classList.contains('cover-shot')) {
    posterEl.className = `poster grade-${state.grade}`;
  }

  // Caption text and sizes scale with the poster.
  tagEl.textContent = state.tag.toUpperCase();
  titleEl.textContent = state.title.toUpperCase();
  subtitleEl.textContent = state.subtitle.toUpperCase();
  tagEl.style.fontSize = `${Math.max(11, Math.round(W * 0.024))}px`;
  titleEl.style.fontSize = `${Math.max(30, Math.round(W * 0.105))}px`;
  subtitleEl.style.fontSize = `${Math.max(11, Math.round(W * 0.028))}px`;

  panelsEl.innerHTML = '';
  const defs = LAYOUTS[state.layout].panels;
  defs.forEach((def, i) => {
    const geom = panelGeom(def, W, H);
    const div = document.createElement('div');
    div.className = 'panel' + (i === state.selected ? ' selected' : '');
    div.dataset.index = String(i);
    div.style.left = `${geom.x}px`;
    div.style.top = `${geom.y}px`;
    div.style.width = `${geom.w}px`;
    div.style.height = `${geom.h}px`;
    if (geom.clip) div.style.clipPath = `polygon(${geom.clip})`;
    const p = state.panels[i];
    const photo = state.photos[p.photo];
    if (photo) {
      const pl = imagePlacement(geom, photo.img, p.zoom, p.dxF, p.dyF);
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name;
      img.style.left = `${pl.x - geom.x}px`;
      img.style.top = `${pl.y - geom.y}px`;
      img.style.width = `${pl.w}px`;
      img.style.height = `${pl.h}px`;
      div.appendChild(img);
    } else {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Add a photo to fill this panel';
      div.appendChild(empty);
    }
    panelsEl.appendChild(div);
  });
  renderControls();
}

function renderControls() {
  document.querySelectorAll('#layoutRow button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradeRow button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  const select = document.getElementById('photoSelect');
  const current = state.panels[state.selected] ? state.panels[state.selected].photo : 0;
  select.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = photo.name;
    select.appendChild(opt);
  });
  if (state.photos.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'No photos yet';
    select.appendChild(opt);
  }
  select.value = String(current);
  const zoom = document.getElementById('zoomInput');
  zoom.value = String(state.panels[state.selected] ? state.panels[state.selected].zoom : 1);
}

/* ---------- photos ---------- */

function addPhoto(name, url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const existing = state.photos.findIndex((p) => p.url === url);
      if (existing >= 0) {
        resolve(existing);
        return;
      }
      state.photos.push({ name, img, url });
      const index = state.photos.length - 1;
      if (state.photos.length === 1) {
        state.panels.forEach((p) => { p.photo = index; });
      }
      resolve(index);
    };
    img.onerror = () => reject(new Error(`Could not load ${name}`));
    img.src = url;
  });
}

async function loadSamplePhoto(which) {
  const sample = SAMPLE_PHOTOS.find((s) => s.name.toLowerCase() === String(which).toLowerCase()) || SAMPLE_PHOTOS[0];
  const index = await addPhoto(sample.name, sample.url);
  state.panels.forEach((p) => { if (state.photos.length <= 2) p.photo = index; });
  renderPoster();
  return index;
}

function setLayout(name) {
  if (!LAYOUTS[name]) return;
  state.layout = name;
  ensurePanels();
  renderPoster();
}

function setGrade(name) {
  if (!GRADES[name]) return;
  state.grade = name;
  renderPoster();
}

function setPreviewSize(size) {
  state.previewSize = size;
  const sel = document.getElementById('sizeSelect');
  if (sel) sel.value = size;
  renderPoster();
}

/* ---------- export ---------- */

function drawGradeOverlay(ctx, W, H) {
  if (state.grade === 'sunset') {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const glow = ctx.createRadialGradient(W * 0.78, H * 0.08, 0, W * 0.78, H * 0.08, W * 0.55);
    glow.addColorStop(0, 'rgba(255,205,90,0.55)');
    glow.addColorStop(1, 'rgba(255,205,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(255,140,60,0.20)');
    wash.addColorStop(0.55, 'rgba(255,60,140,0.30)');
    wash.addColorStop(1, 'rgba(70,20,110,0.40)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else if (state.grade === 'neon') {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    const wash = ctx.createLinearGradient(0, 0, W, H);
    wash.addColorStop(0, 'rgba(255,0,180,0.30)');
    wash.addColorStop(0.6, 'rgba(0,220,255,0.30)');
    wash.addColorStop(1, 'rgba(120,0,255,0.35)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else {
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(8,8,28,0.18)');
    wash.addColorStop(1, 'rgba(8,8,28,0.30)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    const vig = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }
}

function wrapTitleLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !line) {
      line = trial;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function drawCaption(ctx, W, H) {
  const scrim = ctx.createLinearGradient(0, H * 0.58, 0, H);
  scrim.addColorStop(0, 'rgba(12,5,22,0)');
  scrim.addColorStop(1, 'rgba(12,5,22,0.78)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H * 0.58, W, H * 0.42);

  const pad = W * 0.05;
  const titleSize = Math.round(W * 0.105);
  const subSize = Math.round(W * 0.028);
  const tagSize = Math.round(W * 0.026);
  const grade = GRADES[state.grade];

  // Subtitle sits at the bottom.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `700 ${subSize}px "Segoe UI", system-ui, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`; } catch (e) { /* older canvas */ }
  ctx.fillStyle = '#ffffff';
  const subY = H * 0.955;
  ctx.fillText(state.subtitle.toUpperCase(), pad, subY);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }

  // Title above it, wrapped to at most two lines.
  ctx.font = `${titleSize}px Anton, sans-serif`;
  const lines = wrapTitleLines(ctx, state.title.toUpperCase(), W * 0.9);
  const lineHeight = Math.round(titleSize * 0.95);
  let titleBottom = subY - subSize - Math.round(W * 0.012);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#14091d';
  ctx.lineWidth = Math.max(2, Math.round(titleSize * 0.055));
  ctx.fillStyle = grade.titleColor;
  for (let i = lines.length - 1; i >= 0; i--) {
    const y = titleBottom - (lines.length - 1 - i) * lineHeight;
    ctx.strokeText(lines[i], pad, y);
    ctx.fillText(lines[i], pad, y);
  }
  const titleTop = titleBottom - (lines.length - 1) * lineHeight - titleSize;

  // Tag pill above the title.
  ctx.font = `800 ${tagSize}px "Segoe UI", system-ui, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(tagSize * 0.22)}px`; } catch (e) { /* older canvas */ }
  const tagText = state.tag.toUpperCase();
  const tagWidth = ctx.measureText(tagText).width + tagSize * 1.8;
  const tagHeight = tagSize * 2.1;
  const tagY = titleTop - tagHeight - Math.round(W * 0.012);
  ctx.fillStyle = 'rgba(8,4,16,0.72)';
  pillPath(ctx, pad, tagY, tagWidth, tagHeight, tagHeight / 2);
  ctx.fill();
  ctx.fillStyle = state.grade === 'neon' ? '#ff5ce1' : state.grade === 'dark' ? '#ffd23e' : '#37f4ff';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagText, pad + tagSize * 0.9, tagY + tagHeight / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
}

function pillPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPoster(ctx, W, H) {
  ctx.fillStyle = '#1c1026';
  ctx.fillRect(0, 0, W, H);
  const defs = LAYOUTS[state.layout].panels;
  defs.forEach((def, i) => {
    const geom = panelGeom(def, W, H);
    const p = state.panels[i];
    const photo = state.photos[p.photo];
    ctx.save();
    ctx.beginPath();
    if (geom.pts) {
      ctx.moveTo(geom.pts[0][0], geom.pts[0][1]);
      for (let k = 1; k < geom.pts.length; k++) ctx.lineTo(geom.pts[k][0], geom.pts[k][1]);
      ctx.closePath();
    } else {
      ctx.rect(geom.x, geom.y, geom.w, geom.h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = Math.max(2, Math.round(W * 0.003));
    ctx.stroke();
    ctx.clip();
    if (photo) {
      ctx.filter = GRADES[state.grade].canvasFilter;
      const pl = imagePlacement(geom, photo.img, p.zoom, p.dxF, p.dyF);
      ctx.drawImage(photo.img, pl.x, pl.y, pl.w, pl.h);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#2a1838';
      ctx.fillRect(geom.x, geom.y, geom.w, geom.h);
    }
    ctx.restore();
  });
  drawGradeOverlay(ctx, W, H);
  drawCaption(ctx, W, H);
}

async function exportPNG(w, h) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawPoster(canvas.getContext('2d'), w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---------- wiring ---------- */

function wireControls() {
  document.querySelectorAll('#layoutRow button').forEach((b) => {
    b.addEventListener('click', () => setLayout(b.dataset.layout));
  });
  document.querySelectorAll('#gradeRow button').forEach((b) => {
    b.addEventListener('click', () => setGrade(b.dataset.grade));
  });
  document.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', async () => {
      const [w, h] = b.dataset.export.split('x').map(Number);
      const blob = await exportPNG(w, h);
      downloadBlob(blob, `sunset-city-cover-${w}x${h}.png`);
    });
  });
  document.getElementById('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value || 'UNTITLED';
    renderPoster();
  });
  document.getElementById('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    renderPoster();
  });
  document.getElementById('tagInput').addEventListener('input', (e) => {
    state.tag = e.target.value || 'SUNSET CITY';
    renderPoster();
  });
  document.getElementById('photoSelect').addEventListener('change', (e) => {
    state.panels[state.selected].photo = Number(e.target.value);
    renderPoster();
  });
  document.getElementById('zoomInput').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    renderPoster();
  });
  document.getElementById('fillAll').addEventListener('click', () => {
    const photo = state.panels[state.selected].photo;
    state.panels.forEach((p) => { p.photo = photo; });
    renderPoster();
  });
  document.getElementById('resetPanel').addEventListener('click', () => {
    const p = state.panels[state.selected];
    p.zoom = 1;
    p.dxF = 0;
    p.dyF = 0;
    renderPoster();
  });
  document.getElementById('sizeSelect').addEventListener('change', (e) => {
    setPreviewSize(e.target.value);
  });
  document.getElementById('loadSample').addEventListener('click', () => {
    loadSamplePhoto('pier').catch(() => {});
  });
  document.getElementById('fileInput').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        await addPhoto(file.name.replace(/\.[^.]+$/, ''), url);
      } catch (err) {
        URL.revokeObjectURL(url);
      }
    }
    renderPoster();
    e.target.value = '';
  });

  // Drag the selected panel's photo to reposition it.
  let drag = null;
  posterEl.addEventListener('pointerdown', (e) => {
    const panelDiv = e.target.closest('.panel');
    if (!panelDiv) return;
    const rect = panelDiv.getBoundingClientRect();
    state.selected = Number(panelDiv.dataset.index);
    renderPoster();
    drag = { index: state.selected, startX: e.clientX, startY: e.clientY, rect };
    posterEl.setPointerCapture(e.pointerId);
  });
  posterEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = state.panels[drag.index];
    p.dxF = clamp(p.dxF + (e.clientX - drag.startX) / drag.rect.width, -0.4, 0.4);
    p.dyF = clamp(p.dyF + (e.clientY - drag.startY) / drag.rect.height, -0.4, 0.4);
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    renderPoster();
  });
  const endDrag = () => { drag = null; };
  posterEl.addEventListener('pointerup', endDrag);
  posterEl.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => renderPoster());
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/* ---------- deterministic screenshot setup (?shot=...) ---------- */

function sizePosterToViewport(sw, sh) {
  const scale = Math.min(window.innerWidth / sw, window.innerHeight / sh);
  const stage = document.querySelector('.stage-wrap');
  stage.style.display = 'grid';
  stage.style.placeItems = 'center';
  posterEl.style.width = `${Math.round(sw * scale)}px`;
  posterEl.style.height = `${Math.round(sh * scale)}px`;
}

async function applyShotParams() {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (!shot) return;
  if (params.get('photo')) {
    try { await loadSamplePhoto(params.get('photo')); } catch (e) { /* keep going */ }
  }
  if (params.get('layout')) setLayout(params.get('layout'));
  if (params.get('grade')) setGrade(params.get('grade'));
  if (params.get('caption')) state.title = params.get('caption');
  if (params.get('subtitle')) state.subtitle = params.get('subtitle');
  if (params.get('tag')) state.tag = params.get('tag');
  if (params.get('size')) setPreviewSize(params.get('size'));
  if (shot === 'cover') {
    document.body.classList.add('cover-shot');
    const [sw, sh] = (params.get('size') || '1080x1080').split('x').map(Number);
    sizePosterToViewport(sw, sh);
  }
  renderPoster();
}

/* ---------- boot ---------- */

ensurePanels();
wireControls();
applyShotParams().then(() => renderPoster());
renderPoster();

/* Test hook for the maker's own verification runs. */
window.__coverMaker = { state, exportPNG, renderPoster, loadSamplePhoto, setLayout, setGrade, setPreviewSize };
