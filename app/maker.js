'use strict';

/* Sunset City Cover Maker — turns the user's own photos and a caption into
   a multi-panel poster-style cover, exported as a PNG. Everything runs
   offline in the browser: photos are read locally and never uploaded. */

const LAYOUTS = {
  hero: {
    label: 'Single hero',
    panels: [[0, 0, 1, 1]],
  },
  split: {
    label: 'Two-panel split',
    panels: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
  },
  triptych: {
    label: 'Three-panel triptych',
    panels: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
  },
  grid: {
    label: 'Four-panel grid',
    panels: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  },
  diagonal: {
    label: 'Diagonal feature',
    panels: [[0, 0, 0.62, 0.68], [0.62, 0, 0.38, 0.42], [0.62, 0.42, 0.38, 0.26], [0, 0.68, 1, 0.32]],
  },
};

const GRADES = {
  sunset: {
    label: 'Vice City sunset',
    filter: 'saturate(1.45) sepia(0.28) hue-rotate(-12deg) contrast(1.06) brightness(1.02)',
  },
  neon: {
    label: 'Neon nights',
    filter: 'saturate(1.9) contrast(1.18) hue-rotate(8deg) brightness(1.03)',
  },
  dark: {
    label: 'After dark',
    filter: 'brightness(0.8) contrast(1.12) saturate(0.85)',
  },
};

const PREVIEW_SIZES = {
  '1-1': 'Square 1:1',
  '4-5': 'Portrait 4:5',
  '16-9': 'Wide 16:9',
};

const EXPORT_SIZES = ['1080x1080', '1080x1350', '1920x1080'];

const state = {
  photos: [], // { name, url, img, w, h }
  panels: [], // { photo, scale, dx, dy } per layout slot
  layout: 'hero',
  grade: 'sunset',
  caption: 'SUNSET CITY',
  captionSize: 88,
  preview: '1-1',
  selected: 0,
  chosenPhoto: -1,
};

const poster = document.getElementById('poster');
const captionEl = document.getElementById('caption');
const statusEl = document.getElementById('status');
const trayEl = document.getElementById('tray');
const fileInput = document.getElementById('fileInput');
const captionInput = document.getElementById('captionInput');
const captionSizeInput = document.getElementById('captionSize');
const captionSizeValue = document.getElementById('captionSizeValue');

function setStatus(text) {
  statusEl.textContent = text;
}

function layoutRects() {
  return LAYOUTS[state.layout].panels;
}

/* ---------- poster construction ---------- */

function buildPoster() {
  poster.querySelectorAll('.panel').forEach((el) => el.remove());
  const overlay = document.getElementById('gradeOverlay');
  const rects = layoutRects();
  const old = state.panels;
  state.panels = rects.map((_, i) => old[i] || { photo: -1, scale: 1, dx: 0, dy: 0 });
  if (state.selected >= rects.length) state.selected = rects.length - 1;

  rects.forEach((rect, i) => {
    const panel = document.createElement('div');
    panel.className = 'panel' + (i === state.selected ? ' selected' : '');
    panel.dataset.index = String(i);
    panel.style.left = rect[0] * 100 + '%';
    panel.style.top = rect[1] * 100 + '%';
    panel.style.width = rect[2] * 100 + '%';
    panel.style.height = rect[3] * 100 + '%';
    attachPanelGestures(panel, i);
    poster.insertBefore(panel, overlay);
    fillPanel(i);
  });
}

function fillPanel(i) {
  const panel = poster.querySelector('.panel[data-index="' + i + '"]');
  if (!panel) return;
  panel.querySelectorAll('img, .panel-hint').forEach((el) => el.remove());
  const slot = state.panels[i];
  if (slot.photo < 0 || !state.photos[slot.photo]) {
    const hint = document.createElement('div');
    hint.className = 'panel-hint';
    hint.textContent = '+ PHOTO';
    panel.appendChild(hint);
    return;
  }
  const photo = state.photos[slot.photo];
  const img = document.createElement('img');
  img.src = photo.url;
  img.alt = photo.name;
  img.draggable = false;
  panel.appendChild(img);
  renderPanel(i);
}

function renderPanel(i) {
  const panel = poster.querySelector('.panel[data-index="' + i + '"]');
  const img = panel && panel.querySelector('img');
  if (!panel || !img) return;
  const slot = state.panels[i];
  const photo = state.photos[slot.photo];
  if (!photo) return;
  const pw = panel.clientWidth;
  const ph = panel.clientHeight;
  if (!pw || !ph) return;
  const fit = Math.max(pw / photo.w, ph / photo.h);
  const w = photo.w * fit * slot.scale;
  const h = photo.h * fit * slot.scale;
  const maxDx = Math.max(0, (w - pw) / 2);
  const maxDy = Math.max(0, (h - ph) / 2);
  slot.dx = Math.max(-maxDx, Math.min(maxDx, slot.dx));
  slot.dy = Math.max(-maxDy, Math.min(maxDy, slot.dy));
  img.style.width = w + 'px';
  img.style.height = h + 'px';
  img.style.transform = 'translate(-50%, -50%) translate(' + slot.dx + 'px,' + slot.dy + 'px)';
}

