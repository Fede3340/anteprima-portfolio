import { createHold } from './hold.js';
import { assignScenes, createPlayback, format, onFormatChange, reducedMotion } from './media.js';
import { hide, show, splitLines } from './reveal.js';
import { createRipples } from './ripples.js';
import { createSequence } from './sequence.js';
import { createThreshold } from './threshold.js';

const FRAMES = 96;
const FRAME_SIZE = { landscape: [1280, 720], portrait: [720, 1280] };
// Scroll lengths are counted in stage heights.
const CROSSING = 2.5;
const CROSSING_SECONDS = 6.2;
// Share of the crossing after which the picture behind the brand is the night.
const NIGHTFALL = 0.6;
const PRELOAD_LIMIT = 8000;
// Where the ground begins in each scene, as a share of the frame height.
const HORIZON = {
  landscape: { opening: 0.79, pale: 0.75, dunes: 0.5, water: 0.65 },
  portrait: { opening: 0.79, pale: 0.76, dunes: 0.63, water: 0.68 },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const main = $('main');
const brand = $('.brand');
const index = $('.index');
const opening = $('.opening');
const land = $('.land');
const stage = $('.land__stage');
const contact = $('.contact');
const holdButton = $('.hold');
const tracks = { sites: $('#siti'), shops: $('#negozi') };
const heads = { sites: $('.chapter--sites .chapter__head'), shops: $('.chapter--shops .chapter__head') };
const videos = {
  threshold: $('.threshold video'),
  opening: $('video', opening),
  night: $('video', stage),
  contact: $('video', contact),
};
const works = Object.fromEntries($$('.work').map((work) => [work.dataset.work, {
  text: $$('[data-lines], [data-reveal]', work),
  portal: $(`.portal[data-work="${work.dataset.work}"]`),
}]));

const sequence = createSequence($('.land__sequence'), FRAMES);
const playback = createPlayback([videos.opening, videos.night, videos.contact]);
const playhead = { frame: 0 };

let open = false;
let plan;
let shownState = {};
let pressUrl;

const unit = () => stage.offsetHeight;
const landTop = () => land.getBoundingClientRect().top + window.scrollY;
const at = (units) => landTop() + units * unit();

function loadMedia() {
  assignScenes();
  videos.opening.preload = 'auto';
  videos.opening.load();
  const press = fetch(videos.threshold.src)
    .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(`${response.status} ${response.url}`))))
    .then((blob) => {
      URL.revokeObjectURL(pressUrl);
      pressUrl = URL.createObjectURL(blob);
      videos.threshold.src = pressUrl;
      videos.contact.src = pressUrl;
    });
  return [press, sequence.load(`media/crossing/${format()}`, FRAME_SIZE[format()])];
}

function toggleHead(name, on) {
  (on ? show : hide)([$('.chapter__label', heads[name])]);
  gsap.to($('.chapter__rule', heads[name]), {
    scaleX: on ? 1 : 0, duration: on ? 1.4 : 0.4, ease: on ? 'power3.out' : 'power1.in', overwrite: true,
  });
}

function toggleWork(name, on) {
  if (on) show(works[name].text, 0.3);
  else hide(works[name].text);
  works[name].portal.classList.toggle('is-live', on);
}

