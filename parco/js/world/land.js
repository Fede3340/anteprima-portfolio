// Sky, the sea of clouds far below, the islands' ground and the stones of the paths between them. The
// ground of an island is a soft white floor, a little uneven, with a very fine felt; its rim and its
// underside are clouds (see park.js). The stones are thick round plaster discs hanging in the sky.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/BufferGeometryUtils.js';
import { instances } from './instances.js';
import { MOODS, mouth } from './layout.js';

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

// The way on each island, a little darker than the floor, the clearest line of the place: peach from
// where one arrives to where the next path leaves and a few steps towards the works; in the island's
// own colour (MOODS) on its last stretch, from where the path comes in to where one arrives, like the
// stones of the path that brings one there. Worked out once into a picture of the whole park seen from
// above (about 0.3 m a pixel) holding, for each pixel, how far it is from the edge of the way and the
// colour of the nearest stretch; the floor reads it with one look-up and cuts a clean edge from it.
const WAY_WIDTH = 1.5;
const WAY_COLOUR = '#f4a982';
const WAY_PIXELS = 1024;
// Metres of distance from the edge across the whole of the picture's 0-255 range.
const WAY_RAMP = 1.2;
const accentOf = (island) => MOODS[island.id].accent;
function ways(plan) {
  const reach = Math.max(...plan.islands.map((island) => Math.hypot(island.centre.x, island.centre.z) + island.radius)) + 2;
  const metres = (2 * reach) / WAY_PIXELS;
  const data = new Uint8Array(WAY_PIXELS * WAY_PIXELS * 4);
  for (const island of plan.islands) {
    const here = island.arrival;
    // [from, to, colour], the island's own stretch last, so that it wins where they meet.
    const segments = [[here, mouth(plan, island, island.out), WAY_COLOUR]];
    if (island === plan.landing) segments.push([island.start, mouth(plan, island, island.out), WAY_COLOUR]);
    const works = plan.works.filter((work) => work.island === island.index);
    if (works.length) {
      const x = works.reduce((sum, work) => sum + work.x, 0) / works.length;
      const z = works.reduce((sum, work) => sum + work.z, 0) / works.length;
      segments.push([here, { x: here.x + (x - here.x) * 0.6, z: here.z + (z - here.z) * 0.6 }, WAY_COLOUR]);
    }
    segments.push([mouth(plan, island, island.in), here, accentOf(island)]);
    const rgb = segments.map(([, , hex]) => hex.slice(1).match(/../g).map((pair) => parseInt(pair, 16)));
    const from = (v) => Math.max(0, Math.floor((v - island.radius - 2 + reach) / metres));
    const to = (v) => Math.min(WAY_PIXELS - 1, Math.ceil((v + island.radius + 2 + reach) / metres));
    for (let row = from(island.centre.z); row <= to(island.centre.z); row++) {
      for (let column = from(island.centre.x); column <= to(island.centre.x); column++) {
        const px = (column + 0.5) * metres - reach;
        const pz = (row + 0.5) * metres - reach;
        let best = Infinity;
        let nearest = 0;
        segments.forEach(([a, b], k) => {
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const t = Math.min(1, Math.max(0, ((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz)));
          const d = Math.hypot(px - a.x - dx * t, pz - a.z - dz * t);
          if (d <= best) {
            best = d;
            nearest = k;
          }
        });
        const at = (row * WAY_PIXELS + column) * 4;
        const inside = Math.min(1, Math.max(0, 0.5 + (WAY_WIDTH / 2 - best) / WAY_RAMP));
        if (inside <= data[at + 3] / 255) continue;
        data.set([...rgb[nearest], Math.round(inside * 255)], at);
      }
    }
  }
  const map = new THREE.DataTexture(data, WAY_PIXELS, WAY_PIXELS);
  Object.assign(map, { colorSpace: THREE.SRGBColorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true, needsUpdate: true });
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
        uniform vec3 uWayBox;
        float onWay;
        vec3 wayHue;
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
        // A stone wears the colour of the island its path leads to (its instance colour), only here.
        onWay = 1.0;
        wayHue = vColor.rgb;
        colour /= max(vColor.rgb, vec3(0.01));
        #elif defined(WAY_FLOOR)
        vec4 wayAt = texture2D(uWayMap, (at - uWayBox.xy) / uWayBox.z);
        // A clean edge at every distance: the middle of the picture's soft edge, a pixel wide.
        float edge = max(fwidth(wayAt.a) * 0.75, 0.01);
        onWay = smoothstep(0.5 - edge, 0.5 + edge, wayAt.a);
        wayHue = wayAt.rgb;
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
        vec3 wayColour = min(vec3(1.0), wayHue * (0.9 * dot(gl_FragColor.rgb, wayLuma) / max(dot(wayHue, wayLuma), 0.01)));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, wayColour, onWay * 0.92);
        #include <tonemapping_fragment>`);
    const defines = { all: ['WAY_ALL'], floor: ['WAY_FLOOR'] }[way] ?? [];
    if (plain) defines.push('PLAIN');
    shader.fragmentShader = `${defines.map((name) => `#define ${name}\n`).join('')}${shader.fragmentShader}`;
  };
  return material;
}

