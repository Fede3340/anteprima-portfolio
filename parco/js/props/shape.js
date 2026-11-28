// Small helpers shared by the props: place, fuse and group geometries.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

// Moves, rotates (radians, XYZ) and scales a geometry in place; returns it.
export function at(geometry, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  m.compose(v.set(...pos), q.setFromEuler(e.set(...rot)), s.set(...scale));
  return geometry.applyMatrix4(m);
}

// One geometry out of many, with only position and normal, so any mix can be merged.
export function fuse(parts) {
  const clean = parts.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', flat.getAttribute('position'));
    out.setAttribute('normal', flat.getAttribute('normal'));
    return out;
  });
  const merged = mergeGeometries(clean);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

// A group with one mesh per material: { material: [geometries] }.
export function assemble(byMaterial) {
  const group = new THREE.Group();
  for (const [material, parts] of byMaterial) {
    if (parts.length) group.add(new THREE.Mesh(fuse(parts), material));
  }
  return group;
}

// A turned profile: points are [radius, y], from bottom to top. With samples, the profile
// is drawn as a smooth curve through the points instead of straight lines between them.
export function lathe(points, segments = 16, samples = 0) {
  const profile = points.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(samples ? new THREE.SplineCurve(profile).getPoints(samples) : profile, segments);
}

// Shifts every vertex sideways by bend(y): a gentle curve for stems and trunks.
// Normals are kept: the curves are soft enough that the light does not notice.
export function bend(geometry, fn) {
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + fn(p.getY(i)));
  return geometry;
}

// A rounded rectangle centred on the origin, drawn into a Shape or a Path.
export function roundRect(path, w, h, r) {
  const x = -w / 2, y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

// Repeatable random numbers, so a seed always gives the same cloud.
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Squashes everything below `base` towards it, so round puffs get a flat bottom; normals follow.
export function flatten(geometry, base, factor = 0.28) {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y >= base) continue;
    p.setY(i, base + (y - base) * factor);
    v.set(n.getX(i), n.getY(i) / factor, n.getZ(i)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return geometry;
}

// A cumulus of three big puffs, bottom flat on y = 0, about `size` metres wide.
export function cloudPuffs(seed, size, widthSegments = 32, heightSegments = 20) {
  const rnd = random(seed);
  const vary = () => 0.88 + 0.24 * rnd();
  const lift = size * 0.07;
  return [
    [(rnd() - 0.5) * size * 0.08, 0.3, 0.95],
    [-size * 0.29, 0.21, 0.72],
    [size * 0.29, 0.22, 0.72],
  ].map(([x, k, high]) => {
    const r = size * k * vary();
    const puff = at(new THREE.SphereGeometry(r, widthSegments, heightSegments), [x, r * high - lift, (rnd() - 0.5) * size * 0.1]);
    return flatten(puff, 0);
  });
}