const apply = {
  opening: (on) => playback.want(videos.opening, on),
  hold(on) {
    (on ? show : hide)([holdButton]);
    holdButton.tabIndex = on ? 0 : -1;
  },
  pages(on) {
    if (!on) return;
    for (const image of $$('img[data-src]')) {
      image.src = image.dataset.src;
      image.removeAttribute('data-src');
    }
  },
  night(on) {
    playback.want(videos.night, on);
    if (!on && videos.night.readyState) videos.night.currentTime = 0;
  },
  dark(on) {
    brand.dataset.tone = on ? 'light' : 'ink';
    holdButton.dataset.tone = brand.dataset.tone;
  },
  sites: (on) => toggleHead('sites', on),
  shops: (on) => toggleHead('shops', on),
  grecale: (on) => toggleWork('grecale', on),
  mirtifolia: (on) => toggleWork('mirtifolia', on),
  'pippi-store': (on) => toggleWork('pippi-store', on),
  contact(on) {
    const text = $$('[data-lines], [data-reveal]', contact);
    if (on) show(text, 0.3);
    else hide(text);
    if (on && videos.contact.readyState) videos.contact.currentTime = 0;
    playback.want(videos.contact, on);
  },
  chapter(name) {
    for (const link of $$('a', index)) {
      if (link.dataset.chapter === name) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  },
};

const stateAt = (units) => ({
  opening: open && units < 1,
  hold: units > plan.cross - 0.35 && units < plan.arrive - 0.04,
  pages: units > plan.cross,
  night: units >= plan.arrive - 0.08,
  dark: units >= plan.cross + CROSSING * NIGHTFALL && units < (plan.dawn + plan.shops) / 2,
  sites: units >= plan.arrive && units < plan.leave,
  grecale: units >= plan.first + 0.15 && units < plan.second + 0.15,
  mirtifolia: units >= plan.second + 0.15 && units < plan.leave,
  shops: units >= plan.shops - 0.12,
  'pippi-store': units >= plan.shops + 0.1,
  contact: units >= plan.end + 0.5,
  chapter: units < plan.cross - 0.5 ? '' : units < plan.shops - 0.3 ? 'sites' : units < plan.end + 0.5 ? 'shops' : 'contact',
});

function render() {
  if (!plan) return;
  const next = stateAt((window.scrollY - landTop()) / unit());
  for (const [key, value] of Object.entries(next)) {
    if (shownState[key] !== value) apply[key](value);
  }
  shownState = next;
  $('.index__progress').style.strokeDashoffset = String(1 - window.scrollY / ScrollTrigger.maxScroll(window));
}

function buildScene() {
  const arrive = tracks.sites.offsetTop / unit() + CROSSING;
  plan = {
    cross: arrive - CROSSING,
    arrive,
    first: arrive + 0.1,
    second: arrive + 1.15,
    leave: arrive + 2.1,
    dawn: arrive + 2.4,
    shops: tracks.shops.offsetTop / unit(),
    end: (tracks.shops.offsetTop + tracks.shops.offsetHeight) / unit() - 1,
  };

  const scene = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { start: () => at(0), end: () => at(plan.end), scrub: reducedMotion.matches ? true : 0.4, invalidateOnRefresh: true },
  });
  const progress = $('.hold__progress');
  const rise = (name, start) => {
    const { portal } = works[name];
    scene
      .fromTo($$('ellipse', portal), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, stagger: 0.07, ease: 'power1.inOut' }, start)
      .fromTo($('.portal__body', portal), { yPercent: 101 }, { yPercent: 0, duration: 0.45, ease: 'power2.out' }, start + 0.05);
  };
  const sink = (name, start) => {
    const { portal } = works[name];
    scene
      .to($('.portal__body', portal), { yPercent: 101, duration: 0.28, ease: 'power2.in' }, start)
      .to($$('ellipse', portal), { strokeDashoffset: 1, duration: 0.28 }, start);
  };

  scene
    .to(playhead, {
      frame: FRAMES - 1,
      duration: CROSSING,
      onUpdate() {
        sequence.seek(playhead.frame);
        progress.style.strokeDashoffset = String(1 - playhead.frame / (FRAMES - 1));
      },
    }, plan.cross)
    .fromTo(['.land__night', '.land__floor'], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, plan.arrive - 0.08)
    .fromTo('.land__waterline', { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, plan.arrive);
  rise('grecale', plan.first);
  rise('mirtifolia', plan.second);
  sink('grecale', plan.leave);
  sink('mirtifolia', plan.leave);
  scene.to('.land__day', { opacity: 1, duration: plan.shops - plan.dawn - 0.05 }, plan.dawn);
  rise('pippi-store', plan.shops - 0.05);
  scene.set({}, {}, plan.end);
  gsap.set('.portals', { visibility: 'visible' });

  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: render, onRefresh: render });
  createHold(holdButton, { range: () => [at(plan.cross), at(plan.arrive)], seconds: CROSSING_SECONDS });
}

function setUp() {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  splitLines();
  buildScene();
  render();
}

function groundAt(element, share, tone) {
  const box = $('.cover', element).getBoundingClientRect();
  return { horizon: box.top + share * box.height, tone };
}

createRipples($('.ripples'), () => {
  if (!open || reducedMotion.matches) return undefined;
  const horizon = HORIZON[format()];
  const middle = window.innerHeight / 2;
  if (opening.getBoundingClientRect().bottom > middle) return groundAt(opening, horizon.opening, 'light');
  if (stage.getBoundingClientRect().bottom < middle) return groundAt(contact, horizon.water, 'light');
  return playhead.frame < FRAMES / 2 ? groundAt(stage, horizon.pale, 'ink') : groundAt(stage, horizon.dunes, 'light');
});

const threshold = createThreshold($('.threshold'), {
  onEnter() {
    window.scrollTo(0, 0);
    if (reducedMotion.matches) return;
    // Started inside the tap so that browsers which hold back autoplay let these scenes play
    // later; sync() pauses them at once, and that interruption is the rejection ignored here.
    for (const video of [videos.opening, videos.night, videos.contact]) video.play().catch(() => {});
    playback.sync();
  },
  onLeave() {
    open = true;
    main.inert = false;
    render();
    show($$('[data-lines]', opening), 0.45);
    show([$('.cue'), index], 1.3);
  },
});

index.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link || !plan) return;
  event.preventDefault();
  const top = { sites: at(plan.cross), shops: at(plan.shops + 0.5), contact: ScrollTrigger.maxScroll(window) }[link.dataset.chapter];
  window.scrollTo({ top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
});

brand.addEventListener('click', (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
});

let width = window.innerWidth;
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth === width || !plan) return;
    width = window.innerWidth;
    splitLines();
  }, 150);
});

onFormatChange(() => {
  loadMedia();
  playback.sync();
});

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
main.inert = true;

const tasks = [...loadMedia(), document.fonts.ready.then(setUp)];
let settled = 0;
for (const task of tasks) {
  // A scene that fails to load must not keep the door shut: each one falls back to its poster.
  task.catch((error) => console.warn(error)).then(() => threshold.progress(++settled / tasks.length));
}
Promise.race([Promise.allSettled(tasks), new Promise((done) => setTimeout(done, PRELOAD_LIMIT))]).then(threshold.ready);