function renderAllPanels() {
  state.panels.forEach((_, i) => renderPanel(i));
}

function selectPanel(i) {
  state.selected = i;
  poster.querySelectorAll('.panel').forEach((el) => {
    el.classList.toggle('selected', Number(el.dataset.index) === i);
  });
}

/* ---------- panel gestures: drag to pan, wheel to zoom ---------- */

function attachPanelGestures(panel, i) {
  let drag = null;
  panel.addEventListener('pointerdown', (event) => {
    selectPanel(i);
    drag = {
      x: event.clientX,
      y: event.clientY,
      dx: state.panels[i].dx,
      dy: state.panels[i].dy,
      moved: false,
    };
    panel.setPointerCapture(event.pointerId);
  });
  panel.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const nx = drag.dx + (event.clientX - drag.x);
    const ny = drag.dy + (event.clientY - drag.y);
    if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 4) drag.moved = true;
    state.panels[i].dx = nx;
    state.panels[i].dy = ny;
    renderPanel(i);
  });
  panel.addEventListener('pointerup', () => {
    drag = null;
  });
  panel.addEventListener('pointercancel', () => {
    drag = null;
  });
  panel.addEventListener('wheel', (event) => {
    event.preventDefault();
    selectPanel(i);
    const slot = state.panels[i];
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    slot.scale = Math.max(1, Math.min(4, slot.scale * factor));
    renderPanel(i);
  }, { passive: false });
}

/* ---------- photos ---------- */

function addPhoto(photo) {
  state.photos.push(photo);
  const thumb = document.createElement('img');
  thumb.src = photo.url;
  thumb.alt = photo.name;
  thumb.title = photo.name;
  const index = state.photos.length - 1;
  thumb.addEventListener('click', () => {
    assignPhoto(state.selected, index);
    trayEl.querySelectorAll('img').forEach((el) => el.classList.remove('chosen'));
    thumb.classList.add('chosen');
    state.chosenPhoto = index;
  });
  trayEl.appendChild(thumb);
  const firstEmpty = state.panels.findIndex((slot) => slot.photo < 0);
  if (firstEmpty >= 0) assignPhoto(firstEmpty, index);
  setStatus('Photo added: ' + photo.name + '. Click a thumbnail to place it in the selected panel.');
}

function assignPhoto(panelIndex, photoIndex) {
  const slot = state.panels[panelIndex];
  if (!slot || !state.photos[photoIndex]) return;
  slot.photo = photoIndex;
  slot.scale = 1;
  slot.dx = 0;
  slot.dy = 0;
  fillPanel(panelIndex);
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ name: file.name, url, img, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('could not read ' + file.name));
    img.src = url;
  });
}

function loadSamplePhoto(path, name) {
  return fetch(path)
    .then((response) => {
      if (!response.ok) throw new Error('sample not found: ' + path);
      return response.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ name, url, img, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error('could not read ' + path));
        img.src = url;
      });
    });
}

fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files || []).filter((file) => file.type.indexOf('image/') === 0);
  for (const file of files) {
    try {
      addPhoto(await loadImageFile(file));
    } catch (error) {
      setStatus('Could not read ' + file.name + '.');
    }
  }
  fileInput.value = '';
});

/* ---------- controls ---------- */

function buildButtonBar(elementId, items, current, onPick) {
  const bar = document.getElementById(elementId);
  bar.innerHTML = '';
  Object.keys(items).forEach((key) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = items[key];
    button.dataset.key = key;
    if (key === current) button.classList.add('active');
    button.addEventListener('click', () => {
      bar.querySelectorAll('button').forEach((el) => el.classList.remove('active'));
      button.classList.add('active');
      onPick(key);
    });
    bar.appendChild(button);
  });
}

function applyLayout(key) {
  state.layout = key;
  poster.dataset.layout = key;
  buildPoster();
  setStatus('Layout: ' + LAYOUTS[key].label + '.');
}

function applyGrade(key) {
  state.grade = key;
  poster.classList.remove('grade-sunset', 'grade-neon', 'grade-dark');
  poster.classList.add('grade-' + key);
  setStatus('Grade: ' + GRADES[key].label + '.');
}

function applyPreviewSize(key) {
  state.preview = key;
  poster.dataset.ratio = key;
  requestAnimationFrame(renderAllPanels);
}

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  captionEl.textContent = state.caption;
});

captionSizeInput.addEventListener('input', () => {
  state.captionSize = Number(captionSizeInput.value);
  captionSizeValue.textContent = String(state.captionSize);
  captionEl.style.fontSize = state.captionSize + 'px';
});

new ResizeObserver(renderAllPanels).observe(poster);

/* ---------- grade overlay on canvas ---------- */

