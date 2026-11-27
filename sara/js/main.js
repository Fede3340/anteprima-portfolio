const PALETTE = [
  ['--red', '--ink'], ['--yellow', '--ink'], ['--blue', '--paper'], ['--pink', '--ink'],
  ['--green', '--ink'], ['--ink', '--yellow'], ['--orange', '--ink'], ['--paper', '--ink'],
  ['--blue', '--paper'], ['--yellow', '--ink'], ['--red', '--ink'], ['--pink', '--ink'],
];

const NAME_COLORS = [
  ['--yellow', '--ink'], ['--red', '--ink'], ['--blue', '--paper'], ['--pink', '--ink'],
  ['--green', '--ink'], ['--orange', '--ink'], ['--ink', '--yellow'], ['--yellow', '--ink'], ['--blue', '--paper'],
];

const DESK_SLOTS = [
  { x: 4, y: 6, w: 23, r: -3 },
  { x: 29, y: 3, w: 18, r: 2.5 },
  { x: 49, y: 9, w: 21, r: -1.5 },
  { x: 73, y: 4, w: 21, r: 3.5 },
  { x: 9, y: 42, w: 20, r: 4 },
  { x: 33, y: 36, w: 30, r: -2, landscape: true },
  { x: 68, y: 39, w: 22, r: 1.5 },
  { x: 37, y: 60, w: 18, r: -4 },
  { x: 4, y: 75, w: 22, r: 2 },
  { x: 58, y: 72, w: 32, r: -1, landscape: true },
  { x: 28, y: 88, w: 19, r: 3 },
  { x: 76, y: 92, w: 18, r: -2.5 },
];

const PHONE_WIDTHS = [64, 58, 62, 56];
const PHONE_ROT = [-3, 2.5, -1.5, 3.5, -2.5, 1.5];

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const board = document.querySelector('[data-board]');
const viewer = document.querySelector('[data-viewer]');
const stage = viewer.querySelector('[data-stage]');
const countEl = viewer.querySelector('[data-count]');
const titleEl = viewer.querySelector('[data-title]');

let zTop = 10;
let works = [];
let slots = [];

const rand = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

const tornPolygon = (seed, jag = 3) => {
  const r = rand(seed);
  const pts = [];
  const edge = (from, to, fixed, axis) => {
    for (let t = 0; t <= 4; t++) {
      const v = from + (to - from) * t / 4;
      const j = fixed === 0 ? r() * jag : 100 - r() * jag;
      pts.push(axis === 'x' ? `${v}% ${j}%` : `${j}% ${v}%`);
    }
  };
  edge(0, 100, 0, 'x');
  edge(0, 100, 100, 'y');
  edge(100, 0, 100, 'x');
  edge(100, 0, 0, 'y');
  return `polygon(${pts.join(',')})`;
};

