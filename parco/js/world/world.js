// The park drawn live and walked in first person: renderer, scene, where the visitor stands and
// looks, how they move between the islands, and the loop, which only runs while the park can be seen.
import * as THREE from 'three';
import { createRig } from './camera.js';
import { createControls } from './controls.js';
import { HAZE, createGround, createSky, heightAt } from './land.js';
import { islandOf, mouth } from './layout.js';

// A walk: 1.6 m/s, up to 3 holding the screen; half a second to start and to stop.
const WALK = 1.6;
const HURRY = 3;
const EASE = 0.22;
const JUMP_SPEED = 3.4;
const GRAVITY = 11;
const PITCH = THREE.MathUtils.degToRad(25);
const STEER = 2.4;
// Room kept from the edge of an island, and how near its mouth one steps onto a path.
const EDGE = 1.6;
const MOUTH = 1.8;
// The little lift of each step from one stone to the next.
const STONE_EVERY = 1.25;
const STONE_HOP = 0.07;
// The light on the ground: a strong sky with a pale blue bounce from below and a gentle sun.
export const LIGHT = { sky: '#ffffff', ground: '#b9cde6', skyIntensity: 2.2, sun: '#ffffff', sunIntensity: 1.1, sunDirection: [-0.45, 0.75, 0.5] };

