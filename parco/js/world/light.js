// The mood of each island, told only by light: the height and strength of the sun and of the sky, the
// brightness of the pictures, the lamps, how far the haze lets one see. Walking a path from one island
// to the next the light passes from one to the other, never in a jump; colours stay what they are.
import * as THREE from 'three';
import { LIGHT } from './world.js';
import { setTint } from './sprites.js';

const AZIMUTH = Math.atan2(LIGHT.sunDirection[2], LIGHT.sunDirection[0]);

export function createLight({ plan, sky, sun, fog, park }) {
  const mix = (a, b, t) => a + (b - a) * t;
  const now = { ...plan.islands[0].mood };
  const { near, far } = fog;
  return {
    update(dt, time, state) {
      const from = state.path ? plan.islands[state.path.from].mood : state.island.mood;
      const to = state.path ? plan.islands[state.path.to].mood : from;
      const t = state.path ? THREE.MathUtils.smoothstep(state.t / state.path.length, 0.2, 0.8) : 0;
      const k = Math.min(1, dt * 1.2);
      for (const key of Object.keys(now)) now[key] += (mix(from[key], to[key], t) - now[key]) * k;
      sky.intensity = LIGHT.skyIntensity * now.sky;
      sun.intensity = LIGHT.sunIntensity * now.sunLight;
      setTint(0.9 + 0.1 * now.sky);
      const height = THREE.MathUtils.degToRad(now.sun);
      sun.position.set(Math.cos(AZIMUTH) * Math.cos(height), Math.sin(height), Math.sin(AZIMUTH) * Math.cos(height)).multiplyScalar(100);
      fog.near = near * now.haze;
      fog.far = far * now.haze;
      park.lamps = now.lamps;
    },
  };
}
