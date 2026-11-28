// The sculpted things of the park are pictures: cut-outs standing on the ground that always turn to
// whoever walks, around the vertical axis only. They are already lit in the picture, so the scene's
// light does not touch them; the three tones of the hour colour them (grade.js). Each picture has a
// small and a large file: the large one is fetched only where it is needed.
import * as THREE from 'three';
import { grade, ownTones } from './grade.js';
import { fadeIn, loadTexture } from './textures.js';

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const p = new THREE.Vector3();
const s = new THREE.Vector3();
const roll = new THREE.Quaternion();
const forward = new THREE.Vector3(0, 0, 1);
// A plane one metre high with its foot at the origin; the pivot of a piece can move its origin.
const plane = (ax = 0.5, ay = 0) => new THREE.PlaneGeometry(1, 1).translate(0.5 - ax, 0.5 - ay, 0);
const RANK = { light: 0, small: 1, large: 2 };

// Every cut-out made, by the name the park gives it, so that the light can give it an accent.
export const drawn = new Set();

// keep: a picture painted in its own colours, which keeps them in the light of the hour (grade.js),
// drawn mirrored so that its light falls from the left like that of the plaster pictures.
export function createSprite(entry, count, { renderer, fog = true, keep = false, anchor = entry.anchor ?? [0.5, 0] }) {
  // Cut out at half alpha and drawn as solid: no pale rim, and pictures in front hide those behind
  // instead of being added on top of them.
  const material = new THREE.MeshBasicMaterial({ alphaTest: 0.5, fog });
  material.userData.keep = keep;
  if (keep) anchor = [1 - anchor[0], anchor[1]];
  const tone = ownTones();
  grade(material, tone);
  const mesh = new THREE.InstancedMesh(plane(...anchor), material, count);
  // Nothing shows until its picture has arrived.
  mesh.visible = false;
  const aspect = entry.w / entry.h;
  // The size asked for last, and the one drawn.
  let size;
  let shown;
  const spots = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0, height: entry.metres ?? 1, roll: 0, hidden: false }));

  // The picture at the size given, swapped in once decoded; resolves when it is drawn. One asked for
  // earlier that arrives first is drawn meanwhile if it is sharper than what is drawn and smaller
  // than what is asked for now. The first comes in softly.
  // Where there is no light version the small one stands for it.
  function use(wanted) {
    const which = entry[wanted] ? wanted : 'small';
    if (size === which || !entry[which]) return Promise.resolve();
    size = which;
    return loadTexture(entry[which].file, renderer, { cutOut: true }).then((texture) => {
      if (size === undefined || (size !== which && !((RANK[shown] ?? -1) < RANK[which] && RANK[which] < RANK[size]))) return texture.dispose();
      shown = which;
      const first = !material.map;
      material.map?.dispose();
      material.map = texture;
      if (keep) texture.repeat.x = -1;
      if (keep) texture.offset.x = 1;
      material.needsUpdate = true;
      mesh.visible = true;
      if (first) fadeIn(material, { alphaTest: 0.5 });
    }, (error) => console.warn(error));
  }
  const sprite = {
    mesh,
    aspect,
    tone,
    spots,
    use,
    // The picture let go, until it is asked for again.
    release() {
      if (!material.map) return;
      size = undefined;
      shown = undefined;
      material.map.dispose();
      material.map = null;
      material.needsUpdate = true;
      mesh.visible = false;
    },
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
  drawn.add(sprite);
  return sprite;
}
