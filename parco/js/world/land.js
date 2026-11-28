// Sky, the sea of clouds far below, the islands' ground and the stones of the paths between them. The
// ground of an island is a soft white floor, a little uneven, with a very fine felt; its rim and its
// underside are clouds (see park.js). The stones are thick round plaster discs hanging in the sky.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { instances } from './instances.js';
import { mouth } from './layout.js';

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
    depthFunc: THREE.LessEqualDepth,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#7fbdf1') }, horizon: { value: new THREE.Color(HAZE) } },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // On the far plane, drawn after everything else: only where nothing else is.
        gl_Position.z = gl_Position.w;
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
  sky.renderOrder = 10;
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

// The sea of clouds far below: white billows with patches of blue between them, drifting, over broad
// low swells, so that from above it is soft and not a flat sheet.
const SWELL = `
  float swell(vec2 p) {
    return (sin(p.x * 0.017 + 1.3) * cos(p.y * 0.014) * 0.6 + sin((p.x - p.y) * 0.009) * 0.4) * 9.0;
  }`;
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
      ${SWELL}
      void main() {
        vAt = position.xy;
        vec4 mvPosition = modelViewMatrix * vec4(position.xy, swell(position.xy), 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCloud, uGap;
      varying vec2 vAt;
      #include <fog_pars_fragment>
      ${NOISE}
      ${SWELL}
      void main() {
        vec2 at = vAt * 0.012 + vec2(uTime * 0.004, 0.0);
        float n = noise(at) * 0.6 + noise(at * 2.7) * 0.3 + noise(at * 7.0) * 0.1;
        float cloud = smoothstep(0.38, 0.62, n);
        // The swells lit from above and a little aside.
        float h = swell(vAt);
        vec3 normal = normalize(vec3(h - swell(vAt + vec2(4.0, 0.0)), 4.0, h - swell(vAt + vec2(0.0, 4.0))));
        float lit = mix(0.84, 1.04, clamp(dot(normal, normalize(vec3(-0.5, 1.0, 0.4))), 0.0, 1.0));
        gl_FragColor = vec4(mix(uGap, uCloud, cloud) * mix(0.86, 1.0, noise(at * 9.0)) * lit, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.RingGeometry(0, 1500, 96, 48), material);
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

// The way on each island, warmer and a little darker than the floor, the clearest line of the place:
// from where the path comes in to where one arrives, from there to where the next path leaves, and a
// few steps towards the works. Drawn once into a picture of the whole park seen from above (about
// 0.3 m a pixel), which the floor reads with one look-up.
const WAY_WIDTH = 1.5;
const WAY_COLOUR = new THREE.Color('#f4a982');
const WAY_PIXELS = 1024;
function ways(plan) {
  const segments = [];
  for (const island of plan.islands) {
    const here = island.arrival;
    segments.push([mouth(plan, island, island.in), here], [here, mouth(plan, island, island.out)]);
    if (island === plan.landing) segments.push([island.start, mouth(plan, island, island.out)]);
    const works = plan.works.filter((work) => work.island === island.index);
    if (works.length) {
      const x = works.reduce((sum, work) => sum + work.x, 0) / works.length;
      const z = works.reduce((sum, work) => sum + work.z, 0) / works.length;
      segments.push([here, { x: here.x + (x - here.x) * 0.6, z: here.z + (z - here.z) * 0.6 }]);
    }
  }
  const reach = Math.max(...plan.islands.map((island) => Math.hypot(island.centre.x, island.centre.z) + island.radius)) + 2;
  const scale = WAY_PIXELS / (2 * reach);
  const canvas = Object.assign(document.createElement('canvas'), { width: WAY_PIXELS, height: WAY_PIXELS });
  const pen = canvas.getContext('2d');
  Object.assign(pen, { strokeStyle: '#fff', lineCap: 'round', lineWidth: WAY_WIDTH * scale });
  for (const [a, b] of segments) {
    pen.beginPath();
    pen.moveTo((a.x + reach) * scale, (a.z + reach) * scale);
    pen.lineTo((b.x + reach) * scale, (b.z + reach) * scale);
    pen.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.flipY = false;
  return { map, box: new THREE.Vector3(-reach, -reach, 2 * reach) };
}

// way: 'floor' paints the ways on it, 'all' makes it all way (the stones). plain: without the felt,
// the billows of light, the shadows of the clouds and the rings, for slow machines.
function floorMaterial(uniforms, { way, plain = false } = {}) {
  const material = new THREE.MeshLambertMaterial({ color: '#f2f6fc', emissive: '#2f3e58' });
  material.customProgramCacheKey = () => `floor-${way}-${plain}`;
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
        uniform sampler2D uWayMap;
        uniform vec3 uWayBox, uWayColour;
        float onWay;
        ${NOISE}
        float line(float d, float pixels) {
          return 1.0 - smoothstep(pixels * 0.5, pixels * 0.5 + 1.0, abs(d) / max(fwidth(d), 1e-5));
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 at = vGround.xz;
        vec3 colour = diffuseColor.rgb;
        #ifndef PLAIN
        // A very fine felt, only where its grain is larger than a pixel; soft billows of light and shade.
        float felt = noise(at * 16.0) * 0.6 + noise(at * 45.0) * 0.4;
        float grain = 1.0 - smoothstep(0.03, 0.12, fwidth(at.x));
        colour *= (1.0 + (felt - 0.5) * 0.2 * grain) * mix(0.93, 1.04, noise(at * 0.35));
        // Shadows of the clouds going by.
        float cloud = noise(at * 0.045 + vec2(uTime * 0.015, uTime * 0.007));
        colour *= 1.0 - smoothstep(0.6, 0.74, cloud) * 0.16;
        #endif
        onWay = 0.0;
        #ifdef WAY_ALL
        onWay = 1.0;
        #elif defined(WAY_FLOOR)
        onWay = texture2D(uWayMap, (at - uWayBox.xy) / uWayBox.z).r;
        #endif
        #ifndef PLAIN
        // Rings spreading from where the visitor touched.
        float touched = 0.0;
        for (int i = 0; i < ${RIPPLES}; i++) {
          float age = uTime - uRipples[i].z;
          touched += line(distance(at, uRipples[i].xy) - age * 2.6, 2.5) * max(0.0, 1.0 - age / 2.2);
        }
        colour = mix(colour, uLine, clamp(touched, 0.0, 1.0) * 0.8);
        #endif
        diffuseColor.rgb = colour;`)
      // The way's warmth after the tones of the hour (grade.js), which would take it back to white.
      .replace('#include <tonemapping_fragment>', `// The way's colour at the floor's own lightness, a little darker.
        vec3 wayLuma = vec3(0.2126, 0.7152, 0.0722);
        vec3 wayColour = min(vec3(1.0), uWayColour * (0.9 * dot(gl_FragColor.rgb, wayLuma) / dot(uWayColour, wayLuma)));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, wayColour, onWay * 0.85);
        #include <tonemapping_fragment>`);
    const defines = { all: ['WAY_ALL'], floor: ['WAY_FLOOR'] }[way] ?? [];
    if (plain) defines.push('PLAIN');
    shader.fragmentShader = `${defines.map((name) => `#define ${name}\n`).join('')}${shader.fragmentShader}`;
  };
  return material;
}

// The stones of the given paths: thick round plaster discs with a soft edge, a little uneven.
export function createStones(paths, material = new THREE.MeshLambertMaterial({ color: '#edf2f9', emissive: '#6f82a3' })) {
  // From the foot up to the middle of the top, so that the faces look outwards.
  // Closed underneath, and light there too: a stone overhead is plaster, not a grey disc.
  // Thick and soft: a rounded belly under a flat top, as in the pictures.
  const profile = [[0, -0.24], [0.5, -0.22], [0.78, -0.16], [0.94, -0.07], [1, 0.01], [0.97, 0.065], [0.9, 0.085], [0, 0.085]].map(([x, y]) => new THREE.Vector2(x, y));
  const template = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), material);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const spots = paths.flatMap((path) => Array.from({ length: path.stones + 1 }, (_, i) => {
    const f = Math.abs(Math.sin((path.index * 31 + i) * 12.9898) * 43758.5453) % 1;
    const at = path.curve.getPointAt(i / path.stones);
    const size = 0.42 + f * 0.1;
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
  const way = ways(plan);
  const uniforms = {
    uTime: { value: 0 },
    uLine: { value: new THREE.Color('#9cb6db') },
    uRipples: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uWayMap: { value: way.map },
    uWayBox: { value: way.box },
    uWayColour: { value: WAY_COLOUR },
  };
  const material = floorMaterial(uniforms, { way: 'floor' });
  const floors = plan.islands.map((island) => {
    const floor = new THREE.Mesh(createFloor(plan, island), material);
    floor.userData.island = island;
    return floor;
  });
  const sea = createSea();
  // The stones of the paths wear the felt of the floor too.
  const plaster = floorMaterial(uniforms, { way: 'all' });
  plaster.color.set('#edf2f9');
  plaster.emissive.set('#6f82a3');
  const stones = createStones(plan.paths, plaster);
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
  // The light way: the floor in its plain colour with its way, the sea of clouds as one soft colour.
  const plain = { floor: floorMaterial(uniforms, { way: 'floor', plain: true }), sea: new THREE.MeshBasicMaterial({ color: '#c9dcf2' }), bodies: new THREE.MeshLambertMaterial({ color: '#f2f6fc', emissive: '#7487a8', vertexColors: true }), shape: shapes.light };
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
