const PLACEHOLDER_RATIOS = [0.8, 1.5, 1, 0.667, 1.778, 0.8, 1.25, 0.75, 1, 0.667, 1.5, 0.8, 1, 1.6, 0.75, 0.8, 1.5, 1, 0.667, 1.25, 0.8, 1.5, 1, 0.75, 1.778];
const BENEATH = 3;
const STAGGER = 70;

const body = document.body;
const table = document.getElementById('table');
const ticks = document.getElementById('ticks');
const countNow = document.getElementById('countNow');
const caption = document.getElementById('caption');
const prevButton = document.getElementById('prev');
const nextButton = document.getElementById('next');
const viewer = document.getElementById('viewer');
const sheet = document.getElementById('sheet');

let items = [];
let current = 0;
let viewing = false;
let busyUntil = 0;

const isPhone = () => innerWidth < 768;
const tilt = i => ((i * 37) % 7 - 3) * 0.45;

function fit(ratio, box) {
  const w = Math.min(box.w, box.h * ratio);
  return { w, h: w / ratio };
}

function boxes() {
  const W = innerWidth, H = innerHeight;
  if (isPhone()) {
    return {
      full: { x: 12, y: 72, w: W - 24, h: H - 132 },
      stage: { x: 20, y: 104, w: W - 40, h: H - 104 - 160 },
      seen: null,
    };
  }
  const g = Math.min(48, Math.max(20, W * 0.034));
  const left = Math.max(330, W * 0.26);
  return {
    full: { x: g, y: g + 64, w: W - 2 * g, h: H - 2 * g - 100 },
    stage: { x: left, y: g, w: W - left - g, h: H - 2 * g - 70 },
    seen: { x: g, y: H * 0.36, w: 150, h: H * 0.22 },
  };
}

function place(item, box, scaleBy = 1, rotate = 0) {
  const target = fit(item.ratio, box);
  const s = (target.w / item.base.w) * scaleBy;
  const x = box.x + box.w / 2 - item.base.w / 2;
  const y = box.y + box.h / 2 - item.base.h / 2;
  return `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(4)}) rotate(${rotate.toFixed(2)}deg)`;
}

function layout({ from = current, instant = false } = {}) {
  const b = boxes();
  const top = fit(items[current].ratio, b.stage);
  const under = { x: b.stage.x + (b.stage.w - top.w) / 2, y: b.stage.y + (b.stage.h - top.h) / 2, w: top.w, h: top.h };
  items.forEach((item, i) => {
    item.base = fit(item.ratio, b.full);
    const el = item.el;
    el.style.width = `${item.base.w}px`;
    el.style.height = `${item.base.h}px`;
    const changed = (i - from) * (i - current) <= 0 && from !== current;
    el.style.transitionDelay = instant || !changed ? '0ms' : `${Math.abs(i - from) * STAGGER}ms`;
    el.style.transitionDuration = instant ? '0ms' : '';

    let transform, hidden = false, depth;
    if (i === current) {
      transform = place(item, viewing ? b.full : b.stage);
      depth = 200;
    } else if (i > current) {
      hidden = viewing || i - current > BENEATH;
      transform = place(item, under, 0.985, tilt(i));
      depth = 200 - (i - current);
    } else {
      hidden = viewing || !b.seen;
      transform = b.seen ? place(item, b.seen, 1, tilt(i)) : place(item, b.stage, 0.9, -4);
      depth = 100 + i;
    }
    el.style.transform = transform;
    el.style.zIndex = depth;
    el.classList.toggle('is-hidden', hidden);
    el.classList.toggle('is-current', i === current);
    el.classList.toggle('is-seen', i < current);
    el.setAttribute('aria-hidden', String(i !== current));
    el.tabIndex = i === current ? 0 : -1;
  });
  [...ticks.children].forEach((tick, i) => {
    tick.classList.toggle('is-current', i === current);
    tick.classList.toggle('is-seen', i < current);
    tick.firstElementChild?.setAttribute('aria-current', i === current ? 'true' : 'false');
  });
  countNow.textContent = items[current].n;
  caption.textContent = items[current].title;
  prevButton.disabled = current === 0;
  nextButton.disabled = current === items.length - 1;
}

function go(index) {
  const target = Math.max(0, Math.min(items.length - 1, index));
  if (target === current || viewing) return;
  const from = current;
  current = target;
  busyUntil = performance.now() + 700 + Math.min(Math.abs(target - from), 6) * STAGGER;
  layout({ from });
}

function step(dir) {
  if (performance.now() < busyUntil) return;
  go(current + dir);
}

function setViewing(on, byKey = false) {
  viewing = on;
  body.classList.toggle('is-viewing', on);
  viewer.hidden = !on;
  layout();
  if (byKey) (on ? document.getElementById('viewerClose') : items[current].el).focus({ preventScroll: true });
}

