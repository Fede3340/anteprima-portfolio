// Everything that stands on the islands besides the works, as cut-out pictures: the clouds of their
// rims and undersides, the clouds of the sky and of the sea below, the sculpture of each place, and
// each island's own piece of park (a wood, an orchard, a stone garden, a pond...), with soft shadows
// on the ground and a pool of light under each lit lamp.
import * as THREE from 'three';
import { placed } from './instances.js';
import { heightAt } from './land.js';
import { mouth } from './layout.js';
import { createSprite } from './sprites.js';

// What grows on each island, as [picture, how many]; spread over the island away from the works.
const GARDENS = {
  ingresso: [['albero-grande', 2], ['albero-medio', 4], ['albero-piccolo', 4], ['cespuglio-1', 6], ['cespuglio-2', 3], ['nuvola-a-terra', 9], ['panchina', 1]],
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
  // One picture drawn at many spots: [{ x, y, z, height }], each on the ground unless y is given.
  // Each picture knows the islands where it stands, so that it is fetched when one of them comes
  // near and let go when they are all far; everywhere: the sky, the sea, the far islands.
  const nearest = (spot) => plan.islands.reduce((a, b) => (Math.hypot(spot.x - a.centre.x, spot.z - a.centre.z) < Math.hypot(spot.x - b.centre.x, spot.z - b.centre.z) ? a : b)).index;
  const sprite = (name, spots, { everywhere = false, ...options } = {}) => {
    const entry = picture(name);
    if (!entry || !spots.length) return undefined;
    const drawn = createSprite(entry, spots.length, { renderer, ...options });
    drawn.name = name;
    drawn.islands = everywhere ? undefined : new Set(spots.map(nearest));
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

  // Each island's garden, and low cushions of cloud a few steps ahead of where one arrives: on a
  // phone held upright the lower third of the screen is that ground.
  const gardens = {};
  for (const island of plan.islands) {
    const start = island.start ?? island.arrival;
    const near = { x: start.x, z: start.z, heading: Math.atan2(island.centre.z - start.z, island.centre.x - start.x), from: 2.6, to: 7.5 };
    for (const [name, many, height] of CUSHIONS) {
      for (let i = 0; i < many; i++) {
        const spot = freeSpot(island, 0.5, near);
        if (spot) (gardens[name] ??= []).push({ ...spot, height: height * (0.75 + roll() * 0.5) });
      }
    }
    for (const [name, many] of GARDENS[island.id] ?? []) {
      const entry = picture(name);
      if (!entry) continue;
      const width = (entry.metres ?? 1) * (entry.w / entry.h);
      for (let i = 0; i < many; i++) {
        const spot = freeSpot(island, Math.max(0.6, width * 0.45));
        if (spot) (gardens[name] ??= []).push({ ...spot, height: (entry.metres ?? 1) * (0.8 + roll() * 0.4) });
      }
    }
  }
  // Things one cannot walk through, and how near one may come: about a metre from their edge.
  const solid = [];
  const SOFT = /^(ciuffo|nuvola-a-terra|sbuffo|erba-alta|canne|fiore|aiuola|cespuglio|sasso)/;
  // The grass is drawn with the tufts of the whole floor, further down: one picture, one fetch.
  for (const [name, spots] of Object.entries(gardens)) {
    if (!/^ciuffo/.test(name)) sprite(name, spots);
    const entry = picture(name);
    spots.forEach((spot) => {
      const width = spot.height * (entry.w / entry.h);
      shadows.push({ x: spot.x, z: spot.z, size: Math.max(1, width * 1.1) });
      if (!SOFT.test(name)) solid.push({ x: spot.x, z: spot.z, r: 0.8 + width * 0.35 });
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

  // Lamps by the mouths of the paths.
  const lampSpots = plan.islands.flatMap((island) => [island.in, island.out].map((path) => {
    const at = mouth(plan, island, path);
    const toward = Math.atan2(at.z - island.centre.z, at.x - island.centre.x) + 0.5;
    const r = island.radius - 3.2;
    return { x: island.centre.x + Math.cos(toward) * r, z: island.centre.z + Math.sin(toward) * r, on: undefined, level: 0 };
  }));
  const lit = sprite('lampione', lampSpots);
  const dark = sprite('lampione-spento', lampSpots);
  lampSpots.forEach((spot) => {
    shadows.push({ x: spot.x, z: spot.z, size: 1.1 });
    solid.push({ x: spot.x, z: spot.z, r: 0.9 });
  });

  // The swing hangs from its cloud on the island of the games.
  const game = plan.islands.find((island) => island.id === 'videogioco');
  const swingAt = freeSpot(game, 1.6) ?? game.centre;
  const swingGround = heightAt(plan, swingAt.x, swingAt.z);
  const { pivot, seatBottom, cloudBottom } = pictures.altalena;
  const swingCloud = sprite('altalena-nuvola', [{ x: swingAt.x, z: swingAt.z, y: swingGround + cloudBottom }]);
  const seat = sprite('altalena-sedile', [{ x: swingAt.x, z: swingAt.z, y: swingGround + seatBottom + pictures['altalena-sedile'].metres * (1 - pivot[1]) }], { anchor: [pivot[0], 1 - pivot[1]] });
  const swing = { angle: 0, spin: 0 };
  shadows.push({ x: swingAt.x, z: swingAt.z, size: 1.6 });
  solid.push({ x: swingAt.x, z: swingAt.z, r: 1.6 });

  // Clouds: the rims and undersides of the islands, the sea far below, the sky around.
  const rims = [];
  const unders = [];
  for (const island of plan.islands) {
    // The paths come in at the edge, some from below: no billow stands in their way.
    const mouths = [island.in, island.out].map((path) => mouth(plan, island, path));
    const clear = (x, z, room) => mouths.every((at) => Math.hypot(x - at.x, z - at.z) > room);
    const push = (list, a, r, height, y, room) => {
      const x = island.centre.x + Math.cos(a) * r;
      const z = island.centre.z + Math.sin(a) * r;
      if (clear(x, z, room)) list.push({ x, z, y, height });
    };
    const many = Math.round((Math.PI * 2 * island.radius) / RIM_EVERY);
    for (let i = 0; i < many; i++) {
      // Over the edge of the floor, so that the island ends in billows, not in a line.
      const height = (1 + roll() * 0.5) * (1.3 + roll());
      push(rims, (i / many) * Math.PI * 2 + roll() * 0.2, island.radius - 1.3 + roll() * 0.6, height, island.centre.y - height * 0.45, 2.8);
    }
    // A second ring of billows lower down, and big ones underneath: the island has the thickness of
    // a cloud seen from below and from the side.
    const lower = many;
    for (let i = 0; i < lower; i++) {
      const height = 2 + roll() * 1.4;
      push(unders, ((i + 0.5) / lower) * Math.PI * 2 + roll() * 0.2, island.radius * (0.82 + roll() * 0.12), height, island.centre.y - 1.8 - height * 0.6, 4 + height * 1.4);
    }
    for (let i = 0; i < 5; i++) {
      const height = island.radius * (0.22 + roll() * 0.12);
      push(unders, roll() * Math.PI * 2, island.radius * (0.15 + roll() * 0.35), height, island.centre.y - 2.5 - height * (0.6 + roll() * 0.5), 3 + height * 1.4);
    }
  }
  sprite('sbuffo-2', [...rims.filter((_, i) => i % 3 === 0), ...unders]);
  sprite('sbuffo-1', rims.filter((_, i) => i % 3 === 1));
  sprite('sbuffo-3', rims.filter((_, i) => i % 3 === 2));
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
  object.add(ground.mesh, pools.mesh);

  let lampLevel = 0;

  return {
    object,
    solid,
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
    // The light way for slow machines: half the grass and the clouds of the rims, no large pictures.
    light(on) {
      light = on;
      for (const drawn of made) if (/^(ciuffo|sbuffo)/.test(drawn.name)) drawn.mesh.count = on ? Math.ceil(drawn.spots.length / 2) : drawn.spots.length;
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
        swing.spin += 1.1;
        return 'swing';
      }
      return undefined;
    },
    update(dt, time, state, camera) {
      sky.forEach((cloud, index) => {
        const a = cloud.angle + time * 0.003;
        Object.assign(high.spots[index], { x: Math.cos(a) * cloud.r, z: Math.sin(a) * cloud.r, y: cloud.y + Math.sin(time * 0.3 + index) * 1.2 });
      });
      swing.spin += (-(9.8 / 2.4) * Math.sin(swing.angle) - 0.25 * swing.spin) * dt;
      swing.angle += swing.spin * dt;
      if (seat) seat.spots[0].roll = swing.angle;
      if (swingCloud) swingCloud.spots[0].y = swingGround + cloudBottom + 0.04 * Math.sin(time * 0.8);
      lampSpots.forEach((spot, index) => {
        spot.level += ((spot.on === undefined ? lampLevel : Number(spot.on)) - spot.level) * Math.min(1, dt * 3);
        pools.level.array[index] = spot.level;
        lit.spots[index].hidden = spot.level < 0.5;
        dark.spots[index].hidden = spot.level >= 0.5;
      });
      pools.level.needsUpdate = true;
      for (const drawn of made) drawn.face(camera);
    },
  };
}
