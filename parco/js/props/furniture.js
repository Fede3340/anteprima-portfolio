// Park furniture in plaster: frames on easels, lamps with a moon, clouds, benches, trees, the swing.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { palette, plaster } from './materials.js';
import { assemble, at, bend, cloudPuffs, fuse, lathe, roundRect } from './shape.js';

const box = (w, h, d, r, segments = 2) => new RoundedBoxGeometry(w, h, d, segments, r);
const leg = (r, length) => new THREE.CapsuleGeometry(r, length - 2 * r, 4, 12);

// A frame on an easel. `screen` is the plane that receives the cover (its own material).
export function createFrame(width = 1.6, height = 1) {
  const border = 0.08, bottom = 0.72, tilt = -0.1;
  const w = width + 2 * border, h = height + 2 * border;
  const cy = bottom + h / 2;

  const ring = roundRect(new THREE.Shape(), w, h, 0.06);
  ring.holes.push(roundRect(new THREE.Path(), width, height, 0.012));
  const front = new THREE.ExtrudeGeometry(ring, {
    depth: 0.03, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2, curveSegments: 4,
  });
  const board = [at(front, [0, 0, 0.01]), at(box(w, h, 0.05, 0.022), [0, 0, -0.02])]
    .map((g) => at(g, [0, cy, 0], [tilt, 0, 0]));
  // Two legs just behind the board, a third one propping it from the back, and the ledge in front.
  const top = cy + h / 2 + 0.12;
  const legs = [
    at(leg(0.035, top), [0.38 * w, top / 2, -0.07], [tilt, 0, 0.05]),
    at(leg(0.035, top), [-0.38 * w, top / 2, -0.07], [tilt, 0, -0.05]),
    at(leg(0.032, top * 0.95), [0, top * 0.46, -0.42], [0.32, 0, 0]),
    at(box(w * 0.92, 0.06, 0.16, 0.025), [0, bottom - 0.02, 0.1]),
  ];
  const group = assemble([[plaster, [...board, ...legs]]]);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  );
  screen.position.set(0, cy, 0.012);
  screen.rotation.x = tilt;
  group.add(screen);
  group.userData.radius = Math.max(0.6, w / 2 + 0.1);
  return { group, screen };
}

// A lamp: base, slightly curved stem, a cup with a ring and a moon on top.
// userData.light goes from 0 (off) to 1 (on); tap() switches, set(on) chooses.
export function createLamp() {
  const curve = (y) => 0.13 * (y / 3) ** 2;
  const stem = bend(lathe([
    [0, 0], [0.2, 0], [0.21, 0.03], [0.18, 0.1], [0.1, 0.16], [0.055, 0.25], [0.045, 0.6],
    [0.04, 1.3], [0.036, 2.1], [0.035, 2.65], [0.05, 2.85], [0.1, 2.96], [0.16, 3.02], [0.13, 3.06], [0, 3.06],
  ], 18, 20), curve);
  const ring = at(new THREE.TorusGeometry(0.2, 0.026, 8, 32), [curve(3.04), 3.04, 0], [Math.PI / 2, 0, 0]);
  const group = assemble([[plaster, [stem, ring]]]);

  const moonMaterial = new THREE.MeshLambertMaterial({ color: palette.plaster, emissive: '#fff6e4' });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.225, 32, 20), moonMaterial);
  moon.position.set(curve(3.25), 3.25, 0);
  group.add(moon);

  const off = new THREE.Color('#a9bdd6'), on = new THREE.Color(palette.plaster);
  let target = 1;
  const show = (light) => {
    group.userData.light = light;
    moonMaterial.color.lerpColors(off, on, light);
    moonMaterial.emissiveIntensity = 0.85 * light;
    moon.scale.setScalar(1 + 0.08 * light);
  };
  show(1);
  Object.assign(group.userData, {
    radius: 0.3,
    tap: () => { target = 1 - target; },
    set: (state) => { target = state ? 1 : 0; },
    update: (dt) => {
      const light = group.userData.light;
      if (light !== target) show(Math.abs(target - light) < 0.01 ? target : light + (target - light) * (1 - Math.exp(-6 * dt)));
    },
  });
  return group;
}

