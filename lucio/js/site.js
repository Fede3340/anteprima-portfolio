const BENEATH = 3;
const STAGGER = 70;

const body = document.body;
const masthead = document.querySelector('.masthead');
const seriesNav = document.getElementById('series');
const table = document.getElementById('table');
const ticks = document.getElementById('ticks');
const countNow = document.getElementById('countNow');
const countAll = document.getElementById('countAll');
const count = document.querySelector('.count');
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
  const top = masthead.getBoundingClientRect().bottom;
  if (isPhone()) {
    const y = top + 20;
    return {
      full: { x: 12, y: 72, w: W - 24, h: H - 132 },
      stage: { x: 20, y, w: W - 40, h: H - y - 160 },
      seen: null,
    };
  }
  const g = Math.min(48, Math.max(20, W * 0.034));
  const left = Math.max(330, W * 0.26);
  const seenY = top + 28;
  const seenH = Math.min(H * 0.22, count.getBoundingClientRect().top - 24 - seenY);
  return {
    full: { x: g, y: g + 64, w: W - 2 * g, h: H - 2 * g - 100 },
    stage: { x: left, y: g, w: W - left - g, h: H - 2 * g - 70 },
    seen: seenH >= 80 ? { x: g, y: seenY, w: 150, h: seenH } : null,
  };
}

function place(item, box, scaleBy = 1, rotate = 0) {
  const target = fit(item.ratio, box);
  const s = (target.w / item.base.w) * scaleBy;
  const x = box.x + box.w / 2 - item.base.w / 2;
  const y = box.y + box.h / 2 - item.base.h / 2;
  return `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(4)}) rotate(${rotate.toFixed(2)}deg)`;
}

function load(item) {
  if (item.el.firstElementChild) return;
  const img = new Image();
  img.decoding = 'async';
  img.alt = '';
  img.sizes = `${Math.ceil(item.base.w)}px`;
  img.srcset = item.srcset.split(', ').map(s => `media/${s}`).join(', ');
  img.src = `media/${item.file}`;
  item.el.append(img);
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
    if (i >= current - 1 && i <= current + BENEATH + 1) load(item);

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

function build(set) {
  table.replaceChildren();
  ticks.replaceChildren();
  current = 0;
  countAll.textContent = `/ ${String(set.items.length).padStart(2, '0')}`;
  items = set.items.map(entry => ({ ...entry, ratio: entry.w / entry.h }));
  items.forEach((item, i) => {
    const el = document.createElement('figure');
    el.className = 'print';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${item.n}, ${item.title}`);
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
  [...seriesNav.children].forEach(button => button.setAttribute('aria-current', String(button.dataset.series === set.id)));
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

function show(set) {
  if (viewing) setViewing(false);
  build(set);
  enter();
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
  .then(series => {
    series.forEach(set => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'series-link';
      button.dataset.series = set.id;
      button.textContent = set.title;
      button.addEventListener('click', () => { if (button.getAttribute('aria-current') !== 'true') show(set); });
      seriesNav.append(button);
    });
    show(series[0]);
  });
