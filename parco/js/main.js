import * as THREE from 'three';
import { fillList } from './list.js';
import { element, reducedMotion } from './media.js';
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
import { ahead } from './world/textures.js';
import { createWorld } from './world/world.js';

const WORK = /^#lavoro\/([\w-]+)$/;
const ZONE = /^#([\w-]+)$/;
// Walking freely, closer than this to a work a tap on it opens it; further, it walks there.
const NEAR_ENOUGH = 6.5;
// A card of the visit is seen from this far, its sculpture under it.
const CARD_AWAY = 7;
const FLIGHT = 1.4;
// A click on the sky: this many metres ahead.
const STEP_AHEAD = 4;
// Round a work's frame on the screen, a click still opens it rather than walking (pixels); the look,
// held still over a work, lets go only this much further out, so that it never comes and goes on the
// edge.
const MARGIN = 40;
const LET_GO = 32;
// Round a name in the sky, the look stops (pixels).
const NAME_MARGIN = 100;
// Where «Avanti» goes next, said in full.
const VERSO = { apertura: "verso l'Apertura", siti: 'verso i Siti', negozi: 'verso i Negozi online', programmi: 'verso i Programmi', app: 'verso le App', videogioco: 'verso il Videogioco', marchi: 'verso i Marchi', manifesti: 'verso i Manifesti', google: 'verso Google', contatti: 'verso i Contatti' };
// Where a click on the name of an island takes one, said in full.
const TOWARD = { apertura: "all'Apertura", siti: 'ai Siti', negozi: 'ai Negozi online', programmi: 'ai Programmi', app: 'alle App', videogioco: 'al Videogioco', marchi: 'ai Marchi', manifesti: 'ai Manifesti', google: 'a Google', contatti: 'ai Contatti' };

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

// Opening a work: the eyes go to stand in front of it, then the work opens over the park, which stays
// alive around it. Closing: the work goes, and the walk goes on from where it was.
async function apply({ work }, point) {
  // From the list as a page the park is not there to walk in.
  const park = world && !leaning() ? world : undefined;
  if (story.work && story.work !== work) {
    await story.close(point ?? centre());
    document.dispatchEvent(new CustomEvent('park:work', { detail: { id: undefined } }));
    if (park?.rig.mode === 'hold') await park.rig.go('walk', reducedMotion.matches ? 0 : 0.5);
  }
  if (work && story.work !== work) {
    if (park) {
      park.stop();
      await park.rig.go('hold', reducedMotion.matches ? 0 : 0.6, exhibits.standing(workSpot(work)));
    }
    document.dispatchEvent(new CustomEvent('park:work', { detail: { id: work, rect: park ? exhibits.rect(work) : undefined } }));
    await story.open(work, point ?? centre());
  }
}

const run = (target, point) => {
  chain = chain.then(() => apply(target, point)).catch((error) => console.warn(error));
  return chain;
};

