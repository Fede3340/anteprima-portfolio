// The plan of the park: an archipelago of cloud islands in the sky, one for each place, in a loose
// loop at different heights, joined by paths of round stones; from the last one the path goes back to
// the first. On each island its works stand in an arc in a clearing, facing whoever arrives.
import * as THREE from 'three';

const LOOP = 64;
const STONE_EVERY = 1.25;
// 16:10 like the covers, the middle of the picture at about eye height.
export const FRAME = { width: 2, height: 1.25 };

// The mood of each island: its hour on the wheel of the day (hours.js: 0 dawn, 1 day, 2 blue hour) and
// its own touch of colour, taken from the three pictures of the opening. accent: the colour of the
// island (the veil of its portal); on: the cut-outs of the island that wear a colour, by name.
export const MOODS = {
  ingresso: { hour: 0, accent: '#ffa86a' },
  siti: { hour: 0.3, accent: '#f5a98a' },
  negozi: { hour: 1, accent: '#f2836b', on: { cassette: '#f2836b' } },
  programmi: { hour: 1, accent: '#3298fa' },
  app: { hour: 1, accent: '#5a8fe0', on: { canne: '#7fa8e8' } },
  videogioco: { hour: 1.3, accent: '#2a4fd6', on: { aquilone: '#2a4fd6', scivolo: '#f2836b' } },
  marchi: { hour: 1.7, accent: '#f7c35f', on: { 'fiore-1': '#f2836b', 'fiore-2': '#f7c35f', aiuola: '#e98fb5' } },
  manifesti: { hour: 2, accent: '#e98fb5', on: { bandiera: '#e98fb5' } },
  google: { hour: 2, accent: '#8d7bd9' },
  contatti: { hour: 2, accent: '#ffc27a', on: { 'cassetta-posta': '#ffc27a' } },
};

// The islands in the order of the loop: the places they hold, their size, height and light. The first
// stands further out, so that the sky opens between it and its neighbours.
const ISLANDS = [
  { id: 'ingresso', zones: ['apertura', 'chi', 'servizi'], radius: 16, height: 0, mood: 'morning', reach: 1.4 },
  { id: 'siti', zones: ['siti'], radius: 15, height: 5, mood: 'shade' },
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
    const reach = LOOP * (island.reach ?? 1 + 0.12 * Math.sin(index * 2.3));
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
  // Where the visit begins: near the middle of the first island and a little aside, looking at the
  // mouth of the path to the second, so that walking straight ahead leads onto its stones, and the
  // next island stands to the right with open sky in front, as in the picture of the door.
  const first = islands[0];
  const leave = first.out.curve.getPoint(0);
  const axis = leave.clone().sub(first.centre).setY(0).normalize();
  first.start = first.centre.clone().addScaledVector(axis, 1.5).add(v(-axis.z, 0, axis.x).multiplyScalar(6));
  // What is seen from there, by metres ahead and to the right of that look.
  const ahead = leave.clone().sub(first.start).setY(0).normalize();
  const seen = (forward, right, y = first.centre.y) => v(first.start.x + ahead.x * forward - ahead.z * right, y, first.start.z + ahead.z * forward + ahead.x * right);
  // The great cursor stands ahead on the left, a pond ahead on the right, walked round; the other two
  // sculptures to either side, found by turning.
  const marks = { apertura: seen(13, -5), chi: seen(4, 8), servizi: seen(2, -8) };
  for (const zone of first.zones) zone.mark = marks[zone.id];
  const ponds = [{ island: first, ...pick(seen(9, 3.8)), r: 2.3, level: first.centre.y - 0.05 }];
  // The islets around the first island, out of the way and out of reach, each a little themed
  // garden: by distance, degrees to the right of the look and degrees above it. The pond's islet is
  // a little below the eyes, so that its water is seen.
  // One that would stand over an island goes further off along the same line of sight.
  const sky = (distance, right, up, radius) => {
    const a = THREE.MathUtils.degToRad(right);
    const at = (d) => seen(Math.cos(a) * d, Math.sin(a) * d, first.centre.y + 1.6 + Math.tan(THREE.MathUtils.degToRad(up)) * d);
    while (islands.some((island) => Math.hypot(at(distance).x - island.centre.x, at(distance).z - island.centre.z) < island.radius + radius + 3)) distance += 2;
    return at(distance);
  };
  const islets = [
    { id: 'stagno', right: -3, up: -1.5, distance: 26, radius: 5.5 },
    { id: 'boschetto', right: -9, up: 10, distance: 60, radius: 7.5 },
    { id: 'altalena', right: 8, up: 16, distance: 44, radius: 5 },
    { id: 'lampione', right: 24, up: -3, distance: 24, radius: 4 },
  ].map(({ id, right, up, distance, radius }, index) => ({ id, radius, centre: sky(distance, right, up, radius), index: count + index }));
  const pond = islets[0];
  // Its water a little to the far side, so that the near rim does not hide it.
  ponds.push({ island: pond, ...pick(pond.centre.clone().addScaledVector(pond.centre.clone().sub(first.start).setY(0).normalize(), 0.8)), r: 2.5, level: pond.centre.y - 0.05 });
  // Stones hanging between the islets, not to be walked: from the wood to the swing, across the sky.
  const links = [[islets[1], islets[2]]].map(([from, to], index) => {
    const way = to.centre.clone().sub(from.centre).setY(0).normalize();
    const start = from.centre.clone().addScaledVector(way, from.radius - 1).setY(from.centre.y + 0.15);
    const end = to.centre.clone().addScaledVector(way, -(to.radius - 1)).setY(to.centre.y + 0.15);
    const side = v(-way.z, 0, way.x).multiplyScalar(3);
    const curve = new THREE.CubicBezierCurve3(start, start.clone().addScaledVector(way, 5).add(side), end.clone().addScaledVector(way, -5).add(side), end);
    return { curve, stones: Math.round(curve.getLength() / STONE_EVERY), index: count + index };
  });
  return { islands, zones, works, paths, landing: first, islets, links, ponds };
}

const pick = ({ x, z }) => ({ x, z });

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
