// Portals: plaster arches with a veil of light inside that drifts slowly and opens as one comes near.
// In the clearing of the first island one for every other island, in an arc beside the way in; on
// every other island one back to the first, by where one arrives. A click on a portal, or walking into
// it, sends travel:jump to its island (the travel bar makes the jump). The veil is a pattern that
// slides, no particles; its colour is uAccent, which whoever sets the light fills for each portal.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { heightAt } from './land.js';
import { mouth } from './layout.js';

// Small and light: a little higher than a person.
const WIDTH = 1.3;
const HEIGHT = 2.1;
// How near a thing a portal may stand, how far apart portals stand, how far from the ways across an
// island, and when the veil opens.
const ROOM = 1;
const APART = 2.8;
const WAY = 2.2;
const OPEN = 4;
// Walking into a portal: this close to its middle, going towards it.
const INTO = 1.15;

const VEIL = {
  vertexShader: `
    varying vec2 vAt;
    void main() {
      vAt = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform float uTime, uOpen;
    uniform vec3 uAccent;
    varying vec2 vAt;
    void main() {
      // Soft bands of light rising slowly, brighter towards the middle; near, the middle clears.
      float band = 0.5 + 0.5 * sin(vAt.y * 9.0 - uTime * 0.9 + sin(vAt.x * 6.0 + uTime * 0.4) * 1.4);
      // Distance from the middle, in the shape of the arch (narrow and tall).
      float middle = length((vAt - vec2(0.5, 0.42)) * vec2(1.0, 0.62));
      float alpha = (0.6 + band * 0.35) * smoothstep(0.5, 0.32, middle) * (1.0 - uOpen * smoothstep(0.3, 0.0, middle) * 0.8);
      gl_FragColor = vec4(mix(uAccent, vec3(1.0), band * 0.5), alpha);
      #include <colorspace_fragment>
    }`,
};

// The arch: two legs and a half ring over them, standing on the ground at the origin, facing +z.
function archGeometry() {
  const radius = WIDTH / 2;
  const leg = HEIGHT - radius;
  return mergeGeometries([
    new THREE.CylinderGeometry(0.12, 0.14, leg, 14).translate(-radius, leg / 2, 0),
    new THREE.CylinderGeometry(0.12, 0.14, leg, 14).translate(radius, leg / 2, 0),
    new THREE.TorusGeometry(radius, 0.12, 12, 28, Math.PI).translate(0, leg, 0),
  ]);
}

