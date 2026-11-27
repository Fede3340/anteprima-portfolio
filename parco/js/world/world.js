// The park drawn live and walked in first person: renderer, scene, the eyes on the ring, and the loop,
// which only runs while the park can be seen.
import * as THREE from 'three';
import { createRig } from './camera.js';
import { createControls } from './controls.js';
import { HAZE, createGround, createSky } from './land.js';
import { along, wrap, zoneAt } from './layout.js';

const SETTLE = 0.14;
const AUTO_SPEED = 2.2;
const JUMP_SPEED = 3.4;
const GRAVITY = 11;
// The look turned by a sideways drag goes back to the path by itself in about a second.
const LOOK_BACK = 0.7;
const LOOK_LIMIT = 1.1;
// The light on the ground: a strong sky with a pale blue bounce from below and a gentle sun.
export const LIGHT = { sky: '#ffffff', ground: '#b9cde6', skyIntensity: 2.6, sun: '#ffffff', sunIntensity: 1.2, sunDirection: [-0.45, 0.75, 0.5] };

export function createWorld(canvas, { plan, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 40, 520);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  const rig = createRig(camera, plan);

  const sky = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.skyIntensity);
  const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunIntensity);
  scene.add(sky, sun, sun.target);

  const land = createGround(plan, plan.zones.filter((zone) => zone.mark).map(({ mark }) => [mark.x, mark.z]));
  scene.add(createSky(), land.ground);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const state = { s: plan.landing, target: plan.landing, speed: 0, walked: 0, hop: 0, rise: 0, turn: 0, sway: { x: 0, y: 0 }, near: [], auto: undefined, still: !reducedMotion.matches };
  const parts = [];
  let running = false;
  let paused = false;
  let last = 0;
  let time = 0;
  let listeners = { zone: () => {}, frame: () => {} };
  let zone;
  let turning = false;

  const jump = () => {
    if (state.hop > 0 || rig.mode !== 'walk') return;
    state.rise = JUMP_SPEED;
    state.hop = 0.001;
  };

  const controls = createControls(canvas, {
    onWalk(metres) {
      if (rig.mode !== 'walk') return;
      state.auto = undefined;
      state.target += metres;
      listeners.walk?.();
    },
    onTurn(radians, held) {
      turning = held;
      if (rig.mode === 'walk') state.turn = Math.max(-LOOK_LIMIT, Math.min(LOOK_LIMIT, state.turn + radians));
    },
    onTap: (x, y) => listeners.tap?.(x, y),
    onJump: jump,
    onLook(x, y) {
      if (reducedMotion.matches || matchMedia('(pointer: coarse)').matches) return;
      state.sway.x = x;
      state.sway.y = y;
    },
  });

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    rig.fit(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);
  resize();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    if (state.auto !== undefined) {
      state.target = Math.min(state.auto, state.target + AUTO_SPEED * dt);
      if (state.target >= state.auto) state.auto = undefined;
    }
    state.target += controls.step(dt);
    const before = state.s;
    state.s += (state.target - state.s) * (1 - Math.exp(-dt / SETTLE));
    state.speed = (state.s - before) / dt;
    state.walked += Math.abs(state.s - before);
    state.still = !reducedMotion.matches;
    if (!turning) state.turn *= Math.exp(-dt / LOOK_BACK);
    if (state.hop > 0) {
      state.rise -= GRAVITY * dt;
      state.hop = Math.max(0, state.hop + state.rise * dt);
    }

    // The zone in sight: a few steps before a zone, that one.
    const here = zoneAt(plan, state.s + 6);
    if (here !== zone) {
      zone = here;
      listeners.zone(zone);
    }
    land.update(time);
    for (const part of parts) part.update?.(dt, time, state, camera);
    rig.update(dt, state, time);
    listeners.frame(dt, time);
    renderer.render(scene, camera);
  }

  function loop(on) {
    const want = on && !paused && !document.hidden;
    if (want === running) return;
    running = want;
    last = performance.now();
    renderer.setAnimationLoop(want ? frame : null);
  }
  document.addEventListener('visibilitychange', () => loop(true));

  return {
    renderer,
    scene,
    camera,
    state,
    land,
    controls,
    rig,
    sky,
    sun,
    jump,
    add(part) {
      parts.push(part);
      if (part.object) scene.add(part.object);
    },
    on(more) {
      listeners = { ...listeners, ...more };
    },
    start() {
      loop(true);
    },
    pause(value) {
      paused = value;
      if (value) controls.stop();
      loop(true);
    },
    // Puts the eyes at s at once, without walking there.
    place(s) {
      state.s = state.target = s;
      state.auto = undefined;
    },
    walkTo(s) {
      state.auto = s;
    },
    // The shortest way along the ring to s, walked.
    stepTo(s) {
      state.auto = undefined;
      state.target = state.s + along(state.s, s, plan.length);
    },
    where: () => wrap(state.s, plan.length),
    // The first of the given objects under a point of the screen.
    hit(x, y, objects) {
      pointer.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(objects, true)[0];
    },
  };
}
