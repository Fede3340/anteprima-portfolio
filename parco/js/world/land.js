// Sky and ground. The ground is a sea of soft blue dunes running to the horizon, flat where the path,
// the pond and the sculptures are; its shader draws thin white lines on it, rings around the middle
// and around each sculpture, one or two pixels wide at any distance.
import * as THREE from 'three';
import { PATH_HALF } from './layout.js';

const RIPPLES = 6;
const MARKS = 16;
// Colours measured on the pictures of the sculptures: the dunes far away and near.
export const HAZE = '#6d98cf';
const DUNE = '#1e3f74';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Height of the ground at a point: flat by the path, the pond and the middle, dunes growing outwards.
export function heightAt(plan, x, z) {
  const r = Math.hypot(x, z);
  const fromPath = Math.abs(r - plan.radius);
  const flat = smooth(3, 13, fromPath) * smooth(plan.pond + 1, plan.pond + 9, r);
  const amount = 0.9 + Math.min(3, Math.max(0, r - plan.radius - 10) * 0.035);
  const waves = 0.55 * Math.sin(0.11 * x + 0.7) * Math.cos(0.09 * z)
    + 0.35 * Math.sin(0.05 * (x + z) + 1.3)
    + 0.25 * Math.sin(0.17 * x - 0.13 * z);
  return flat * amount * waves;
}

export function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#8cc6f3') }, horizon: { value: new THREE.Color('#a3d3f7') } },
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
        gl_FragColor = vec4(mix(horizon, top, smoothstep(0.0, 0.35, vDirection.y)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

// A disc of rings, close together near the park and further apart towards the horizon.
function groundGeometry(plan) {
  const radii = [0];
  for (let r = 0.8; r < plan.island + 6; r += 0.8) radii.push(r);
  for (let r = radii.at(-1), step = 0.8; r < 620; step *= 1.07) radii.push((r += step));
  const around = 320;
  const positions = [];
  const index = [];
  radii.forEach((r, ring) => {
    for (let i = 0; i < around; i++) {
      const a = (i / around) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      positions.push(x, heightAt(plan, x, z), z);
      if (!ring) continue;
      const here = ring * around + i;
      const next = ring * around + ((i + 1) % around);
      index.push(here - around, next, here, here - around, next - around, next);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

// marks: the points with rings of their own around them (the sculptures).
export function createGround(plan, marks) {
  const uniforms = {
    uTime: { value: 0 },
    uPath: { value: plan.radius },
    uPond: { value: plan.pond },
    uLine: { value: new THREE.Color('#e8f0fa') },
    uWay: { value: new THREE.Color('#3c6aa8') },
    uWater: { value: new THREE.Color('#5f8fcb') },
    uMarks: { value: Array.from({ length: MARKS }, (_, i) => new THREE.Vector2(...(marks[i] ?? [9999, 9999]))) },
    uRipples: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
  };
  const material = new THREE.MeshLambertMaterial({ color: DUNE });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGround;
        uniform float uTime, uPath, uPond;
        uniform vec3 uLine, uWay, uWater;
        uniform vec2 uMarks[${MARKS}];
        uniform vec4 uRipples[${RIPPLES}];
        // A line where d is zero, as wide on the screen as the given pixels at any distance and any
        // slope, with soft edges: drawn on the dunes, it follows them like a pen line.
        float edge(float distance, float change, float pixels) {
          return 1.0 - smoothstep(pixels * 0.5, pixels * 0.5 + 1.0, abs(distance) / max(change, 1e-5));
        }
        float line(float d, float pixels) {
          return edge(d, fwidth(d), pixels);
        }
        // Lines every 'gap' along a value, faded where they would crowd together. The change across a
        // pixel is read on the value itself, which has no jump where one line hands over to the next.
        float lines(float v, float gap, float pixels) {
          float change = fwidth(v);
          return edge((fract(v / gap + 0.5) - 0.5) * gap, change, pixels) * (1.0 - smoothstep(0.08, 0.3, change / gap));
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 at = vGround.xz;
        float r = length(at);
        float fw = fwidth(r);
        // Rings around the middle, wider apart going out; on the dunes they rise and fall with them.
        float drawn = lines(r, 1.6 + r * 0.03, 1.2);
        float near = 0.0;
        for (int i = 0; i < ${MARKS}; i++) {
          float d = distance(at, uMarks[i]);
          float fade = 1.0 - smoothstep(4.0, 9.0, d);
          if (fade > 0.0) near = max(near, lines(d, 0.55, 1.1) * fade * step(1.2, d));
        }
        drawn = max(drawn * (1.0 - near), near);
        float way = abs(r - uPath);
        // No ring runs inside the path: one under the feet would read as a stray line across the way.
        drawn *= smoothstep(${PATH_HALF.toFixed(2)}, ${PATH_HALF.toFixed(2)} + 0.8, way);
        vec3 colour = mix(diffuseColor.rgb, uLine, drawn * 0.7);
        colour = mix(colour, uWay, (1.0 - smoothstep(${PATH_HALF.toFixed(2)} - 0.4, ${PATH_HALF.toFixed(2)} + 0.3, way)) * 0.85);
        float water = 1.0 - smoothstep(uPond - fw, uPond + fw, r);
        float wave = lines(r - uTime * 0.25, 3.5, 1.4) * 0.5;
        for (int i = 0; i < ${RIPPLES}; i++) {
          float age = uTime - uRipples[i].z;
          wave += line(distance(at, uRipples[i].xy) - age * 3.2, 2.5) * max(0.0, 1.0 - age / 3.5);
        }
        colour = mix(colour, mix(uWater, uLine, clamp(wave, 0.0, 1.0) * 0.85), water);
        colour = mix(colour, uLine, line(r - uPond, 2.0));
        diffuseColor.rgb = colour;`);
  };
  const ground = new THREE.Mesh(groundGeometry(plan), material);
  ground.frustumCulled = false;

  let next = 0;
  return {
    ground,
    update(time) {
      uniforms.uTime.value = time;
    },
    // Rings start where the pond was touched.
    ripple(x, z) {
      uniforms.uRipples.value[next].set(x, z, uniforms.uTime.value, 0);
      next = (next + 1) % RIPPLES;
    },
    isPond: (x, z) => Math.hypot(x, z) < plan.pond,
  };
}
