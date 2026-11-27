// Many copies of one object drawn as instances, one InstancedMesh for each of its meshes. Copies
// spread around the ring are grouped by the slice of the ring they stand in, so that the slices
// out of sight are not drawn at all.
import * as THREE from 'three';

const SLICES = 8;
const m = new THREE.Matrix4();

// spots: [{ matrix, x, z }]. swap(mesh) may give a mesh another material for its instances.
export function instances(template, spots, { swap = (mesh) => mesh.material, slices = SLICES } = {}) {
  template.updateMatrixWorld(true);
  const meshes = [];
  template.traverse((node) => {
    if (node.isMesh) meshes.push(node);
  });
  const groups = Array.from({ length: slices }, () => []);
  spots.forEach((spot, index) => {
    const slice = slices === 1 ? 0 : Math.floor(((Math.atan2(spot.z, spot.x) / (2 * Math.PI)) + 1) * slices) % slices;
    groups[slice].push(index);
  });
  // Where each spot is drawn: the slice and its place in it.
  const where = [];
  const drawn = [];
  const bySlice = groups.filter((list) => list.length).map((list) => {
    const parts = meshes.map((mesh) => {
      const instanced = new THREE.InstancedMesh(mesh.geometry, swap(mesh), list.length);
      instanced.userData = { part: mesh.matrixWorld.clone(), spots: list, source: mesh };
      drawn.push(instanced);
      return instanced;
    });
    list.forEach((spotIndex, slot) => { where[spotIndex] = { parts, slot }; });
    return parts;
  });
  const set = (index, matrix, only) => {
    const { parts, slot } = where[index];
    for (const mesh of parts) {
      if (only && mesh.userData.source !== only) continue;
      mesh.setMatrixAt(slot, m.multiplyMatrices(matrix, mesh.userData.part));
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  spots.forEach((spot, index) => set(index, spot.matrix));
  bySlice.flat().forEach((mesh) => mesh.computeBoundingSphere());
  return {
    drawn,
    set,
    // The spot a ray hit belongs to.
    spotOf: (hit) => hit.object.userData.spots?.[hit.instanceId],
    // The instanced copies of one mesh of the template, with the slot of each spot.
    each(source, fn) {
      where.forEach(({ parts, slot }, index) => fn(parts.find((mesh) => mesh.userData.source === source), slot, index));
    },
  };
}

export const placed = (x, z, yaw = 0, scale = 1, y = 0) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
  new THREE.Vector3(scale, scale, scale),
);