// The stones of the given paths: thick round plaster discs with a soft edge, a little uneven.
// colourOf(path), if given: the colour of each path's stones.
export function createStones(paths, material = new THREE.MeshLambertMaterial({ color: '#edf2f9', emissive: '#6f82a3' }), colourOf) {
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
    return { x: at.x, z: at.z, path, matrix: new THREE.Matrix4().compose(at, q.setFromAxisAngle(up, f * 6.28), new THREE.Vector3(size, 1, size)) };
  }));
  const drawn = instances(template, spots, { slices: 16 });
  if (colourOf) {
    const colour = new THREE.Color();
    drawn.each(template, (mesh, slot, index) => mesh.setColorAt(slot, colour.set(colourOf(spots[index].path))));
  }
  return drawn.drawn;
}

// The white of the billows and the soft blue of their folds.
const FOLD = new THREE.Color('#a9bbdb');
const PUFF = new THREE.Color('#ffffff');

// The belly of every island and islet: a closed mass under its whole floor, so that nothing is seen
// through it from below. Just under the rim it is a thin lid; deeper down it draws in, behind the
// cut-out sheets of cloud that make the island's outline (park.js), to a round bottom in billows, white
// above and the soft blue of the folds below. [distance from the middle as a share of the radius,
// depth under the centre in metres, more depth as a share of the radius].
const BELLY = [[0.97, 0.7, 0], [0.82, 1.05, 0], [0.7, 1.6, 0], [0.6, 1.6, 0.15], [0.42, 1.6, 0.33], [0.2, 1.6, 0.42], [0, 1.6, 0.45]];
function createBellies(list, light) {
  const parts = list.map((island) => {
    const R = island.radius;
    const profile = BELLY.map(([r, metres, share]) => new THREE.Vector2(r * R, -(metres + share * R))).reverse();
    const belly = new THREE.LatheGeometry(profile, light ? 24 : 48);
    const position = belly.attributes.position;
    const colours = new Float32Array(position.count * 3);
    const tint = new THREE.Color();
    const seed = island.index * 1.7;
    for (let v = 0; v < position.count; v++) {
      const x = position.getX(v);
      const y = position.getY(v);
      const z = position.getZ(v);
      const u = x / R;
      const w = z / R;
      const down = Math.min(1, -y / (1.6 + 0.45 * R));
      // Round swellings over the surface, growing towards the bottom.
      const lump = Math.max(0, Math.sin(u * 7 + seed) * Math.sin(w * 6 + seed * 1.3)) * 0.6 + Math.max(0, Math.sin((u + w) * 11 + seed * 2) * Math.sin((u - w) * 9 - down * 5)) * 0.4;
      const grow = 1 + lump * 0.22 * down;
      position.setXYZ(v, island.centre.x + x * grow, island.centre.y + y - lump * down * R * 0.08, island.centre.z + z * grow);
      tint.copy(PUFF).lerp(FOLD, Math.min(1, down * 0.8 + (1 - lump) * 0.2 * down)).toArray(colours, v * 3);
    }
    belly.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    belly.deleteAttribute('uv');
    belly.deleteAttribute('normal');
    // One normal where the turns meet (the bottom point, the seam), not one per turn.
    const joined = mergeVertices(belly);
    joined.computeVertexNormals();
    return joined.toNonIndexed();
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
  const stones = createStones(plan.paths, plaster, (path) => accentOf(plan.islands[path.to]));
  // The bellies wear the felt of the floor; on the light way, plain and coarser.
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
  const all = [...plan.islands, ...plan.islets];
  const bodies = new THREE.Mesh(mergeGeometries([createBellies(all, false), ...tops]), felt);
  const shapes = { full: bodies.geometry, light: mergeGeometries([createBellies(all, true), ...tops]) };
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
