const tokens = getComputedStyle(document.documentElement);
const EASE = tokens.getPropertyValue('--ease').trim();
const TIME_TEXT = parseFloat(tokens.getPropertyValue('--time-text'));
const TIME_FRAME = parseFloat(tokens.getPropertyValue('--time-frame'));
const HOLD_DELAY = 400;
const HOLD_STEP = 200;
const READY_AHEAD = 4;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const wait = (time) => new Promise((done) => setTimeout(done, time));

function fadeIn(element, duration) {
  return reducedMotion.matches ? null : element.animate({ opacity: [0, 1] }, { duration, easing: EASE });
}

const mark = document.querySelector('.axis-mark');
const dayLabel = document.querySelector('.bar-day');
let atMiddle = null;
let pointed = null;

function showMoment() {
  const { at, day } = (pointed ?? atMiddle).dataset;
  mark.style.setProperty('--at', at);
  if (dayLabel.textContent === day) return;
  dayLabel.textContent = day;
  fadeIn(dayLabel, TIME_TEXT);
}

function follow(element) {
  atMiddle = element;
  showMoment();
}

// The observed area ends at mid-screen and has no top: an element is in it once its top has gone past the middle.
const moments = [...document.querySelectorAll('[data-day]:not(.state)')];
const pastMiddle = new Set();
const middle = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) pastMiddle.add(entry.target);
      else pastMiddle.delete(entry.target);
    }
    const latest = moments.findLast((element) => pastMiddle.has(element));
    if (latest) follow(latest);
  },
  { rootMargin: '1000000px 0px -50% 0px' },
);
moments.forEach((element) => middle.observe(element));

function point(holder) {
  if (holder === pointed) return;
  pointed = holder;
  if (pointed ?? atMiddle) showMoment();
}

const holderOf = (event) => event.target.closest?.('.entry-link')?.closest('[data-day]') ?? null;

if (matchMedia('(hover: hover)').matches) document.addEventListener('pointerover', (event) => point(holderOf(event)));
document.addEventListener('focusin', (event) => point(holderOf(event)));
document.addEventListener('focusout', () => point(null));

function setUpReplay(work) {
  const states = [...work.querySelectorAll('.state')];
  const controls = work.querySelector('.controls');
  const buttons = [...controls.querySelectorAll('.control')];
  const ready = new Map();
  const moves = {
    first: () => 0,
    back: (index) => index - 1,
    forward: (index) => index + 1,
  };

  let front = work.querySelector('.frame picture');
  let back = front.cloneNode(true);
  const phoneFrame = matchMedia(front.querySelector('source').media);
  let current = states.length - 1;
  let fade = null;
  let queue = Promise.resolve();
  let hold = 0;
  let holdTimer = 0;

  back.classList.remove('is-front');
  for (const layer of [front, back]) layer.querySelector('img').loading = 'eager';
  front.after(back);

  function prepare(state) {
    const url = phoneFrame.matches ? state.dataset.phone : state.dataset.pc;
    if (!ready.has(url)) {
      const image = new Image();
      image.src = url;
      // A failed download must not stop the step: the frame shows the image when it arrives.
      ready.set(url, image.decode().catch(() => undefined));
    }
    return ready.get(url);
  }

  async function swapImage(state, cut) {
    await prepare(state);
    fade?.finish();
    const image = back.querySelector('img');
    back.querySelector('source').srcset = state.dataset.phone;
    image.src = state.dataset.pc;
    // decode() rejects when the picture picks its source again; the file is already in memory.
    await image.decode().catch(() => undefined);
    back.classList.add('is-front');
    front.classList.remove('is-front');
    [front, back] = [back, front];
    fade = cut ? null : fadeIn(front, TIME_FRAME);
  }

  async function show(index, cut) {
    const state = states[index];
    const previous = states[current];
    const sameImage = state.dataset.pc === previous.dataset.pc && state.dataset.phone === previous.dataset.phone;
    if (!sameImage) await swapImage(state, cut);

    previous.classList.remove('is-current');
    state.classList.add('is-current');
    if (!cut) fadeIn(state, TIME_TEXT);

    const direction = Math.sign(index - current) || 1;
    current = index;
    for (let ahead = 1; ahead <= READY_AHEAD; ahead++) {
      const next = states[index + ahead * direction];
      if (next) prepare(next);
    }

    work.dataset.at = state.dataset.at;
    work.dataset.day = state.dataset.day;
    follow(work);
    buttons.forEach((button) => button.setAttribute('aria-disabled', String(targetOf(button) === null)));
  }

  function targetOf(button) {
    const index = moves[button.dataset.step](current);
    return states[index] && index !== current ? index : null;
  }

  function step(button, cut) {
    queue = queue.then(() => {
      const index = targetOf(button);
      if (index !== null) return show(index, cut);
    });
    return queue;
  }

  const isOff = (button) => button.getAttribute('aria-disabled') === 'true';

  function press(button) {
    if (isOff(button)) return;
    const id = ++hold;
    button.classList.add('is-held');
    step(button, false);
    if (button.dataset.step === 'first') return;
    holdTimer = setTimeout(async () => {
      while (hold === id && !isOff(button)) {
        await step(button, true);
        await wait(HOLD_STEP);
      }
    }, HOLD_DELAY);
  }

  function release() {
    hold++;
    clearTimeout(holdTimer);
    buttons.forEach((button) => button.classList.remove('is-held'));
  }

  controls.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('.control');
    if (!button || event.button !== 0) return;
    button.setPointerCapture(event.pointerId);
    press(button);
  });
  // Enter and Space are handled on press: without preventDefault the browser would add its own click.
  const isPressKey = (event) => event.target.closest('.control') && (event.key === 'Enter' || event.key === ' ');
  controls.addEventListener('keydown', (event) => {
    if (!isPressKey(event)) return;
    event.preventDefault();
    if (!event.repeat) press(event.target.closest('.control'));
  });
  controls.addEventListener('keyup', (event) => {
    if (isPressKey(event)) event.preventDefault();
    release();
  });
  // What is left is a click sent by assistive technology, which comes without a pointer or a key.
  controls.addEventListener('click', (event) => {
    const button = event.target.closest('.control');
    if (button && event.detail === 0 && !isOff(button)) step(button, false);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'focusout']) {
    controls.addEventListener(type, release);
  }
  controls.addEventListener('contextmenu', (event) => event.preventDefault());

  controls.hidden = false;
}

document.querySelectorAll('[data-replay]').forEach(setUpReplay);
