import { fillList } from './list.js';
import { reducedMotion } from './media.js';
import { createSound } from './sound.js';
import { createStory } from './story.js';
import { createThreshold } from './threshold.js';
import { catalogue } from './works.js';
import { createAnchors } from './world/anchors.js';
import { createExhibits } from './world/exhibits.js';
import { planPark } from './world/layout.js';
import { createLight } from './world/light.js';
import { createPark } from './world/park.js';
import { createSigns } from './world/signs.js';
import { createWorld } from './world/world.js';

const WORK = /^#lavoro\/([\w-]+)$/;
const ZONE = /^#([\w-]+)$/;
const DESCENT = 1.7;
const FLIGHT = 1.4;

const $ = (selector) => document.querySelector(selector);
const sound = createSound($('.sound'));
const hint = $('.hint');

export let world;
export let plan;
let works;
let story;
export let exhibits;
let chain = Promise.resolve();

const json = (path) => fetch(`${path}?v=${document.documentElement.dataset.version}`).then((response) => response.json());
const centre = () => ({ x: innerWidth / 2, y: innerHeight / 2 });

// The address says where the walk is (#marchi) or which work is open (#lavoro/ghisa). Opening a work
// adds an entry, so that Back closes it.
const read = () => {
  const work = WORK.exec(location.hash)?.[1];
  if (work && works[work]) return { work };
  const zone = ZONE.exec(location.hash)?.[1];
  return plan.zones.some((each) => each.id === zone) ? { zone } : {};
};

async function apply({ work }, point) {
  if (story.work && story.work !== work) {
    await story.close(point ?? centre());
    world?.pause(false);
  }
  if (work && story.work !== work) {
    world?.pause(true);
    await story.open(work, point ?? centre());
  }
}

const run = (target, point) => {
  chain = chain.then(() => apply(target, point)).catch((error) => console.warn(error));
  return chain;
};

function open(id, point) {
  if (story.work === id) return;
  history.pushState({ work: id }, '', `#lavoro/${id}`);
  run({ work: id }, point);
}

// Back to the park, where the visitor was. A work opened from inside the page is closed by walking
// its entry back; one reached from an address typed elsewhere has no entry before it.
function close() {
  if (!story.work) return chain;
  if (history.state?.work) {
    history.back();
    return chain;
  }
  history.replaceState(null, '', `#${plan.zones.find((zone) => zone.id === works[story.work].chapter)?.id ?? ''}`);
  return run({});
}

// A few steps before a zone, with its name and its sculpture in sight ahead.
const zoneStart = (id) => plan.zones.find((zone) => zone.id === id).start - 5;
const workSpot = (id) => plan.works.find((spot) => spot.id === id);

addEventListener('popstate', () => {
  const target = read();
  const closing = Boolean(story.work);
  run(target).then(() => {
    if (target.zone && !closing) world?.stepTo(zoneStart(target.zone));
  });
});

function setUp(data, texts) {
  works = catalogue(data);
  plan = planPark(data, texts);
  story = createStory($('.story'), { works, sound, onClose: close, onEnd: close });
  fillList($('.list'), { plan, works, onOpen: (id) => open(id) });
}

const above = $('.above');
// Room kept free for the buttons at the top and the invitation at the foot, set once the park is built.
let keep = () => {};
// The large pictures of the park are fetched once the door has been passed.
let unveil = () => {};
let here;
let flying = false;

// From above the whole island and the names of the zones; a zone touched is where the walk goes on.
async function fly(up, zone) {
  if (flying || !world || up === (world.rig.mode === 'above')) return;
  flying = true;
  sound.play('whoosh');
  above.setAttribute('aria-pressed', String(up));
  if (zone) world.place(zoneStart(zone));
  await world.rig.go(up ? 'above' : 'walk', reducedMotion.matches ? 0 : FLIGHT);
  flying = false;
}
above.addEventListener('click', () => fly(world?.rig.mode !== 'above'));