export function open(id, point) {
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
const workSpot = (id) => plan.works.find((spot) => spot.id === id);

addEventListener('popstate', () => {
  const target = read();
  const closing = Boolean(story.work);
  run(target).then(() => {
    if (target.zone && !closing) world?.goIsland(target.zone);
  });
});

// The list of the works as the page, when the park has given way on a slow machine. Its small covers
// are fetched only now. The button goes back to the park.
const leaning = () => document.documentElement.classList.contains('is-lean');
const leanNote = element('span', { textContent: 'Il parco su questo computer va a scatti: ecco tutti i lavori in elenco.' });
const leanBack = element('button', { className: 'pill', type: 'button', textContent: 'Torna al parco' });
leanBack.addEventListener('click', () => {
  document.documentElement.classList.remove('is-lean');
  world.pause(false);
});

const covers = () => {
  for (const image of $('.list').querySelectorAll('img[data-src]')) image.src = image.dataset.src;
};

function showList() {
  covers();
  document.documentElement.classList.add('is-lean');
  scrollTo(0, 0);
}

function setUp(data, texts) {
  works = catalogue(data);
  plan = planPark(data, texts);
  story = createStory($('.story'), { works, sound, onClose: close, onEnd: close });
  fillList($('.list'), { plan, works, onOpen: (id) => open(id) });
  $('.list').prepend(element('p', { className: 'lean' }, [leanNote, leanBack]));
}

const above = $('.above');
// The pictures of the park beyond the first light ones, fetched once the door is ready.
let unveil = () => {};
let here;
let flying = false;
// How many times the ground has been clicked walking freely (the label says «here» the first three).
let goneHere = 0;
const verb = () => (matchMedia('(pointer: coarse)').matches ? 'Tocca' : 'Clicca');

// The guided visit: the stops in the order of the walk, one island after the other, each seen whole
// from where one arrives (in front of its works), then its cards, then its works one by one.
// at: the stop one is at, or going to.
let stops = [];
let at = 0;
// The stop being walked to, turned to on arrival; open: the work opens there.
let arriving;
export let free = false;

// Where a stop is seen from, and the point the eyes look at there.
function sight(stop) {
  if (stop.work) return exhibits.view(stop.work);
  const { arrival, centre } = stop.island;
  if (stop.card) {
    const { mark } = stop.card;
    const d = Math.hypot(arrival.x - mark.x, arrival.z - mark.z) || 1;
    return { x: mark.x + ((arrival.x - mark.x) / d) * CARD_AWAY, z: mark.z + ((arrival.z - mark.z) / d) * CARD_AWAY, look: { x: mark.x, y: mark.y + 2.4, z: mark.z } };
  }
  const places = plan.works.filter((spot) => spot.island === stop.island.index).map((spot) => spot.place);
  const mean = (key) => places.reduce((sum, place) => sum + place[key], 0) / places.length;
  const look = places.length ? { x: mean('x'), y: mean('cy') - 0.6, z: mean('z') } : { x: centre.x, y: centre.y + 0.6, z: centre.z };
  return { x: arrival.x, z: arrival.z, look };
}
// The stop one is at; come to an island some other way (a jump, a free walk), its first stop.
// On the way to a stop, that stop is where one is.
const position = () => (arriving || stops[at]?.island === world.here() ? at : stops.findIndex((stop) => stop.island === world.here()));

// Goes to a stop: walks there along the paths, and on arrival turns to what it shows.
function visit(index, opening = false) {
  at = (index + stops.length) % stops.length;
  const { x, z } = sight(stops[at]);
  world.goTo(stops[at].island, x, z);
  arriving = { stop: stops[at], open: opening };
  hint.classList.add('is-gone');
}
const faceStop = (stop) => {
  const { look } = sight(stop);
  world.face(look.x, look.z, look.y);
};

// «Avanti» and «Indietro»: the stop after and before; nextStop says where «Avanti» goes. «Avanti»
// pressed on the way brings one there at once, for whoever does not want to wait.
export const nextStop = () => stops[(position() + 1) % stops.length];
export function advance(way = 1) {
  if (!world || world.rig.mode !== 'walk' || story.work) return;
  if (arriving && way > 0) {
    const { stop } = arriving;
    const { x, z, look } = sight(stop);
    arriving = undefined;
    world.place(stop.island, { x, z });
    world.state.heading = Math.atan2(look.z - z, look.x - x);
    faceStop(stop);
    return;
  }
  visit(position() + way);
}
// The work «Apri» opens: on the visit the one the stop shows, once there; walking freely the nearest,
// near enough.
export const front = () => {
  if (!free) {
    const stop = stops[at];
    return stop?.work && !arriving && !world.moving() && stop.island === world.here() ? stop.work : undefined;
  }
  const spot = world?.state.nearest;
  return spot && Math.hypot(world.state.x - spot.x, world.state.z - spot.z) < NEAR_ENOUGH ? spot : undefined;
};
// «Cammina libero», and back to the visit, which goes on from its stop.
export function setFree(on) {
  free = on;
  world.controls.setFree(on);
  if (!on && world.rig.mode === 'walk') visit(position());
}

// The label next to the mouse that says what a click does there; not on a phone.
const label = element('div', { className: 'pointer-label', hidden: true });
document.body.append(label);
document.addEventListener('pointermove', (event) => {
  // Beside the hand, never past the right edge of the screen.
  if (event.pointerType === 'mouse') label.style.transform = `translate(${Math.min(event.clientX + 18, innerWidth - label.offsetWidth - 8)}px, ${event.clientY + 24}px)`;
});
const toward = (zone, title) => TOWARD[zone] ?? `a ${title}`;
// The jump to an island, which the travel bar makes.
const jump = (zone) => document.dispatchEvent(new CustomEvent('travel:jump', { detail: { zone } }));

function say(text) {
  if (label.textContent === text) return;
  label.textContent = text;
  label.hidden = !text;
}

// From above the whole island and the names of the zones; a zone touched is where the walk goes on.
async function fly(up, zone) {
  if (flying || !world || up === (world.rig.mode === 'above')) return;
  flying = true;
  sound.play('whoosh');
  above.setAttribute('aria-pressed', String(up));
  if (zone) world.place(zone);
  await world.rig.go(up ? 'above' : 'walk', reducedMotion.matches ? 0 : FLIGHT);
  flying = false;
}
above.addEventListener('click', () => fly(world?.rig.mode !== 'above'));

// The path and the metres along it of a point on its stones.
function stoneAt(point) {
  let best;
  for (const path of plan.paths) {
    for (let i = 0; i <= 80; i++) {
      const at = path.curve.getPointAt(i / 80);
      const gap = at.distanceTo(point);
      if (!best || gap < best.gap) best = { gap, path, t: (i / 80) * path.length };
    }
  }
  return [best.path, best.t];
}

// Builds the park; the promise is kept when what is seen from the arrival is decoded and drawn.
function build(texts, pictures, sprites) {
  world = createWorld($('.park'), { plan, reducedMotion });
  const anchors = createAnchors($('.anchors'), world.camera);
  exhibits = createExhibits({ plan, works, renderer: world.renderer, anchors, rig: world.rig, camera: world.camera });
  const park = createPark({ plan, renderer: world.renderer, pictures, sprites });
  world.add(exhibits);
  world.add(park);
  world.block([...exhibits.solid, ...park.solid]);
  const tappable = [...exhibits.targets, ...park.tappable];
  stops = plan.islands.flatMap((island) => [
    { island, label: VERSO[island.zones[0].id] ?? `verso ${island.zones[0].title}` },
    ...island.zones.filter((zone) => zone.card).map((card) => ({ island, card, label: card.title })),
    ...plan.works.filter((spot) => spot.island === island.index).map((work) => ({ island, work, label: works[work.id].title })),
  ]);
  // A name never falls on a work, nor under the arrows at the sides.
  const arrows = world.controls.arrows;
  anchors.avoid(() => [...exhibits.inSight(), ...arrows.filter((node) => node.classList.contains('is-on')).map((node) => node.getBoundingClientRect())]);
  world.add(createLight({ plan, sky: world.sky, sun: world.sun, fog: world.scene.fog, park }));
  createSigns({
    plan,
    texts,
    works,
    anchors,
    rig: world.rig,
    state: world.state,
    camera: world.camera,
    // A name in the sky: the jump there (the travel bar makes it).
    onZone(id) {
      if (world.rig.mode === 'above') fly(false, id);
      else jump(id);
    },
    onWork: (id) => open(id),
  });
  // What lies under a point of the screen, for a click and for the hand: a work (it wins over the
  // ground, with a wide margin round its frame), a thing of the park, the ground or a stone.
  // held: the work the look is held still over, whose margin is wider.
  const pick = (x, y, held) => {
    // The frame the point is in, or else the nearest whose margin it is in.
    const off = (r) => Math.max(r.left - x, x - r.left - r.width, r.top - y, y - r.top - r.height, 0);
    const near = exhibits.inSight()
      .filter((r) => r.distance < 22 && off(r) < MARGIN + (r.spot === held ? LET_GO : 0))
      .sort((a, b) => off(a) - off(b) || a.distance - b.distance)[0];
    if (near) return { work: near.spot };
    const hit = world.hit(x, y, [...tappable, ...world.land.floors, ...world.land.stones]);
    if (!hit) return {};
    if (exhibits.targets.includes(hit.object)) return { work: exhibits.spotOf(hit) };
    if (park.tappable.includes(hit.object)) return { thing: hit };
    return { ground: hit };
  };

  // The ring on the ground under the hand: «here», before the click.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }));
  ring.renderOrder = 3;
  ring.visible = false;
  world.scene.add(ring);

  // Under the hand, one frame in three: the look holds still over what a click opens; the hand presses
  // there; the label says what a click does; walking freely, the ring marks the ground. On the visit
  // only the works answer: the one in front opens, another is gone to.
  let frame = 0;
  let underHand = {};
  const point = () => {
    const at = world.controls.pointer();
    // Nothing to point at while walking: no ring, and no cost.
    if (!at || world.rig.mode !== 'walk' || world.moving()) {
      ring.visible = false;
      world.controls.hold(false);
      return;
    }
    if (frame++ % 3) return;
    underHand = pick(at.x, at.y, underHand.work);
    const { work, thing } = underHand;
    const ground = free && underHand.ground;
    world.controls.hold(Boolean(work || thing));
    $('.park').classList.toggle('is-over', Boolean(work || (free && thing)));
    ring.visible = Boolean(ground);
    if (ground) ring.position.copy(ground.point).setY(ground.point.y + 0.04);
    const title = work && works[work.id].title;
    say(work ? (free || work === front() ? `${verb()} per aprire: ${title}` : `${verb()} per andare a: ${title}`) : ground && goneHere < 3 ? `${verb()} per andare qui` : '');
  };

  // Coming near a name in the sky, the look stops, so that the name stays where the hand is going: the
  // look turning towards the pointer brings the name towards it, and stopped this far out it has not
  // yet slid past.
  world.controls.holdNear((x, y) => [...document.querySelectorAll('.anchor.zone-name.is-on:not(.is-covered)')].some((node) => {
    const r = node.getBoundingClientRect();
    return x > r.left - NAME_MARGIN && x < r.right + NAME_MARGIN && y > r.top - NAME_MARGIN && y < r.bottom + NAME_MARGIN;
  }));

  world.add({
    update() {
      keep();
      // The arrows to turn round, only walking freely in the park.
      const walking = free && world.rig.mode === 'walk' && !story.work;
      for (const node of arrows) node.classList.toggle('is-on', walking);
      anchors.update();
      point();
      // At the stop one was going to: the look turns to what it shows, and a work clicked opens.
      if (arriving && !world.moving()) {
        const { stop, open: opening } = arriving;
        arriving = undefined;
        if (stop.island !== world.here()) return;
        if (opening) open(stop.work.id);
        else faceStop(stop);
      }
    },
  });
  // Come to an island by a jump («I mondi», a name in the sky): the visit goes on from its first stop.
  document.addEventListener('travel:arrived', () => {
    at = position();
    faceStop(stops[at]);
  });
  $('.anchors').addEventListener('pointerover', (event) => {
    const name = event.pointerType === 'mouse' && event.target.closest('.zone-name');
    if (name) say(`${verb()} per andare ${toward(name.dataset.zone, name.textContent)}`);
  });
  $('.anchors').addEventListener('pointerout', (event) => {
    if (event.target.closest('.zone-name')) say('');
  });
  // Room kept for the buttons at the top and for the travel bar and the words at the start at the
  // foot; read every frame, as they come and go.
  const keep = () => {
    const low = [$('.travel__bar'), hint].filter((node) => node && !node.hidden && !node.classList.contains('is-gone')).map((node) => node.getBoundingClientRect().top);
    anchors.keep({
      top: $('.hud').getBoundingClientRect().bottom + 8,
      bottom: low.length ? innerHeight - Math.min(...low) + 8 : 8,
    });
  };
  addEventListener('resize', () => anchors.remeasure());
  hint.textContent = `Premi Avanti per visitare. ${verb()} un quadro per aprirlo.`;
  // Before everything already asked for: on an island with works, the covers near; then the
  // cut-outs of the island one is on, small; then the covers if they have not come first, and the
  // rest at its size.
  unveil = () => ahead(() => {
    const works = plan.works.some((spot) => spot.island === here.index);
    if (works) exhibits.island(here);
    park.load(here.index, 'small');
    if (!works) exhibits.island(here);
    park.island(here);
  });
  world.on({
    // Pictures are fetched for the island one is on and its neighbours, once past the door.
    island(island) {
      here = island;
      if ($('.threshold').hidden) unveil();
      if (story.work || !$('.threshold').hidden) return;
      history.replaceState(null, '', island.index === 0 ? location.pathname + location.search : `#${island.zones[0].id}`);
    },
    // A slow machine: the park goes the light way; too slow even so, the list of the works is the
    // page, with a way back to the park.
    light(on) {
      park.light(on);
      exhibits.light(on);
    },
    crawl() {
      world.pause(true);
      showList();
    },
    // The visit: the wheel, a swipe; and after a drag the look goes back to the stop.
    step: (way) => advance(way),
    lookEnd() {
      if (!free && !arriving) faceStop(stops[position()]);
    },
    // One click, one obvious thing. On the visit: the work in front opens, another work is gone to.
    // Walking freely: a work near opens, one far is walked to and opens there, a thing of the park
    // answers, the ground or a stone is walked to (with rings where it was touched), the sky takes a few
    // steps ahead; on a phone a tap while walking stops.
    tap(x, y, kind) {
      if (world.rig.mode !== 'walk') return;
      const { work, thing, ground } = pick(x, y);
      if (!free) {
        if (!work) return;
        sound.play('tap');
        if (work === front()) open(work.id, { x, y });
        else visit(stops.findIndex((stop) => stop.work === work));
        return;
      }
      arriving = undefined;
      if (kind !== 'mouse' && world.moving()) {
        world.stop();
        return;
      }
      if (work) {
        sound.play('tap');
        if (Math.hypot(world.camera.position.x - work.x, world.camera.position.z - work.z) < NEAR_ENOUGH) open(work.id, { x, y });
        else visit(stops.findIndex((stop) => stop.work === work), true);
      } else if (thing) {
        if (park.touch(thing)) sound.play('tap');
      } else if (ground) {
        goneHere++;
        sound.play('drop');
        if (world.land.stones.includes(ground.object)) world.goAlong(...stoneAt(ground.point));
        else {
          world.land.ripple(ground.point.x, ground.point.z);
          world.goTo(ground.object.userData.island, ground.point.x, ground.point.z);
        }
      } else world.ahead(STEP_AHEAD);
    },
  });
  // The door opens when the first island is drawn, in its light pictures (tools/build-light.py).
  // Then, while the door is read, the same sharper and what is near; once in, each island change
  // asks for what comes near and lets go what is far.
  return Promise.all([park.load(0, 'light'), exhibits.load(0)]);
}

addEventListener('keydown', (event) => {
  if (!story || (world && !$('.threshold').hidden)) return;
  if (event.key === 'Escape') {
    if (world?.rig.mode === 'above') fly(false);
    else if (story.work) close();
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
  // On the visit: the arrows right and down are «Avanti», left and up «Indietro».
  const way = free ? 0 : { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }[event.key];
  if (way) {
    event.preventDefault();
    if (!event.repeat) advance(way);
  } else if (world.controls.key(event, true)) {
    event.preventDefault();
    world.stop();
    arriving = undefined;
  }
  else if (event.key === 'Enter' && front()) open(front().id);
  else if (event.key === ' ') {
    event.preventDefault();
    advance();
  }
});
addEventListener('keyup', (event) => world?.controls.key(event, false));

$('.brand').addEventListener('click', (event) => {
  event.preventDefault();
  if (!world || !$('.threshold').hidden) return;
  close();
  chain.then(() => world.goIsland(plan.landing));
});

const threshold = createThreshold($('.threshold'), {
  async onEnter(withSound) {
    world.start();
    sound.begin(withSound);
    sound.play('drop');
    const target = read();
    if (target.work) world.place(plan.islands[workSpot(target.work).island]);
    else if (target.zone) world.place(target.zone);
    await world.rig.go('walk');
  },
  onLeave() {
    const target = read();
    if (target.work) {
      history.replaceState(null, '', `#${works[target.work].chapter}`);
      history.pushState({ work: target.work }, '', `#lavoro/${target.work}`);
      run(target);
    }
    hint.hidden = false;
    unveil();
  },
});

// The pictures listed by img/sprites/manifest.json, in the shape the park reads.
const library = (manifest) => Object.fromEntries(Object.entries(manifest).map(([id, entry]) => [id, {
  w: entry.larghezza,
  h: entry.altezza,
  metres: entry.altezza_m,
  lift: entry.sospesa_m ?? 0,
  // The planets of the sky have no foot to stand on.
  anchor: entry.appoggio && [entry.appoggio.x, 1 - entry.appoggio.y],
  large: { file: `img/sprites/${entry.file}` },
  small: { file: `img/sprites/${entry.file_1024}` },
  light: { file: `img/sprites-light/${id}.webp` },
}]));

const [data, texts, pictures, manifest] = await Promise.all([json('data/works.json'), json('data/racconto.json'), json('img/park/park.json'), json('img/sprites/manifest.json'), document.fonts.ready]);
setUp(data, texts);
let loaded;
try {
  loaded = build(texts, pictures, library(manifest));
} catch (error) {
  // Without WebGL the list of works is the page, and every work still opens closely.
  console.warn(error);
  document.documentElement.classList.add('no-webgl');
  covers();
  $('.threshold').hidden = true;
}
if (world) {
  // The park is drawn from the moment one goes in; behind the door there is the picture.
  await loaded;
  world.renderer.compile(world.scene, world.camera);
  threshold.ready();
  here ??= plan.landing;
  unveil();
} else {
  const target = read();
  if (target.work) run(target);
}
