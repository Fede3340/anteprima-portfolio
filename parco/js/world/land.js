// Sky, the sea of clouds far below, the islands' ground and the stones of the paths between them. The
// ground of an island is a soft white floor, a little uneven, with a very fine felt; its rim and its
// underside are clouds (see park.js). The stones are thick round plaster discs hanging in the sky.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { instances } from './instances.js';

// The haze far away, light blue, and the sea of clouds under it.
export const HAZE = '#cfe3f6';
const RIPPLES = 6;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The island under a point, if any.
export function islandAt(plan, x, z) {
  return plan.islands.find((island) => Math.hypot(x - island.centre.x, z - island.centre.z) < island.radius);
}

// Low soft billows of the cloud floor.
const bump = (x, z) => 0.5 * Math.sin(x * 0.42 + 1.3) * Math.cos(z * 0.36) + 0.22 * Math.sin(x * 0.9 + z * 0.75) + 0.08 * Math.cos(x * 2.1 - z * 1.7);

// The height of the floor of an island or islet at a point (by default the nearest): a little uneven,
// curving down at the rim; around a pond it levels into a low rim and sinks under the water.
export function heightAt(plan, x, z, island = islandAt(plan, x, z) ?? [...plan.islands, ...plan.islets].reduce((a, b) => (Math.hypot(x - a.centre.x, z - a.centre.z) < Math.hypot(x - b.centre.x, z - b.centre.z) ? a : b))) {
  const r = Math.hypot(x - island.centre.x, z - island.centre.z);
  const edge = Math.max(0, r - (island.radius - 2));
  const y = island.centre.y + bump(x, z) * (1 - smooth(island.radius - 3, island.radius, r)) - edge * edge * 0.25;
  const pond = plan.ponds.find((each) => each.island === island);
  if (!pond) return y;
  const d = Math.hypot(x - pond.x, z - pond.z);
  const bowl = pond.level + 0.14 - 0.55 * (1 - smooth(pond.r - 0.7, pond.r + 0.2, d));
  return y + (bowl - y) * (1 - smooth(pond.r + 0.4, pond.r + 2.6, d));
}

