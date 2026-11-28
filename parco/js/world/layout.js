// The plan of the park: an archipelago of cloud islands in the sky, one for each place, in a loose
// loop at different heights, joined by paths of round stones; from the last one the path goes back to
// the first. On each island its works stand in an arc in a clearing, facing whoever arrives.
import * as THREE from 'three';

const LOOP = 64;
const STONE_EVERY = 1.5;
// 16:10 like the covers, the middle of the picture at about eye height.
export const FRAME = { width: 2, height: 1.25 };

// The mood of each island: its hour on the wheel of the day (hours.js: 0 dawn, 1 day, 2 blue hour) and
// its own touch of colour, only from the colours of the mark (its blue, orange and peach, lilac,
// light blue, cream). accent: the colour of the island (its flowers,
// flags and kites, its stones and its name); on: the things of the island that wear a colour of their
// own, by name.
export const MOODS = {
  ingresso: { hour: 0, accent: '#ffa86a' },
  siti: { hour: 0.3, accent: '#f5a98a' },
  negozi: { hour: 1, accent: '#f5a47a', on: { cassette: '#f5a47a' } },
  programmi: { hour: 1, accent: '#6fb1ee' },
  app: { hour: 1, accent: '#4f72c4' },
  videogioco: { hour: 1.3, accent: '#a99ade', on: { scivolo: '#a99ade' } },
  marchi: { hour: 1.7, accent: '#f0d6a8' },
  manifesti: { hour: 2, accent: '#c7a8e2' },
  google: { hour: 2, accent: '#f39a5a' },
  contatti: { hour: 2, accent: '#f5d4a8', on: { 'cassetta-posta': '#f5d4a8' } },
};

// The colours of the living things of the park, the same on every island, soft and in the light of the
// hour (light.js gives them to the pictures; whoever draws the park elsewhere takes them from here).
export const TINTS = {
  crown: '#8aa781',
  forest: '#7a9a76',
  hedge: '#7f9c77',
  bush: '#93ad88',
  grass: '#a0b88c',
  stem: '#8ea47c',
  reedHead: '#b1916f',
  trunk: '#a98a74',
  stone: '#b8b2ac',
  furniture: '#9ba0c8',
};

// The islands in the order of the loop: the places they hold, their size, height and light. The first
// stands further out, so that the sky opens between it and its neighbours.
const ISLANDS = [
  { id: 'ingresso', zones: ['apertura', 'chi', 'servizi'], radius: 16, height: 0, mood: 'morning', reach: 1.4 },
  { id: 'siti', zones: ['siti'], radius: 15, height: 5, mood: 'shade' },
  { id: 'negozi', zones: ['negozi'], radius: 19, height: 2, mood: 'noon' },
  { id: 'programmi', zones: ['programmi'], radius: 13, height: 10, mood: 'clear' },
  { id: 'app', zones: ['app'], radius: 14, height: 4, mood: 'calm' },
  { id: 'videogioco', zones: ['videogioco'], radius: 14, height: 12, mood: 'dusk' },
  { id: 'marchi', zones: ['marchi'], radius: 19, height: 3, mood: 'morning' },
  { id: 'manifesti', zones: ['manifesti'], radius: 18, height: 9, mood: 'noon' },
  { id: 'google', zones: ['google'], radius: 12, height: 15, mood: 'far' },
  { id: 'contatti', zones: ['contatti'], radius: 13, height: 5, mood: 'dusk' },
];

