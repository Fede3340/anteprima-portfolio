// Long soft shadows on the ground, cast away from the light of the hour by the large cut-outs and the
// works: one strip each, laid on the floor point by point so that it follows the billows, all in one
// mesh, redrawn only when the light has turned. No lights, no shadow maps.
import * as THREE from 'three';
import { heightAt } from './land.js';

const ROWS = 7;
const SIDE = [-1, 0, 1];
// Longest shadow, in heights of the thing; how dark; how much the light must turn to redraw it.
const LONGEST = 3;
const TURN = THREE.MathUtils.degToRad(2);

// casters: [{ x, z, height, width }] standing on the ground.
export function createShadows(plan, casters) {
  const per = ROWS * SIDE.length;
  const position = new Float32Array(casters.length * per * 3);
  const alpha = new Float32Array(casters.length * per);
  const index = [];
  casters.forEach((_, c) => {
    for (let row = 0; row < ROWS - 1; row++) {
      for (let col = 0; col < SIDE.length - 1; col++) {
        const a = c * per + row * SIDE.length + col;
        const b = a + SIDE.length;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('shade', new THREE.BufferAttribute(alpha, 1));
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
    uniforms: { colour: { value: new THREE.Color() }, strength: { value: 0.5 } },
    vertexShader: `
      attribute float shade;
      varying float vShade;
      void main() {
        vShade = shade;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 colour;
      uniform float strength;
      varying float vShade;
      void main() {
        gl_FragColor = vec4(colour, vShade * strength);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  let drawn;

  // away: the way the shadows fall, as an angle in the ground plane; elevation: of the light.
  function lay(away, elevation) {
    const dx = Math.cos(away);
    const dz = Math.sin(away);
    const length = Math.min(LONGEST, 1 / Math.tan(Math.max(elevation, 0.05)));
    casters.forEach(({ x, z, height, width }, c) => {
      const foot = heightAt(plan, x, z);
      for (let row = 0; row < ROWS; row++) {
        const t = row / (ROWS - 1);
        const along = height * length * t;
        // Narrow at the foot, widest two thirds along, round at the end.
        const half = width * (0.3 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 0.75 + 0.1)));
        SIDE.forEach((side, col) => {
          const v = c * per + row * SIDE.length + col;
          const px = x + dx * along - dz * half * side;
          const pz = z + dz * along + dx * half * side;
          // Past the rim, where the floor falls away, there is nothing to fall on: the strip stays
          // level there and fades out.
          const ground = heightAt(plan, px, pz);
          const off = ground < foot - 0.6;
          position.set([px, (off ? foot : ground) + 0.12, pz], v * 3);
          alpha[v] = side || off ? 0 : (1 - t * t) * (row ? 1 : 0.6);
        });
      }
    });
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.shade.needsUpdate = true;
  }

  return {
    mesh,
    material,
    update(away, elevation) {
      if (drawn && Math.abs(drawn[0] - away) < TURN && Math.abs(drawn[1] - elevation) < TURN) return;
      drawn = [away, elevation];
      lay(away, elevation);
    },
  };
}