function drawGradeOverlay(ctx, w, h, grade) {
  ctx.save();
  if (grade === 'sunset') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,110,40,0.14)');
    g.addColorStop(0.68, 'rgba(255,45,120,0.22)');
    g.addColorStop(1, 'rgba(24,0,48,0.28)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (grade === 'neon') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,0,140,0.20)');
    g.addColorStop(0.6, 'rgba(0,230,255,0.18)');
    g.addColorStop(1, 'rgba(120,0,255,0.16)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    const g = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.3, w / 2, h * 0.42, Math.max(w, h) * 0.75);
    g.addColorStop(0.52, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.52)');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

/* ---------- export ---------- */

async function exportCover(sizeLabel) {
  const parts = sizeLabel.split('x');
  const W = Number(parts[0]);
  const H = Number(parts[1]);
  if (!W || !H) throw new Error('bad export size: ' + sizeLabel);
  try {
    await document.fonts.load('400 80px Anton');
    await document.fonts.ready;
  } catch (error) {
    /* The caption falls back to a system sans-serif if the font is not ready. */
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, W, H);

  const posterRect = poster.getBoundingClientRect();
  const scaleX = W / posterRect.width;
  const scaleY = H / posterRect.height;
  const rects = layoutRects();

  rects.forEach((rect, i) => {
    const x = rect[0] * W;
    const y = rect[1] * H;
    const w = rect[2] * W;
    const h = rect[3] * H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const slot = state.panels[i];
    const photo = slot && slot.photo >= 0 ? state.photos[slot.photo] : null;
    if (photo) {
      ctx.filter = GRADES[state.grade].filter;
      const fit = Math.max(w / photo.w, h / photo.h);
      const dw = photo.w * fit * slot.scale;
      const dh = photo.h * fit * slot.scale;
      const dx = x + (w - dw) / 2 + slot.dx * scaleX;
      const dy = y + (h - dh) / 2 + slot.dy * scaleY;
      ctx.drawImage(photo.img, dx, dy, dw, dh);
      ctx.filter = 'none';
    } else {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#241640');
      g.addColorStop(1, '#12081f');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  });

  drawGradeOverlay(ctx, W, H, state.grade);

  const text = state.caption.trim();
  if (text) {
    const pad = Math.round(W * 0.03);
    let size = Math.round(state.captionSize * scaleX);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const setFont = (px) => {
      ctx.font = '400 ' + px + 'px Anton, sans-serif';
    };
    setFont(size);
    const maxWidth = W - pad * 2;
    while (size > 24 && ctx.measureText(text).width > maxWidth) {
      size = Math.round(size * 0.92);
      setFont(size);
    }
    const bandTop = H - Math.round(size * 2.1);
    const band = ctx.createLinearGradient(0, bandTop, 0, H);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.55, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = band;
    ctx.fillRect(0, bandTop, W, H - bandTop);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, Math.round(size / 14));
    ctx.strokeStyle = '#ff2e88';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = Math.round(size / 4);
    ctx.shadowOffsetY = Math.round(size / 22);
    ctx.strokeText(text, pad, H - Math.round(size * 0.32));
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, pad, H - Math.round(size * 0.32));
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sunset-city-cover-' + W + 'x' + H + '.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus('Exported ' + W + ' x ' + H + ' PNG.');
  return { width: W, height: H, bytes: blob.size };
}

document.querySelectorAll('.export-btn').forEach((button) => {
  button.addEventListener('click', () => {
    exportCover(button.dataset.export).catch(() => {
      setStatus('Export failed. Try loading a photo first.');
    });
  });
});

/* ---------- demo mode for screenshots: ?demo=1 ---------- */

async function runDemo() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('layout')) applyLayout(params.get('layout'));
  if (params.get('grade')) applyGrade(params.get('grade'));
  if (params.get('caption')) {
    captionInput.value = params.get('caption');
    state.caption = params.get('caption');
    captionEl.textContent = state.caption;
  }
  if (params.get('demo') !== '1') return;
  try {
    const pier = await loadSamplePhoto('samples/pier.jpg', 'pier.jpg');
    const boulevard = await loadSamplePhoto('samples/boulevard.jpg', 'boulevard.jpg');
    if (state.layout === 'hero') applyLayout('grid');
    addPhoto(pier);
    addPhoto(boulevard);
    assignPhoto(2, 0);
    assignPhoto(3, 1);
    setStatus('Demo cover loaded from the bundled sample photos.');
  } catch (error) {
    setStatus('Demo photos could not be loaded.');
  }
}

/* ---------- init ---------- */

buildButtonBar('layoutBar', Object.fromEntries(Object.entries(LAYOUTS).map(([k, v]) => [k, v.label])), state.layout, applyLayout);
buildButtonBar('gradeBar', Object.fromEntries(Object.entries(GRADES).map(([k, v]) => [k, v.label])), state.grade, applyGrade);
buildButtonBar('sizeBar', PREVIEW_SIZES, state.preview, applyPreviewSize);
captionEl.style.fontSize = state.captionSize + 'px';
buildPoster();
runDemo();

window.sunsetCity = { state, exportCover, LAYOUTS, GRADES, EXPORT_SIZES };
