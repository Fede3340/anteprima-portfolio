// The park drawn live and walked in first person: renderer, scene, where the visitor stands and
// looks, how they move between the islands, and the loop, which only runs while the park can be seen.
import * as THREE from 'three';
import { createRig } from './camera.js';
import { createControls } from './controls.js';
import { HAZE, createGround, createSky, heightAt } from './land.js';
import { islandOf, mouth } from './layout.js';

// A walk: 2.8 m/s, up to 4.2 holding the screen; at full pace within 0.12 s, and stopped as quickly.
const WALK = 2.8;
const HURRY = 4.2;
const ACCEL = 36;
// How softly a walk to a point comes to its end (m/s²), and the look's rest walking: just below level.
const SETTLE = 12;
const LEVEL = -0.05;
// A walk to a point on the same island takes 1.5 s from near, 2.5 at most from far: the pace for a
// distance, never below a walk, never above 16 m/s.
const paceFor = (metres) => Math.min(16, Math.max(WALK, metres / Math.min(2.1, 1 + metres * 0.045)));
// A notch of the wheel: 1.1 m, walked at once in about a sixth of a second.
const NOTCH = 1.1;
const NOTCH_SPEED = 7;
const JUMP_SPEED = 3.4;
const GRAVITY = 11;
const PITCH = THREE.MathUtils.degToRad(35);
const STEER = 1.6;
// Room kept from the edge of an island, and how near its mouth one steps onto a path.
const EDGE = 1;
const MOUTH = 1.8;
// How far from a thing one starts to turn along it.
const SOFT = 1;
// How far a stone gives under the foot, and the stretch before an island where the stones meet its floor.
const SINK = 0.035;
const LANDING = 1.5;
// The light on the ground: a strong sky with a pale blue bounce from below and a gentle sun.
// The sharpness of the drawing follows the machine. It starts at the screen's own density, up to 1.5
// and up to about 2.6 million pixels drawn (a large screen of high density starts a step lower). The
// time of a frame, 50 ms at most, is averaged over about ten frames, so that a screen dropping every other frame (16
// and 33 ms in turn) counts as slow: after half a second of that average above 22 ms it goes down a
// step; on the lowest step, after one more second, the light way comes on. It goes back up a step
// after five seconds at the screen's full pace (under 18 ms: the time between frames cannot be shorter
// than the screen's own, 16.7 ms at 60 Hz); a step found too slow is tried again once, twenty seconds
// later, and after a second failure no more.
const STEPS = [1.5, 1.25, 1, 0.8, 0.65];
const PIXELS = 2.6e6;
const SLOW = 22;
const QUICK = 18;

export const LIGHT = { sky: '#ffffff', ground: '#b9cde6', skyIntensity: 2.2, sun: '#ffffff', sunIntensity: 1.1, sunDirection: [-0.45, 0.75, 0.5] };

