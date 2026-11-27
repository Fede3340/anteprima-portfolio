import { onFormatChange, playback, prepare, recut, reducedMotion } from './media.js';
import { createSound } from './sound.js';
import { createStory } from './story.js';
import { createThreshold } from './threshold.js';
import { createWalk } from './walk.js';
import { catalogue, PLACES } from './works.js';

const PRELOAD_LIMIT = 5000;
const WORK = /^#lavoro\/([\w-]+)$/;
const STAGE = /^#([\w-]+)$/;

const $ = (selector) => document.querySelector(selector);
const world = $('.world');
const sound = createSound($('.sound'));
const centre = () => ({ x: innerWidth / 2, y: innerHeight / 2 });

let walk;
let story;
let works;
let data;
let chain = Promise.resolve();

// The address says where the walk is (#marchi) or which work is open (#lavoro/ghisa). Opening a
// work adds an entry, so that Back closes it.
const read = () => {
  const work = WORK.exec(location.hash)?.[1];
  if (work && works[work]) return { work };
  const stage = STAGE.exec(location.hash)?.[1];
  return PLACES.some((place) => place.id === stage) ? { stage } : {};
};

async function apply({ work }, point) {
  if (story.work && story.work !== work) await story.close(point ?? centre());
  if (work && story.work !== work) await story.open(work, point ?? centre());
}

const run = (target, point) => {
  chain = chain.then(() => apply(target, point)).catch((error) => console.warn(error));
  return chain;
};

function open(id, point) {
  history.pushState({ work: id }, '', `#lavoro/${id}`);
  run({ work: id }, point);
}

// Back to the path. A work opened from inside the page is closed by walking its entry back; one
// reached from an address typed elsewhere has no entry before it, so its address is replaced.
function close() {
  if (!story.work) return chain;
  if (history.state?.work) {
    history.back();
    return chain;
  }
  history.replaceState(null, '', location.pathname + location.search);
  return run({});
}

addEventListener('popstate', () => run(read()));

addEventListener('keydown', (event) => {
  if (!walk || world.inert) return;
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (story.work ? story.key(event) : walk.key(event)) event.preventDefault();
});

$('.brand').addEventListener('click', (event) => {
  event.preventDefault();
  if (!walk) return;
  sound.play('tap');
  close();
  chain.then(() => walk.home());
});

function setUp(loaded) {
  data = loaded;
  works = catalogue(data);
  story = createStory($('.story'), {
    works,
    sound,
    onClose: close,
    onEnd(id) {
      close();
      chain.then(() => walk.after(id));
    },
  });
}

const threshold = createThreshold($('.threshold'), {
  onEnter(withSound) {
    sound.begin(withSound);
    walk = createWalk($('.walk'), {
      data,
      works,
      sound,
      onOpen: open,
      onStage(id) {
        if (story.work) return;
        history.replaceState(history.state, '', id === 'home' ? location.pathname + location.search : `#${id}`);
      },
    });
    walk.layout();
    const opening = $('.walk__view video');
    if (opening) {
      prepare(opening);
      // Started inside the tap so that browsers which hold back autoplay still play the opening.
      if (!reducedMotion.matches) opening.play().catch(() => {});
    }
  },
  onTouch: () => sound.play('drop'),
  onLeave() {
    world.inert = false;
    setTimeout(() => sound.allowBeds(), 1500);
    const target = read();
    if (target.work) {
      history.replaceState(null, '', `#${works[target.work].chapter}`);
      history.pushState({ work: target.work }, '', `#lavoro/${target.work}`);
      walk.start();
      walk.show(target.work, { instant: true });
      run(target);
    } else walk.start(target.stage);
  },
});

onFormatChange(() => {
  recut();
  playback.sync();
  walk?.layout();
});

const loading = fetch(`data/works.json?v=${document.documentElement.dataset.version}`).then((response) => response.json());
const tasks = [$('.threshold__still').decode(), Promise.all([loading, document.fonts.ready]).then(([loaded]) => setUp(loaded))];
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