function makeDraggable(el, { angle = () => 0, onStart, onEnd } = {}) {
  let start = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, ox: gsap.getProperty(el, 'x'), oy: gsap.getProperty(el, 'y'), id: e.pointerId, moved: false };
    el.dataset.dragged = '';
  });
  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      start.moved = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      onStart?.();
    }
    const a = -angle() * Math.PI / 180;
    gsap.set(el, {
      x: start.ox + dx * Math.cos(a) - dy * Math.sin(a),
      y: start.oy + dx * Math.sin(a) + dy * Math.cos(a),
      rotation: gsap.utils.clamp(-8, 8, (e.movementX || 0) * 0.6),
    });
  });
  const end = () => {
    if (!start) return;
    if (start.moved) {
      el.dataset.dragged = '1';
      el.classList.remove('is-dragging');
      gsap.to(el, { rotation: (Math.random() - 0.5) * 6, duration: 0.5, ease: 'back.out(2)' });
      onEnd?.();
    }
    start = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function buildName() {
  let k = 0;
  document.querySelectorAll('.name__row').forEach((row) => {
    [...row.dataset.word].forEach((letter) => {
      const [bg, fg] = NAME_COLORS[k % NAME_COLORS.length];
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = letter;
      chip.style.background = `var(${bg}) url("img/paper.webp") center / 300px auto`;
      chip.style.backgroundBlendMode = 'multiply';
      chip.style.color = `var(${fg})`;
      chip.style.clipPath = tornPolygon(k * 97 + 13, 4);
      gsap.set(chip, { rotation: [-4, 3, -2, 5, -3, 2, -5, 4, -1][k % 9] });
      makeDraggable(chip, { onStart: () => { chip.style.zIndex = ++zTop; } });
      row.append(chip);
      k++;
    });
  });
}

function sheetMarkup(work, i) {
  const sheet = document.createElement('button');
  sheet.type = 'button';
  sheet.className = 'sheet';
  sheet.setAttribute('aria-label', `Foglio ${work.number}${work.title ? `, ${work.title}` : ', in arrivo'}`);
  sheet.innerHTML = `<span class="sheet__number">${work.number}</span><span class="sheet__state">in arrivo</span>`;
  if (work.file) {
    const img = new Image();
    img.src = work.file;
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.addEventListener('load', () => { works[i].ratio = img.naturalHeight / img.naturalWidth; layout(); });
    sheet.append(img);
    sheet.classList.add('has-image');
  }
  return sheet;
}

function buildBoard() {
  works.forEach((work, i) => {
    const [bg, fg] = PALETTE[i % PALETTE.length];
    const li = document.createElement('li');
    li.className = 'slot';
    li.style.setProperty('--c', `var(${bg})`);
    li.style.setProperty('--t', `var(${fg})`);
    li.innerHTML = '<span class="slot__scrap slot__scrap--a"></span><span class="slot__scrap slot__scrap--b"></span><span class="slot__tape slot__tape--a"></span><span class="slot__tape slot__tape--b"></span>';
    const sheet = sheetMarkup(work, i);
    li.insertBefore(sheet, li.querySelector('.slot__tape'));
    const slot = { li, sheet, rotation: 0, index: i };
    makeDraggable(sheet, {
      angle: () => slot.rotation,
      onStart: () => { li.style.zIndex = ++zTop; li.classList.add('is-torn'); },
    });
    sheet.addEventListener('click', () => {
      if (sheet.dataset.dragged === '1') return;
      li.style.zIndex = ++zTop;
      openViewer(i);
    });
    slots.push(slot);
    board.append(li);
  });
}

function layout() {
  const W = board.clientWidth;
  const phone = W <= 700;
  const vw = W / 100;
  let bottom = 0;
  let y = 4;
  slots.forEach((slot, i) => {
    let spec;
    if (phone) {
      const landscape = i === 5 || i === 9;
      const w = landscape ? 84 : PHONE_WIDTHS[i % 4];
      spec = { x: landscape ? 8 : (i % 2 ? 100 - w - 5 : 5), y, w, r: PHONE_ROT[i % PHONE_ROT.length], landscape };
    } else {
      spec = DESK_SLOTS[i % DESK_SLOTS.length];
    }
    const ratio = works[i].ratio || (spec.landscape ? 0.707 : 1.414);
    const w = spec.w * vw;
    const h = w * ratio;
    if (phone) y += (h / vw) * 0.8;
    slot.rotation = spec.r;
    Object.assign(slot.li.style, {
      left: `${spec.x * vw}px`, top: `${spec.y * vw}px`, width: `${w}px`, height: `${h}px`, rotate: `${spec.r}deg`,
    });
    slot.sheet.style.setProperty('--num', `${Math.round(Math.min(w, h) * 0.22)}px`);
    bottom = Math.max(bottom, spec.y * vw + h);
  });
  board.style.setProperty('--board-h', `${bottom + 6 * vw}px`);
}

function revealBoard() {
  if (reduced) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      const slot = slots.find((s) => s.li === entry.target);
      const tapes = slot.li.querySelectorAll('.slot__tape');
      gsap.timeline()
        .fromTo(slot.sheet, { scale: 1.14, autoAlpha: 0, rotation: 5 }, { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.42, ease: 'back.out(2)' })
        .fromTo(tapes, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 0.9, duration: 0.22, stagger: 0.08, ease: 'power2.out', transformOrigin: '0% 50%' }, '-=0.12');
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  slots.forEach((slot) => {
    gsap.set(slot.sheet, { autoAlpha: 0 });
    gsap.set(slot.li.querySelectorAll('.slot__tape'), { autoAlpha: 0 });
    io.observe(slot.li);
  });
}

