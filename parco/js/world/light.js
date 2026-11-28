// The light of the park is the hour of the day: each island has its hour (MOODS in layout.js) and the
// light passes from one to the next along the paths, never in a jump. The hour gives the sky, the sun,
// the sea of clouds, the haze, the lamps, the planets, and the three tones every plaster surface takes
// (grade.js). Standing before a work, the light leans a little to the colour of its cover.
import * as THREE from 'three';
import { grade, pools, tones } from './grade.js';
import { LENGTH, hourLight } from './hours.js';
import { heightAt } from './land.js';
import { MOODS } from './layout.js';
import { createShadows } from './shadows.js';
import { createSkyMaterial } from './sky.js';
import { createSprite, drawn, forming } from './sprites.js';
import { asset } from '../media.js';

// Less sky and more sun than world.js gives: the side towards the sun reaches the light tone, the
// side away from it the half tone, the folds and undersides the shade.
const SKY = 1.9;
const SUN = 2.4;
// Planets: [name, degrees to the right of the arrival's look, degrees above the horizon], far away.
const PLANETS = [['pianeta-anello', -33, 13], ['pianeta-luna', -10, 19], ['pianeta-fasce', 150, 16], ['pianeta-piccolo', 70, 24]];
const PLANET_DISTANCE = 650;
// Before a work: how much each tone leans to the cover's colour, and how soon (seconds).
const LEAN = { lit: 0.08, half: 0.07, shade: 0.04, time: 0.17 };
const STAND = 7.5;
// The water of the ponds, deep and at the rim, as in the door's picture.
const WATER_DEEP = new THREE.Color('#3f7fd6');
const WATER_SHALLOW = new THREE.Color('#8fc4f2');
const LAMP_GLOW = new THREE.Color('#ffb860');
// The lamp's globe in its picture (lampione.webp): middle and half size, as shares of the picture.
const GLOBE = [0.5, 0.884, 0.5, 0.12];
// Every kind of thing has its tint, taken from the colours of the hours, so that a tree is never taken
// for a cushion of cloud: [names, colour, how much]. The ground and the clouds stay white; furniture
// and the sculptures of the first island a neutral tone darker than the ground; the sculpture of every
// other island wears that island's colour, to be seen from far.
const ROLES = [
  [/^(albero|tronco|boschetto)/, '#7484e0', 0.55],
  [/^(cespugli|siepe)/, '#86a8f0', 0.5],
  [/^(ciuffo|erba|tifa|canne|ninfea)/, '#9a86dc', 0.5],
  [/^(panchina|altalena-sedile|gradini|pontile|scivolo|cassette|cassetta-posta|bandiera|aquilone|sasso)/, '#9ba0c8', 0.3],
];
const NEUTRAL = ['#9ba0c8', 0.32];

