// Everything that stands on the islands besides the works, as cut-out pictures: the clouds of their
// rims and undersides, the clouds of the sky and of the sea below, the sculpture of each place, and
// each island's own piece of park (a wood, an orchard, a stone garden, a pond...), with soft shadows
// on the ground and a pool of light under each lit lamp.
import * as THREE from 'three';
import { placed } from './instances.js';
import { createStones, heightAt, islandAt } from './land.js';
import { mouth } from './layout.js';
import { createSprite } from './sprites.js';
import { createWater } from './water.js';

// What grows on each island, as [picture, how many]; spread over the island away from the works.
const GARDENS = {
  ingresso: [['albero-grande', 2], ['albero-medio', 4], ['albero-piccolo', 4], ['cespuglio-1', 6], ['cespuglio-2', 3], ['nuvola-a-terra', 9]],
  siti: [['albero-grande', 9], ['albero-medio', 9], ['albero-piccolo', 5], ['cespuglio-2', 5], ['cespuglio-1', 4], ['nuvola-a-terra', 7]],
  negozi: [['albero-frutti', 9], ['cassette', 4], ['cespuglio-1', 3], ['nuvola-a-terra', 4]],
  programmi: [['siepe-squadrata', 6], ['gradini', 2], ['sasso', 8], ['albero-piccolo', 2]],
  app: [['canne', 8], ['albero-medio', 3], ['cespuglio-1', 4], ['nuvola-a-terra', 4]],
  videogioco: [['scivolo', 1], ['aquilone', 3], ['nuvola-a-terra', 8], ['cespuglio-2', 3]],
  marchi: [['fiore-1', 7], ['fiore-2', 8], ['aiuola', 4], ['cespuglio-1', 3]],
  manifesti: [['erba-alta', 16], ['bandiera', 4], ['nuvola-a-terra', 3]],
  google: [['albero-piccolo', 3], ['panchina', 1], ['sasso', 4], ['nuvola-a-terra', 3]],
  contatti: [['cassetta-posta', 1], ['albero-medio', 2], ['nuvola-a-terra', 5], ['cespuglio-1', 3]],
};
// The islets around the first island, each its own little garden: [pictures, the first that exists
// is used; how many]. Their trees stand close together.
const ISLETS = {
  stagno: [[['albero-medio'], 1], [['albero-piccolo'], 2], [['cespuglio-1'], 3], [['ciuffo-2'], 6]],
  boschetto: [[['boschetto'], 2], [['albero-grande'], 4], [['albero-medio'], 7], [['albero-piccolo'], 7], [['cespuglio-2'], 3], [['ciuffo-2'], 6]],
  altalena: [[['aquilone'], 2], [['cespugli-gruppo', 'cespuglio-2'], 3], [['nuvola-a-terra'], 3], [['ciuffo-2'], 5]],
  lampione: [[['albero-doppio', 'albero-medio'], 1], [['cespuglio-1'], 2], [['ciuffo-2'], 4]],
};
// The ground seen on arrival, composed as in the picture of the door: [pictures, metres ahead of the
// look, metres to its right, height]. A great tree on the left and one on the right, the bench, and in
// front groups of cushions, bushes and tufts, a few low ones in the middle, where a phone held upright
// looks; nothing there stops the walk to the path.
const FRONT = [
  [['ciuffo-2'], 2.8, -0.5, 0.3], [['nuvola-a-terra'], 3.4, 0.9, 0.4], [['ciuffo-1'], 4.2, 0.3, 0.25], [['ciuffo-1'], 3.6, -0.9, 0.25],
  [['cespuglio-1'], 4.8, -1.3, 0.5], [['nuvola-a-terra'], 6, -0.8, 0.45], [['ciuffo-2'], 6.5, 0.6, 0.35],
  [['albero-grande'], 9, -8.5], [['albero-doppio', 'albero-medio'], 13, 8.5], [['panchina'], 7, -2.1],
  [['nuvola-a-terra'], 3, -1.8, 0.45], [['cespuglio-1'], 3.6, -2.8, 0.55], [['ciuffo-2'], 2.5, -1.3, 0.35], [['ciuffo-1'], 3.1, -0.9, 0.25],
  [['cespugli-gruppo', 'cespuglio-2'], 4.5, 2.6, 0.7], [['ciuffo-2'], 3, 1.4, 0.35], [['nuvola-a-terra'], 5, 1.6, 0.45], [['ciuffo-1'], 2.4, 1.9, 0.25],
  [['cespuglio-2'], 6, -4.6, 0.9], [['nuvola-a-terra'], 6.2, -3.4, 0.6], [['ciuffo-2'], 5.2, -2.5, 0.45], [['ciuffo-1'], 7.5, -1.2, 0.3],
  [['nuvola-a-terra'], 9.5, -3.2, 0.8], [['cespuglio-1'], 10, -2.2], [['ciuffo-2'], 8.5, 1.1, 0.5], [['cespuglio-1'], 12, -9],
];
const RIM_EVERY = 3.2;
// The cushions near the way in: [picture, how many, height in metres].
const CUSHIONS = [['nuvola-a-terra', 5, 0.9], ['cespuglio-1', 3, 0.8], ['ciuffo-2', 6, 0.6]];

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
    // The way across the island, from where one arrives to where the next path leaves, stays free.
    const leave = mouth(plan, island, island.out);
    for (let k = 0; k <= 10; k++) {
      taken.push({ x: island.arrival.x + (leave.x - island.arrival.x) * (k / 10), z: island.arrival.z + (leave.z - island.arrival.z) * (k / 10), r: 2 });
    }
  }
  for (const pond of plan.ponds) taken.push({ x: pond.x, z: pond.z, r: pond.r + 1 });
  // near: { x, z, from, to } to look only between from and to metres of a point, ahead of it.
  function freeSpot(island, size, near) {
    for (let tries = 0; tries < 40; tries++) {
      let x;
      let z;
      if (near) {
        const a = near.heading + (roll() - 0.5) * 2.6;
        const r = near.from + roll() * (near.to - near.from);
        x = near.x + Math.cos(a) * r;
        z = near.z + Math.sin(a) * r;
        if (Math.hypot(x - island.centre.x, z - island.centre.z) > island.radius - 2.2) continue;
      } else {
        const a = roll() * Math.PI * 2;
        const r = Math.sqrt(roll()) * (island.radius - 2.2);
        x = island.centre.x + Math.cos(a) * r;
        z = island.centre.z + Math.sin(a) * r;
      }
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
    const far = Math.atan2(pond.z - first.start.z, pond.x - first.start.x);
    const many = Math.round((2 * Math.PI * (pond.r + 0.6)) / 0.9);
    for (let i = 0; i < many; i++) {
      const a = (i / many) * Math.PI * 2;
      const behind = Math.cos(a - far);
      const at = (r) => ({ x: pond.x + Math.cos(a) * r, z: pond.z + Math.sin(a) * r });
      if (behind > -0.2) plant(['nuvola-a-terra'], at(pond.r + 0.45 + roll() * 0.3), 0.6 + 0.4 * behind + roll() * 0.2);
      else plant(['ciuffo-1'], at(pond.r + 0.5), 0.3);
      if (i % 3 === 1 && behind > -0.5) plant(['tifa', 'canne'], at(pond.r + 0.1), 1.6 + roll() * 0.6);
    }
    for (const [dx, dz] of [[0.3, -0.35], [-0.45, 0.2]]) plant(['ninfea'], { x: pond.x + dx * pond.r, z: pond.z + dz * pond.r, y: pond.level }, 0.45);
  }
  // Each island's and islet's garden: [pictures, how many], away from what stands there already;
  // spacing: how far apart, as a share of the width of the picture.
  const grow = (island, list, spacing, home) => {
    for (const [names, many] of list) {
      const name = pick(...[names].flat());
      if (!name) continue;
      const entry = picture(name);
      const width = (entry.metres ?? 1) * (entry.w / entry.h);
      for (let i = 0; i < many; i++) {
        const spot = freeSpot(island, Math.max(0.4, width * spacing));
        if (spot) (gardens[name] ??= []).push({ ...spot, home, height: (entry.metres ?? 1) * (0.8 + roll() * 0.4) });
      }
    }
  };
  // Low cushions of cloud a few steps ahead of where one arrives: on a phone held upright the lower
  // third of the screen is that ground.
  for (const island of plan.islands) {
    if (island !== first) {
      const near = { x: island.arrival.x, z: island.arrival.z, heading: Math.atan2(island.centre.z - island.arrival.z, island.centre.x - island.arrival.x), from: 2.6, to: 7.5 };
      for (const [name, many, height] of CUSHIONS) {
        for (let i = 0; i < many; i++) {
          const spot = freeSpot(island, 0.5, near);
          if (spot) (gardens[name] ??= []).push({ ...spot, height: height * (0.75 + roll() * 0.5) });
        }
      }
    }
    grow(island, GARDENS[island.id] ?? [], 0.45);
  }
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
    const drawn = sprite(zone.id, [zone.mark]);
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
    // Beside the mouth, on the other side if that one is by a pond.
    const beside = (turn) => {
      const toward = Math.atan2(at.z - island.centre.z, at.x - island.centre.x) + turn;
      return { x: island.centre.x + Math.cos(toward) * r, z: island.centre.z + Math.sin(toward) * r };
    };
    const spot = beside(0.5);
    return plan.ponds.some((pond) => Math.hypot(spot.x - pond.x, spot.z - pond.z) < pond.r + 4) ? beside(-0.5) : spot;
  }));
  const lampIslet = plan.islets.find((islet) => islet.id === 'lampione').centre;
  lampSpots.push({ x: lampIslet.x + 0.6, z: lampIslet.z, home: 0 });
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

  // Clouds: the rims and undersides of the islands and islets, the sea far below, the sky around.
  const rims = [];
  const unders = [];
  for (const island of [...plan.islands, ...plan.islets]) {
    // The paths come in at the edge, some from below: no billow stands in their way.
    const mouths = island.out ? [island.in, island.out].map((path) => mouth(plan, island, path)) : [];
    const clear = (x, z, room) => mouths.every((at) => Math.hypot(x - at.x, z - at.z) > room);
    const R = island.radius;
    const y = island.centre.y;
    const push = (list, a, r, height, foot, room) => {
      const x = island.centre.x + Math.cos(a) * r;
      const z = island.centre.z + Math.sin(a) * r;
      if (clear(x, z, room)) list.push({ x, z, y: foot, height });
    };
    const many = Math.max(8, Math.round((Math.PI * 2 * R) / RIM_EVERY));
    for (let i = 0; i < many; i++) {
      // Over the edge of the floor, so that the island ends in billows, not in a line.
      const height = (1 + roll() * 0.5) * (1.3 + roll()) * Math.min(1, R / 10);
      push(rims, (i / many) * Math.PI * 2 + roll() * 0.2, R - 1.3 + roll() * 0.6, height, y - height * 0.45, 2.8);
    }
    // The visible body of the island: big cut-out billows overlapping in rings from under the rim down
    // to the bottom, over a plain core hidden inside them (land.js), so that from the side and from
    // below the island is a soft cloud, as in the pictures: [share of the radius, depth under the
    // floor, height of the billows], both as shares of the radius.
    for (const [share, depth, size] of [[0.95, 0.14, 0.28], [0.78, 0.33, 0.3], [0.5, 0.52, 0.3], [0.15, 0.68, 0.28]]) {
      const count = Math.max(3, Math.round((Math.PI * 2 * share) / (size * 1.2)));
      for (let i = 0; i < count; i++) {
        const height = R * size * (0.85 + roll() * 0.4);
        push(unders, ((i + roll() * 0.6) / count) * Math.PI * 2, R * share * (0.9 + roll() * 0.15), height, y - R * depth - height * 0.5, 3 + height * 0.5);
      }
    }
  }
  // A small billow under every stone, so that the stones float on cloud.
  for (const path of [...plan.paths, ...plan.links]) {
    for (let i = 0; i <= path.stones; i++) {
      const at = path.curve.getPointAt(i / path.stones);
      unders.push({ x: at.x, z: at.z, y: at.y - 0.55, height: 0.42 + roll() * 0.12 });
    }
  }
  // The billows shared among the three pictures, every third one each; every third one first, so that
  // the light way, which draws the first third of them, thins them evenly.
  const third = (list, k) => list.filter((_, i) => i % 3 === k);
  const evenly = (list) => [0, 1, 2].flatMap((k) => third(list, k));
  ['sbuffo-2', 'sbuffo-1', 'sbuffo-3'].forEach((name, k) => sprite(name, evenly(third([...rims, ...unders], k))));
  // Grass of cloud, in little tufts all over the floors.
  const tufts = [];
  for (const island of plan.islands) {
    for (let i = 0; i < island.radius * 5; i++) {
      const spot = freeSpot(island, 0.25);
      if (spot) tufts.push({ ...spot, height: 0.3 + roll() * 0.5 });
    }
  }
  sprite('ciuffo-1', [...(gardens['ciuffo-1'] ?? []), ...tufts.filter((_, i) => i % 2)]);
  sprite('ciuffo-2', [...(gardens['ciuffo-2'] ?? []), ...tufts.filter((_, i) => !(i % 2))]);
  const sky = [];
  for (let i = 0; i < 12; i++) {
    const a = roll() * Math.PI * 2;
    const r = 120 + roll() * 260;
    sky.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 15 + roll() * 45, height: 8 + roll() * 12, angle: a, r });
  }
  // The sea of clouds as a band all round far below, and other islands far away, out of reach.
  const sea = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return { x: Math.cos(a) * 330, z: Math.sin(a) * 330, y: -58, height: 70 };
  });
  const distant = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.4;
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
  for (const pond of plan.ponds) if (pond.island === first) solid.push({ x: pond.x, z: pond.z, r: pond.r + 0.5 });

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
    // The light way for slow machines: half the gardens and the grass, a third of the billows, no
    // large pictures.
    light(on) {
      light = on;
      for (const drawn of made) {
        const share = /^sbuffo/.test(drawn.name) ? 3 : halved.has(drawn) || /^ciuffo/.test(drawn.name) ? 2 : 1;
        drawn.mesh.count = on ? Math.ceil(drawn.spots.length / share) : drawn.spots.length;
      }
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
      if (moved) Object.assign(eyes, { x: camera.position.x, z: camera.position.z });
      for (const drawn of made) if (moved || moving.has(drawn)) drawn.face(camera);
    },
  };
}
