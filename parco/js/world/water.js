// The water of the ponds: one flat disc for each, all in one mesh, light blue and paler towards the
// rim, with slow rings spreading from the middle and a soft glint. Its edge sinks under the floor
// around it, where the cushions of cloud hide it. Nothing is reflected: it is all in the colours.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

// ponds: [{ x, z, r, level }]. The colours are uniforms, for whoever sets the light of the hour:
// uDeep (the middle), uShallow (the rim), uRing (the spreading rings), uGlint (the glint).
export function createWater(ponds) {
  const discs = ponds.map((pond) => {
    const disc = new THREE.CircleGeometry(pond.r + 0.5, 48).rotateX(-Math.PI / 2).translate(pond.x, pond.level, pond.z);
    const centre = new Float32Array(disc.attributes.position.count * 3);
    for (let i = 0; i < centre.length; i += 3) centre.set([pond.x, pond.z, pond.r], i);
    disc.setAttribute('pond', new THREE.BufferAttribute(centre, 3));
    return disc;
  });
  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#3f7fd6') },
      uShallow: { value: new THREE.Color('#9ccaf4') },
      uRing: { value: new THREE.Color('#e4f1ff') },
      uGlint: { value: new THREE.Color('#ffffff') },
    }]),
    vertexShader: `
      attribute vec3 pond;
      varying vec2 vAt;
      #include <fog_pars_vertex>
      void main() {
        // Where the point is in its pond, the radius as unit.
        vAt = (position.xz - pond.xy) / pond.z;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uRing, uGlint;
      varying vec2 vAt;
      #include <fog_pars_fragment>
      void main() {
        float d = length(vAt);
        vec3 colour = mix(uDeep, uShallow, smoothstep(0.15, 1.0, d));
        // Thin rings a little off the middle, spreading slowly and fading towards the rim.
        float wave = length(vAt - vec2(0.12, -0.08)) * 7.0 - uTime * 0.35;
        float ring = smoothstep(0.82, 1.0, sin(wave * 6.2832) * 0.5 + 0.5) * (1.0 - smoothstep(0.35, 0.9, d));
        colour = mix(colour, uRing, ring * 0.7);
        float glint = exp(-dot(vAt - vec2(-0.35, -0.3), vAt - vec2(-0.35, -0.3)) * 9.0);
        gl_FragColor = vec4(mix(colour, uGlint, glint * 0.45), 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  return new THREE.Mesh(mergeGeometries(discs), material);
}
