import { createArchive } from './archive.js';
import { createHold } from './hold.js';
import { createPlayback, format, onFormatChange, prepare, recut, reducedMotion } from './media.js';
import { hide, show, splitLines } from './reveal.js';
import { createRipples } from './ripples.js';
import { createSequence } from './sequence.js';
import { createSound } from './sound.js';
import { createThreshold } from './threshold.js';
import { createViewer } from './viewer.js';
import { catalogue, renderArchive, renderChapters } from './works.js';

const FRAMES = { landscape: 96, portrait: 72 };
const FRAME_SIZE = { landscape: [1600, 900], portrait: [810, 1440] };
const HOLD_SECONDS = 1.6;
// Share of the crossing after which the picture behind the hold button is the night.
const NIGHTFALL = { landscape: 0.68, portrait: 0.655 };
const PRELOAD_LIMIT = 5000;
// Where the ground begins in each scene, as a share of the frame height.
const HORIZON = {
  landscape: { opening: 0.79, pale: 0.75, dunes: 0.5, scene: 0.8 },
  portrait: { opening: 0.79, pale: 0.76, dunes: 0.63, scene: 0.8 },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const main = $('main');
const brand = $('.brand');
const index = $('.index');
const opening = $('.opening');
const land = $('.land');
const stage = $('.land__stage');
const night = $('#siti');
const chaptersEnd = $('#google');
const contact = $('.contact');
const holdButton = $('.hold');
const videos = {
  threshold: $('.threshold video'),
  opening: $('video', opening),
  night: $('video', stage),
  contact: $('video', contact),
};

const canvas = $('.land__sequence');
const sequence = createSequence(canvas);
const sound = createSound($('.sound'));
const playback = createPlayback();
const playhead = { frame: 0 };

let open = false;
let whooshed = false;
let plan;
let scene;
let viewer;
let shownState = {};
const sceneState = new Map();

const unit = () => stage.offsetHeight;
const landTop = () => land.getBoundingClientRect().top + window.scrollY;
const at = (units) => landTop() + units * unit();
const docTop = (element) => element.getBoundingClientRect().top + window.scrollY;
const lastFrame = () => FRAMES[format()] - 1;
const chapterSections = () => $$('.chapter');

// The press starts downloading once the door can be used: before that only its cover, the type and the code.
function loadPress() {
  prepare(videos.threshold);
  videos.threshold.preload = 'auto';
  videos.threshold.load();
}

const loadSequence = () => sequence.load(`media/crossing/${format()}`, FRAME_SIZE[format()], FRAMES[format()]);

const apply = {
  sequence(on) {
    canvas.style.visibility = on ? '' : 'hidden';
  },
  whoosh(on) {
    if (on && !whooshed) whooshed = sound.play('whoosh');
  },
  opening: (on) => playback.want(videos.opening, on),
  hold(on) {
    (on ? show : hide)([holdButton]);
    holdButton.tabIndex = on ? 0 : -1;
  },
  night(on) {
    playback.want(videos.night, on);
    if (!on && videos.night.readyState) videos.night.currentTime = 0;
  },
  nightfall(on) {
    holdButton.dataset.tone = on ? 'light' : 'ink';
  },
  press: (on) => playback.want(videos.contact, on),
  contact(on) {
    const text = $$('[data-lines], [data-reveal]', contact);
    if (on) show(text);
    else hide(text);
  },
  chapter(id) {
    const link = $(`a[href="#${id}"]`, index);
    $('.index__current', index).textContent = link?.textContent ?? '';
    for (const item of $$('a', index)) {
      if (item === link) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    }
  },
};

function currentChapter(units) {
  if (units >= plan.end + 0.5) return 'contatti';
  const middle = window.innerHeight / 2;
  const reached = chapterSections().filter((section) => section.getBoundingClientRect().top <= middle);
  return reached.at(-1)?.id ?? '';
}

const stateAt = (units) => ({
  sequence: units < plan.arrive,
  whoosh: units > plan.cross + 0.15 && units < plan.arrive - 0.3,
  opening: open && units < 1,
  hold: units > plan.cross - 0.35 && units < plan.arrive - 0.04,
  night: units >= plan.arrive - 0.08 && units < plan.landEnd,
  nightfall: units >= plan.nightfall,
  press: units >= plan.end,
  contact: units >= plan.end + 0.97,
  chapter: currentChapter(units),
});

// The scene of a chapter gets its file a screen ahead and plays while the chapter is on screen.
function renderScenes() {
  for (const video of $$('.chapter__scene video')) {
    const box = video.closest('.chapter').getBoundingClientRect();
    if (box.top < window.innerHeight * 2) prepare(video);
    const visible = box.top < window.innerHeight && box.bottom > 0;
    if (sceneState.get(video) !== visible) playback.want(video, visible);
    sceneState.set(video, visible);
  }
}

function render() {
  if (!plan) return;
  const next = stateAt((window.scrollY - landTop()) / unit());
  for (const [key, value] of Object.entries(next)) {
    if (shownState[key] !== value) apply[key](value);
  }
  shownState = next;
  if (open) renderScenes();
  $('.index__progress').style.strokeDashoffset = String(1 - window.scrollY / ScrollTrigger.maxScroll(window));
}

// Positions along the story, in stage heights from the top of the land.
function measure() {
  const crossing = parseFloat(getComputedStyle(land).getPropertyValue('--crossing'));
  plan = {
    cross: 1,
    arrive: 1 + crossing,
    nightfall: 1 + crossing * NIGHTFALL[format()],
    landEnd: land.offsetHeight / unit(),
    end: (docTop(chaptersEnd) + chaptersEnd.offsetHeight - landTop()) / unit() - 1,
  };
}

function buildScene() {
  measure();
  scene?.scrollTrigger.kill();
  scene?.kill();
  const progress = $('.hold__progress');
  scene = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { start: () => at(0), end: () => at(plan.arrive), scrub: reducedMotion.matches ? true : 0.3 },
  })
    .to(playhead, {
      frame: lastFrame(),
      duration: plan.arrive - plan.cross,
      onUpdate() {
        sequence.seek(playhead.frame);
        progress.style.strokeDashoffset = String(1 - playhead.frame / lastFrame());
      },
    }, plan.cross)
    .fromTo(['.land__night', '.land__floor'], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, plan.arrive - 0.08);
  shownState = {};
  render();
}

