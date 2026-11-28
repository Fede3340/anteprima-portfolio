// The white of the park is never one colour. Every plaster surface, drawn (the cut-outs) or lit (ground,
// island bodies, stones), passes by its lightness through three tones of the hour: shade, half tone,
// light. light.js sets the tones; a cut-out can add a touch of its own colour (an accent) or a veil.
import * as THREE from 'three';

export const tones = {
  uShade: { value: new THREE.Color('#8d90c2') },
  uHalf: { value: new THREE.Color('#b7abd1') },
  uLit: { value: new THREE.Color('#fbe0d2') },
};

// The warm pools of the four lit lamps nearest the eyes, painted on the floor after its tones and
// worked out at its corners, not pixel by pixel: [x, z, how lit, unused] each, and their colour.
export const pools = {
  uPools: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
  uPoolColour: { value: new THREE.Color('#ffa95e') },
};
const POOLS = `
  uniform vec4 uPools[4];
  varying float vPool;`;
const POOL_VERTEX = `
  vec2 poolAt = (modelMatrix * vec4(transformed, 1.0)).xz;
  vPool = 0.0;
  for (int i = 0; i < 4; i++) vPool = max(vPool, uPools[i].z * (1.0 - smoothstep(0.4, 3.2, distance(poolAt, uPools[i].xy))));
  vPool *= 0.42;`;

// Lightness (linear) 0.3 is shade, 0.56 half tone, 0.865 light; darker than shade darkens it. Some
// cut-outs add a colour of their own (an accent) or a veil.
const GLSL = `
  uniform vec3 uShade, uHalf, uLit;
  #ifdef GRADE_OWN
  uniform vec4 uAccent, uVeil;
  uniform float uAccentFrom;
  #endif
  vec3 grade(vec3 c) {
    #ifdef GRADE_FLOOR
    // The floor faces the sky square on: brought down onto the slope from half tone to light, where
    // its felt and its soft billows show, instead of all at the light.
    c *= 0.9;
    #endif
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 g = mix(uShade * min(1.0, l * 3.33), uHalf, clamp((l - 0.3) * 3.85, 0.0, 1.0));
    g = mix(g, uLit, clamp((l - 0.56) * 3.28, 0.0, 1.0));
    #ifdef GRADE_OWN
    g = mix(g, uAccent.rgb * (0.4 + 0.7 * l), uAccent.a * smoothstep(uAccentFrom - 0.12, uAccentFrom, l));
    g = mix(g, uVeil.rgb, uVeil.a);
    #endif
    return g;
  }`;

// own: the accent and veil uniforms of a cut-out; they are worked into its drawing only once
// material.userData.toned is set. lamps: true for the floor, which carries the pools of the lamps.
export function grade(material, own, lamps = false) {
  const before = material.onBeforeCompile;
  const base = `${material.customProgramCacheKey()}|grade${own ? '-cut' : ''}${lamps ? '-lamps' : ''}`;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    Object.assign(shader.uniforms, tones, own, lamps && pools);
    const defines = `${material.userData.toned ? '#define GRADE_OWN\n' : ''}${lamps ? '#define GRADE_FLOOR\n' : ''}`;
    // A cut-out's picture is premultiplied and undecoded (textures.js): back to its own colour, edges
    // included, then to light (a square stands for the decoding).
    if (own) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
        diffuseColor.rgb /= max(sampledDiffuseColor.a, 0.004);
        diffuseColor.rgb *= diffuseColor.rgb;
        #endif`);
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${defines}${GLSL}${lamps ? `${POOLS}\nuniform vec3 uPoolColour;` : ''}`)
      .replace('#include <opaque_fragment>', `outgoingLight = grade(outgoingLight);${lamps ? '\noutgoingLight = mix(outgoingLight, uPoolColour, vPool);' : ''}\n#include <opaque_fragment>`);
    if (lamps) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>${POOLS}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>${POOL_VERTEX}`);
    }
  };
  material.customProgramCacheKey = () => `${base}${material.userData.toned ? '-own' : ''}`;
  material.needsUpdate = true;
  return material;
}

export const ownTones = () => ({
  uAccent: { value: new THREE.Vector4(1, 1, 1, 0) },
  uAccentFrom: { value: 0 },
  uVeil: { value: new THREE.Vector4(1, 1, 1, 0) },
});
