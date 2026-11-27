// The eyes of the visitor. Walking, they look along the path at a man's height, with a hint of a step;
// near a work they go to stand in front of it, far enough for the whole work to be seen large.
// From far (behind the door) and from above they look at the whole island.
import * as THREE from 'three';
import { FRAME, along, ringPoint } from './layout.js';

export const EYE = 1.6;
const STEP = 0.75;
const BOB = 0.035;
// Share of the screen width a work takes when the eyes are in front of it, on a phone and wider.
const SHARE = { narrow: 0.7, wide: 0.46 };

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createRig(camera, plan) {
  const pos = new THREE.Vector3(0, 80, 160);
  const look = new THREE.Vector3();
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const from = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let tween;
  let snap = false;
  let mode = 'far';
  const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  // Standing in front of a work, along the way it faces, as far as it takes to see it whole and large.
  function workPose(spot) {
    const w = spot.place;
    const wide = tanHalf() * camera.aspect;
    const share = camera.aspect < 1 ? SHARE.narrow : SHARE.wide;
    const distance = Math.max(FRAME.width / (share * 2 * wide), (FRAME.height / 2 + 0.4) / tanHalf());
    pose.look.set(w.x, w.cy, w.z);
    pose.pos.set(w.x + w.fx * distance, EYE, w.z + w.fz * distance);
  }

  function walk(state) {
    const p = ringPoint(plan, state.s);
    const bob = state.still ? Math.sin((state.walked / STEP) * Math.PI) ** 2 * BOB * Math.min(1, Math.abs(state.speed) / 1.5) : 0;
    wantPos.set(p.x, EYE + bob + state.hop, p.z);
    const yaw = state.turn + state.sway.x * 0.25;
    const ax = p.tx * Math.cos(yaw) + p.nx * Math.sin(yaw);
    const az = p.tz * Math.cos(yaw) + p.nz * Math.sin(yaw);
    wantLook.set(wantPos.x + ax * 10, wantPos.y - 0.35 - state.sway.y * 1.5, wantPos.z + az * 10);
    const work = state.near.reduce((best, spot) => {
      const gap = Math.abs(along(state.s, spot.s, plan.length));
      return !best || gap < best.gap ? { spot, gap } : best;
    }, undefined);
    if (!work) return;
    // Fully in front of the nearest work when at it, back on the path halfway to the next one; turning
    // the look by hand loosens the pull of the work.
    const k = (1 - smooth(work.spot.reach * 0.3, work.spot.reach, work.gap)) * (1 - Math.min(1, Math.abs(state.turn) * 2));
    if (k <= 0) return;
    workPose(work.spot);
    pose.pos.y += state.hop;
    wantPos.lerp(pose.pos, k);
    wantLook.lerp(pose.look, k);
  }

  function far(time) {
    const r = plan.island * 2.1;
    const angle = -0.5 + time * 0.015;
    wantPos.set(Math.cos(angle) * r, plan.island * 0.75, Math.sin(angle) * r);
    wantLook.set(0, -4, 0);
  }

  function above() {
    // Wide enough for the names that stand outside the ring.
    const reach = plan.radius + 20;
    const fit = Math.max(reach / (tanHalf() * camera.aspect), reach / tanHalf()) * 1.08;
    wantPos.set(0, fit * 0.8, fit * 0.62);
    wantLook.set(0, 0, 0);
  }

  return {
    get mode() {
      return mode;
    },
    fit(width, height) {
      camera.aspect = width / height;
      camera.fov = camera.aspect < 1 ? 70 : 55;
      camera.updateProjectionMatrix();
    },
    // Moves to another way of looking over the given seconds, or at once.
    go(next, seconds = 0) {
      mode = next;
      tween = seconds ? { start: performance.now(), seconds } : undefined;
      snap = !seconds;
      from.pos.copy(pos);
      from.look.copy(look);
      return seconds ? new Promise((done) => { tween.done = done; }) : Promise.resolve();
    },
    update(dt, state, time) {
      if (mode === 'far') far(time);
      else if (mode === 'above') above();
      else walk(state);
      if (tween) {
        const t = Math.min(1, (performance.now() - tween.start) / (tween.seconds * 1000));
        pos.lerpVectors(from.pos, wantPos, ease(t));
        look.lerpVectors(from.look, wantLook, ease(t));
        if (t >= 1) {
          tween.done();
          tween = undefined;
        }
      } else if (mode === 'walk' && !snap) {
        // The position follows the path closely; the look turns a little softer.
        pos.lerp(wantPos, 1 - Math.exp(-dt / 0.12));
        look.lerp(wantLook, 1 - Math.exp(-dt / 0.25));
      } else {
        pos.copy(wantPos);
        look.copy(wantLook);
        snap = false;
      }
      camera.position.copy(pos);
      camera.lookAt(look);
    },
  };
}
