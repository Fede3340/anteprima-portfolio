// The sky of the hour: four colours from the horizon up, the sun with its glow and the warm light it
// throws on the horizon, the rose band of the blue hour, the stars. One pass, on the sky's own sphere.
// High up on the way in (js/threshold.js) the sky is space instead, by a share uSpace: deep blue above,
// lilac, a warm peach below, with no horizon, and the sun's halo round in every direction.
import * as THREE from 'three';

// The colours of space, from below to above.
export const SPACE = { low: new THREE.Color('#d9a7b5'), mid: new THREE.Color('#6a70bf'), top: new THREE.Color('#232c6e') };

export function createSkyMaterial() {
  const colour = () => ({ value: new THREE.Color() });
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    fog: false,
    uniforms: { uTop: colour(), uQuarter: colour(), uHalf: colour(), uHorizon: colour(), uGlow: colour(), uDisc: colour(), uBand: colour(), uSun: { value: new THREE.Vector3(0, 1, 0) }, uBandAmount: { value: 0 }, uStars: { value: 0 }, uSpace: { value: 0 }, uCut: { value: 1 }, uEdge: { value: -0.07 }, uSpaceLow: { value: SPACE.low }, uSpaceMid: { value: SPACE.mid }, uSpaceTop: { value: SPACE.top } },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        // Not normalised here: across the large faces of the sphere only the difference itself is
        // linear, and normalising each corner bent the glow of the sun along their edges.
        vDirection = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // On the far plane, drawn after everything else: only where nothing else is.
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `
      uniform vec3 uTop, uQuarter, uHalf, uHorizon, uGlow, uDisc, uBand, uSun;
      uniform vec3 uSpaceLow, uSpaceMid, uSpaceTop;
      uniform float uBandAmount, uStars, uSpace, uCut, uEdge;
      varying vec3 vDirection;
      void main() {
        vec3 d = normalize(vDirection);
        float y = max(d.y, 0.0);
        vec3 c = mix(uHorizon, uHalf, smoothstep(0.0, 0.1, y));
        c = mix(c, uQuarter, smoothstep(0.1, 0.24, y));
        c = mix(c, uTop, smoothstep(0.24, 0.5, y));
        float low = 1.0 - smoothstep(0.0, 0.3, y);
        c = mix(c, uBand, uBandAmount * (1.0 - smoothstep(0.0, 0.09, y)));
        float toward = dot(d, uSun);
        float s = max(toward, 0.0);
        float s8 = s * s;
        s8 *= s8;
        s8 *= s8;
        float s32 = s8 * s8;
        // Once there is a horizon (uCut), the light of the sun fades out softly down to the far edge of
        // the sea of clouds (uEdge, as high as it is seen from the eyes): lower down the sky has the
        // colour of the haze (light.js, js/threshold.js), so whatever the haze covers there (the sea,
        // far islands) meets the sky without an edge.
        float above = mix(1.0, smoothstep(uEdge, uEdge + 0.14, d.y), uCut);
        c = mix(c, uGlow, min(1.0, (s8 * low * 0.55 + s32 * 0.5) * above));
        if (uSpace > 0.0) {
          // Plain peach below the edge of the sea, the haze's colour there; lilac; deep blue above.
          vec3 space = mix(uSpaceLow, uSpaceMid, smoothstep(-0.1, 0.15, d.y));
          space = mix(space, uSpaceTop, smoothstep(0.1, 0.42, d.y));
          // The halo: by the angle from the sun only, round, light added onto the sky (a warm breath that
          // brightens the blue, never muddies it) round a pale core.
          float a = acos(clamp(toward, -1.0, 1.0));
          space += uGlow * (0.55 * exp(-a * a / 0.02) + 0.2 * exp(-a * a / 0.12)) * above;
          space = mix(space, uDisc, 0.85 * exp(-a * a / 0.0025) * above);
          // A grain finer than a pixel of the page, so that the deep blue is not plastic.
          space += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.03;
          c = mix(c, space, uSpace);
        }
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
