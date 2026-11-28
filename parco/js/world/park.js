// Everything that stands on the islands besides the works, as cut-out pictures: the clouds of their
// rims and undersides, the clouds of the sky and of the sea below, the sculpture of each place, and
// each island's own piece of park (a wood, an orchard, a stone garden, a pond...), with soft shadows
// on the ground and a pool of light under each lit lamp.
import * as THREE from 'three';
import { placed } from './instances.js';
import { createStones, heightAt, islandAt } from './land.js';
import { mouth } from './layout.js';
import { createSprite, forming } from './sprites.js';
import { createWater } from './water.js';

// What grows on each island: a few groups, each a thing and what grows at its foot ([pictures, the
// first that exists is used]), towards the rim and behind the works, with free ground between them;
// and single things: [pictures, how many, how far towards the rim, as a share of the radius]. Each
// island is known from far by one thing: the tall trunks of the wood, the rows of the orchard, the
// square hedges, the pond, the kites, the flower beds, the flags, the bench at the edge, the letterbox.
const GARDENS = {
  ingresso: { groups: 4, of: [['albero-medio'], ['cespuglio-1'], ['ciuffo-2']], also: [[['albero-grande'], 2, 0.5], [['albero-piccolo'], 3, 0.3]] },
  siti: { groups: 6, of: [['albero-grande'], ['albero-medio'], ['albero-piccolo'], ['cespuglio-1'], ['ciuffo-2']], also: [[['tronco-alto'], 3, 0.6]] },
  negozi: { groups: 5, of: [['albero-frutti'], ['albero-frutti'], ['cassette'], ['ciuffo-2']] },
  programmi: { groups: 6, of: [['siepe-squadrata'], ['siepe-squadrata'], ['siepe-squadrata'], ['sasso'], ['ciuffo-1']], also: [[['gradini'], 2, 0.5]] },
  app: { groups: 3, of: [['albero-medio'], ['cespuglio-1'], ['ciuffo-2']] },
  videogioco: { groups: 3, of: [['cespuglio-2'], ['nuvola-a-terra'], ['ciuffo-2']], also: [[['scivolo'], 1, 0.3], [['aquilone'], 3, 0.6]] },
  marchi: { groups: 6, of: [['aiuola'], ['fiore-1'], ['fiore-2'], ['fiore-2']] },
  manifesti: { groups: 4, of: [['bandiera'], ['erba-alta'], ['erba-alta'], ['erba-alta']], also: [[['erba-alta'], 6, 0.5]] },
  google: { groups: 2, of: [['albero-piccolo'], ['sasso'], ['ciuffo-1']], also: [[['panchina'], 1, 0.9]] },
  contatti: { groups: 2, of: [['albero-medio'], ['cespuglio-1'], ['ciuffo-2']], also: [[['cassetta-posta'], 1, 0.4]] },
};
// Pictures drawn taller than their own height, to be seen from the next island: the square hedges.
const TALLER = { 'siepe-squadrata': 1.7 };
// The islets around the first island, each its own little garden; their trees stand close together.
const ISLETS = {
  stagno: { also: [[['albero-medio'], 1], [['albero-piccolo'], 2], [['cespuglio-1'], 3], [['ciuffo-2'], 6]] },
  boschetto: { also: [[['boschetto'], 2], [['albero-grande'], 4], [['albero-medio'], 7], [['albero-piccolo'], 7], [['cespuglio-2'], 3], [['ciuffo-2'], 6]] },
  altalena: { also: [[['aquilone'], 2], [['cespugli-gruppo', 'cespuglio-2'], 2], [['ciuffo-2'], 5]] },
  lampione: { also: [[['albero-doppio', 'albero-medio'], 1], [['cespuglio-1'], 2], [['ciuffo-2'], 4]] },
};
// The ground seen on arrival: [pictures, metres ahead of the look, metres to its right, height]. Two
// groups, one each side, with the bench on the left; the middle, where the way runs to the path ahead,
// stays empty ground.
const FRONT = [
  [['albero-grande'], 7, -11.5], [['cespuglio-1'], 5.2, -4.8, 0.6], [['nuvola-a-terra'], 6.5, -6, 0.6], [['ciuffo-2'], 4.4, -3.6, 0.4],
  [['panchina'], 7.5, -3.4], [['cespuglio-1'], 12, -9],
  [['albero-doppio', 'albero-medio'], 10.5, 7.5], [['cespugli-gruppo', 'cespuglio-2'], 4.8, 4.4, 0.7], [['ciuffo-1'], 3.8, 3.4, 0.3],
];
// Sculptures drawn smaller than their picture's height, so as not to fill the first look.
const SMALLER = { apertura: 5.5 };
// The sheets of cloud under an island and under an islet: [picture, how far towards the eyes it hangs
// and its width, as shares of the island's radius; depth of its top edge in metres, under the lowest
// dip of the floor].
const BODY = [['falda-1', 0.75, 1, 2.15], ['falda-2', 0.35, 2, 1.5]];
const ISLET_BODY = [['falda-3', 0.75, 1, 2.1]];