// taken: things already standing, [{ x, z, r }], that a portal keeps clear of.
export function createPortals({ plan, taken }) {
  const object = new THREE.Group();
  const placed = [];
  // The ways across each island stay free: from the path in to the arrival, from there to the path
  // out, on the first island from where one starts and from its middle to the path out, and straight
  // on from each path's end, as one walks off the stones.
  const ways = (island) => {
    const enter = mouth(plan, island, island.in);
    const leave = mouth(plan, island, island.out);
    const on = (path, at) => {
      const end = path.from === island.index ? 0 : 1;
      const d = path.curve.getTangentAt(end).multiplyScalar(end ? 9 : -9);
      return [at, { x: at.x + d.x, z: at.z + d.z }];
    };
    return [[enter, island.arrival], [island.arrival, leave], [island.start ?? island.arrival, leave], [island.centre, leave], on(island.in, enter), on(island.out, leave)];
  };
  const off = (x, z, [a, b]) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - a.x - dx * k, z - a.z - dz * k);
  };
  const clear = (x, z, island) => Math.hypot(x - island.centre.x, z - island.centre.z) < island.radius - 2.5
    && ways(island).every((way) => off(x, z, way) > WAY)
    && !taken.some((thing) => Math.hypot(x - thing.x, z - thing.z) < thing.r + ROOM)
    && !placed.some((other) => Math.hypot(x - other.x, z - other.z) < APART);

  // Around a point, on rings of the given radii, the first clear spots beside the way ahead: on one
  // side from near the way round to behind, then on the other.
  function spots(island, at, ahead, radii, count) {
    const found = [];
    for (const side of [1, -1]) {
      for (const radius of radii) {
        // On the first island, out of the first view: from 75 degrees off the way one looks.
        for (let degrees = at === plan.landing.start ? 75 : 30; degrees <= 180 && found.length < count; degrees += 5) {
          const a = ahead + side * THREE.MathUtils.degToRad(degrees);
          const x = at.x + Math.cos(a) * radius;
          const z = at.z + Math.sin(a) * radius;
          if (!clear(x, z, island)) continue;
          found.push({ x, z });
          placed.push({ x, z });
        }
      }
    }
    return found;
  }

  const arch = archGeometry();
  const arches = [];
  const veils = [];
  const list = [];
  function add(island, spot, to, face) {
    const y = heightAt(plan, spot.x, spot.z);
    const yaw = Math.atan2(face.x - spot.x, face.z - spot.z);
    arches.push(arch.clone().rotateY(yaw).translate(spot.x, y, spot.z));
    const uniforms = { uTime: { value: 0 }, uOpen: { value: 0 }, uAccent: { value: new THREE.Color('#ffd9b0') } };
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(WIDTH - 0.24, HEIGHT - 0.12).translate(0, (HEIGHT - 0.12) / 2, 0),
      new THREE.ShaderMaterial({ ...VEIL, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    veil.position.set(spot.x, y, spot.z);
    veil.rotation.y = yaw;
    const portal = { zone: to.zones[0].id, title: to.zones[0].title, top: new THREE.Vector3(spot.x, y + HEIGHT + 0.45, spot.z), x: spot.x, z: spot.z, y, veil, accent: uniforms.uAccent.value, uniforms, inside: false };
    veil.userData.portal = portal;
    veils.push(veil);
    list.push(portal);
  }

  const first = plan.landing;
  const out = mouth(plan, first, first.out);
  const ahead = Math.atan2(out.z - first.start.z, out.x - first.start.x);
  const others = plan.islands.filter((island) => island !== first);
  const clearing = spots(first, first.start, ahead, [6.5, 8.5, 10.5, 12.5, 7.5, 9.5, 11.5, 13.5, 5.5], others.length);
  // Said loudly: the checks read errors, and an island without its portal is a fault to see.
  if (clearing.length < others.length) console.error(`portali: spazio nella radura per ${clearing.length} su ${others.length}`);
  clearing.forEach((spot, index) => add(first, spot, others[index], first.start));
  for (const island of others) {
    const inward = Math.atan2(island.centre.z - island.arrival.z, island.centre.x - island.arrival.x);
    const [spot] = spots(island, island.arrival, inward, [3.5, 5, 6.5], 1);
    if (spot) add(island, spot, first, island.arrival);
  }

  const arches3d = new THREE.Mesh(mergeGeometries(arches), new THREE.MeshLambertMaterial({ color: '#edf2f9', emissive: '#6f82a3' }));
  object.add(arches3d, ...veils);

  return {
    object,
    list,
    // A portal stands where one cannot walk through its legs; its middle is walked into.
    solid: list.flatMap((portal) => [-1, 1].map((side) => {
      const yaw = portal.veil.rotation.y;
      return { x: portal.x + Math.cos(yaw) * side * (WIDTH / 2), z: portal.z - Math.sin(yaw) * side * (WIDTH / 2), r: 0.35 };
    })),
    tappable: [arches3d, ...veils],
    // The portal a hit on one of the tappable meshes belongs to.
    portalOf(hit) {
      if (hit.object.userData.portal) return hit.object.userData.portal;
      return list.reduce((a, b) => (hit.point.distanceTo(new THREE.Vector3(a.x, a.y, a.z)) < hit.point.distanceTo(new THREE.Vector3(b.x, b.y, b.z)) ? a : b));
    },
    update(dt, time, state) {
      for (const portal of list) {
        const near = Math.hypot(state.x - portal.x, state.z - portal.z);
        portal.uniforms.uTime.value = time;
        portal.uniforms.uOpen.value += ((near < OPEN ? 1 : 0) - portal.uniforms.uOpen.value) * Math.min(1, dt * 4);
        // Walking into it, once until one has stepped away again.
        // Only walking by oneself: a walk to a point that passes through a portal does not jump.
        const into = near < INTO && Math.abs(state.speed) > 0.5 && !state.route.length;
        if (into && !portal.inside) document.dispatchEvent(new CustomEvent('travel:jump', { detail: { zone: portal.zone } }));
        portal.inside = near < INTO;
      }
    },
  };
}
