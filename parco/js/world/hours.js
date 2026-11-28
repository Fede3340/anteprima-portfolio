// The hours the walk goes through, measured on the three pictures of the opening (dawn, full day, blue
// hour) and a night made from the blue hour, between the last island and the first. The hour of a
// place is a number on this wheel: 0 dawn, 1 day, 2 blue hour, 2.5 night, 3 dawn again.
// sun: where the sun stands, in degrees, as [to the right of the way one looks on arrival, above the
// horizon]; shape: where the light that models things comes from, the same way; glow: the warm light
// round the sun and on the horizon below it; band: the rose band low in the sky; stars; lamps; light:
// how much light falls on things (less at night, so the floor sits in its half tone and the lamps
// show); veil: how much the sky veils the planets; haze: how far one sees.
import * as THREE from 'three';

const KEYS = [
  { at: 0, top: '#81adf7', quarter: '#b7b7ee', half: '#ddb8cf', horizon: '#dcb6cd', seaFar: '#bba9d4', seaNear: '#c4b3ce', shade: '#8d90c2', mid: '#b7abd1', lit: '#fbe0d2', glow: '#ffc183', disc: '#fff3c4', band: '#f4a7b4', sun: [-15, 1.6], shape: [55, 22], bandAmount: 0, stars: 0, lamps: 0.6, light: 1, veil: 0.55, haze: 1 },
  { at: 1, top: '#0d63e0', quarter: '#3298fa', half: '#4eb5fd', horizon: '#67d2fd', seaFar: '#9cd6fc', seaNear: '#9cc1f0', shade: '#85a8db', mid: '#b4c6e9', lit: '#fbf8f6', glow: '#fff4dc', disc: '#ffffff', band: '#f4a7b4', sun: [100, 58], shape: [100, 58], bandAmount: 0, stars: 0, lamps: 0, light: 1, veil: 0.7, haze: 1.15 },
  { at: 2, top: '#20358c', quarter: '#636bce', half: '#8d7bd9', horizon: '#cf8cce', seaFar: '#bc8ed7', seaNear: '#7d84d7', shade: '#6f77c8', mid: '#9891dc', lit: '#f5d2d5', glow: '#ff9a6a', disc: '#ffd2a0', band: '#ff9fa8', sun: [206, -6], shape: [150, 30], bandAmount: 0.75, stars: 1, lamps: 1, light: 0.6, veil: 0, haze: 0.85 },
  { at: 2.5, top: '#111a4c', quarter: '#2a3278', half: '#4a4c9c', horizon: '#8a6fb4', seaFar: '#6a64b2', seaNear: '#50559f', shade: '#4d5399', mid: '#7471b8', lit: '#d9c3d8', glow: '#c9789a', disc: '#ffd2a0', band: '#d98aa8', sun: [290, -18], shape: [250, 30], bandAmount: 0.3, stars: 1.2, lamps: 1, light: 0.5, veil: 0, haze: 0.75 },
].map((key) => Object.fromEntries(Object.entries(key).map(([name, value]) => [name, typeof value === 'string' ? new THREE.Color(value) : value])));
// The wheel closes on dawn, the sun come round once more.
KEYS.push({ ...KEYS[0], at: 3, sun: [KEYS[0].sun[0] + 360, KEYS[0].sun[1]], shape: [KEYS[0].shape[0] + 360, KEYS[0].shape[1]] });

export const LENGTH = 3;

// The light at an hour of the wheel, written into out (made once by hourLight()).
export function hourLight(hour = 0, out = Object.fromEntries(Object.entries(KEYS[0]).map(([name, value]) => [name, value.isColor ? value.clone() : value]))) {
  const h = ((hour % LENGTH) + LENGTH) % LENGTH;
  const next = KEYS.findIndex((key) => key.at > h);
  const a = KEYS[next - 1];
  const b = KEYS[next];
  const t = THREE.MathUtils.smoothstep(h, a.at, b.at);
  for (const name of Object.keys(out)) {
    if (out[name]?.isColor) out[name].lerpColors(a[name], b[name], t);
    else if (Array.isArray(a[name])) out[name] = a[name].map((value, i) => value + (b[name][i] - value) * t);
    else out[name] = a[name] + (b[name] - a[name]) * t;
  }
  return out;
}