// The looks at the sculptures of an island: from where one arrives, from the last stones of the path
// that brings one there and, on the first island, from where the visit begins, to each sculpture, as
// segments [from, to].
const sights = (island) => {
  const bridge = island.in.curve.getPoint(Math.max(0, 1 - 7 / island.in.curve.getLength()));
  return island.zones.flatMap((zone) => [island.arrival, island.start, bridge].filter(Boolean).map((from) => [from, zone.mark]));
};
// How far a point is from a segment.
function along(p, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

// Soft round patches laid on the ground: dark ones for shadows, light ones for the pools of the lamps.
function createPatches(spots, { colour, strength, falloff, light }) {
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
  const level = new THREE.InstancedBufferAttribute(new Float32Array(spots.length).fill(1), 1);
  geometry.setAttribute('level', level);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { colour: { value: new THREE.Color(colour) } },
    vertexShader: `
      attribute float level;
      varying vec2 vUv;
      varying float vLevel;
      void main() {
        vUv = uv;
        vLevel = level;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 colour;
      varying vec2 vUv;
      varying float vLevel;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        gl_FragColor = vec4(colour, (1.0 - smoothstep(${falloff.toFixed(2)}, 1.0, d)) * ${strength.toFixed(2)} * vLevel);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  spots.forEach((spot, index) => mesh.setMatrixAt(index, placed(spot.x, spot.z, 0, spot.size, spot.y ?? 0)));
  mesh.renderOrder = light ? 2 : 1;
  return { mesh, level };
}

// pictures: img/park/park.json; sprites: img/sprites/manifest.json (missing pictures are left out).
export function createPark({ plan, renderer, pictures, sprites: library = {} }) {
  const object = new THREE.Group();
  const roll = random(7);
  const made = [];
  let here;
  let light = false;
  const shadows = [];
  const picture = (name) => library[name] ?? pictures[name];
  // The first of the pictures named that the park has: newer pictures take the place of older ones
  // as they arrive.
  const pick = (...names) => names.find(picture);
  // One picture drawn at many spots: [{ x, y, z, height }], each on the ground unless y is given.
  // Each picture knows the islands where it stands, so that it is fetched when one of them comes
  // near and let go when they are all far; everywhere: the sky, the sea, the far islands. A spot with a
  // home belongs to that island: what is seen from the arrival comes with the first one.
  const nearest = (spot) => plan.islands.reduce((a, b) => (Math.hypot(spot.x - a.centre.x, spot.z - a.centre.z) < Math.hypot(spot.x - b.centre.x, spot.z - b.centre.z) ? a : b)).index;
  const sprite = (name, spots, { everywhere = false, ...options } = {}) => {
    const entry = picture(name);
    if (!entry || !spots.length) return undefined;
    const drawn = createSprite(entry, spots.length, { renderer, ...options });
    drawn.name = name;
    drawn.islands = everywhere ? undefined : new Set(spots.map((spot) => spot.home ?? nearest(spot)));
    drawn.mesh.userData.rank = everywhere ? 0 : Math.min(...drawn.islands);
    spots.forEach((spot, index) => Object.assign(drawn.spots[index], { x: spot.x, z: spot.z, y: spot.y ?? heightAt(plan, spot.x, spot.z), ...(spot.height ? { height: spot.height } : {}) }));
    made.push(drawn);
    object.add(drawn.mesh);
    return drawn;
  };

  // A free spot on an island: away from its works, its sculptures, its paths and its rim.
  const taken = plan.works.map((work) => ({ x: work.x, z: work.z, r: 2.2 }));
  for (const island of plan.islands) {
    for (const zone of island.zones) taken.push({ x: zone.mark.x, z: zone.mark.z, r: 2.6 });
    for (const path of [island.in, island.out]) {
      const at = mouth(plan, island, path);
      taken.push({ x: at.x, z: at.z, r: 2.5 });
    }
    // The ground in front of the way in stays open, so that the works are seen on arrival.
    taken.push({ x: island.arrival.x, z: island.arrival.z, r: 2.6 });
    // The way across the island (land.js), from where the path comes in to where one arrives and on to
    // where the next path leaves, stays free; on the first island also from where the visit begins.
    const ways = [[mouth(plan, island, island.in), island.arrival], [island.arrival, mouth(plan, island, island.out)]];
    if (island.start) ways.push([island.start, mouth(plan, island, island.out)]);
    for (const [a, b] of ways) {
      for (let k = 0; k <= 10; k++) taken.push({ x: a.x + (b.x - a.x) * (k / 10), z: a.z + (b.z - a.z) * (k / 10), r: 2 });
    }
    // Nothing stands between where one arrives and the sculptures.
    for (const [a, b] of sights(island)) {
      for (let k = 0; k <= 10; k++) taken.push({ x: a.x + (b.x - a.x) * (k / 10), z: a.z + (b.z - a.z) * (k / 10), r: 1.5 });
    }
  }
  for (const pond of plan.ponds) taken.push({ x: pond.x, z: pond.z, r: pond.r + 1 });
  // The clearing between where one arrives and the works stays empty: nothing stands in front of them.
  const clearings = plan.islands.map((island) => {
    const spots = plan.works.filter((work) => work.island === island.index);
    if (!spots.length) return undefined;
    const { x, z } = island.arrival;
    const ahead = Math.atan2(island.centre.z - z, island.centre.x - x);
    const turns = spots.map((work) => {
      const a = Math.atan2(work.z - z, work.x - x) - ahead;
      return Math.atan2(Math.sin(a), Math.cos(a));
    });
    return { x, z, ahead, from: Math.min(...turns) - 0.3, to: Math.max(...turns) + 0.3, reach: Math.max(...spots.map((work) => Math.hypot(work.x - x, work.z - z))) + 1.2 };
  });
  const inClearing = (island, x, z) => {
    const c = clearings[island.index];
    if (!c || Math.hypot(x - c.x, z - c.z) > c.reach) return false;
    const a = Math.atan2(z - c.z, x - c.x) - c.ahead;
    const turn = Math.atan2(Math.sin(a), Math.cos(a));
    return turn > c.from && turn < c.to;
  };
  // near: { x, z, heading, spread, from, to } to look only between from and to metres of a point,
  // within spread radians round heading; rim: how far towards the rim, as a share of the radius.
  function freeSpot(island, size, near, rim = 0) {
    for (let tries = 0; tries < 40; tries++) {
      let x;
      let z;
      if (near) {
        const a = near.heading + (roll() - 0.5) * (near.spread ?? 2.6);
        const r = near.from + roll() * (near.to - near.from);
        x = near.x + Math.cos(a) * r;
        z = near.z + Math.sin(a) * r;
        if (Math.hypot(x - island.centre.x, z - island.centre.z) > island.radius - 2.2) continue;
      } else {
        const a = roll() * Math.PI * 2;
        const r = (rim + (1 - rim) * Math.sqrt(roll())) * (island.radius - 2.2);
        x = island.centre.x + Math.cos(a) * r;
        z = island.centre.z + Math.sin(a) * r;
      }
      if (island.out && inClearing(island, x, z)) continue;
      if (taken.some((other) => Math.hypot(other.x - x, other.z - z) < other.r + size)) continue;
      taken.push({ x, z, r: size });
      return { x, z };
    }
    return undefined;
  }

  // The arrival, composed by hand (FRONT), by metres ahead of the first look and to its right.
  const gardens = {};
  const first = plan.landing;
  const leave = mouth(plan, first, first.out);
  const look = Math.atan2(leave.z - first.start.z, leave.x - first.start.x);
  const seen = (forward, right) => ({ x: first.start.x + Math.cos(look) * forward - Math.sin(look) * right, z: first.start.z + Math.sin(look) * forward + Math.cos(look) * right });
  const plant = (names, at, height) => {
    const name = pick(...names);
    if (!name) return;
    (gardens[name] ??= []).push({ ...at, home: 0, height: height ?? (picture(name).metres ?? 1) * (0.85 + roll() * 0.3) });
    taken.push({ x: at.x, z: at.z, r: 0.5 });
  };
  for (const [names, forward, right, height] of FRONT) plant(names, seen(forward, right), height);
  // Round each pond: cushions and reeds on the far rim and the sides, only low tufts on the near rim,
  // so that the water is seen from the arrival; a water lily or two.
  for (const pond of plan.ponds) {
    const viewer = pond.island.out && pond.island !== first ? pond.island.arrival : first.start;
    const far = Math.atan2(pond.z - viewer.z, pond.x - viewer.x);
    const many = Math.round((2 * Math.PI * (pond.r + 0.6)) / 0.9);
    for (let i = 0; i < many; i++) {
      const a = (i / many) * Math.PI * 2;
      const behind = Math.cos(a - far);
      const at = (r) => ({ x: pond.x + Math.cos(a) * r, z: pond.z + Math.sin(a) * r });
      if (behind > -0.2 && i % 4 === 1) plant(['nuvola-a-terra'], at(pond.r + 0.45 + roll() * 0.3), 0.6 + 0.4 * behind + roll() * 0.2);
      else if (behind <= -0.2 && i % 3 === 0) plant(['ciuffo-1'], at(pond.r + 0.5), 0.3);
      // Reeds as tall as the pond is wide: on the App's island they are seen from the next one.
      if (i % 3 === 1 && behind > -0.5) plant(['tifa', 'canne'], at(pond.r + 0.1), 0.9 + pond.r * 0.45 + roll() * 0.6);
    }
    for (const [dx, dz] of [[0.3, -0.35], [-0.45, 0.2]]) plant(['ninfea'], { x: pond.x + dx * pond.r, z: pond.z + dz * pond.r, y: pond.level }, 0.45);
    // On the App's island a jetty runs from the near rim into the water.
    if (pond.island.id === 'app') plant(['pontile'], { x: pond.x - Math.cos(far) * (pond.r - 0.4), z: pond.z - Math.sin(far) * (pond.r - 0.4), y: pond.level });
  }
  // Each island's and islet's garden (GARDENS); spacing: how far apart single things stand, as a share
  // of the width of their picture.
  const put = (name, spot, home) => (gardens[name] ??= []).push({ ...spot, home, height: (picture(name).metres ?? 1) * (TALLER[name] ?? 1) * (0.8 + roll() * 0.4) });
  const grow = (island, { groups = 0, of = [], also = [] }, spacing, home) => {
    for (let g = 0; g < groups; g++) {
      const centre = freeSpot(island, 1.2, undefined, 0.45);
      if (!centre) continue;
      of.forEach((names, k) => {
        const name = pick(...names);
        const spot = k ? freeSpot(island, 0.4, { ...centre, heading: 0, spread: Math.PI * 2, from: 0.9, to: 2.4 }) : centre;
        if (name && spot) put(name, spot, home);
      });
    }
    for (const [names, many, rim = 0] of also) {
      const name = pick(...names);
      if (!name) continue;
      const entry = picture(name);
      for (let i = 0; i < many; i++) {
        const spot = freeSpot(island, Math.max(0.4, (entry.metres ?? 1) * (entry.w / entry.h) * spacing), undefined, rim);
        if (spot) put(name, spot, home);
      }
    }
  };
  for (const island of plan.islands) grow(island, GARDENS[island.id], 0.45);
  for (const islet of plan.islets) grow(islet, ISLETS[islet.id], 0.22, 0);
  // Things one cannot walk through, and how near one may come: about a metre from their edge.
  const solid = [];
  const SOFT = /^(ciuffo|nuvola-a-terra|sbuffo|erba-alta|canne|tifa|ninfea|fiore|aiuola|cespugli|sasso)/;
  // The grass is drawn with the tufts of the whole floor, further down: one picture, one fetch.
  // What is seen from the arrival comes first, so that the light way, which draws half, keeps it.
  const halved = new Set();
  for (const [name, spots] of Object.entries(gardens)) {
    spots.sort((a, b) => (b.home === 0) - (a.home === 0));
    if (!/^ciuffo/.test(name)) halved.add(sprite(name, spots));
    const entry = picture(name);
    spots.forEach((spot) => {
      const width = spot.height * (entry.w / entry.h);
      shadows.push({ x: spot.x, z: spot.z, size: Math.max(1, width * 1.1) });
      if (!SOFT.test(name) && islandAt(plan, spot.x, spot.z)) solid.push({ x: spot.x, z: spot.z, r: 0.8 + width * 0.35 });
    });
  }

  // The sculpture of each place; the great cursor stands in the middle of the first island.
  const sculptures = new Set();
  for (const zone of plan.zones) {
    const drawn = sprite(zone.id, [{ ...zone.mark, height: SMALLER[zone.id] }]);
    if (!drawn) continue;
    sculptures.add(drawn);
    drawn.spots[0].y += picture(zone.id).lift ?? 0;
    shadows.push({ x: zone.mark.x, z: zone.mark.z, size: 3 });
    // A sculpture is seen whole from a few metres; the great cursor from further.
    solid.push({ x: zone.mark.x, z: zone.mark.z, r: zone.id === 'apertura' ? 5.5 : 3 });
    sprite(`${zone.id}-cerchio`, [zone.mark]);
  }

  // Lamps by the mouths of the paths, and one on its islet.
  const lampSpots = plan.islands.flatMap((island) => [island.in, island.out].map((path) => {
    const at = mouth(plan, island, path);
    const r = island.radius - 3.2;
    const beside = (turn) => {
      const toward = Math.atan2(at.z - island.centre.z, at.x - island.centre.x) + turn;
      return { x: island.centre.x + Math.cos(toward) * r, z: island.centre.z + Math.sin(toward) * r };
    };
    // Beside the mouth, on whichever side is clear of a pond and of the look at a sculpture.
    const clear = (spot) => !plan.ponds.some((pond) => Math.hypot(spot.x - pond.x, spot.z - pond.z) < pond.r + 4) && !sights(island).some(([a, b]) => along(spot, a, b) < 2);
    return [0.5, -0.5, 0.9, -0.9].map(beside).find(clear) ?? beside(0.5);
  }));
  const lampIslet = plan.islets.find((islet) => islet.id === 'lampione').centre;
  lampSpots.push({ x: lampIslet.x + 0.6, z: lampIslet.z, home: 0 });
  // The letterbox of the Contacts has its lamp beside it.
  for (const box of gardens['cassetta-posta'] ?? []) lampSpots.push({ x: box.x + 1.1, z: box.z + 0.4 });
  lampSpots.forEach((spot) => Object.assign(spot, { on: undefined, level: 0 }));
  const lit = sprite('lampione', lampSpots);
  const dark = sprite('lampione-spento', lampSpots);
  lampSpots.forEach((spot) => {
    shadows.push({ x: spot.x, z: spot.z, size: 1.1 });
    solid.push({ x: spot.x, z: spot.z, r: 0.9 });
  });

  // Swings hang from their clouds, pivoting at the top of the ropes: on the island of the games and
  // on their islet.
  const game = plan.islands.find((island) => island.id === 'videogioco');
  const swingIslet = plan.islets.find((islet) => islet.id === 'altalena').centre;
  const { pivot, seatBottom } = pictures.altalena;
  const hang = [pivot[0], 1 - pivot[1]];
  const swingSpots = [freeSpot(game, 1.6) ?? game.centre, { x: swingIslet.x, z: swingIslet.z, home: 0 }].map((at) => {
    const top = heightAt(plan, at.x, at.z) + seatBottom + picture('altalena-sedile').metres * hang[1];
    return { x: at.x, z: at.z, home: at.home, y: top, top, angle: 0, spin: 0 };
  });
  const swingCloud = sprite('altalena-nuvola', swingSpots.map((spot) => ({ ...spot, y: spot.top - 0.08 })));
  const seat = sprite('altalena-sedile', swingSpots, { anchor: hang });
  shadows.push({ x: swingSpots[0].x, z: swingSpots[0].z, size: 1.6 });
  solid.push({ x: swingSpots[0].x, z: swingSpots[0].z, r: 1.6 });

  // Clouds: the body of each island and islet, a few small clouds beside it, the sea far below, the
  // sky around.
  const sheets = {};
  const beside = [];
  for (const island of [...plan.islands, ...plan.islets]) {
    const R = island.radius;
    // The body: one or two broad sheets of cloud, flat on top and soft underneath, hung by their top
    // edge just under the floor on the side facing the eyes (see update), so that against the sky the
    // island is one clear shape: a flat floor over a belly of cloud.
    for (const [name, forward, top, width] of island.out ? BODY : ISLET_BODY) {
      const entry = picture(name);
      const height = (R * width * entry.h) / entry.w;
      (sheets[name] ??= []).push({ island, forward: R * forward, x: island.centre.x, z: island.centre.z, y: island.centre.y - top, height, home: island.out ? undefined : 0 });
    }
    // Two or three small clouds apart from it, away from its paths.
    const mouths = island.out ? [island.in, island.out].map((path) => mouth(plan, island, path)) : [];
    for (let i = 0; i < (island.out ? 3 : 1); i++) {
      const a = roll() * Math.PI * 2;
      const r = R + 3 + roll() * 4;
      const x = island.centre.x + Math.cos(a) * r;
      const z = island.centre.z + Math.sin(a) * r;
      if (mouths.every((at) => Math.hypot(x - at.x, z - at.z) > 8)) beside.push({ x, z, y: island.centre.y - 1.5 - roll() * 3, height: 1 + roll() * 0.8 });
    }
  }
  // A small cloud under one stone in seven: the stones hang in clear sky.
  for (const path of [...plan.paths, ...plan.links]) {
    for (let i = 3; i < path.stones; i += 7) {
      const at = path.curve.getPointAt(i / path.stones);
      beside.push({ x: at.x, z: at.z, y: at.y - 0.6, height: 0.45 });
    }
  }
  ['sbuffo-2', 'sbuffo-1', 'sbuffo-3'].forEach((name, k) => sprite(name, beside.filter((_, i) => i % 3 === k)));
  const bodies = Object.entries(sheets).map(([name, spots]) => ({ drawn: sprite(name, spots), spots }));
  // Grass of cloud, a few little tufts over the floors, with free ground between.
  const tufts = [];
  for (const island of plan.islands) {
    for (let i = 0; i < island.radius; i++) {
      const spot = freeSpot(island, 0.25);
      if (spot) tufts.push({ ...spot, height: 0.3 + roll() * 0.5 });
    }
  }
  sprite('ciuffo-1', [...(gardens['ciuffo-1'] ?? []), ...tufts.filter((_, i) => i % 2)]);
  sprite('ciuffo-2', [...(gardens['ciuffo-2'] ?? []), ...tufts.filter((_, i) => !(i % 2))]);
  const sky = [];
  for (let i = 0; i < 7; i++) {
    const a = roll() * Math.PI * 2;
    const r = 120 + roll() * 260;
    sky.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 15 + roll() * 45, height: 8 + roll() * 12, angle: a, r });
  }
  // The sea of clouds as a band all round, far below the islands, and other islands far away, out of
  // reach: between the islands one sees the sky.
  const sea = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return { x: Math.cos(a) * 420, z: Math.sin(a) * 420, y: -120, height: 60 };
  });
  const distant = Array.from({ length: 4 }, (_, i) => {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const r = 190 + roll() * 90;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: -6 + roll() * 22, height: 11 + roll() * 6 };
  });
  const high = sprite('nuvola-1', sky, { fog: false, everywhere: true });
  sprite('mare-di-nuvole', sea, { everywhere: true });
  sprite('isola-lontana-1', distant.filter((_, i) => i % 2), { everywhere: true });
  sprite('isola-lontana-2', distant.filter((_, i) => !(i % 2)), { everywhere: true });

  const ground = createPatches(shadows.map((spot) => ({ ...spot, y: heightAt(plan, spot.x, spot.z) })), { colour: '#5f7fb3', strength: 0.34, falloff: 0.1 });
  const pools = createPatches(lampSpots.map((spot) => ({ x: spot.x, z: spot.z, y: heightAt(plan, spot.x, spot.z), size: 6 })), { colour: '#ffffff', strength: 0.3, falloff: 0, light: true });
  // The water of the ponds, and the stones hanging between the islets.
  const water = createWater(plan.ponds);
  object.add(ground.mesh, pools.mesh, water, ...createStones(plan.links));
  for (const pond of plan.ponds) if (pond.island.out) solid.push({ x: pond.x, z: pond.z, r: pond.r + 0.5 });

  let lampLevel = 0;
  // Pictures that move by themselves are turned to the eyes every frame; the others only when the
  // eyes have moved.
  const moving = new Set([high, swingCloud, seat, lit, dark]);
  const eyes = { x: Infinity, z: Infinity };

  return {
    object,
    solid,
    // The water's material: its colours are uniforms (water.js).
    water: water.material,
    // The pictures first seen on the island of the given index, at a size ('light' or 'small');
    // resolves when they are drawn.
    load: (index, size) => Promise.all(made.filter((drawn) => !drawn.islands || drawn.islands.has(index)).map((drawn) => drawn.use(size))),
    tappable: [lit?.mesh, dark?.mesh, seat?.mesh, swingCloud?.mesh].filter(Boolean),
    set lamps(level) {
      lampLevel = level;
    },
    // After the door: the large pictures of what is everywhere, and of the sculptures on the island
    // one is on and those beside it; the small ones of the others.
    island(island) {
      here = island;
      const count = plan.islands.length;
      const apart = (index) => Math.min(Math.abs(index - island.index), count - Math.abs(index - island.index));
      // Large pictures only for the sculptures of the island one is on and those beside it, which
      // are seen from close: every other picture stays small, and nothing heavy is sent to the
      // graphics card while walking.
      for (const drawn of made) {
        const away = drawn.islands ? Math.min(...[...drawn.islands].map(apart)) : 0;
        if (away > 2) drawn.release();
        else drawn.use(away <= 1 && !light && sculptures.has(drawn) ? 'large' : 'small');
      }
    },
    // The light way for slow machines and phones: half the gardens, a third of the grass and the small
    // clouds, no shadows on the ground, no large pictures.
    light(on) {
      light = on;
      for (const drawn of made) {
        const share = /^(ciuffo|sbuffo)/.test(drawn.name) ? 3 : halved.has(drawn) ? 2 : 1;
        drawn.mesh.count = on ? Math.ceil(drawn.spots.length / share) : drawn.spots.length;
      }
      ground.mesh.visible = !on;
      if (here) this.island(here);
    },
    // Something of the park was touched: a lamp switches, the swing is pushed.
    touch(hit) {
      if (hit.object === lit?.mesh || hit.object === dark?.mesh) {
        const spot = lampSpots[hit.instanceId];
        spot.on = !(spot.on ?? lampLevel > 0.5);
        return 'lamp';
      }
      if (hit.object === seat?.mesh || hit.object === swingCloud?.mesh) {
        swingSpots[hit.instanceId].spin += 1.1;
        return 'swing';
      }
      return undefined;
    },
    update(dt, time, state, camera) {
      sky.forEach((cloud, index) => {
        const a = cloud.angle + time * 0.003;
        Object.assign(high.spots[index], { x: Math.cos(a) * cloud.r, z: Math.sin(a) * cloud.r, y: cloud.y + Math.sin(time * 0.3 + index) * 1.2 });
      });
      swingSpots.forEach((swing, index) => {
        swing.spin += (-(9.8 / 2.4) * Math.sin(swing.angle) - 0.25 * swing.spin) * dt;
        swing.angle += swing.spin * dt;
        seat.spots[index].roll = swing.angle;
        swingCloud.spots[index].y = swing.top - 0.08 + 0.04 * Math.sin(time * 0.8 + index);
      });
      water.material.uniforms.uTime.value = time;
      lampSpots.forEach((spot, index) => {
        spot.level += ((spot.on === undefined ? lampLevel : Number(spot.on)) - spot.level) * Math.min(1, dt * 3);
        pools.level.array[index] = spot.level;
        lit.spots[index].hidden = spot.level < 0.5;
        dark.spots[index].hidden = spot.level >= 0.5;
      });
      pools.level.needsUpdate = true;
      const moved = Math.hypot(camera.position.x - eyes.x, camera.position.z - eyes.z) > 1e-4;
      if (moved) {
        Object.assign(eyes, { x: camera.position.x, z: camera.position.z });
        // The body of an island hangs on the side facing the eyes; seen from on it, in its middle.
        for (const { drawn, spots } of bodies) {
          spots.forEach(({ island, forward }, index) => {
            const dx = eyes.x - island.centre.x;
            const dz = eyes.z - island.centre.z;
            const d = Math.hypot(dx, dz);
            const k = d > island.radius ? forward / d : 0;
            Object.assign(drawn.spots[index], { x: island.centre.x + dx * k, z: island.centre.z + dz * k });
          });
        }
      }
      for (const drawn of made) if (moved || moving.has(drawn) || forming.value < 1) drawn.face(camera);
    },
  };
}