// The island of the campaigns keeps the id google: the campaign on Google is its first.
const NAMES = { apertura: 'Apertura', google: 'Campagne', contatti: 'Contatti' };
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
  // The great cursor stands well to the left, clear of the way ahead; a pond ahead on the right, walked
  // round; the other two sculptures to either side, found by turning.
  const marks = { apertura: seen(11, -10), chi: seen(4, 8), servizi: seen(2, -8) };
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
  // The island of the App has a pond of its own, where it is furthest from the works, the sculpture
  // and the way across.
  const app = islands.find((island) => island.id === 'app');
  const keep = [...works.filter((work) => work.island === app.index), ...app.zones.map((zone) => zone.mark), app.arrival, mouth(null, app, app.in), mouth(null, app, app.out)];
  const across = (p) => Math.min(...Array.from({ length: 11 }, (_, k) => p.distanceTo(app.arrival.clone().lerp(mouth(null, app, app.out), k / 10).setY(app.centre.y))));
  const [spot] = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const p = v(app.centre.x + Math.cos(a) * app.radius * 0.42, app.centre.y, app.centre.z + Math.sin(a) * app.radius * 0.42);
    return { p, room: Math.min(across(p), ...keep.map((at) => Math.hypot(p.x - at.x, p.z - at.z))) };
  }).sort((a, b) => b.room - a.room);
  ponds.push({ island: app, ...pick(spot.p), r: 3.4, level: app.centre.y - 0.05 });
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
// pictures in a clearing. With more than seven, two arcs: each work of the back one stands in the gap
// between two of the front one, the gap wide enough to show it whole from where one arrives, and the
// front one far enough for the eyes to stand between its works and see one of the back one square on.
// The sculpture of each place stands at an end of the arc; cards stand by their sculptures.
const ONE_ROW = 7;
const GAP = 2.7;
const ROWS = [9, 13.5];
// The width of a frame with its border (exhibits.js), and the room kept between two seen side by side.
const FRAME_WIDTH = FRAME.width + 0.12;
const APART = 0.08;
// Where the way to the next path crosses the arcs, the works stand aside from it: half the way's
// width (land.js), half a frame and a little room, in metres.
const LANE = 2.1;
// More works than this cannot stand in front of where one arrives without hiding one another: they
// stand all round, in a ring.
const RING = 12;
function arrange(island) {
  if (island.zones.flatMap((zone) => zone.works).length > RING) return ring(island);
  const arrive = island.in.curve.getPoint(1).clone().sub(island.centre).setY(0).normalize();
  island.arrival = island.centre.clone().addScaledVector(arrive, island.radius * 0.5);
  const focal = island.arrival;
  const ahead = Math.atan2(-arrive.z, -arrive.x);
  const all = island.zones.flatMap((zone) => zone.works);
  const two = all.length > ONE_ROW;
  // Front and back counts; with as many in each, the two arcs are turned a quarter step each way so
  // that the whole stays centred on the way in.
  const front = two ? Math.ceil(all.length / 2) : all.length;
  const back = all.length - front;
  const step = two ? FRAME_WIDTH / ROWS[0] + FRAME_WIDTH / ROWS[1] + APART : GAP / ONE_ROW;
  const turn = back === front ? step / 4 : 0;
  const leave = island.out.curve.getPoint(0);
  const toLeave = Math.atan2(leave.z - focal.z, leave.x - focal.x);
  const off = (angle) => Math.atan2(Math.sin(angle - toLeave), Math.cos(angle - toLeave));
  const angles = all.map((work, index) => {
    const row = two ? index % 2 : 0;
    const inRow = two ? Math.floor(index / 2) : index;
    return row ? ahead + (inRow - (back - 1) / 2) * step + turn : ahead + (inRow - (front - 1) / 2) * step - turn;
  });
  // The lane opens only where the way runs through the works or past one of them, the same angle for
  // both arcs, so that the works of the back one stay in the gaps of the front one.
  const width = LANE / (two ? ROWS[0] : ONE_ROW);
  const straddled = all.length && Math.min(...angles.map(off)) < 0 && Math.max(...angles.map(off)) > 0;
  const lane = straddled || angles.some((angle) => Math.abs(off(angle)) < width) ? width : 0;
  let widest = 0;
  all.forEach((work, index) => {
    const row = two ? index % 2 : 0;
    const distance = two ? ROWS[row] : ONE_ROW;
    const angle = angles[index] + (off(angles[index]) < 0 ? -lane : lane);
    widest = Math.max(widest, Math.abs(angle - ahead));
    let x = focal.x + Math.cos(angle) * distance;
    let z = focal.z + Math.sin(angle) * distance;
    // Kept on the island, clear of its rim.
    const out = Math.hypot(x - island.centre.x, z - island.centre.z);
    const room = island.radius - 2.5;
    if (out > room) {
      x = island.centre.x + ((x - island.centre.x) / out) * room;
      z = island.centre.z + ((z - island.centre.z) / out) * room;
    }
    const f = v(focal.x - x, 0, focal.z - z).normalize();
    work.place = { x, y: island.centre.y, z, fx: f.x, fz: f.z, cy: island.centre.y + 1.5 };
    Object.assign(work, { x, z });
  });
  // The side of the way in away from the path that leaves: the great cursor stands there, aside.
  const away = Math.sign(Math.cos(ahead) * (leave.z - focal.z) - Math.sin(ahead) * (leave.x - focal.x)) || 1;
  island.zones.forEach((zone, index) => {
    // The sculptures at the ends of the arc, or either side of the way in where there are no works.
    const side = index % 2 ? 1 : -1;
    const turn = zone.id === 'apertura' ? ahead - away * 0.9 : ahead + side * (all.length ? widest + 0.55 : 1.15);
    const distance = zone.id === 'apertura' ? island.radius * 0.95 : all.length ? 6.5 : 9;
    zone.mark = { x: focal.x + Math.cos(turn) * distance, y: island.centre.y, z: focal.z + Math.sin(turn) * distance };
  });
}