// A cloud of fused puffs, bottom at y = 0; size is its width in metres. tap() makes it bounce.
export function createCloud(seed = 1, size = 3) {
  const group = assemble([[plaster, cloudPuffs(seed, size)]]);
  const body = group.children[0];
  let lift = 0, liftSpeed = 0;
  Object.assign(group.userData, {
    radius: size * 0.45,
    tap: () => { liftSpeed += 2.6; },
    update: (dt, time) => {
      liftSpeed += (-40 * lift - 3.2 * liftSpeed) * dt;
      lift += liftSpeed * dt;
      body.position.y = size * (lift * 0.25 + 0.015 * Math.sin(time * 0.7 + seed));
      body.scale.set(1 - lift * 0.08, 1 + lift * 0.12, 1 - lift * 0.08);
    },
  });
  return group;
}

// The bench as a sofa: two soft sides down to the ground, seat and back between them.
export function benchParts(segments = 3) {
  return [
    at(box(0.26, 0.74, 0.66, 0.11, segments), [0.86, 0.37, 0]),
    at(box(0.26, 0.74, 0.66, 0.11, segments), [-0.86, 0.37, 0]),
    at(box(1.6, 0.17, 0.6, 0.07, segments), [0, 0.46, 0.02]),
    at(box(1.66, 0.6, 0.18, 0.08, segments), [0, 0.8, -0.24], [-0.16, 0, 0]),
  ];
}

export function createBench() {
  const group = assemble([[plaster, benchParts()]]);
  group.userData.radius = 1.05;
  return group;
}

// A tree with a ball crown on a trunk curved like an S.
export function createTree() {
  const trunk = bend(lathe([
    [0, 0], [0.22, 0], [0.17, 0.05], [0.11, 0.17], [0.085, 0.42], [0.075, 0.85],
    [0.08, 1.25], [0.095, 1.55], [0.12, 1.8], [0, 1.92],
  ], 24), (y) => 0.13 * Math.sin((y / 1.8) * Math.PI));
  const crown = at(new THREE.SphereGeometry(0.95, 40, 26), [0, 2.6, 0]);
  const group = assemble([[plaster, [trunk, crown]]]);
  group.userData.radius = 0.9;
  return group;
}

// A swing hanging from a cloud. tap() pushes it; the seat swings like a pendulum and slows down.
export function createSwing() {
  const pivot = 3.0, length = 2.45;
  const cloud = new THREE.Mesh(fuse(cloudPuffs(7, 2.0, 32, 18)), plaster);
  cloud.position.y = pivot - 0.18;
  const rope = () => new THREE.CylinderGeometry(0.02, 0.02, length, 12, 1, true);
  const seat = new THREE.Mesh(fuse([
    at(rope(), [0.55, -length / 2, 0]),
    at(rope(), [-0.55, -length / 2, 0]),
    at(box(1.3, 0.09, 0.44, 0.04), [0, -length, 0]),
  ]), plaster);
  seat.position.y = pivot;
  const group = new THREE.Group();
  group.add(cloud, seat);

  let angle = 0, spin = 0;
  Object.assign(group.userData, {
    radius: 0.8,
    tap: () => { spin += 1.1; },
    update: (dt, time) => {
      dt = Math.min(dt, 0.05);
      spin += (-(9.8 / length) * Math.sin(angle) - 0.25 * spin) * dt;
      angle += spin * dt;
      seat.rotation.x = angle + 0.03 * Math.sin(time * 1.3);
      cloud.position.y = pivot - 0.18 + 0.03 * Math.sin(time * 0.8);
    },
  });
  return group;
}
