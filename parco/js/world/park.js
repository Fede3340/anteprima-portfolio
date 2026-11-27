// Everything that stands in the park besides the works, as cut-out pictures: the great cursor in the
// pond, a sculpture for each zone, lamps, benches, trees, the swing and clouds at three distances,
// with soft shadows on the ground and a pool of light under each lit lamp.
import * as THREE from 'three';
import { placed } from './instances.js';
import { heightAt } from './land.js';
import { WORK_SIDE, along, ringPoint } from './layout.js';
import { createSprite } from './sprites.js';

const LAMP_EVERY = 15;

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

// pictures: img/park/park.json; sculptures: img/sprites/manifest.json, by zone (missing ones are left out).
export function createPark({ plan, renderer, pictures, sculptures = {} }) {
  const object = new THREE.Group();
  const roll = random(7);
  const sprites = [];
  const sprite = (entry, count, options = {}) => {
    const made = createSprite(entry, count, { renderer, ...options });
    sprites.push(made);
    object.add(made.mesh);
    return made;
  };
  const stand = (made, index, x, z, height) => Object.assign(made.spots[index], { x, y: heightAt(plan, x, z), z, ...(height ? { height } : {}) });

  // A sculpture for each zone just inside the path, and the great cursor in the middle of the pond.
  const statues = [];
  for (const zone of plan.zones) {
    const entry = sculptures[zone.id];
    if (!entry) continue;
    // The sculptures are fetched once the door is passed: the door itself stays light.
    const made = sprite(entry, 1, { later: true });
    if (zone.mark) stand(made, 0, zone.mark.x, zone.mark.z);
    else stand(made, 0, 0, 0);
    made.spots[0].y += entry.lift ?? 0;
    statues.push({ zone, made });
    // The stamp of Marchi hangs over the ring it has printed on the ground.
    const ring = sculptures[`${zone.id}-cerchio`];
    if (ring && zone.mark) {
      const printed = sprite(ring, 1, { later: true });
      stand(printed, 0, zone.mark.x, zone.mark.z);
      statues.push({ zone, made: printed });
    }
  }

  // Lamps line the outer edge of the path, moved off any work to the middle of the gap beside it, so
  // that none stands between a work and the eyes turned to it.
  const lampSpots = [];
  for (let s = LAMP_EVERY / 2; s < plan.length; s += LAMP_EVERY) {
    const work = plan.works.find((spot) => Math.abs(along(s, spot.s, plan.length)) < spot.reach);
    const p = ringPoint(plan, work ? work.s + work.reach : s, 2.1);
    lampSpots.push({ x: p.x, z: p.z, on: undefined, level: 0 });
  }
  const lit = sprite(pictures.lampione, lampSpots.length);
  const dark = sprite(pictures['lampione-spento'], lampSpots.length);
  lampSpots.forEach((spot, index) => {
    stand(lit, index, spot.x, spot.z);
    stand(dark, index, spot.x, spot.z);
  });

  const benches = sprite(pictures.panchina, plan.zones.length);
  const benchSpots = plan.zones.map((zone, index) => {
    const p = ringPoint(plan, zone.start + zone.length * 0.55 + 3, -3.1);
    stand(benches, index, p.x, p.z);
    return p;
  });

  const treeSpots = [];
  for (let s = 4; s < plan.length; s += 9) {
    const p = ringPoint(plan, s + roll() * 4, WORK_SIDE + 5 + roll() * 14);
    treeSpots.push({ x: p.x, z: p.z, height: pictures.albero.metres * (0.85 + roll() * 0.5) });
  }
  const trees = sprite(pictures.albero, treeSpots.length);
  treeSpots.forEach((spot, index) => stand(trees, index, spot.x, spot.z, spot.height));

  // The swing: the cloud stays, the seat swings on the point where its ropes hang.
  const swingAt = ringPoint(plan, plan.zones.find((zone) => zone.id === 'videogioco').start + 7, -6);
  const swingCloud = sprite(pictures['altalena-nuvola'], 1);
  const seat = sprite(pictures['altalena-sedile'], 1, { anchor: [pictures.altalena.pivot[0], 1 - pictures.altalena.pivot[1]] });
  const { pivot, seatBottom, cloudBottom } = pictures.altalena;
  const pivotHeight = seatBottom + pictures['altalena-sedile'].metres * (1 - pivot[1]);
  Object.assign(swingCloud.spots[0], { x: swingAt.x, y: cloudBottom, z: swingAt.z });
  Object.assign(seat.spots[0], { x: swingAt.x, y: pivotHeight, z: swingAt.z });
  const swing = { angle: 0, spin: 0 };

  // Clouds: big and far around the park, middling over it, small and low across the path.
  const clouds = [];
  for (let i = 0; i < 10; i++) clouds.push({ layer: 'far', angle: (i / 10) * 6.28 + roll() * 0.4, radius: 170 + roll() * 150, y: 8 + roll() * 40, size: 18 + roll() * 22 });
  for (let i = 0; i < 7; i++) clouds.push({ layer: 'middle', angle: roll() * 6.28, radius: plan.pond * 0.5 + roll() * (plan.island - plan.pond * 0.5), y: 16 + roll() * 10, size: 5 + roll() * 4 });
  for (let i = 0; i < 7; i++) clouds.push({ layer: 'low', angle: ((i + roll() * 0.5) / 7) * 6.28, radius: plan.radius + (roll() - 0.5) * 7, y: 2.9 + roll() * 0.8, size: 1.1 + roll() * 0.6 });
  const kinds = ['nuvola-1', 'nuvola-2', 'nuvola-3'].map((name, k) => {
    const members = clouds.filter((_, index) => index % 3 === k);
    members.forEach((cloud, slot) => Object.assign(cloud, { kind: k, slot, bounce: 0, kick: 0 }));
    return { made: sprite(pictures[name], members.length, { fog: false }), members };
  });
  const speed = { far: 0.004, middle: 0.01, low: 0.016 };

  const shadows = createPatches([
    ...lampSpots.map((spot) => ({ ...spot, size: 1.1 })),
    ...benchSpots.map((spot) => ({ x: spot.x, z: spot.z, size: 2.4 })),
    ...treeSpots.map((spot) => ({ x: spot.x, z: spot.z, y: heightAt(plan, spot.x, spot.z), size: spot.height * 0.7 })),
    ...statues.filter(({ zone }) => zone.mark).map(({ zone }) => ({ x: zone.mark.x, z: zone.mark.z, size: 3 })),
    ...plan.works.map(({ place }) => ({ x: place.x, z: place.z, size: 3.2 })),
    { x: swingAt.x, z: swingAt.z, size: 1.6 },
  ], { colour: '#0b2350', strength: 0.32, falloff: 0.15 });
  const pools = createPatches(lampSpots.map((spot) => ({ ...spot, size: 7 })), { colour: '#ffffff', strength: 0.3, falloff: 0, light: true });
  object.add(shadows.mesh, pools.mesh);

  let lampLevel = 0;

  return {
    object,
    tappable: [lit.mesh, dark.mesh, seat.mesh, swingCloud.mesh, ...kinds.map((kind) => kind.made.mesh)],
    set lamps(level) {
      lampLevel = level;
    },
    // After the door: the large pictures of what is everywhere, and of the sculptures close by.
    zone(zone) {
      const total = plan.zones.length;
      for (const made of sprites) if (!statues.some((statue) => statue.made === made)) made.use('large');
      for (const { zone: own, made } of statues) {
        const gap = Math.min(Math.abs(own.index - zone.index), total - Math.abs(own.index - zone.index));
        made.use(gap <= 1 || !own.mark ? 'large' : 'small');
      }
    },
    // Something of the park was touched: a lamp switches, a low cloud bounces, the swing is pushed.
    touch(hit) {
      if (hit.object === lit.mesh || hit.object === dark.mesh) {
        const spot = lampSpots[hit.instanceId];
        spot.on = !(spot.on ?? lampLevel > 0.5);
        return 'lamp';
      }
      const kind = kinds.find((each) => each.made.mesh === hit.object);
      if (kind) {
        const cloud = kind.members[hit.instanceId];
        if (cloud.layer !== 'low') return undefined;
        cloud.kick += 3;
        return 'cloud';
      }
      if (hit.object === seat.mesh || hit.object === swingCloud.mesh) {
        swing.spin += 1.1;
        return 'swing';
      }
      return undefined;
    },
    update(dt, time, state, camera) {
      clouds.forEach((cloud, index) => {
        if (cloud.layer === 'low') {
          cloud.kick += (-cloud.bounce * 40 - cloud.kick * 3.2) * dt;
          cloud.bounce += cloud.kick * dt;
        }
        const angle = cloud.angle + time * speed[cloud.layer] * (cloud.layer === 'middle' ? -1 : 1);
        Object.assign(kinds[cloud.kind].made.spots[cloud.slot], {
          x: Math.cos(angle) * cloud.radius,
          z: Math.sin(angle) * cloud.radius,
          y: cloud.y + Math.sin(time * 0.4 + index) * (cloud.layer === 'far' ? 1.5 : 0.2) + cloud.bounce * cloud.size * 0.3,
          height: cloud.size * (1 + cloud.bounce * 0.1),
        });
      });
      swing.spin += (-(9.8 / 2.4) * Math.sin(swing.angle) - 0.25 * swing.spin) * dt;
      swing.angle += swing.spin * dt;
      seat.spots[0].roll = swing.angle;
      swingCloud.spots[0].y = cloudBottom + 0.04 * Math.sin(time * 0.8);
      lampSpots.forEach((spot, index) => {
        spot.level += ((spot.on === undefined ? lampLevel : Number(spot.on)) - spot.level) * Math.min(1, dt * 3);
        pools.level.array[index] = spot.level;
        lit.spots[index].hidden = spot.level < 0.5;
        dark.spots[index].hidden = spot.level >= 0.5;
      });
      pools.level.needsUpdate = true;
      for (const made of sprites) made.face(camera);
    },
  };
}
