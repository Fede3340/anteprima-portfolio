// The eyes of the visitor, at a man's height above the ground where they stand, looking where they
// are told to. A work touched brings them to stand still in front of it, with its surroundings
// around. From far (behind the door) and from above they look at the whole island.
import * as THREE from 'three';
import { FRAME } from './layout.js';

export const EYE = 1.6;
// A long, easy stride at 2.8 m/s: the same cadence as 0.75 m at 2 m/s.
const STEP = 1.05;
const BOB = 0.025;
// Share of the screen height the frame of a work takes when the eyes stand in front of it.
const HELD = 0.42;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function createRig(camera, plan) {
  const pos = new THREE.Vector3(0, 80, 160);
  const look = new THREE.Vector3();
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const from = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let tween;
  let mode = 'far';
  let held;
  const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  function walk(state) {
    const bob = state.still ? Math.sin((state.walked / STEP) * Math.PI) ** 2 * BOB * Math.min(1, Math.abs(state.speed) / 1.2) : 0;
    wantPos.set(state.x, state.y + EYE + bob + state.hop, state.z);
    // The way one faces.
    const { heading, pitch } = state;
    const flat = Math.cos(pitch);
    wantLook.set(wantPos.x + Math.cos(heading) * flat * 10, wantPos.y + Math.sin(pitch) * 10, wantPos.z + Math.sin(heading) * flat * 10);
  }

  // In front of a work, a little higher than its middle and far enough for the land around to show.
  function hold() {
    const { x, z, fx, fz, cy } = held;
    const distance = (FRAME.height / 2 + 0.1) / (HELD * tanHalf());
    wantLook.set(x, cy + 0.15, z);
    wantPos.set(x + fx * distance, cy + 0.35, z + fz * distance);
  }

  // How far the archipelago reaches from its middle.
  const reach = Math.max(...plan.islands.map((island) => Math.hypot(island.centre.x, island.centre.z) + island.radius));

  function far(time) {
    const angle = -0.5 + time * 0.015;
    wantPos.set(Math.cos(angle) * reach * 1.3, reach * 0.32, Math.sin(angle) * reach * 1.3);
    wantLook.set(0, -8, 0);
  }

  function above() {
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
      camera.fov = camera.aspect < 1 ? 72 : 55;
      camera.updateProjectionMatrix();
    },
    // Moves to another way of looking over the given seconds, or at once. 'hold' needs the place of
    // the work: { x, z, fx, fz, cy }.
    go(next, seconds = 0, place) {
      mode = next;
      held = place ?? held;
      tween = seconds ? { start: performance.now(), seconds } : undefined;
      from.pos.copy(pos);
      from.look.copy(look);
      return seconds ? new Promise((done) => { tween.done = done; }) : Promise.resolve();
    },
    update(dt, state, time) {
      if (mode === 'far') far(time);
      else if (mode === 'above') above();
      else if (mode === 'hold') hold();
      else walk(state);
      if (tween) {
        const t = Math.min(1, (performance.now() - tween.start) / (tween.seconds * 1000));
        pos.lerpVectors(from.pos, wantPos, ease(t));
        look.lerpVectors(from.look, wantLook, ease(t));
        if (t >= 1) {
          tween.done();
          tween = undefined;
        }
      } else {
        pos.copy(wantPos);
        look.copy(wantLook);
      }
      camera.position.copy(pos);
      camera.lookAt(look);
    },
  };
}