function openSheet(id) {
  sheet.classList.add('is-open');
  sheet.removeAttribute('inert');
  sheet.setAttribute('aria-hidden', 'false');
  document.getElementById(id).scrollIntoView({ block: 'start' });
  document.getElementById('sheetClose').focus();
}

function closeSheet() {
  sheet.classList.remove('is-open');
  sheet.setAttribute('inert', '');
  sheet.setAttribute('aria-hidden', 'true');
}

function blank(item, i) {
  const hue = (i * 47 + 20) % 360;
  const box = document.createElement('div');
  box.className = 'blank';
  box.style.setProperty('--angle', `${(i * 53) % 180 + 100}deg`);
  box.style.setProperty('--from', `hsl(${hue} 7% ${84 - (i % 4) * 2}%)`);
  box.style.setProperty('--to', `hsl(${(hue + 30) % 360} 9% ${74 - (i % 3) * 3}%)`);
  box.innerHTML = `<span aria-hidden="true">${item.n}</span>`;
  return box;
}

function build(data) {
  document.getElementById('countAll').textContent = `/ ${String(data.length).padStart(2, '0')}`;
  items = data.map((entry, i) => ({ ...entry, ratio: PLACEHOLDER_RATIOS[i % PLACEHOLDER_RATIOS.length] }));
  items.forEach((item, i) => {
    const el = document.createElement('figure');
    el.className = 'print';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', item.title ? `${item.n}, ${item.title}` : `Immagine ${item.n}`);
    if (item.file) {
      const img = new Image();
      img.decoding = 'async';
      img.alt = '';
      img.onload = () => { item.ratio = img.naturalWidth / img.naturalHeight; layout({ instant: true }); };
      if (item.srcset) {
        img.srcset = item.srcset.split(', ').map(s => `media/${s}`).join(', ');
        img.sizes = '100vw';
      }
      img.src = `media/${item.file}`;
      el.append(img);
    } else {
      el.append(blank(item, i));
    }
    el.addEventListener('click', () => {
      if (moved) { moved = false; return; }
      if (i === current) setViewing(!viewing);
      else if (i < current) go(i);
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') setViewing(!viewing, true); });
    item.el = el;
    table.append(el);

    const li = document.createElement('li');
    li.className = 'tick';
    const tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'tick-hit';
    tick.setAttribute('aria-label', `Immagine ${item.n}`);
    tick.addEventListener('click', () => go(i));
    li.append(tick);
    ticks.append(li);
  });
}

function enter() {
  const b = boxes();
  items.forEach((item, i) => {
    item.base = fit(item.ratio, b.full);
    Object.assign(item.el.style, { width: `${item.base.w}px`, height: `${item.base.h}px`, transitionDuration: '0ms' });
    const stage = { ...b.stage, y: b.stage.y + 60 };
    item.el.style.transform = place(item, stage, 0.97, tilt(i));
    item.el.classList.add('is-hidden');
  });
  table.offsetWidth;
  layout();
  items.slice(0, BENEATH + 1).forEach((item, i) => {
    item.el.style.transitionDelay = `${300 + (BENEATH - i) * 160}ms`;
  });
}

let startX = 0, startY = 0, moved = false;
table.addEventListener('pointerdown', e => { startX = e.clientX; startY = e.clientY; moved = false; });
table.addEventListener('pointerup', e => {
  const dx = e.clientX - startX, dy = e.clientY - startY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
  moved = true;
  if (viewing) return;
  const main = Math.abs(dx) > Math.abs(dy) ? dx : dy;
  step(main < 0 ? 1 : -1);
});

let wheelSum = 0, wheelTimer;
addEventListener('wheel', e => {
  if (viewing || sheet.classList.contains('is-open')) return;
  e.preventDefault();
  wheelSum += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { wheelSum = 0; }, 180);
  if (Math.abs(wheelSum) > 50) {
    step(wheelSum > 0 ? 1 : -1);
    wheelSum = 0;
  }
}, { passive: false });

addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (sheet.classList.contains('is-open')) closeSheet();
    else if (viewing) setViewing(false, true);
    return;
  }
  if (sheet.classList.contains('is-open') || viewing) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); }
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
});

prevButton.addEventListener('click', () => step(-1));
nextButton.addEventListener('click', () => step(1));
document.getElementById('viewerClose').addEventListener('click', () => setViewing(false));
document.getElementById('sheetClose').addEventListener('click', closeSheet);
document.querySelectorAll('[data-open]').forEach(link => link.addEventListener('click', () => openSheet(link.dataset.open)));

let resizeFrame;
addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => layout({ instant: true }));
});

fetch('data/images.json')
  .then(r => r.json())
  .then(data => { build(data); enter(); });