export function createWorld(canvas, { plan, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const fits = (ratio) => ratio <= Math.min(devicePixelRatio, Math.sqrt(PIXELS / (innerWidth * innerHeight)));
  const found = STEPS.findIndex(fits);
  const top = found < 0 ? STEPS.length - 1 : found;
  const quality = { step: top, average: 1000 / 60, slow: 0, quick: 0, crawl: 0, failed: {}, light: false, gaveWay: false };
  renderer.setPixelRatio(STEPS[top]);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 60, 460);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  const rig = createRig(camera, plan);

  const sky = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.skyIntensity);
  const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunIntensity);
  scene.add(sky, sun, sun.target);

  const land = createGround(plan);
  // The sky is the land's too, for whoever sets the light.
  land.sky = createSky();
  scene.add(land.sky, land.sea, land.bodies, ...land.floors, ...land.stones);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // Where the visitor is: on an island, or at t metres along a path. Heading and pitch of the look.
  const state = { island: plan.landing, path: undefined, t: 0, x: 0, y: 0, z: 0, heading: 0, pitch: -0.1, lookYaw: 0, lookPitch: 0, speed: 0, walked: 0, turned: 0, hop: 0, rise: 0, pending: 0, hold: false, route: [], near: [], still: !reducedMotion.matches };
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
    state.turnTo = undefined;
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
    onWalk(way) {
      if (rig.mode !== 'walk') return;
      state.route = [];
      state.pending = way * NOTCH;
    },
    onLook(yaw, pitch) {
      if (rig.mode !== 'walk') return;
      state.heading += yaw;
      state.turned += Math.abs(yaw);
      state.pitch = Math.max(-PITCH, Math.min(PITCH, state.pitch + pitch));
    },
    onHold(on) {
      if (rig.mode !== 'walk') return;
      state.hold = on;
      if (on) stop();
    },
    onTap: (x, y, kind) => listeners.tap?.(x, y, kind),
    onJump: jump,
  });

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    rig.fit(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);
  resize();

  // The way the look faces along the path one is on: 1 towards its end, -1 towards its start.
  function facing() {
    state.path.curve.getTangentAt(Math.min(1, Math.max(0, state.t / state.path.length)), tangent);
    const view = state.heading + state.lookYaw;
    return Math.sign(Math.cos(view) * tangent.x + Math.sin(view) * tangent.z) || 1;
  }

  // From an island to a point of another, across the islands along the loop, forward or back,
  // whichever is shorter. Each step is a point on an island or a path to walk.
  function across(here, island, at, steps, metres) {
    const count = plan.islands.length;
    const ahead = (island.index - here.index + count) % count;
    const forward = ahead <= count - ahead;
    while (here !== island) {
      const path = forward ? here.out : here.in;
      const start = mouth(plan, here, path);
      steps.push({ island: here, x: start.x, z: start.z });
      steps.push({ path, to: forward ? path.length : 0 });
      metres += path.length;
      here = plan.islands[forward ? path.to : path.from];
    }
    steps.push({ island, x: at.x, z: at.z });
    return { steps, metres };
  }

  // The way from where one is to an island and a point on it; from a path, by the shorter of its ends.
  function route(island, at) {
    if (!state.path) return across(state.island, island, at, [], 0).steps;
    const { path, t } = state;
    return [[path.to, path.length, path.length - t], [path.from, 0, t]]
      .map(([end, to, left]) => across(plan.islands[end], island, at, [{ path, to }], left))
      .sort((a, b) => a.metres - b.metres)[0].steps;
  }

  // A point inside a thing is moved out of it, to just before its side: a walk always has an end
  // that can be reached, and never circles round it looking for a way in. Where things stand so close
  // that pushing out of one goes into another (a sculpture by the last work), the point comes back
  // towards where one stands until it is clear.
  const inside = (at) => solid.find((each) => Math.hypot(at.x - each.x, at.z - each.z) < each.r + 0.3);
  function outside(at) {
    const thing = inside(at);
    if (!thing) return at;
    const d = Math.hypot(at.x - thing.x, at.z - thing.z) || 1;
    const k = (thing.r + 0.3) / d;
    const out = { ...at, x: thing.x + (at.x - thing.x) * k, z: thing.z + (at.z - thing.z) * k };
    if (!inside(out) || at.island !== state.island) return out;
    const back = Math.hypot(state.x - at.x, state.z - at.z);
    for (let metres = 0.25; metres < back; metres += 0.25) {
      const near = { ...at, x: at.x + ((state.x - at.x) * metres) / back, z: at.z + ((state.z - at.z) * metres) / back };
      if (!inside(near)) return near;
    }
    return { ...at, x: state.x, z: state.z };
  }

  function go(steps) {
    state.pending = 0;
    state.route = steps.map((step) => (step.island ? outside(step) : step));
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

  // A move from a point of an island: never into a thing, never past the edge. Within a metre of a
  // thing the part of the move that goes into it fades out the nearer one is, and the move turns along
  // it at no less than 60% of its pace, on the side it leans to: one goes round without a jolt, even
  // walking straight at it. A walk to a point that comes before the thing (left: the metres to it)
  // does not go round it: it only never goes in.
  function slide(island, x, z, mx, mz, left = Infinity) {
    const length = Math.hypot(mx, mz);
    for (const thing of solid) {
      const d = Math.hypot(x - thing.x, z - thing.z) || 1;
      if (d >= thing.r + SOFT) continue;
      const nx = (x - thing.x) / d;
      const nz = (z - thing.z) / d;
      const inward = mx * nx + mz * nz;
      if (inward >= 0) continue;
      if (left < d - thing.r) {
        if (d + inward < thing.r) {
          mx -= inward * nx;
          mz -= inward * nz;
        }
        continue;
      }
      const along = mx * -nz + mz * nx;
      // Walking almost straight at it, the side taken first is kept, so as not to waver.
      if (Math.abs(along) > length * 0.2 || !thing.side) thing.side = Math.sign(along) || 1;
      const k = Math.min(1, (thing.r + SOFT - d) / SOFT);
      mx -= k * inward * nx;
      mz -= k * inward * nz;
      const short = length * 0.6 * k - Math.hypot(mx, mz);
      if (short > 0) {
        mx += -nz * thing.side * short;
        mz += nx * thing.side * short;
      }
    }
    x += mx;
    z += mz;
    // At the edge one stops: no wall, no fall.
    const r = Math.hypot(x - island.centre.x, z - island.centre.z);
    const room = island.radius - EDGE;
    if (r > room) {
      x = island.centre.x + ((x - island.centre.x) / r) * room;
      z = island.centre.z + ((z - island.centre.z) / r) * room;
    }
    return [x, z];
  }

  const ramp = (value, want, dt) => value + Math.max(-ACCEL * dt, Math.min(ACCEL * dt, want - value));
  // Turns the way one faces so that the look (with the pointer's share) goes towards a direction.
  const steer = (toward, dt) => {
    const turn = toward - state.lookYaw - state.heading;
    state.heading += Math.max(-STEER * dt, Math.min(STEER * dt, Math.atan2(Math.sin(turn), Math.cos(turn))));
  };

  function move(dt) {
    const keys = controls.held(dt);
    state.heading += keys.turn;
    state.turned += Math.abs(keys.turn);
    // The look follows the pointer; walking, it comes back level to the horizon.
    const walking = Math.abs(state.speed) > 0.3;
    const gaze = controls.gaze(dt, walking);
    state.lookYaw = gaze.yaw;
    state.lookPitch = gaze.pitch;
    if (walking) state.pitch += (LEVEL - state.pitch) * (1 - Math.exp(-dt / 0.3));
    if (state.turnTo !== undefined) {
      steer(state.turnTo, dt);
      if (Math.abs(Math.atan2(Math.sin(state.turnTo - state.lookYaw - state.heading), Math.cos(state.turnTo - state.lookYaw - state.heading))) < 0.01) state.turnTo = undefined;
    }
    const step = state.route[0];
    let want = 0;
    if (state.hold) want = HURRY;
    else if (keys.walk) want = keys.walk * WALK;
    else if (step) want = step.speed ?? WALK;
    // Coming to the end of a walk to a point, softly.
    if (step?.island && !state.route[1]) want = Math.min(want, Math.sqrt(2 * SETTLE * Math.hypot(step.x - state.x, step.z - state.z)) + 0.4);
    if (want) state.pending = 0;
    state.speed = ramp(state.speed, want, dt);
    let metres = state.speed * dt;
    // The wheel's notch: walked at once at an even pace, stopped dead at its end.
    if (state.pending) {
      metres = Math.sign(state.pending) * Math.min(Math.abs(state.pending), NOTCH_SPEED * dt);
      state.pending -= metres;
    }
    if (!metres) return;
    state.walked += Math.abs(metres);

    if (state.path) {
      // Along the path, the way the route goes or the look faces.
      const { path } = state;
      let sign = facing();
      const bend = Math.atan2(tangent.z, tangent.x);
      if (step?.path === path) sign = Math.sign(step.to - state.t) || 1;
      else sign *= Math.sign(metres);
      state.t += sign * Math.abs(metres);
      if (step?.path === path && Math.sign(step.to - state.t) !== sign) {
        state.t = step.to;
        state.route.shift();
      }
      // The look turns as much as the path turns, so that one looking aside goes on looking aside;
      // on a phone a walk to a point also turns it slowly the way it goes.
      path.curve.getTangentAt(Math.min(1, Math.max(0, state.t / path.length)), tangent);
      const turn = Math.atan2(tangent.z, tangent.x) - bend;
      state.heading += Math.atan2(Math.sin(turn), Math.cos(turn));
      if (step?.path === path) steer(Math.atan2(sign * tangent.z, sign * tangent.x), dt);
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
    let way = state.heading + state.lookYaw;
    if (step?.island) {
      const dx = step.x - state.x;
      const dz = step.z - state.z;
      const left = Math.hypot(dx, dz);
      way = Math.atan2(dz, dx);
      metres = Math.min(metres, left);
      // A mouth lies past the edge one keeps from: close to it is there.
      // A walk that has not come nearer for two and a half seconds (going round a thing takes a
      // while; a thing standing on the point never ends) stops there.
      if (left < (step.best ?? Infinity) - 0.05) Object.assign(step, { best: left, since: time });
      if (left < (state.route[1]?.path ? EDGE + 0.3 : 0.1)) state.route.shift();
      else if (time - step.since > 2.5) state.route = [];
      else if (Math.abs(state.speed) > 0.2) steer(way, dt);
    } else if (step?.path) {
      enter(step.path, step.to === 0);
      return;
    }
    const mx = Math.cos(way) * metres;
    const mz = Math.sin(way) * metres;
    const left = step?.island ? Math.hypot(step.x - state.x, step.z - state.z) : Infinity;
    // Near a mouth, walking out of the island, one steps onto its path.
    for (const [path, end] of [[island.out, false], [island.in, true]]) {
      const at = mouth(plan, island, path);
      const outward = mx * (at.x - island.centre.x) + mz * (at.z - island.centre.z) > 0;
      if (!step && outward && Math.hypot(state.x + mx - at.x, state.z + mz - at.z) < MOUTH) {
        enter(path, end);
        return;
      }
    }
    [state.x, state.z] = slide(island, state.x, state.z, mx, mz, left);
  }

  function adapt(frame) {
    // A single long frame (a picture sent to the graphics card) counts as a slow one, no more.
    const spent = Math.min(frame, 50);
    quality.average += (spent - quality.average) * 0.1;
    quality.slow = quality.average > SLOW ? quality.slow + spent : 0;
    quality.quick = quality.average < QUICK ? quality.quick + spent : 0;
    const go = (step) => {
      quality.step = step;
      quality.slow = 0;
      quality.quick = 0;
      renderer.setPixelRatio(STEPS[step]);
      renderer.setSize(innerWidth, innerHeight, false);
    };
    if (quality.slow > 500 && quality.step < STEPS.length - 1) {
      const failed = quality.failed[quality.step];
      quality.failed[quality.step] = { at: time, times: (failed?.times ?? 0) + 1 };
      go(quality.step + 1);
    } else if (quality.slow > 1000 && !quality.light) {
      quality.light = true;
      quality.slow = 0;
      land.light(true);
      listeners.light?.(true);
    } else if (quality.quick > 5000 && quality.step > top) {
      const failed = quality.failed[quality.step - 1];
      if (!failed || (failed.times < 2 && time - failed.at > 20)) go(quality.step - 1);
    }
    // Light, and still under 15 frames a second for five seconds: the park gives way, once.
    quality.crawl = quality.light && frame > 1000 / 15 ? quality.crawl + frame : 0;
    if (quality.crawl > 5000 && !quality.gaveWay) {
      quality.gaveWay = true;
      listeners.crawl?.();
    }
  }

  function frame(now) {
    // The first frame after a pause is not a measure.
    if (last && now - last < 1000) adapt(now - last);
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
      const { path } = state;
      const between = (state.t / (path.length / path.stones)) % 1;
      const sink = state.still ? SINK * (0.5 + 0.5 * Math.cos(between * Math.PI * 2)) : 0;
      const ground = Math.min(state.t, path.length - state.t) / LANDING;
      state.x = at.x;
      state.z = at.z;
      state.y = at.y + 0.085 - sink;
      if (ground < 1) state.y += (heightAt(plan, at.x, at.z) - state.y) * (1 - ground) ** 2;
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
    quality,
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
    // On the island one is on, at the pace that brings one there in a moment.
    goTo(island, x, z) {
      const steps = route(island, { x, z });
      if (steps.length === 1) steps[0].speed = paceFor(Math.hypot(x - state.x, z - state.z));
      go(steps);
    },
    // Turns the look, at the steering pace, towards a point.
    face(x, z) {
      state.turnTo = Math.atan2(z - state.z, x - state.x);
    },
    // Walks to a point along a path.
    goAlong(path, t) {
      if (state.path === path) return go([{ path, to: t }]);
      const end = plan.islands[t > path.length / 2 ? path.to : path.from];
      return go([...route(end, mouth(plan, end, path)), { path, to: t }]);
    },
    // Walks to an island: to its arrival point, or to a place given by id.
    // A few steps ahead, the way the look faces: along the path if one is on the stones.
    ahead(metres) {
      if (state.path) return go([{ path: state.path, to: Math.min(state.path.length, Math.max(0, state.t + facing() * metres)) }]);
      return go([{ island: state.island, x: state.x + Math.cos(state.heading) * metres, z: state.z + Math.sin(state.heading) * metres }]);
    },
    goIsland(id, speed) {
      const island = typeof id === 'string' ? islandOf(plan, id) : id;
      go(route(island, island.arrival).map((step) => ({ ...step, speed })));
    },
    stop,
    moving: () => Math.abs(state.speed) > 0.05 || Math.abs(state.pending) > 0 || state.route.length > 0,
    here: () => state.island ?? plan.islands[state.t > state.path.length / 2 ? state.path.to : state.path.from],
    // The first of the given objects under a point of the screen.
    hit(x, y, objects) {
      pointer.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(objects, true)[0];
    },
  };
}