export function createLight({ plan, sky, sun, fog, park, renderer }) {
  const scene = sky.parent;
  const meshes = scene.children;
  // The sky's sphere wears the sky of the hour.
  const dome = meshes.find((mesh) => mesh.material?.uniforms?.horizon);
  const heavens = createSkyMaterial();
  dome.material = heavens;
  const u = heavens.uniforms;
  const sea = meshes.find((mesh) => mesh.userData.sea);
  // Ground, bodies and stones; on the light way their materials change, and the new ones are graded too.
  const ground = meshes.filter((mesh) => mesh.material?.isMeshLambertMaterial);
  const graded = new WeakSet();
  // Graded at once, so that they are ready when the park is first prepared, and again whenever the
  // light way changes them.
  const gradeGround = () => {
    for (const mesh of ground) {
      if (graded.has(mesh.material)) continue;
      graded.add(grade(mesh.material, undefined, Boolean(mesh.userData.island)));
    }
  };
  gradeGround();
  const [contact, patches] = [1, 2].map((order) => park.object.children.find((mesh) => mesh.renderOrder === order && mesh.material.uniforms?.colour));
  // The pools of the lamps are painted by the floor itself (grade.js), following its bumps; the flat
  // patches park.js lays for them would sink into the floor, so they are not drawn.
  patches.visible = false;
  const lamps = Array.from({ length: patches.count }, (_, index) => {
    const at = new THREE.Matrix4();
    patches.getMatrixAt(index, at);
    return { x: at.elements[12], z: at.elements[14], index, d: 0 };
  });
  const lampLevels = patches.geometry.attributes.level.array;
  // The covers of the works, and their plaster frames, which take the tones of the hour like the rest.
  const screens = [];
  const frames = new Set();
  const cutOuts = new Set([...drawn].map((sprite) => sprite.mesh.material));
  scene.traverse((mesh) => {
    if (mesh.userData.index !== undefined && mesh.isMesh && !mesh.isInstancedMesh) screens[mesh.userData.index] = mesh;
    if (mesh.isInstancedMesh && mesh.material.isMeshBasicMaterial && !cutOuts.has(mesh.material)) frames.add(mesh.material);
  });
  for (const material of frames) grade(material);

  // The look on arrival, read on the first frame: the sun of dawn stands just left of it, low over the
  // sea of clouds, in sight on a phone too, and the planets are placed from it.
  let ahead;
  const direction = (right, up, out = new THREE.Vector3()) => {
    const a = ahead + THREE.MathUtils.degToRad(right);
    const e = THREE.MathUtils.degToRad(up);
    return out.set(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
  };

  // The island's colours on its cut-outs, and a warm globe on the lit lamps.
  const toned = (sprite) => {
    sprite.mesh.material.userData.toned = true;
    sprite.mesh.material.needsUpdate = true;
  };
  const tint = (sprite, colour, amount) => {
    sprite.tone.uAccent.value.set(...new THREE.Color(colour).toArray(), amount);
    toned(sprite);
  };
  for (const sprite of drawn) {
    const zone = plan.zones.find((each) => each.id === sprite.name);
    const role = ROLES.find(([pattern]) => pattern.test(sprite.name));
    if (zone) tint(sprite, ...(zone.island === plan.landing ? NEUTRAL : [MOODS[zone.island.id].accent, 0.55]));
    else if (role) tint(sprite, role[1], role[2]);
    const colour = Object.values(MOODS).find((mood) => mood.on?.[sprite.name])?.on[sprite.name];
    if (colour) tint(sprite, colour, 0.9);
    // A soft warm light round the globe, nothing on the pole.
    if (sprite.name === 'lampione') {
      tint(sprite, LAMP_GLOW, 0.55);
      sprite.tone.uAccentFrom.value = 0.5;
      sprite.tone.uAccentAt.value.set(...GLOBE);
    }
  }

  // The planes kept apart, as in the door's picture: the sea of clouds below darker, bluer and flatter
  // than the islands, the far islands sunk into it, the clouds of the sky sunk into the sky.
  const behind = [[/^mare-di-nuvole$/, 'sea', 0.65], [/^isola-lontana/, 'sea', 0.45], [/^nuvola-\d$/, 'quarter', 0.4]]
    .flatMap(([pattern, colour, amount]) => [...drawn].filter((sprite) => pattern.test(sprite.name)).map((sprite) => {
      toned(sprite);
      return { sprite, colour, amount };
    }));

  // Long shadows of the large things standing on the ground (trees, sculptures, lamps, benches) and
  // of the works; not on the light way, where the sea of clouds is plain.
  const standing = [...drawn].filter((sprite) => !/^(sbuffo|ciuffo|nuvola|mare|isola-lontana|lampione-spento|altalena)/.test(sprite.name)).flatMap((sprite) => sprite.spots
    .filter((spot) => !spot.hidden && spot.height >= 1 && Math.abs(spot.y - heightAt(plan, spot.x, spot.z)) < 0.4)
    .map((spot) => ({ x: spot.x, z: spot.z, height: spot.height, width: spot.height * sprite.aspect })));
  const shadows = createShadows(plan, [...standing, ...plan.works.map((work) => ({ x: work.place.x, z: work.place.z, height: 2.2, width: 2.1 }))]);
  scene.add(shadows.mesh);

  // The planets, still in the sky, as far as the sky goes; they need the renderer to be fetched.
  const planets = [];
  const makePlanets = (drawer) => fetch(asset('img/sprites/manifest.json')).then((answer) => answer.json()).then((manifest) => {
    for (const [name, right, up] of PLANETS) {
      const entry = manifest[name];
      if (!entry) continue;
      const width = 2 * PLANET_DISTANCE * Math.tan(THREE.MathUtils.degToRad(entry.larghezza_gradi / 2));
      const planet = createSprite({ w: entry.larghezza, h: entry.altezza, small: { file: `img/sprites/${entry.file_1024}` } }, 1, { renderer: drawer, fog: false, anchor: [0.5, 0.5] });
      const at = direction(right, up).multiplyScalar(PLANET_DISTANCE);
      Object.assign(planet.spots[0], { x: at.x, y: at.y, z: at.z, height: width * (entry.altezza / entry.larghezza) });
      planet.mesh.renderOrder = -1;
      toned(planet);
      scene.add(planet.mesh);
      planet.use('small');
      planets.push(planet);
    }
  }, (error) => console.warn(error));
  // Without the renderer given, the sky hands it over when first drawn.
  if (!renderer) dome.onBeforeRender = (drawer) => {
    dome.onBeforeRender = () => {};
    makePlanets(drawer);
  };

  // The colour of a cover: its picture taken down to 8 by 8, each pixel counting as much as it is
  // coloured, so that a white page with a red mark gives the red (story.js takes a palette's liveliest).
  const covers = {};
  const sample = Object.assign(document.createElement('canvas'), { width: 8, height: 8 }).getContext('2d', { willReadFrequently: true });
  function coverColour(spot) {
    if (covers[spot.id]) return covers[spot.id];
    const image = screens[plan.works.indexOf(spot)]?.material.map?.image;
    if (!image) return undefined;
    sample.drawImage(image, 0, 0, 8, 8);
    const data = sample.getImageData(0, 0, 8, 8).data;
    const sum = [0, 0, 0, 0];
    for (let at = 0; at < data.length; at += 4) {
      const [r, g, b] = data.slice(at, at + 3);
      const weight = (Math.max(r, g, b) - Math.min(r, g, b)) / 255 + 0.05;
      for (let c = 0; c < 3; c++) sum[c] += (data[at + c] / 255) * weight;
      sum[3] += weight;
    }
    covers[spot.id] = new THREE.Color().setRGB(sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3], THREE.SRGBColorSpace);
    return covers[spot.id];
  }

  const hourOf = (index) => MOODS[plan.islands[index].id].hour;
  let hour = hourOf(plan.landing.index);
  const now = hourLight(hour);
  // The colour of the sea of clouds below, worked out from the hour each frame.
  const below = { sea: new THREE.Color() };
  const cover = new THREE.Color();
  // A tone leans to the cover's colour brought to the tone's own lightness: a dark cover warms or
  // cools the light, it never dims it.
  const luma = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const toward = new THREE.Color();
  const leanTo = (out, base, amount) => {
    toward.copy(cover).multiplyScalar(luma(base) / Math.max(luma(cover), 0.02));
    toward.setRGB(Math.min(1, toward.r), Math.min(1, toward.g), Math.min(1, toward.b));
    out.copy(base).lerp(toward, amount);
  };
  let lean = 0;
  // The air veils what is far more than world.js does, so that the other islands stand back, paler.
  const near = fog.near * 0.1;
  const far = fog.far * 0.5;

  return {
    update(dt, time, state, camera) {
      if (ahead === undefined) {
        ahead = state.heading;
        if (renderer) makePlanets(renderer);
      }
      // The hour wanted here: an island's, or between two along a path; the hour turns forward round
      // the wheel, so the path back to the first island goes through the night to dawn.
      let want = hourOf(state.path ? state.path.from : state.island.index);
      if (state.path) {
        let next = hourOf(state.path.to);
        if (next < want - LENGTH / 2) next += LENGTH;
        want += (next - want) * THREE.MathUtils.smoothstep(state.t / state.path.length, 0.2, 0.8);
      }
      const gap = ((((want - hour) % LENGTH) + LENGTH * 1.5) % LENGTH) - LENGTH / 2;
      hour = (hour + gap * Math.min(1, dt * 1.2) + LENGTH) % LENGTH;
      hourLight(hour, now);

      // Standing before a work, the light leans to its cover, over about half a second.
      const spot = state.nearest;
      const standing = spot && Math.abs(state.speed) < 0.3 && Math.hypot(state.x - spot.place.x, state.z - spot.place.z) < STAND;
      const colour = standing && coverColour(spot);
      if (colour) cover.copy(colour);
      lean += ((colour ? 1 : 0) - lean) * (1 - Math.exp(-dt / LEAN.time));
      leanTo(tones.uShade.value, now.shade, LEAN.shade * lean);
      leanTo(tones.uHalf.value, now.mid, LEAN.half * lean);
      leanTo(tones.uLit.value, now.lit, LEAN.lit * lean);

      gradeGround();

      u.uTop.value.copy(now.top);
      u.uQuarter.value.copy(now.quarter);
      u.uHalf.value.copy(now.half);
      u.uHorizon.value.copy(now.horizon);
      u.uGlow.value.copy(now.glow);
      u.uDisc.value.copy(now.disc);
      u.uBand.value.copy(now.band);
      u.uBandAmount.value = now.bandAmount;
      u.uStars.value = now.stars;
      direction(now.sun[0], now.sun[1], u.uSun.value);
      direction(now.shape[0], now.shape[1], sun.position).multiplyScalar(100);
      sky.intensity = SKY * now.light;
      // The floor makes up for half the light the hour takes away.
      pools.uFloorLight.value = 0.9 / (0.5 + 0.5 * now.light);
      sun.intensity = SUN * now.light;

      fog.color.copy(now.horizon);
      fog.near = near * now.haze;
      // While the park takes shape the haze stands close, and lifts.
      // On the light way the haze comes nearer: less is seen far off, the near things stay sharp.
      fog.far = far * now.haze * (0.2 + 0.8 * forming.value) * (sea.material.uniforms ? 1 : 0.7);
      below.sea.copy(now.seaNear).multiplyScalar(0.8).lerp(now.shade, 0.35);
      if (sea.material.uniforms) {
        sea.material.uniforms.uCloud.value.copy(below.sea);
        sea.material.uniforms.uGap.value.copy(below.sea).multiplyScalar(0.85);
      } else sea.material.color.copy(below.sea);
      for (const { sprite, colour, amount } of behind) sprite.tone.uVeil.value.set(...(below[colour] ?? now[colour]).toArray(), amount);
      contact.material.uniforms.colour.value.copy(now.shade).multiplyScalar(0.8);
      shadows.mesh.visible = Boolean(sea.material.uniforms);
      shadows.material.uniforms.colour.value.copy(now.shade).multiplyScalar(0.75);
      shadows.update(ahead + THREE.MathUtils.degToRad(now.shape[0]) + Math.PI, THREE.MathUtils.degToRad(now.shape[1]));
      // The ponds stay water blue at every hour, touched by the sky of the hour; the light of the
      // plaster in the rings and the sun's glow in the glint.
      if (park.water) {
        const w = park.water.uniforms;
        w.uDeep.value.copy(WATER_DEEP).lerp(now.top, 0.3);
        w.uShallow.value.copy(WATER_SHALLOW).lerp(now.half, 0.25);
        w.uRing.value.copy(now.lit);
        w.uGlint.value.copy(now.glow);
      }
      park.lamps = now.lamps;
      for (const lamp of lamps) lamp.d = Math.hypot(lamp.x - state.x, lamp.z - state.z);
      lamps.sort((a, b) => a.d - b.d);
      pools.uPools.value.forEach((pool, i) => pool.set(lamps[i].x, lamps[i].z, lampLevels[lamps[i].index], 0));
      for (const planet of planets) {
        planet.tone.uVeil.value.set(...now.quarter.toArray(), now.veil);
        planet.face(camera);
      }
    },
  };
}