function build(texts, pictures, sculptures) {
  world = createWorld($('.park'), { plan, reducedMotion });
  const anchors = createAnchors($('.anchors'), world.camera);
  exhibits = createExhibits({ plan, works, renderer: world.renderer, anchors, rig: world.rig });
  const park = createPark({ plan, renderer: world.renderer, pictures, sculptures });
  world.add(exhibits);
  world.add(park);
  world.add(createLight({ plan, sky: world.sky, sun: world.sun, park }));
  createSigns({
    plan,
    texts,
    works,
    anchors,
    rig: world.rig,
    state: world.state,
    onZone(id) {
      if (world.rig.mode === 'above') fly(false, id);
      else world.stepTo(zoneStart(id));
    },
    onWork: (id) => open(id),
  });
  world.add({ update: () => anchors.update() });
  keep = () => anchors.keep({ top: $('.hud').getBoundingClientRect().bottom + 8, bottom: innerHeight - $('.hint').getBoundingClientRect().top + 8 });
  addEventListener('resize', () => {
    keep();
    anchors.remeasure();
  });
  hint.textContent = texts.hint;
  unveil = () => park.zone(here);
  world.on({
    zone(zone) {
      exhibits.zone(zone);
      here = zone;
      if ($('.threshold').hidden) park.zone(zone);
      if (story.work || !$('.threshold').hidden) return;
      history.replaceState(null, '', zone.id === 'apertura' ? location.pathname + location.search : `#${zone.id}`);
    },
    walk() {
      hint.classList.add('is-gone');
    },
    tap(x, y) {
      if (world.rig.mode !== 'walk') return;
      const hit = world.hit(x, y, [...exhibits.targets, ...park.tappable, world.land.ground]);
      if (!hit) return;
      if (exhibits.targets.includes(hit.object)) {
        sound.play('tap');
        open(exhibits.spotOf(hit).id, { x, y });
      } else if (park.touch(hit)) sound.play('tap');
      else if (hit.object === world.land.ground && world.land.isPond(hit.point.x, hit.point.z)) {
        world.land.ripple(hit.point.x, hit.point.z);
        sound.play('drop');
      }
    },
  });
}

addEventListener('keydown', (event) => {
  if (!story || (world && !$('.threshold').hidden)) return;
  if (event.key === 'Escape') {
    if (world?.rig.mode === 'above') fly(false);
    else close();
    return;
  }
  if (story.work) {
    if (story.key(event)) event.preventDefault();
    return;
  }
  if (!world) return;
  if (event.key === 'm' || event.key === 'M') {
    fly(world.rig.mode !== 'above');
    return;
  }
  if (event.target.closest?.('a, button, .list') || world.rig.mode !== 'walk') return;
  if (world.controls.key(event, true)) event.preventDefault();
  else if (event.key === 'Enter' && world.state.nearest) open(world.state.nearest.id);
  else if (event.key === ' ') {
    event.preventDefault();
    world.jump();
  }
});
addEventListener('keyup', (event) => world?.controls.key(event, false));

$('.brand').addEventListener('click', (event) => {
  event.preventDefault();
  if (!world || !$('.threshold').hidden) return;
  close();
  chain.then(() => world.stepTo(plan.landing));
});

const threshold = createThreshold($('.threshold'), {
  async onEnter(withSound) {
    sound.begin(withSound);
    sound.play('drop');
    const target = read();
    if (target.work) world.place(workSpot(target.work).s - 1.5);
    else if (target.zone) world.place(zoneStart(target.zone));
    await world.rig.go('walk', reducedMotion.matches ? 0 : DESCENT);
  },
  onLeave() {
    setTimeout(() => sound.allowBeds(), 1500);
    const target = read();
    if (target.work) {
      history.replaceState(null, '', `#${works[target.work].chapter}`);
      history.pushState({ work: target.work }, '', `#lavoro/${target.work}`);
      run(target);
    } else if (!target.zone) {
      world.walkTo(plan.firstStop);
    }
    hint.hidden = false;
    keep();
    unveil();
  },
});

// The sculptures of the zones, as listed by img/sprites/manifest.json, in the shape the park reads.
const statues = (manifest) => Object.fromEntries(Object.entries(manifest).map(([id, entry]) => [id, {
  w: entry.larghezza,
  h: entry.altezza,
  metres: entry.altezza_m,
  lift: entry.sospesa_m ?? 0,
  anchor: [entry.appoggio.x, 1 - entry.appoggio.y],
  large: { file: `img/sprites/${entry.file}` },
  small: { file: `img/sprites/${entry.file_1024}` },
}]));

const [data, texts, pictures, manifest] = await Promise.all([json('data/works.json'), json('data/racconto.json'), json('img/park/park.json'), json('img/sprites/manifest.json'), document.fonts.ready]);
setUp(data, texts);
try {
  build(texts, pictures, statues(manifest));
} catch (error) {
  // Without WebGL the list of works is the page, and every work still opens closely.
  console.warn(error);
  document.documentElement.classList.add('no-webgl');
  $('.threshold').hidden = true;
}
if (world) {
  world.start();
  threshold.ready();
} else {
  const target = read();
  if (target.work) run(target);
}
