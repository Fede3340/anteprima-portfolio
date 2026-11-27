import { createHold } from './hold.js';
import { createPlayback, format, onFormatChange, prepare, recut, reducedMotion } from './media.js';
import { hide, show, splitLines } from './reveal.js';
import { createRipples } from './ripples.js';
import { createSequence } from './sequence.js';
import { createSound } from './sound.js';
import { createThreshold } from './threshold.js';
import { createViewer } from './viewer.js';

const FRAMES = { landscape: 96, portrait: 72 };
const FRAME_SIZE = { landscape: [1280, 720], portrait: [540, 960] };
const HOLD_SECONDS = 1.6;
// Share of the crossing after which the picture behind the hold button is the night.
const NIGHTFALL = { landscape: 0.68, portrait: 0.655 };
const PRELOAD_LIMIT = 5000;
const METADATA_GRACE = 600;
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
const chapters = { sites: $('#siti'), shops: $('#negozi') };
const videos = {
  threshold: $('.threshold video'),
  opening: $('video', opening),
  night: $('video', stage),
  contact: $('video', contact),
};
const phone = window.matchMedia('(max-width: 767px)');

const canvas = $('.land__sequence');
const sequence = createSequence(canvas);
const sound = createSound($('.sound'));
const playback = createPlayback([videos.opening, videos.night, videos.contact]);
const playhead = { frame: 0 };

let open = false;
let whooshed = false;
let plan;
let scene;
let shownState = {};

const unit = () => stage.offsetHeight;
const landTop = () => land.getBoundingClientRect().top + window.scrollY;
const at = (units) => landTop() + units * unit();
const docTop = (element) => element.getBoundingClientRect().top + window.scrollY;
const lastFrame = () => FRAMES[format()] - 1;

// The first data of a scene, or shortly after its metadata on browsers that load no further before a tap.
const firstData = (video) => new Promise((done) => {
  video.addEventListener('loadeddata', done, { once: true });
  video.addEventListener('loadedmetadata', () => setTimeout(done, METADATA_GRACE), { once: true });
  video.addEventListener('error', done, { once: true });
});

function loadDoor() {
  const waiting = firstData(videos.threshold);
  prepare(videos.threshold);
  videos.threshold.preload = 'auto';
  videos.threshold.load();
  return [$('.threshold__still').decode(), waiting];
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
  press(on) {
    if (on && videos.contact.readyState) videos.contact.currentTime = 0;
    playback.want(videos.contact, on);
  },
  contact(on) {
    const text = $$('[data-lines], [data-reveal]', contact);
    if (on) show(text);
    else hide(text);
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
  sequence: units < plan.arrive,
  whoosh: units > plan.cross + 0.15 && units < plan.arrive - 0.3,
  hold: units > plan.cross - 0.35 && units < plan.arrive - 0.04,
  night: units >= plan.arrive - 0.08 && units < plan.day,
  nightfall: units >= plan.nightfall,
  press: units >= plan.end + 0.5,
  contact: units >= plan.end + 0.97,
  chapter: units < plan.cross - 0.5 ? '' : units < plan.shops - 0.5 ? 'sites' : units < plan.end + 0.5 ? 'shops' : 'contact',
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

// Positions along the story, in stage heights from the top of the land.
function measure() {
  const crossing = parseFloat(getComputedStyle(land).getPropertyValue('--crossing'));
  const shops = (docTop(chapters.shops) - landTop()) / unit();
  const skirt = $('.skirt--night').getBoundingClientRect().height;
  plan = {
    cross: 1,
    arrive: 1 + crossing,
    nightfall: 1 + crossing * NIGHTFALL[format()],
    shops,
    day: shops - 0.25,
    end: (land.offsetHeight - skirt) / unit() - 1,
  };
}

function buildScene() {
  measure();
  scene?.scrollTrigger.kill();
  scene?.kill();
  const progress = $('.hold__progress');
  scene = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { start: () => at(0), end: () => at(plan.end), scrub: reducedMotion.matches ? true : 0.3 },
  })
    .to(playhead, {
      frame: lastFrame(),
      duration: plan.arrive - plan.cross,
      onUpdate() {
        sequence.seek(playhead.frame);
        progress.style.strokeDashoffset = String(1 - playhead.frame / lastFrame());
      },
    }, plan.cross)
    .fromTo(['.land__night', '.land__floor'], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, plan.arrive - 0.08)
    .fromTo('.land__day', { opacity: 0 }, { opacity: 1, duration: 0.55 }, plan.shops - 1)
    .to('.land__floor', { autoAlpha: 0, duration: 0.55 }, plan.shops - 1)
    .set({}, {}, plan.end);
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
  // Captures are fetched when their window is a screen away.
  const near = new IntersectionObserver((entries) => {
    for (const entry of entries.filter((item) => item.isIntersecting)) {
      for (const element of $$('[data-srcset], [data-src]', entry.target)) {
        if (element.dataset.srcset) element.srcset = element.dataset.srcset;
        if (element.dataset.src) element.src = element.dataset.src;
      }
      near.unobserve(entry.target);
    }
  }, { rootMargin: '100% 0px' });
  const live = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle('is-live', entry.isIntersecting);
  });
  for (const element of $$('.chapter, .work')) reveal.observe(element);
  for (const work of $$('.work')) {
    near.observe(work);
    live.observe(work);
  }
}

function findWork(id) {
  const work = id && $(`.work[data-work="${id}"]`);
  if (!work) return undefined;
  const page = $('.work__page', work);
  const link = $('.work__link', work);
  return {
    id,
    title: $('.work__name', work).textContent,
    link: link && { href: link.href, label: link.textContent },
    images: phone.matches ? [$('source', work).dataset.srcset, ...(work.dataset.more?.split(' ') ?? [])] : [page.dataset.src],
    opener: $('.work__window', work),
  };
}

const viewer = createViewer($('.viewer'), findWork);

function setUp() {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  splitLines();
  buildScene();
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: render, onRefresh: render });
  createHold(holdButton, { range: () => [at(plan.cross), at(plan.arrive)], seconds: HOLD_SECONDS });
  watchWorks();
  $('[data-sky]').src = `img/day-sky-${format()}.webp`;
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
  if (stage.getBoundingClientRect().bottom < middle) return groundAt(contact, horizon.water, 'light');
  return playhead.frame < lastFrame() / 2 ? groundAt(stage, horizon.pale, 'ink') : groundAt(stage, horizon.dunes, 'light');
}, () => sound.play('drop'));

$('.viewer__close').addEventListener('click', () => sound.play('tap'));

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

for (const work of $$('.work')) {
  $('.work__window', work).addEventListener('click', () => {
    sound.play('tap');
    viewer.open(work.dataset.work);
  });
}

index.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link || !plan) return;
  event.preventDefault();
  sound.play('tap');
  const chapter = chapters[link.dataset.chapter];
  const top = chapter ? docTop($('.chapter__head', chapter)) - unit() * 0.12 : ScrollTrigger.maxScroll(window);
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

const tasks = [...loadDoor(), document.fonts.ready.then(setUp)];
let settled = 0;
for (const task of tasks) {
  // A scene that fails to load must not keep the door shut: each one falls back to its poster.
  task.catch((error) => console.warn(error)).then(() => threshold.progress(++settled / tasks.length));
}
Promise.race([Promise.allSettled(tasks), new Promise((done) => setTimeout(done, PRELOAD_LIMIT))]).then(threshold.ready);
