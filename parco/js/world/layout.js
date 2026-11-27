// The plan of the park: an archipelago of cloud islands in the sky, one for each place, in a loose
// loop at different heights, joined by paths of round stones; from the last one the path goes back to
// the first. On each island its works stand in an arc in a clearing, facing whoever arrives.
import * as THREE from 'three';

const LOOP = 64;
const STONE_EVERY = 1.25;
// 16:10 like the covers, the middle of the picture at about eye height.
export const FRAME = { width: 2, height: 1.25 };

// Light of each island: height of the sun in degrees, strength of sun and sky as shares of the usual
// light, lamps lit, and how much the haze closes in. Colours never change.
// Sky and sun are balanced so the white ground gets about the same light on every island, between
// 0.88 and 0.96 of full white as (2.2 * sky + 1.1 * sunLight * sin(sun)) / PI: a low sun is made up
// for by the sky, a high one takes from it. The floor is never grey and never burnt out.
const MOODS = {
  morning: { sun: 40, sunLight: 1, sky: 1, lamps: 0, haze: 1 },
  noon: { sun: 66, sunLight: 1.15, sky: 0.85, lamps: 0, haze: 1.15 },
  shade: { sun: 30, sunLight: 0.6, sky: 1.13, lamps: 0.3, haze: 0.85 },
  clear: { sun: 52, sunLight: 1.15, sky: 0.9, lamps: 0, haze: 1.1 },
  calm: { sun: 22, sunLight: 0.8, sky: 1.15, lamps: 0.2, haze: 0.9 },
  dusk: { sun: 10, sunLight: 0.45, sky: 1.22, lamps: 1, haze: 0.8 },
  far: { sun: 58, sunLight: 1.1, sky: 0.9, lamps: 0, haze: 1.3 },
};

// The islands in the order of the loop: the places they hold, their size, height and light.
const ISLANDS = [
  { id: 'ingresso', zones: ['apertura', 'chi', 'servizi'], radius: 16, height: 0, mood: 'morning' },
  { id: 'siti', zones: ['siti'], radius: 15, height: 7, mood: 'shade' },
  { id: 'negozi', zones: ['negozi'], radius: 15, height: 2, mood: 'noon' },
  { id: 'programmi', zones: ['programmi'], radius: 13, height: 10, mood: 'clear' },
  { id: 'app', zones: ['app'], radius: 14, height: 4, mood: 'calm' },
  { id: 'videogioco', zones: ['videogioco'], radius: 14, height: 12, mood: 'dusk' },
  { id: 'marchi', zones: ['marchi'], radius: 16, height: 3, mood: 'morning' },
  { id: 'manifesti', zones: ['manifesti'], radius: 17, height: 9, mood: 'noon' },
  { id: 'google', zones: ['google'], radius: 12, height: 15, mood: 'far' },
  { id: 'contatti', zones: ['contatti'], radius: 13, height: 5, mood: 'dusk' },
];

const NAMES = { apertura: 'Apertura', google: 'Google', contatti: 'Contatti' };
const CARDS = { chi: 'who', servizi: 'services', google: 'google', contatti: 'contact' };

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export function planPark(data, texts) {
  const chapters = Object.fromEntries(data.chapters.map((chapter) => [chapter.id, chapter]));
  const count = ISLANDS.length;
  const islands = ISLANDS.map((island, index) => {
    const angle = (index / count) * Math.PI * 2;
    // A loop that is not a circle: each island a little in or out, so that others show past it.
    const reach = LOOP * (1 + 0.12 * Math.sin(index * 2.3));
    return { ...island, index, centre: v(Math.cos(angle) * reach, island.height, Math.sin(angle) * reach), mood: MOODS[island.mood] };
  });
  const zones = [];
  const works = [];
  for (const island of islands) {
    island.zones = island.zones.map((id) => {
      const chapter = chapters[id];
      const zone = { id, island, title: NAMES[id] ?? chapter?.title ?? texts[CARDS[id]]?.title, card: CARDS[id], works: [], mood: island.mood, index: zones.length };
      zones.push(zone);
      for (const workId of chapter?.works ?? []) {
        const work = { id: workId, zone: id, island: island.index };
        zone.works.push(work);
        works.push(work);
      }
      return zone;
    });
  }
  const paths = islands.map((from, index) => joinIslands(from, islands[(index + 1) % count], index));
  for (const island of islands) {
    island.out = paths[island.index];
    island.in = paths[(island.index - 1 + count) % count];
    arrange(island);
  }
  // Where the visit begins: on the first island, a few steps from the path to the second, so that
  // walking straight ahead leads onto its stones.
  const first = islands[0];
  const leave = first.out.curve.getPoint(0);
  first.start = first.centre.clone().lerp(leave, 0.4);
  return { islands, zones, works, paths, landing: first };
}

