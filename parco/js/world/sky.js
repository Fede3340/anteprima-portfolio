// The sky of the hour: four colours from the horizon up, the sun with its glow and the warm light it
// throws on the horizon, the rose band of the blue hour, the stars. One pass, on the sky's own sphere.
import * as THREE from 'three';

export function createSkyMaterial() {
  const colour = () => ({ value: new THREE.Color() });
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTop: colour(), uQuarter: colour(), uHalf: colour(), uHorizon: colour(), uGlow: colour(), uDisc: colour(), uBand: colour(), uSun: { value: new THREE.Vector3(0, 1, 0) }, uBandAmount: { value: 0 }, uStars: { value: 0 } },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTop, uQuarter, uHalf, uHorizon, uGlow, uDisc, uBand, uSun;
      uniform float uBandAmount, uStars;
      varying vec3 vDirection;
      void main() {
        vec3 d = normalize(vDirection);
        float y = max(d.y, 0.0);
        vec3 c = mix(uHorizon, uHalf, smoothstep(0.0, 0.1, y));
        c = mix(c, uQuarter, smoothstep(0.1, 0.24, y));
        c = mix(c, uTop, smoothstep(0.24, 0.5, y));
        float low = 1.0 - smoothstep(0.0, 0.3, y);
        c = mix(c, uBand, uBandAmount * (1.0 - smoothstep(0.0, 0.09, y)));
        float s = max(dot(d, uSun), 0.0);
        float s8 = s * s;
        s8 *= s8;
        s8 *= s8;
        float s32 = s8 * s8;
        c = mix(c, uGlow, min(1.0, s8 * low * 0.55 + s32 * 0.5));
        c = mix(c, uDisc, smoothstep(0.99955, 0.99966, s));
        if (uStars > 0.0) {
          vec3 at = d * 260.0;
          vec3 cell = floor(at);
          float h = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
          float star = step(0.9965, h) * (1.0 - smoothstep(0.08, 0.22, length(fract(at) - 0.5)));
          c += star * uStars * smoothstep(0.12, 0.4, y) * vec3(1.0, 0.95, 0.9);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
