// The walker: a plaster figure 1.1 m tall with a pear body, round shoes, its head inside a cloud
// half again as wide as the body, and a blue scarf that the wind of the sky lifts when it moves.
import * as THREE from 'three';
import { palette, plaster } from './materials.js';
import { at, flatten, fuse, lathe } from './shape.js';

const HIP = 0.2; // hip height, also the leg length
const SHOULDER = 0.36; // above the hip
const NECK = 0.53; // above the hip, where the scarf is tied
const HEAD = 0.665; // centre of the cloud, above the hip
const GRAVITY = 9.8;
const JUMP_SPEED = 3.4; // about 0.6 m high, 0.7 s in the air
const TAIL = 16; // segments of the scarf's loose end
const TAIL_LENGTH = 0.42;

const body = () => lathe([
  [0, -0.05], [0.08, -0.045], [0.13, -0.02], [0.158, 0.03], [0.165, 0.09], [0.155, 0.15],
  [0.13, 0.22], [0.105, 0.3], [0.085, 0.38], [0.072, 0.46], [0.058, 0.55], [0, 0.6],
], 36, 19);

// Leg hanging from the hip pivot, ending in a round shoe that points forward.
const leg = () => fuse([
  at(new THREE.CapsuleGeometry(0.05, 0.1, 5, 16), [0, -0.09, 0]),
  at(new THREE.SphereGeometry(0.07, 20, 12), [0, -HIP + 0.045, 0.03], [0, 0, 0], [1, 0.65, 1.35]),
]);

const arm = () => at(new THREE.CapsuleGeometry(0.045, 0.17, 4, 14), [0, -0.13, 0]);

// A cumulus: a tall middle puff, one each side, one behind; flat underneath.
const head = () => fuse([
  [0, 0.06, 0, 0.175], [-0.15, -0.01, 0.01, 0.115], [0.15, 0, 0, 0.12], [0, 0.02, -0.1, 0.14],
].map(([x, y, z, r]) => flatten(at(new THREE.SphereGeometry(r, 32, 20), [x, y, z]), -0.08, 0.3)));

const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