// Many works: one arrives near the middle of the island, and the works stand all round in two
// staggered rings, as in the two arcs, with a lane left free where each path comes in or goes out. The
// sculpture of the place takes a place in the back ring, in the middle of the longer stretch.
function ring(island) {
  const arrive = island.in.curve.getPoint(1).clone().sub(island.centre).setY(0).normalize();
  island.arrival = island.centre.clone().addScaledVector(arrive, 1.5);
  const focal = island.arrival;
  const toward = (point) => Math.atan2(point.z - focal.z, point.x - focal.x);
  const lane = LANE / ROWS[0];
  const ways = [toward(island.out.curve.getPoint(0)), toward(island.in.curve.getPoint(1))];
  const turnOf = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // The two stretches between the lanes, counterclockwise: [start, length].
  const gap = turnOf(ways[1] - ways[0]);
  const stretches = [[ways[0] + lane, gap - 2 * lane], [ways[1] + lane, Math.PI * 2 - gap - 2 * lane]];
  const all = island.zones.flatMap((zone) => zone.works);
  const count = all.length + island.zones.length;
  const total = stretches[0][1] + stretches[1][1];
  const many = Math.round((count * stretches[0][1]) / total);
  const slots = stretches.flatMap(([start, length], k) => {
    const n = k ? count - many : many;
    return Array.from({ length: n }, (_, j) => ({ angle: start + ((j + 0.5) * length) / n, row: j % 2, k, j, n }));
  });
  const longer = stretches[0][1] >= stretches[1][1] ? 0 : 1;
  const free = slots.filter((slot) => !(slot.row && slot.k === longer));
  const backs = slots.filter((slot) => slot.row && slot.k === longer).sort((a, b) => Math.abs(a.j - (a.n - 1) / 2) - Math.abs(b.j - (b.n - 1) / 2));
  const at = (slot) => {
    const distance = ROWS[slot.row];
    return { x: focal.x + Math.cos(slot.angle) * distance, z: focal.z + Math.sin(slot.angle) * distance };
  };
  island.zones.forEach((zone) => {
    zone.mark = { ...at(backs.shift()), y: island.centre.y };
  });
  [...free, ...backs].sort((a, b) => turnOf(a.angle - ways[0]) - turnOf(b.angle - ways[0])).forEach((slot, index) => {
    const work = all[index];
    const { x, z } = at(slot);
    const f = v(focal.x - x, 0, focal.z - z).normalize();
    work.place = { x, y: island.centre.y, z, fx: f.x, fz: f.z, cy: island.centre.y + 1.5 };
    Object.assign(work, { x, z });
  });
}

// Where an island's path enters or leaves it, on its edge.
export const mouth = (plan, island, path) => path.curve.getPoint(path.from === island.index ? 0 : 1);

export const islandOf = (plan, id) => plan.islands.find((island) => island.id === id || island.zones.some((zone) => zone.id === id));