function introHero() {
  if (reduced) return;
  const chips = document.querySelectorAll('.chip');
  gsap.timeline({ delay: 0.15 })
    .from(chips, { scale: 1.35, autoAlpha: 0, duration: 0.38, stagger: 0.07, ease: 'back.out(2.2)' })
    .from('.sticker--city', { scale: 0.4, rotation: -60, autoAlpha: 0, duration: 0.5, ease: 'back.out(2)' }, '-=0.2')
    .from('.slip--drawings', { y: -30, autoAlpha: 0, duration: 0.4, ease: 'power3.out' }, '-=0.3');
}

const state = { index: -1, figure: null, busy: false, opener: null };

function targetBox(ratio) {
  const reserveBottom = innerWidth <= 700 ? 150 : 130;
  const maxW = Math.min(innerWidth - 32, 980);
  const maxH = innerHeight - reserveBottom - 32;
  const w = Math.min(maxW, maxH / ratio);
  const h = w * ratio;
  return { w, h, left: (innerWidth - w) / 2, top: Math.max(24, (innerHeight - reserveBottom - h) / 2 + 8) };
}

function makeFigure(i) {
  const slot = slots[i];
  const ratio = slot.li.offsetHeight / slot.li.offsetWidth;
  const box = targetBox(ratio);
  const fig = document.createElement('div');
  fig.className = 'viewer__sheet slot';
  fig.style.cssText = `width:${box.w}px;height:${box.h}px;left:${box.left}px;top:${box.top}px;rotate:0deg;--c:${slot.li.style.getPropertyValue('--c')};--t:${slot.li.style.getPropertyValue('--t')}`;
  const sheet = slot.sheet.cloneNode(true);
  sheet.removeAttribute('style');
  sheet.style.setProperty('--num', `${Math.round(box.w * 0.18)}px`);
  sheet.setAttribute('tabindex', '-1');
  sheet.setAttribute('aria-hidden', 'true');
  fig.append(sheet);
  stage.append(fig);
  swipe(fig);
  return { fig, box };
}

function updateInfo(i) {
  countEl.textContent = `${works[i].number} / ${String(works.length).padStart(2, '0')}`;
  titleEl.textContent = works[i].title || 'in arrivo';
}

function openViewer(i) {
  if (state.busy || state.index !== -1) return;
  state.busy = true;
  state.index = i;
  state.opener = slots[i].sheet;
  const slot = slots[i];
  const from = slot.sheet.getBoundingClientRect();
  viewer.hidden = false;
  document.body.classList.add('is-locked');
  updateInfo(i);
  const { fig, box } = makeFigure(i);
  state.figure = fig;
  const dx = from.left + from.width / 2 - (box.left + box.w / 2);
  const dy = from.top + from.height / 2 - (box.top + box.h / 2);
  const scale = slot.li.offsetWidth / box.w;
  const rotation = slot.rotation + gsap.getProperty(slot.sheet, 'rotation');
  const tl = gsap.timeline({ onComplete: () => { state.busy = false; viewer.querySelector('[data-close]').focus({ preventScroll: true }); } });
  tl.fromTo(viewer, { backgroundColor: 'rgba(21,18,15,0)' }, { backgroundColor: 'rgba(21,18,15,0.94)', duration: reduced ? 0 : 0.35 }, 0)
    .fromTo(fig, { x: dx, y: dy, scale, rotation }, { x: 0, y: 0, scale: 1, rotation: -1, duration: reduced ? 0 : 0.6, ease: 'power3.inOut' }, 0)
    .fromTo('.viewer__info, .viewer__controls', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, reduced ? 0 : 0.4)
    .set(slot.sheet, { visibility: 'hidden' }, 0)
    .call(() => slot.li.classList.add('is-torn'), null, 0);
}