export function createWorld(canvas, { plan, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 60, 460);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  const rig = createRig(camera, plan);

  const sky = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.skyIntensity);
  const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunIntensity);
  scene.add(sky, sun, sun.target);

  const land = createGround(plan);
  scene.add(createSky(), land.sea, ...land.floors, ...land.stones);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // Where the visitor is: on an island, or at t metres along a path. Heading and pitch of the look.
  const state = { island: plan.landing, path: undefined, t: 0, x: 0, y: 0, z: 0, heading: 0, pitch: -0.1, speed: 0, walked: 0, hop: 0, rise: 0, pending: 0, hold: false, route: [], near: [], still: !reducedMotion.matches };
  const parts = [];
  let running = false;
  let paused = false;
  let last = 0;
  let time = 0;
  let listeners = { island: () => {}, frame: () => {} };
  let shown;
  let solid = [];

  const tangent = new THREE.Vector3();

  const jump = () => {
    if (state.hop > 0 || rig.mode !== 'walk') return;
    state.rise = JUMP_SPEED;
    state.hop = 0.001;
  };

  const stop = () => {
    state.route = [];
    state.pending = 0;
  };

  // Stands at a point of an island at once, looking at its works, or, where it has none, along the
  // way to the path that leaves it and the islands ahead, a little up.
  function place(island, at = island.arrival) {
    stop();
    state.island = island;
    state.path = undefined;
    state.speed = 0;
    state.x = at.x;
    state.z = at.z;
    const works = island.zones.some((zone) => zone.works.length);
    const toward = works ? island.centre : mouth(plan, island, island.out);
    state.heading = Math.atan2(toward.z - at.z, toward.x - at.x);
    state.pitch = works ? -0.1 : 0.06;
  }
  place(plan.landing, plan.landing.start);

  const controls = createControls(canvas, {
    onWalk(metres) {
      if (rig.mode !== 'walk') return;
      state.route = [];
      state.pending += metres;
      listeners.walk?.();
    },
    onLook(yaw, pitch) {
      if (rig.mode !== 'walk') return;
      state.heading += yaw;
      state.pitch = Math.max(-PITCH, Math.min(PITCH, state.pitch + pitch));
      listeners.walk?.();
    },
    onHold(on) {
      if (rig.mode !== 'walk') return;
      state.hold = on;
      if (on) stop();
      listeners.walk?.();
    },
    onTap: (x, y) => listeners.tap?.(x, y),
    onJump: jump,
  });

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    rig.fit(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);
  resize();

  // The way from where one is to an island and a point on it: across the islands along the loop,
  // forward or back, whichever is shorter. Each step is a point on an island or a path to walk.
  function route(island, at) {
    const steps = [];
    let here = state.path ? plan.islands[state.t > state.path.length / 2 ? state.path.to : state.path.from] : state.island;
    if (state.path) steps.push({ path: state.path, to: here.index === state.path.to ? state.path.length : 0 });
    const count = plan.islands.length;
    const ahead = (island.index - here.index + count) % count;
    const forward = ahead <= count - ahead;
    while (here !== island) {
      const path = forward ? here.out : here.in;
      const start = mouth(plan, here, path);
      steps.push({ island: here, x: start.x, z: start.z });
      steps.push({ path, to: forward ? path.length : 0 });
      here = plan.islands[forward ? path.to : path.from];
    }
    steps.push({ island, x: at.x, z: at.z });
    return steps;
  }

  // Steps onto a path or off it.
  function enter(path, end) {
    state.path = path;
    state.island = undefined;
    state.t = end ? path.length : 0;
  }
  function leave(path, atEnd) {
    state.island = plan.islands[atEnd ? path.to : path.from];
    state.path = undefined;
  }

  function move(dt) {
    const keys = controls.held(dt);
    state.heading += keys.turn;
    const step = state.route[0];
    let want = 0;
    let way = state.heading;
    if (state.hold) want = HURRY;
    else if (keys.walk) want = keys.walk * WALK;
    else if (Math.abs(state.pending) > 0.02) want = Math.sign(state.pending) * Math.min(WALK, Math.abs(state.pending) / EASE);
    else if (step) want = step.speed ?? WALK;
    state.speed += (want - state.speed) * (1 - Math.exp(-dt / EASE));
    if (!want && Math.abs(state.speed) < 0.02) state.speed = 0;
    if (!state.speed) return;
    let metres = state.speed * dt;
    if (!step && !state.hold && !keys.walk) state.pending -= metres;
    state.walked += Math.abs(metres);

    if (state.path) {
      // Along the path: the route's way, or the way the look faces.
      const { path } = state;
      path.curve.getTangentAt(Math.min(1, Math.max(0, state.t / path.length)), tangent);
      let sign = Math.sign(Math.cos(state.heading) * tangent.x + Math.sin(state.heading) * tangent.z) || 1;
      if (step?.path === path) sign = Math.sign(step.to - state.t) || 1;
      state.t += sign * Math.abs(metres);
      if (step?.path === path && Math.sign(step.to - state.t) !== sign) {
        state.t = step.to;
        state.route.shift();
      }
      if (step?.path === path) {
        const turn = Math.atan2(sign * tangent.z, sign * tangent.x) - state.heading;
        state.heading += Math.max(-STEER * dt, Math.min(STEER * dt, Math.atan2(Math.sin(turn), Math.cos(turn))));
      }
      if (state.t <= 0) leave(path, false);
      else if (state.t >= path.length) leave(path, true);
      else return;
      state.t = Math.min(path.length, Math.max(0, state.t));
      const end = path.curve.getPoint(state.t >= path.length ? 1 : 0);
      state.x = end.x;
      state.z = end.z;
      return;
    }

    const { island } = state;
    if (step?.island) {
      const dx = step.x - state.x;
      const dz = step.z - state.z;
      const left = Math.hypot(dx, dz);
      way = Math.atan2(dz, dx);
      metres = Math.min(metres, left);
      // A mouth lies past the edge one keeps from: close to it is there.
      if (left < (state.route[1]?.path ? EDGE + 0.3 : 0.1)) state.route.shift();
      else if (Math.abs(state.speed) > 0.2) {
        const turn = way - state.heading;
        state.heading += Math.max(-STEER * dt, Math.min(STEER * dt, Math.atan2(Math.sin(turn), Math.cos(turn))));
      }
    } else if (step?.path) {
      enter(step.path, step.to === 0);
      return;
    }
    let x = state.x + Math.cos(way) * metres;
    let z = state.z + Math.sin(way) * metres;
    // Near a mouth, walking out of the island, one steps onto its path.
    for (const [path, end] of [[island.out, false], [island.in, true]]) {
      const at = mouth(plan, island, path);
      const outward = (x - state.x) * (at.x - island.centre.x) + (z - state.z) * (at.z - island.centre.z) > 0;
      if (!step && outward && Math.hypot(x - at.x, z - at.z) < MOUTH) {
        enter(path, end);
        return;
      }
    }
    // Nothing is walked through: close to a thing one slides round it, and stops if it is in the way.
    for (const thing of solid) {
      const dx = x - thing.x;
      const dz = z - thing.z;
      const d = Math.hypot(dx, dz);
      if (d >= thing.r || d === 0) continue;
      x = thing.x + (dx / d) * thing.r;
      z = thing.z + (dz / d) * thing.r;
    }
    if (Math.hypot(x - state.x, z - state.z) < Math.abs(metres) * 0.2 && Math.abs(state.speed) > 0.3) {
      state.speed *= 0.5;
      if (step?.island) state.route = [];
    }
    // At the edge one stops: no wall, no fall.
    const r = Math.hypot(x - island.centre.x, z - island.centre.z);
    const room = island.radius - EDGE;
    if (r > room) {
      x = island.centre.x + ((x - island.centre.x) / r) * room;
      z = island.centre.z + ((z - island.centre.z) / r) * room;
    }
    state.x = x;
    state.z = z;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;
    if (rig.mode === 'walk') move(dt);
    state.still = !reducedMotion.matches;
    if (state.hop > 0) {
      state.rise -= GRAVITY * dt;
      state.hop = Math.max(0, state.hop + state.rise * dt);
    }
    if (state.path) {
      const at = state.path.curve.getPointAt(Math.min(1, Math.max(0, state.t / state.path.length)));
      const between = (state.t / STONE_EVERY) % 1;
      state.x = at.x;
      state.z = at.z;
      state.y = at.y + 0.085 + Math.sin(between * Math.PI) * STONE_HOP;
    } else {
      state.y = heightAt(plan, state.x, state.z);
    }
    const island = state.island ?? plan.islands[state.t > state.path.length / 2 ? state.path.to : state.path.from];
    if (island !== shown) {
      shown = island;
      listeners.island(island);
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
    // Things one cannot walk through: [{ x, z, r }].
    block(things) {
      solid = solid.concat(things);
    },
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
    // At an island (or the island of a place) at once, at its arrival or at a given point.
    place(id, at) {
      place(typeof id === 'string' ? islandOf(plan, id) : id, at);
    },
    // Walks to a point of an island, along the paths if it is another one.
    goTo(island, x, z) {
      state.pending = 0;
      state.route = route(island, { x, z });
    },
    // Walks to a point along the path being walked.
    goAlong(path, t) {
      state.pending = 0;
      state.route = state.path === path ? [{ path, to: t }] : [...route(plan.islands[t > path.length / 2 ? path.to : path.from], mouth(plan, plan.islands[t > path.length / 2 ? path.to : path.from], path)), { path, to: t }];
    },
    // Walks to an island: to its arrival point, or to a place given by id.
    goIsland(id, speed) {
      const island = typeof id === 'string' ? islandOf(plan, id) : id;
      state.pending = 0;
      state.route = route(island, island.arrival).map((step) => ({ ...step, speed }));
    },
    stop,
    moving: () => Math.abs(state.speed) > 0.05 || state.route.length > 0,
    here: () => state.island ?? plan.islands[state.t > state.path.length / 2 ? state.path.to : state.path.from],
    // The first of the given objects under a point of the screen.
    hit(x, y, objects) {
      pointer.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(objects, true)[0];
    },
  };
}
