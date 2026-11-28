// The twelve zone sculptures, in plaster. createSymbol(id) returns a Group, origin on the ground, front towards +Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { deep, glow, night, plaster } from './materials.js';
import { benchParts } from './furniture.js';
import { assemble, at, cloudPuffs, fuse, lathe } from './shape.js';

const box = (w, h, d, r, segments = 2) => new RoundedBoxGeometry(w, h, d, segments, r);
const pole = (r, length) => new THREE.CapsuleGeometry(r, length - 2 * r, 6, 20);
const extrude = (shape, depth, bevel) => new THREE.ExtrudeGeometry(shape, {
  depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6,
});

// The pointer of a computer, tip at the origin, pointing up; units of one "pixel".
function cursorShape() {
  const shape = new THREE.Shape();
  [[0, -15], [3.6, -11.6], [6.2, -17.6], [8.6, -16.6], [6.1, -10.8], [11, -10.8]].forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(0, 0);
    shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

// The pointer standing up, depth in pixels; its centre of mass sits on x = 0, z = 0.
const cursor = (scale, depth = 1.6) => at(extrude(cursorShape(), depth, 0.3), [-4.3 * scale, 0, -depth * scale / 2], [0, 0, 0], [scale, scale, scale]);

const builders = {
  // The great pointer of the brand, 9 m, its tail sunk in the water.
  apertura: () => assemble([[plaster, [at(cursor(0.58, 1.8), [0, 15.6 * 0.58, 0])]]]),

  // A bench with a cloud sitting on it.
  chi: () => assemble([[plaster, [
    ...benchParts(2).map((g) => at(g, [0, 0, 0], [0, 0, 0], [1.8, 1.8, 1.8])),
    ...cloudPuffs(11, 1.7).map((g) => at(g, [0.1, 0.99, 0.05])),
  ]]]),

  // A post with three arrows pointing three ways.
  servizi: () => {
    const arrow = new THREE.Shape();
    [[1.0, 0], [0.62, 0.26], [0.62, 0.12], [-0.55, 0.12], [-0.55, -0.12], [0.62, -0.12], [0.62, -0.26]]
      .forEach(([x, y], i) => (i ? arrow.lineTo(x, y) : arrow.moveTo(x, y)));
    arrow.closePath();
    const sign = (y, turn) => at(extrude(arrow, 0.1, 0.04), [0, y, 0], [0, turn, 0], [1.3, 1.3, 1]);
    return assemble([[plaster, [
      at(pole(0.1, 3.5), [0, 1.75, 0]),
      lathe([[0, 0], [0.38, 0], [0.4, 0.05], [0.3, 0.16], [0.12, 0.26], [0, 0.3]], 32),
      at(new THREE.SphereGeometry(0.17, 32, 20), [0, 3.5, 0]),
      sign(3.0, -0.25), sign(2.45, Math.PI + 0.4), sign(1.9, 0.9),
    ]]]);
  },

  // A door with the night inside, and a small moon in it.
  siti: () => {
    const w = 1.7, h = 3.0, frame = 0.22;
    return assemble([
      [plaster, [
        at(box(frame, h + frame, 0.32, 0.07), [-(w + frame) / 2, (h + frame) / 2, 0]),
        at(box(frame, h + frame, 0.32, 0.07), [(w + frame) / 2, (h + frame) / 2, 0]),
        at(box(w + 2 * frame, frame, 0.32, 0.07), [0, h + frame / 2, 0]),
      ]],
      [night, [at(new THREE.BoxGeometry(w + 0.02, h, 0.06), [0, h / 2, -0.02])]],
      [glow, [at(new THREE.SphereGeometry(0.15, 32, 20), [0.42, 2.45, 0.04])]],
    ]);
  },

  // A shopping trolley carrying a parcel.
  negozi: () => {
    const side = new THREE.Shape();
    [[-1.1, 0.5], [1.15, 0.5], [0.95, -0.5], [-0.85, -0.5]].forEach(([x, y], i) => (i ? side.lineTo(x, y) : side.moveTo(x, y)));
    side.closePath();
    const wheel = (x, z) => at(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 32), [x, 0.2, z], [Math.PI / 2, 0, 0]);
    const s = 1.25;
    return assemble([
      [plaster, [
        at(extrude(side, 1.2, 0.08), [0, 1.2, -0.6]),
        at(pole(0.05, 0.75), [-0.75, 0.55, 0.45]), at(pole(0.05, 0.75), [0.75, 0.55, 0.45]),
        at(pole(0.05, 0.75), [-0.75, 0.55, -0.45]), at(pole(0.05, 0.75), [0.75, 0.55, -0.45]),
        wheel(-0.75, 0.45), wheel(0.75, 0.45), wheel(-0.75, -0.45), wheel(0.75, -0.45),
        at(pole(0.06, 0.8), [-1.35, 1.85, 0.45], [0, 0, 0.6]), at(pole(0.06, 0.8), [-1.35, 1.85, -0.45], [0, 0, 0.6]),
        at(pole(0.07, 1.25), [-1.58, 2.18, 0], [Math.PI / 2, 0, 0]),
        at(box(1.05, 0.8, 0.9, 0.12), [0.1, 2.15, 0], [0, 0.2, 0]),
      ]],
      [deep, [
        at(box(1.08, 0.82, 0.2, 0.05), [0.1, 2.16, 0], [0, 0.2, 0]),
        at(box(0.2, 0.83, 0.93, 0.05), [0.1, 2.16, 0], [0, 0.2, 0]),
      ]],
    ].map(([m, parts]) => [m, parts.map((g) => at(g, [0, 0, 0], [0, 0, 0], [s, s, s]))]));
  },

  // Three program windows, one behind the other, floating.
  programmi: () => {
    const spots = [[-0.55, 1.05, 0.6], [0.05, 1.7, 0], [0.65, 2.35, -0.6]];
    const group = assemble([
      [plaster, spots.map(([x, y, z]) => at(box(2.2, 1.6, 0.14, 0.07), [x, y, z]))],
      [night, spots.map(([x, y, z]) => at(box(1.96, 1.12, 0.06, 0.03), [x, y - 0.12, z + 0.06]))],
    ]);
    group.children.forEach((mesh) => { mesh.userData.floats = 0; });
    return groupFloating(group, 0.06);
  },

  // A phone standing up, screen and a few app tiles.
  app: () => {
    const tiles = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) tiles.push(at(box(0.42, 0.42, 0.06, 0.1), [col ? 0.3 : -0.3, 2.65 - row * 0.62, 0.15]));
    }
    return assemble([
      [plaster, [at(box(1.55, 3.1, 0.24, 0.22, 3), [0, 1.6, 0]), ...tiles, at(box(0.5, 0.08, 0.06, 0.035), [0, 0.42, 0.15])]],
      [night, [at(box(1.33, 2.75, 0.06, 0.1), [0, 1.62, 0.1])]],
    ].map(([m, parts]) => [m, parts.map((g) => at(g, [0, 0, 0], [-0.08, 0, 0]))]));
  },

  // A game controller held up in the air.
  videogioco: () => {
    const flat = [1, 1, 0.62];
    const plus = (x, y) => [at(box(0.42, 0.13, 0.1, 0.05), [x, y, 0.36]), at(box(0.13, 0.42, 0.1, 0.05), [x, y, 0.36])];
    const button = (x, y) => at(new THREE.CylinderGeometry(0.085, 0.085, 0.1, 24), [x, y, 0.36], [Math.PI / 2, 0, 0]);
    const group = assemble([
      [plaster, [
        at(new THREE.CapsuleGeometry(0.55, 1.2, 10, 32), [0, 0, 0], [0, 0, Math.PI / 2], flat),
        at(new THREE.CapsuleGeometry(0.4, 0.55, 10, 32), [-0.78, -0.42, 0], [0, 0, -0.55], flat),
        at(new THREE.CapsuleGeometry(0.4, 0.55, 10, 32), [0.78, -0.42, 0], [0, 0, 0.55], flat),
      ]],
      [deep, [...plus(-0.6, 0.04), button(0.5, 0.17), button(0.72, -0.03), button(0.5, -0.23), button(0.28, -0.03)]],
    ]);
    for (const mesh of group.children) {
      mesh.position.y = 2.3;
      mesh.rotation.x = -0.12;
      mesh.userData.floats = 0.01;
    }
    return groupFloating(group, 0.08, 1.1);
  },

  // A rubber stamp hanging in the air over the circle it printed.
  marchi: () => {
    // Base, waisted neck, then the ball handle drawn as an arc.
    const ball = [];
    for (let i = 0; i <= 12; i++) {
      const a = -1.05 + (i / 12) * (Math.PI / 2 + 1.05);
      ball.push([0.45 * Math.cos(a), 1.6 + 0.45 * Math.sin(a)]);
    }
    const stamp = lathe([
      [0, 0.1], [0.78, 0.1], [0.92, 0.02], [0.98, 0.08], [1.0, 0.45], [0.97, 0.53], [0.9, 0.57], [0.45, 0.62],
      [0.3, 0.72], [0.24, 0.88], [0.22, 1.02], ...ball,
    ], 48);
    const group = assemble([
      [plaster, [at(stamp, [0, 1.6, 0])]],
      [deep, [at(new THREE.CylinderGeometry(0.8, 0.8, 0.04, 48), [0, 1.69, 0])]],
    ]);
    group.children.forEach((mesh) => { mesh.userData.floats = 0.4; });
    // The printed circle stays on the ground.
    group.add(new THREE.Mesh(fuse([at(new THREE.TorusGeometry(0.95, 0.09, 10, 64), [0, 0.03, 0], [Math.PI / 2, 0, 0], [1, 1, 0.4])]), plaster));
    return groupFloating(group, 0.12, 0.8);
  },

  // A billboard on two posts.
  manifesti: () => assemble([
    [plaster, [
      at(pole(0.1, 3.7), [-1.05, 1.85, -0.05]), at(pole(0.1, 3.7), [1.05, 1.85, -0.05]),
      at(box(3.3, 2.05, 0.2, 0.09), [0, 2.55, 0.06]),
      at(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 48), [0.55, 2.8, 0.19], [Math.PI / 2, 0, 0]),
    ]],
    [deep, [at(box(3.06, 1.8, 0.06, 0.04), [0, 2.55, 0.15])]],
  ]),

  // A tower of slabs with a small pointer on its top.
  google: () => {
    const slabs = [];
    for (let i = 0; i < 18; i++) slabs.push(at(box(i % 2 ? 0.86 : 0.96, 0.14, i % 2 ? 0.86 : 0.96, 0.04, 1), [0, 0.07 + i * 0.17, 0]));
    slabs.push(at(box(1.3, 0.16, 1.3, 0.05, 1), [0, 3.1, 0]));
    slabs.push(at(cursor(0.034, 2), [0, 3.18 + 17.6 * 0.034 - 2.6 * 0.034, 0]));
    return assemble([[plaster, slabs]]);
  },

  // A paper plane, gliding.
  contatti: () => {
    const nose = [1.7, 0.05, 0], tail = [-1.4, 0.05, 0];
    const wingL = [-1.5, 0.42, 1.1], wingR = [-1.5, 0.42, -1.1], keel = [-1.35, -0.45, 0];
    const faces = [[nose, tail, wingL], [nose, wingR, tail], [nose, keel, tail]];
    const points = [];
    for (const [a, b, c] of faces) points.push(...a, ...b, ...c, ...a, ...c, ...b); // both sides
    const paper = new THREE.BufferGeometry();
    paper.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    paper.computeVertexNormals();
    const group = assemble([[plaster, [at(paper, [0, 0, 0], [0, -0.6, 0.12])]]]);
    const plane = group.children[0];
    plane.position.y = 2.4;
    group.userData.update = (dt, time) => {
      plane.position.y = 2.4 + 0.15 * Math.sin(time * 0.9);
      plane.rotation.x = 0.08 * Math.sin(time * 0.7);
      plane.rotation.z = 0.06 * Math.sin(time * 0.9 + 1);
    };
    return group;
  },
};

// A group whose marked meshes bob together, each from its own base height.
function groupFloating(group, amount, speed = 0.9) {
  const base = group.children.map((mesh) => mesh.position.y);
  group.userData.update = (dt, time) => group.children.forEach((mesh, i) => {
    if (mesh.userData.floats !== undefined) mesh.position.y = base[i] + amount * Math.sin(time * speed + mesh.userData.floats);
  });
  return group;
}

const radius = { apertura: 3.2, chi: 1.9, servizi: 1.2, siti: 1.3, negozi: 1.9, programmi: 1.7, app: 1.0, videogioco: 1.6, marchi: 1.1, manifesti: 1.8, google: 0.8, contatti: 1.6 };

export const symbolIds = Object.keys(builders);

export function createSymbol(id) {
  const build = builders[id];
  if (!build) throw new Error(`Unknown symbol: ${id}`);
  const group = build();
  group.userData.radius = radius[id];
  group.userData.id = id;
  return group;
}