function closeViewer() {
  if (state.busy || state.index === -1) return;
  state.busy = true;
  const slot = slots[state.index];
  const fig = state.figure;
  gsap.set(slot.sheet, { visibility: 'visible', autoAlpha: 0 });
  const to = slot.sheet.getBoundingClientRect();
  const box = fig.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (box.left + box.width / 2) + gsap.getProperty(fig, 'x');
  const dy = to.top + to.height / 2 - (box.top + box.height / 2) + gsap.getProperty(fig, 'y');
  const scale = slot.li.offsetWidth / fig.offsetWidth;
  const rotation = slot.rotation + gsap.getProperty(slot.sheet, 'rotation');
  gsap.timeline({
    onComplete: () => {
      gsap.set(slot.sheet, { autoAlpha: 1 });
      fig.remove();
      viewer.hidden = true;
      document.body.classList.remove('is-locked');
      state.index = -1;
      state.figure = null;
      state.busy = false;
      state.opener?.focus({ preventScroll: true });
    },
  })
    .to('.viewer__info, .viewer__controls', { autoAlpha: 0, duration: 0.15 }, 0)
    .to(fig, { x: dx, y: dy, scale, rotation, duration: reduced ? 0 : 0.5, ease: 'power3.inOut' }, 0)
    .to(viewer, { backgroundColor: 'rgba(21,18,15,0)', duration: reduced ? 0 : 0.4 }, 0.1);
}

function step(dir) {
  if (state.busy || state.index === -1) return;
  state.busy = true;
  const old = state.figure;
  const prevSlot = slots[state.index];
  const next = (state.index + dir + works.length) % works.length;
  gsap.set(prevSlot.sheet, { visibility: 'visible' });
  gsap.set(slots[next].sheet, { visibility: 'hidden' });
  slots[next].li.classList.add('is-torn');
  state.index = next;
  updateInfo(next);
  gsap.to(old, {
    x: -dir * innerWidth * 0.9, y: 60, rotation: -dir * 22, duration: reduced ? 0 : 0.45, ease: 'power2.in', onComplete: () => old.remove(),
  });
  const { fig } = makeFigure(next);
  state.figure = fig;
  gsap.fromTo(fig, { scale: 1.12, autoAlpha: 0, rotation: dir * 4 }, {
    scale: 1, autoAlpha: 1, rotation: -1, duration: reduced ? 0 : 0.42, delay: reduced ? 0 : 0.18, ease: 'back.out(1.8)', onComplete: () => { state.busy = false; },
  });
}

function swipe(fig) {
  let start = null;
  fig.addEventListener('pointerdown', (e) => {
    if (state.busy) return;
    start = { x: e.clientX, id: e.pointerId };
    fig.setPointerCapture(e.pointerId);
  });
  fig.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    gsap.set(fig, { x: dx, rotation: -1 + dx * 0.03 });
  });
  const end = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    start = null;
    if (Math.abs(dx) > 90) step(dx < 0 ? 1 : -1);
    else gsap.to(fig, { x: 0, rotation: -1, duration: 0.4, ease: 'back.out(2)' });
  };
  fig.addEventListener('pointerup', end);
  fig.addEventListener('pointercancel', end);
}

viewer.querySelector('[data-close]').addEventListener('click', closeViewer);
viewer.querySelector('[data-prev]').addEventListener('click', () => step(-1));
viewer.querySelector('[data-next]').addEventListener('click', () => step(1));
stage.addEventListener('click', (e) => { if (e.target === stage) closeViewer(); });
addEventListener('keydown', (e) => {
  if (state.index === -1) return;
  if (e.key === 'Escape') closeViewer();
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
});

let lastWidth = innerWidth;
addEventListener('resize', () => {
  if (innerWidth === lastWidth) return;
  lastWidth = innerWidth;
  layout();
});

async function init() {
  buildName();
  introHero();
  works = await fetch('data/works.json').then((r) => r.json());
  buildBoard();
  layout();
  revealBoard();
}

init();
