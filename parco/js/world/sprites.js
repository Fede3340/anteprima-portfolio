// The sculpted things of the park are pictures: cut-outs standing on the ground that always turn to
// whoever walks, around the vertical axis only. They are already lit in the picture, so the scene's
// light does not touch them; the mood brightens or dims them all a little. Each picture has a small
// and a large file: the large one is fetched only where it is needed.
import * as THREE from 'three';
import { loadTexture } from './textures.js';

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const p = new THREE.Vector3();
const s = new THREE.Vector3();
const roll = new THREE.Quaternion();
const forward = new THREE.Vector3(0, 0, 1);
// A plane one metre high with its foot at the origin; the pivot of a piece can move its origin.
const plane = (ax = 0.5, ay = 0) => new THREE.PlaneGeometry(1, 1).translate(0.5 - ax, 0.5 - ay, 0);

export const tint = { value: 1 };
const materials = new Set();

export function setTint(value) {
  tint.value = value;
  for (const material of materials) material.color.setScalar(value);
}

// later: nothing is fetched until use() is called.
export function createSprite(entry, count, { renderer, fog = true, anchor = entry.anchor ?? [0.5, 0], later = false }) {
  const material = new THREE.MeshBasicMaterial({ alphaToCoverage: true, fog, color: new THREE.Color().setScalar(tint.value) });
  materials.add(material);
  const mesh = new THREE.InstancedMesh(plane(...anchor), material, count);
  // Nothing shows until its picture has arrived.
  mesh.visible = false;
  const aspect = entry.w / entry.h;
  let size;
  const spots = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0, height: entry.metres ?? 1, roll: 0, hidden: false }));

  function use(which) {
    if (size === which || !entry[which]) return;
    size = which;
    loadTexture(entry[which].file, renderer).then((texture) => {
      if (size !== which) return texture.dispose();
      material.map?.dispose();
      material.map = texture;
      material.needsUpdate = true;
      mesh.visible = true;
    }, (error) => console.warn(error));
  }
  if (!later) use('small');

  return {
    mesh,
    spots,
    use,
    // Every copy turned to the eyes; call once a frame.
    face(camera) {
      spots.forEach((spot, index) => {
        if (spot.hidden) {
          mesh.setMatrixAt(index, m.makeScale(0, 0, 0));
          return;
        }
        q.setFromAxisAngle(up, Math.atan2(camera.position.x - spot.x, camera.position.z - spot.z));
        if (spot.roll) q.multiply(roll.setFromAxisAngle(forward, spot.roll));
        mesh.setMatrixAt(index, m.compose(p.set(spot.x, spot.y, spot.z), q, s.set(spot.height * aspect, spot.height, 1)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    },
  };
}