export function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#7fbdf1') }, horizon: { value: new THREE.Color(HAZE) } },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      varying vec3 vDirection;
      void main() {
        gl_FragColor = vec4(mix(horizon, top, smoothstep(-0.05, 0.4, vDirection.y)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

const NOISE = `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

// The sea of clouds far below: white billows with patches of blue between them, drifting.
function createSea() {
  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 },
      uCloud: { value: new THREE.Color('#f4f8fd') },
      uGap: { value: new THREE.Color('#5f93d3') },
    }]),
    vertexShader: `
      varying vec2 vAt;
      #include <fog_pars_vertex>
      void main() {
        vAt = position.xy;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCloud, uGap;
      varying vec2 vAt;
      #include <fog_pars_fragment>
      ${NOISE}
      void main() {
        vec2 at = vAt * 0.012 + vec2(uTime * 0.004, 0.0);
        float n = noise(at) * 0.6 + noise(at * 2.7) * 0.3 + noise(at * 7.0) * 0.1;
        float cloud = smoothstep(0.38, 0.62, n);
        gl_FragColor = vec4(mix(uGap, uCloud, cloud) * mix(0.86, 1.0, noise(at * 9.0)), 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(1500, 64), material);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -95;
  return sea;
}

// The floor of an island, as a disc of rings so that the rim can curve down.
function createFloor(plan, island) {
  const positions = [];
  const index = [];
  // Finer where a pond sinks into the floor; coarser on the small islets.
  const rings = Math.round(island.radius * (plan.ponds.some((pond) => pond.island === island) ? 2.1 : 1.4));
  const around = island.radius > 8 ? 96 : 48;
  for (let ring = 0; ring <= rings; ring++) {
    const r = (ring / rings) * island.radius;
    for (let i = 0; i < around; i++) {
      const a = (i / around) * Math.PI * 2;
      const x = island.centre.x + Math.cos(a) * r;
      const z = island.centre.z + Math.sin(a) * r;
      positions.push(x, heightAt(plan, x, z, island), z);
      if (!ring) continue;
      const here = ring * around + i;
      const next = ring * around + ((i + 1) % around);
      index.push(here - around, next, here, here - around, next - around, next);
    }
  }
  const floor = new THREE.BufferGeometry();
  floor.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  floor.setIndex(index);
  floor.computeVertexNormals();
  return floor;
}

function floorMaterial(uniforms) {
  const material = new THREE.MeshLambertMaterial({ color: '#f2f6fc', emissive: '#2f3e58' });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGround;
        uniform float uTime;
        uniform vec3 uLine;
        uniform vec4 uRipples[${RIPPLES}];
        ${NOISE}
        float line(float d, float pixels) {
          return 1.0 - smoothstep(pixels * 0.5, pixels * 0.5 + 1.0, abs(d) / max(fwidth(d), 1e-5));
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 at = vGround.xz;
        // A very fine felt, only where its grain is larger than a pixel; soft billows of light and shade.
        float felt = noise(at * 16.0) * 0.6 + noise(at * 45.0) * 0.4;
        float grain = 1.0 - smoothstep(0.015, 0.06, fwidth(at.x));
        vec3 colour = diffuseColor.rgb * (1.0 + (felt - 0.5) * 0.08 * grain) * mix(0.93, 1.04, noise(at * 0.35));
        // Shadows of the clouds going by.
        float cloud = noise(at * 0.045 + vec2(uTime * 0.015, uTime * 0.007));
        colour *= 1.0 - smoothstep(0.6, 0.74, cloud) * 0.16;
        // Rings spreading from where the visitor touched.
        float touched = 0.0;
        for (int i = 0; i < ${RIPPLES}; i++) {
          float age = uTime - uRipples[i].z;
          touched += line(distance(at, uRipples[i].xy) - age * 2.6, 2.5) * max(0.0, 1.0 - age / 2.2);
        }
        diffuseColor.rgb = mix(colour, uLine, clamp(touched, 0.0, 1.0) * 0.8);`);
  };
  return material;
}

// The stones of the given paths: thick round plaster discs with a soft edge, a little uneven.
export function createStones(paths) {
  // From the foot up to the middle of the top, so that the faces look outwards.
  // Closed underneath, and light there too: a stone overhead is plaster, not a grey disc.
  // Thick and soft: a rounded belly under a flat top, as in the pictures.
  const profile = [[0, -0.24], [0.5, -0.22], [0.78, -0.16], [0.94, -0.07], [1, 0.01], [0.97, 0.065], [0.9, 0.085], [0, 0.085]].map(([x, y]) => new THREE.Vector2(x, y));
  const template = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), new THREE.MeshLambertMaterial({ color: '#edf2f9', emissive: '#6f82a3' }));
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const spots = paths.flatMap((path) => Array.from({ length: path.stones + 1 }, (_, i) => {
    const f = Math.abs(Math.sin((path.index * 31 + i) * 12.9898) * 43758.5453) % 1;
    const at = path.curve.getPointAt(i / path.stones);
    const size = 0.5 + f * 0.14;
    return { x: at.x, z: at.z, matrix: new THREE.Matrix4().compose(at, q.setFromAxisAngle(up, f * 6.28), new THREE.Vector3(size, 1, size)) };
  }));
  return instances(template, spots, { slices: 16 }).drawn;
}

// The core of every island: a few round billows under the floor, merged in one mesh, so that from
// below one does not see through it. What is seen of the island are the cut-out clouds around and under
// it (park.js), so the billows stay few and plain; the islets, never seen from below, have none. Where a billow sinks into another its
// colour goes to the soft blue of the folds. light: fewer and coarser billows, for slow machines.
const FOLD = new THREE.Color('#a9bbdb');
const PUFF = new THREE.Color('#ffffff');

function createBodies(list, light) {
  const balls = [];
  for (const island of list) {
    const R = island.radius;
    const c = island.centre;
    const seed = (n) => Math.abs(Math.sin((island.index * 131 + n) * 12.9898) * 43758.5453) % 1;
    let n = 0;
    // Rings from under the floor down, well inside the cut-out billows that make the outline:
    // radius from the middle, size of the billows, their top's depth.
    const rings = [[R * 0.35, R * 0.17, 1.4], [0, R * 0.2, R * 0.22]];
    for (const [r, size, top] of rings) {
      const count = r ? Math.max(4, Math.round((2 * Math.PI * r) / (size * (light ? 1.7 : 1.2)))) : 1;
      for (let i = 0; i < count; i++, n++) {
        const a = ((i + seed(n) * 0.5) / count) * Math.PI * 2;
        const s = size * (0.85 + seed(n + 500) * 0.3);
        balls.push({ x: c.x + Math.cos(a) * r, y: c.y - top - s * 0.8, z: c.z + Math.sin(a) * r, r: s, squash: 0.8, detail: light || top > 1 ? 1 : 2 });
      }
    }
  }
  const shapes = [1, 2].map((detail) => {
    const ball = new THREE.IcosahedronGeometry(1, detail);
    // Round, not faceted: on a unit ball the normal is the point itself.
    ball.setAttribute('normal', ball.attributes.position.clone());
    ball.deleteAttribute('uv');
    return ball;
  });
  const near = balls.map((ball) => balls.filter((other) => other !== ball && Math.hypot(other.x - ball.x, other.y - ball.y, other.z - ball.z) < ball.r + other.r));
  const p = new THREE.Vector3();
  const tint = new THREE.Color();
  const parts = balls.map((ball, index) => {
    const geometry = shapes[ball.detail - 1].clone().scale(ball.r, ball.r * ball.squash, ball.r).translate(ball.x, ball.y, ball.z);
    const position = geometry.attributes.position;
    const colours = new Float32Array(position.count * 3);
    for (let v = 0; v < position.count; v++) {
      p.fromBufferAttribute(position, v);
      // How far into the fold with a neighbour this point of the surface is.
      let fold = 0;
      for (const other of near[index]) {
        const inside = Math.hypot(p.x - other.x, (p.y - other.y) / other.squash, p.z - other.z) / other.r;
        fold = Math.max(fold, 1 - Math.min(1, (inside - 1) / 0.35));
      }
      tint.copy(PUFF).lerp(FOLD, fold * 0.85).toArray(colours, v * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return geometry;
  });
  return mergeGeometries(parts);
}

export function createGround(plan) {
  const uniforms = {
    uTime: { value: 0 },
    uLine: { value: new THREE.Color('#9cb6db') },
    uRipples: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
  };
  const material = floorMaterial(uniforms);
  const floors = plan.islands.map((island) => {
    const floor = new THREE.Mesh(createFloor(plan, island), material);
    floor.userData.island = island;
    return floor;
  });
  const sea = createSea();
  const stones = createStones(plan.paths);
  // The billows wear the felt of the floor; on the light way, plain and fewer.
  // Lit a little from within, as cloud is, so that from below it stays white and not grey.
  const felt = floorMaterial(uniforms);
  felt.vertexColors = true;
  felt.emissive.set('#7487a8');
  // The islets' floors go with the bodies: seen, never walked on nor touched.
  const tops = plan.islets.map((islet) => {
    const top = createFloor(plan, islet).toNonIndexed();
    top.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(top.attributes.position.count * 3).fill(1), 3));
    return top;
  });
  const bodies = new THREE.Mesh(mergeGeometries([createBodies(plan.islands, false), ...tops]), felt);
  const shapes = { full: bodies.geometry, light: mergeGeometries([createBodies(plan.islands, true), ...tops]) };
  // The light way: the floor in its plain colour, the sea of clouds as one soft colour, nothing
  // worked out pixel by pixel.
  const plain = { floor: new THREE.MeshLambertMaterial({ color: '#f2f6fc', emissive: '#2f3e58' }), sea: new THREE.MeshBasicMaterial({ color: '#c9dcf2' }), bodies: new THREE.MeshLambertMaterial({ color: '#f2f6fc', emissive: '#7487a8', vertexColors: true }), shape: shapes.light };
  const full = { floor: material, sea: sea.material, bodies: felt, shape: shapes.full };
  let next = 0;
  return {
    floors,
    // The floor's own material (all floors share it), for whoever sets the light.
    floor: material,
    stones,
    sea,
    bodies,
    light(on) {
      const use = on ? plain : full;
      for (const floor of floors) floor.material = use.floor;
      sea.material = use.sea;
      bodies.material = use.bodies;
      bodies.geometry = use.shape;
    },
    update(time) {
      uniforms.uTime.value = time;
      full.sea.uniforms.uTime.value = time;
    },
    // Rings start where the ground was touched.
    ripple(x, z) {
      uniforms.uRipples.value[next].set(x, z, uniforms.uTime.value, 0);
      next = (next + 1) % RIPPLES;
    },
  };
}