// The scarf: a ring round the neck and a ribbon whose points are moved every frame.
function scarf(material) {
  const ring = new THREE.Mesh(at(new THREE.TorusGeometry(0.068, 0.028, 8, 32), [0, 0, 0], [Math.PI / 2, 0, 0]), material);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((TAIL + 1) * 2 * 3), 3));
  const index = [];
  for (let i = 0; i < TAIL; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  geometry.setIndex(index);
  const tail = new THREE.Mesh(geometry, material);
  tail.frustumCulled = false;

  // wind 0: hangs down the back; wind 1: streams out behind, flaps and twists,
  // so it shows its face from behind and from the side.
  function blow(wind, time) {
    const p = geometry.getAttribute('position');
    let x = 0, y = 0, z = -0.075;
    const step = TAIL_LENGTH / TAIL, flap = 7 + 9 * wind;
    for (let i = 0; i <= TAIL; i++) {
      const s = i / TAIL;
      const half = 0.05 * (1 - 0.25 * s);
      const angle = 0.3 + 0.12 * s + 1.15 * wind + wind * 0.32 * s * Math.sin(i * 0.9 - time * flap);
      const twist = wind * (1.1 * s + 0.35 * Math.sin(i * 0.6 - time * flap * 0.7));
      const sway = wind * 0.04 * s * Math.sin(i * 0.7 - time * flap * 0.8);
      // Across the ribbon: sideways, turned by the twist around the ribbon's own direction.
      const ax = Math.cos(twist) * half, ay = -Math.sin(angle) * Math.sin(twist) * half, az = Math.cos(angle) * Math.sin(twist) * half;
      p.setXYZ(i * 2, x + sway - ax, y - ay, z - az);
      p.setXYZ(i * 2 + 1, x + sway + ax, y + ay, z + az);
      // In the wind it also drifts off one shoulder, so it reads from straight behind.
      x += step * Math.sin(angle) * 0.6 * wind;
      y -= step * Math.cos(angle);
      z -= step * Math.sin(angle) * (1 - 0.2 * wind);
    }
    p.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  return { ring, tail, blow };
}

export function createWalker() {
  const group = new THREE.Group();
  const rig = new THREE.Group(); // bounces, leans, squashes; scales from the ground
  const torso = new THREE.Group(); // turns towards what the walker looks at
  torso.position.y = HIP;
  group.add(rig);
  rig.add(torso);

  const mesh = (geometry, parent, x, y) => {
    const m = new THREE.Mesh(geometry, plaster);
    m.position.set(x, y, 0);
    parent.add(m);
    return m;
  };
  const trunk = mesh(body(), torso, 0, 0);
  const cloud = mesh(head(), torso, 0, HEAD);
  const legL = mesh(leg(), rig, 0.07, HIP);
  const legR = mesh(leg(), rig, -0.07, HIP);
  const armL = mesh(arm(), torso, 0.12, SHOULDER);
  const armR = mesh(arm(), torso, -0.12, SHOULDER);
  const wrap = scarf(new THREE.MeshLambertMaterial({ color: palette.deep, side: THREE.DoubleSide }));
  wrap.ring.position.y = NECK;
  wrap.tail.position.y = NECK;
  torso.add(wrap.ring, wrap.tail);

  let time = 0, phase = 0, pace = 0, look = 0, lookTarget = 0, wind = 0;
  let height = 0, rise = 0, airborne = false, squash = 0, squashSpeed = 0, air = 0;

  function update(dt, speed = 0) {
    dt = Math.min(dt, 0.05);
    time += dt;
    pace += (Math.abs(speed) - pace) * ease(10, dt);
    const run = smooth(pace, 1, 9); // 0 walking, 1 running
    const walking = smooth(pace, 0.05, 0.6); // 0 standing, 1 moving

    // Swing amplitude and stride grow with speed; the phase follows the distance covered,
    // so at contact the foot moves back exactly as fast as the body moves on: no sliding.
    const swing = 0.45 + 0.45 * run;
    const stride = 2 * Math.PI * HIP * swing * (1 + 1.6 * run);
    phase += (speed * dt / stride) * 2 * Math.PI;
    const s = Math.sin(phase);

    legL.rotation.x = walking * swing * s;
    legR.rotation.x = -walking * swing * s;
    const armSwing = walking * (0.75 + 0.35 * run) * s;
    armL.rotation.x = -armSwing;
    armR.rotation.x = armSwing;
    const spread = 0.2 + 0.15 * run + 1.2 * air;
    armL.rotation.z = spread;
    armR.rotation.z = -spread;

    // Jump: plain gravity, then a spring that squashes on landing and settles.
    if (airborne) {
      rise -= GRAVITY * dt;
      height += rise * dt;
      if (height <= 0) {
        height = 0;
        airborne = false;
        squashSpeed = rise * 0.28;
        rise = 0;
      }
    }
    squashSpeed += (-320 * squash - 16 * squashSpeed) * dt;
    squash += squashSpeed * dt;
    air += ((airborne ? 1 : 0) - air) * ease(14, dt);

    // Walking: highest at mid-stance; running: highest in flight.
    const bob = walking * (0.012 + 0.045 * run) * (0.5 + 0.5 * Math.cos(2 * phase + Math.PI * run));
    rig.position.y = height + bob;
    rig.rotation.x = walking * (0.05 + 0.15 * run) * Math.sign(speed);
    const stretch = 1 + squash + (airborne ? 0.08 * Math.max(-1, Math.min(1, rise / JUMP_SPEED)) : 0);
    rig.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));

    // Standing: the body breathes and the cloud floats; moving: the body sways with the steps.
    const breath = (1 - walking) * 0.025 * Math.sin(time * 2.2);
    trunk.scale.set(1 - breath / 2, 1 + breath, 1 - breath / 2);
    look += (lookTarget - look) * ease(5, dt);
    torso.rotation.y = look * 0.35 + walking * 0.08 * s;
    torso.rotation.z = walking * 0.05 * s;
    cloud.rotation.y = look * 0.65;
    cloud.rotation.z = -look * 0.12 + 0.05 * Math.sin(time * 1.1);
    cloud.position.y = HEAD + 0.018 * Math.sin(time * 1.6) + 0.02 * air;

    // The scarf hangs still when standing, streams out when running or in the air.
    wind += (Math.max(smooth(pace, 0.1, 4), air * 0.7) - wind) * ease(4, dt);
    wrap.blow(wind, time);
  }

  // Angle in radians around Y, like rotation.y, relative to where the walker faces (0 = ahead).
  function lookAt(angle) {
    lookTarget = Math.max(-1.2, Math.min(1.2, angle));
  }

  function jump() {
    if (airborne) return;
    airborne = true;
    rise = JUMP_SPEED;
  }

  group.userData.radius = 0.3;
  update(0, 0);
  return { group, update, look: lookAt, jump };
}