function watchWorks() {
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries.filter((item) => item.isIntersecting)) {
      entry.target.classList.add('is-in');
      reveal.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  const near = new IntersectionObserver((entries) => {
    for (const entry of entries.filter((item) => item.isIntersecting)) {
      for (const element of $$('[data-srcset], [data-src]', entry.target)) {
        if (element.dataset.srcset) element.srcset = element.dataset.srcset;
        if (element.dataset.src) element.src = element.dataset.src;
      }
      near.unobserve(entry.target);
    }
  }, { rootMargin: '100% 0px' });
  for (const element of $$('.works, .chapter__backdrop')) near.observe(element);
  const live = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle('is-live', entry.isIntersecting);
  });
  for (const element of $$('.chapter, .work, .note')) reveal.observe(element);
  for (const work of $$('.work')) live.observe(work);
}

function renderIndex(data) {
  const links = [...data.chapters, { id: 'google', title: $('#google-label').textContent }, { id: 'contatti', title: 'Contatti' }]
    .map(({ id, title }) => Object.assign(document.createElement('a'), { href: `#${id}`, textContent: title }));
  $('.index__links', index).replaceChildren(...links);
}

function setUp(data) {
  renderChapters(data, { night, after: $('.chapters') });
  renderIndex(data);
  const works = catalogue(data);
  viewer = createViewer($('.viewer'), works, { onStep: () => sound.play('tap') });
  const archive = createArchive($('.archive'));

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open]');
    if (!trigger) return;
    sound.play('tap');
    viewer.open(trigger.dataset.open, trigger);
  });
  $('.index__all').addEventListener('click', (event) => {
    sound.play('tap');
    if (!$('.archive__list').children.length) renderArchive(data, $('.archive__list'));
    archive.show(event.currentTarget);
  });
  $('.archive .viewer__close').addEventListener('click', () => sound.play('tap'));

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  splitLines();
  buildScene();
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: render, onRefresh: render });
  createHold(holdButton, { range: () => [at(plan.cross), at(plan.arrive)], seconds: HOLD_SECONDS });
  watchWorks();
  viewer.openFromAddress();
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
  if (stage.getBoundingClientRect().bottom > middle) {
    return playhead.frame < lastFrame() / 2 ? groundAt(stage, horizon.pale, 'ink') : groundAt(stage, horizon.dunes, 'light');
  }
  const scene = $$('.chapter__scene').find((element) => {
    const box = element.getBoundingClientRect();
    return box.top <= middle && box.bottom > middle;
  });
  return groundAt(scene ?? contact, horizon.scene, 'light');
}, () => sound.play('drop'));

$('.viewer .viewer__close').addEventListener('click', () => sound.play('tap'));

const threshold = createThreshold($('.threshold'), {
  onEnter(withSound) {
    sound.begin(withSound);
    window.scrollTo(0, 0);
    loadSequence();
    prepare(videos.opening);
    // Started inside the tap so that browsers which hold back autoplay still play the opening.
    if (!reducedMotion.matches) videos.opening.play().catch(() => {});
  },
  onTouch: () => sound.play('drop'),
  onLeave() {
    open = true;
    main.inert = false;
    render();
    show($$('[data-lines]', opening), 0.2);
    show([$('.cue'), index, $('.sound')], 0.8);
  },
});

index.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link || !plan) return;
  event.preventDefault();
  sound.play('tap');
  const target = $(link.getAttribute('href'));
  const top = target === contact ? ScrollTrigger.maxScroll(window) : docTop($('.chapter__head', target)) - unit() * 0.12;
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
    buildScene();
  }, 150);
});

onFormatChange(() => {
  recut();
  if (open) loadSequence();
  playback.sync();
});

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
main.inert = true;

const data = fetch('data/works.json').then((response) => response.json());
const tasks = [$('.threshold__still').decode(), Promise.all([data, document.fonts.ready]).then(([loaded]) => setUp(loaded))];
let settled = 0;
for (const task of tasks) {
  // A scene that fails to load must not keep the door shut: each one falls back to its poster.
  task.catch((error) => console.warn(error)).then(() => threshold.progress(++settled / tasks.length));
}
Promise.race([Promise.allSettled(tasks), new Promise((done) => setTimeout(done, PRELOAD_LIMIT))]).then(() => {
  threshold.ready();
  loadPress();
});
