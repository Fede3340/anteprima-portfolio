import { createArchive } from './archive.js';
import { createLand } from './land.js';
import { onFormatChange, playback, prepare, recut, reducedMotion } from './media.js';
import { prepareCrossing } from './places/portals.js';
import { createPlaces } from './places.js';
import { createSound } from './sound.js';
import { createStory } from './story.js';
import { createThreshold } from './threshold.js';
import { catalogue, HOME, PLACES, renderArchive } from './works.js';

const PRELOAD_LIMIT = 5000;
const WORK = /^#lavoro\/([\w-]+)$/;
const PLACE = /^#([\w-]+)$/;

const $ = (selector) => document.querySelector(selector);
const world = $('.world');
const exit = $('.dock__exit');
const sound = createSound($('.sound'));
const centre = () => ({ x: innerWidth / 2, y: innerHeight / 2 });

let land;
let places;
let story;
let works;
let archive;
let chapters;
let chain = Promise.resolve();

// Where the visitor is: the land, a place, or a work inside a place. The address mirrors it, so
// that Back walks out one level at a time.
const read = () => {
  const work = WORK.exec(location.hash)?.[1];
  if (work && works[work]) return { place: history.state?.place ?? works[work].chapter, work };
  const place = PLACE.exec(location.hash)?.[1];
  return PLACES.some((spot) => spot.id === place) ? { place } : {};
};
const depth = (target) => (target.work ? 2 : target.place ? 1 : 0);
const address = (target) => (target.work ? `#lavoro/${target.work}` : target.place ? `#${target.place}` : location.pathname + location.search);

async function apply(target, point) {
  if (story.work && story.work !== target.work) {
    if (target.work) return story.replace(target.work, point ?? centre());
    await story.close(point ?? centre());
  }
  if (places.id !== target.place) {
    if (places.id) {
      await places.close(land.point());
      land.resume();
    }
    if (target.place) {
      land.to(target.place, { instant: true, quiet: true });
      land.pause();
      await places.open(PLACES.find((spot) => spot.id === target.place), point ?? land.point(), { instant: !point && Boolean(target.work) });
    }
  }
  if (target.work && story.work !== target.work) await story.open(target.work, point ?? centre());
  exit.hidden = !depth(target);
}

const run = (target, point) => {
  chain = chain.then(() => apply(target, point)).catch((error) => console.warn(error));
  return chain;
};

function go(target, point) {
  const replace = depth(target) === depth(history.state ?? {}) && depth(target) > 0;
  history[replace ? 'replaceState' : 'pushState']({ ...target, depth: depth(target) }, '', address(target));
  return run(target, point);
}

function back() {
  const level = history.state?.depth ?? 0;
  if (!level) return;
  history.back();
}

function home() {
  const level = history.state?.depth ?? 0;
  if (level) {
    addEventListener('popstate', () => run({}).then(() => land.to('home')), { once: true });
    history.go(-level);
  } else land.to('home');
}

function openWork(id, point) {
  go({ place: places.id ?? works[id].chapter, work: id }, point);
}

addEventListener('popstate', () => run(read()));

addEventListener('keydown', (event) => {
  if (!land || world.inert || !$('.archive').hidden) return;
  if (event.key === 'Escape') return back();
  const handled = story.work ? story.key(event) : places.id ? places.key(event) : land.key(event);
  if (handled) event.preventDefault();
});

exit.addEventListener('click', () => {
  sound.play('tap');
  back();
});

$('.brand').addEventListener('click', (event) => {
  event.preventDefault();
  sound.play('tap');
  home();
});

function setUp(data) {
  works = catalogue(data);
  chapters = data.chapters;
  places = createPlaces($('.place'), { scene: $('.land'), data, works, sound, openWork });
  story = createStory($('.story'), {
    works, sound, onWork: (id, point) => openWork(id, point),
  });
  archive = createArchive($('.archive'), {
    open(id) {
      archive.hide();
      openWork(id, centre());
    },
    fill: (list) => renderArchive(data, list),
  });
  $('.dock__all').addEventListener('click', (event) => {
    sound.play('tap');
    archive.show(event.currentTarget);
  });
}

// The land is built at the door, so that its scenes download only once the visitor is in.
function buildLand() {
  const spots = [HOME, ...PLACES].map((spot) => {
    const chapter = chapters.find((item) => item.id === spot.id);
    return {
      ...spot,
      title: spot.title ?? chapter?.title,
      note: spot.note ?? (chapter ? `${chapter.works.length} ${chapter.works.length === 1 ? 'lavoro' : 'lavori'}` : undefined),
    };
  });
  land = createLand($('.land'), {
    spots,
    sound,
    onEnter: (spot, point) => go({ place: spot.id }, point),
    onArrive: (spot) => {
      if (spot.id === 'siti' || spot.id === 'home') prepareCrossing();
    },
  });
}

const threshold = createThreshold($('.threshold'), {
  onEnter(withSound) {
    sound.begin(withSound);
    buildLand();
    const opening = $('.spot video');
    prepare(opening);
    // Started inside the tap so that browsers which hold back autoplay still play the opening.
    if (!reducedMotion.matches) opening.play().catch(() => {});
  },
  onTouch: () => sound.play('drop'),
  onLeave() {
    world.inert = false;
    land.layout();
    const target = read();
    history.replaceState({ depth: 0 }, '', address({}));
    if (target.place) history.pushState({ place: target.place, depth: 1 }, '', address({ place: target.place }));
    if (target.work) history.pushState({ ...target, depth: 2 }, '', address(target));
    land.to(target.place ?? 'home', { instant: true });
    run(target);
  },
});

onFormatChange(() => {
  recut();
  playback.sync();
  land?.layout();
});

const data = fetch('data/works.json?v=' + document.documentElement.dataset.version).then((response) => response.json());
const tasks = [$('.threshold__still').decode(), Promise.all([data, document.fonts.ready]).then(([loaded]) => setUp(loaded))];
let settled = 0;
for (const task of tasks) {
  // A scene that fails to load must not keep the door shut: each one falls back to its poster.
  task.catch((error) => console.warn(error)).then(() => threshold.progress(++settled / tasks.length));
}
Promise.race([Promise.allSettled(tasks), new Promise((done) => setTimeout(done, PRELOAD_LIMIT))]).then(() => {
  threshold.ready();
  const press = $('.threshold video');
  prepare(press);
  press.preload = 'auto';
  press.load();
});