// A path of stones from the edge of one island to the edge of the next, bending to one side. It
// leaves and reaches each island level with its floor, never from under its edge: the climb or the
// descent is in the middle.
function joinIslands(from, to, index) {
  const way = to.centre.clone().sub(from.centre).setY(0).normalize();
  const side = new THREE.Vector3(-way.z, 0, way.x).multiplyScalar((index % 2 ? 1 : -1) * 4);
  const start = from.centre.clone().addScaledVector(way, from.radius - 1.2).setY(from.centre.y + 0.15);
  const end = to.centre.clone().addScaledVector(way, -(to.radius - 1.2)).setY(to.centre.y + 0.15);
  const leave = start.clone().addScaledVector(way, 6).add(side);
  const arrive = end.clone().addScaledVector(way, -6).add(side);
  const curve = new THREE.CubicBezierCurve3(start, leave, arrive, end);
  const length = curve.getLength();
  const stones = Math.max(2, Math.round(length / STONE_EVERY));
  return { index, from: from.index, to: to.index, curve, length, stones };
}

// The works of an island in an arc a few steps in front of where one arrives, facing that point, as
// pictures in a clearing; with many works, a second arc behind the first. The sculpture of each place
// stands at an end of the arc; cards stand by their sculptures.
const ROWS = [7, 10];
const GAP = 2.7;
function arrange(island) {
  const arrive = island.in.curve.getPoint(1).clone().sub(island.centre).setY(0).normalize();
  island.arrival = island.centre.clone().addScaledVector(arrive, island.radius * 0.5);
  const focal = island.arrival;
  const ahead = Math.atan2(-arrive.z, -arrive.x);
  const all = island.zones.flatMap((zone) => zone.works);
  const rows = all.length > 7 ? 2 : 1;
  const perRow = Math.ceil(all.length / rows);
  let widest = 0;
  all.forEach((work, index) => {
    const row = rows === 2 ? index % 2 : 0;
    const inRow = rows === 2 ? Math.floor(index / 2) : index;
    const distance = ROWS[row];
    const step = GAP / distance;
    const angle = ahead + (inRow - (perRow - 1) / 2) * step + row * step * 0.5;
    widest = Math.max(widest, Math.abs(angle - ahead));
    let x = focal.x + Math.cos(angle) * distance;
    let z = focal.z + Math.sin(angle) * distance;
    // Kept on the island, clear of its rim.
    const off = Math.hypot(x - island.centre.x, z - island.centre.z);
    const room = island.radius - 2.5;
    if (off > room) {
      x = island.centre.x + ((x - island.centre.x) / off) * room;
      z = island.centre.z + ((z - island.centre.z) / off) * room;
    }
    const f = v(focal.x - x, 0, focal.z - z).normalize();
    work.place = { x, y: island.centre.y, z, fx: f.x, fz: f.z, cy: island.centre.y + 1.5 };
    Object.assign(work, { x, z });
  });
  // The side of the way in away from the path that leaves: the great cursor stands there, aside.
  const leave = island.out.curve.getPoint(0);
  const away = Math.sign(Math.cos(ahead) * (leave.z - focal.z) - Math.sin(ahead) * (leave.x - focal.x)) || 1;
  island.zones.forEach((zone, index) => {
    // The sculptures at the ends of the arc, or either side of the way in where there are no works.
    const side = index % 2 ? 1 : -1;
    const turn = zone.id === 'apertura' ? ahead - away * 0.9 : ahead + side * (all.length ? widest + 0.55 : 1.15);
    const distance = zone.id === 'apertura' ? island.radius * 0.95 : all.length ? 6.5 : 9;
    zone.mark = { x: focal.x + Math.cos(turn) * distance, y: island.centre.y, z: focal.z + Math.sin(turn) * distance };
  });
}

// Where an island's path enters or leaves it, on its edge.
export const mouth = (plan, island, path) => path.curve.getPoint(path.from === island.index ? 0 : 1);

export const islandOf = (plan, id) => plan.islands.find((island) => island.id === id || island.zones.some((zone) => zone.id === id));
