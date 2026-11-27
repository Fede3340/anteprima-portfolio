// The mood of each zone, told only by light: the height and strength of the sun and of the sky on the
// ground, the brightness of the pictures, the lamps. Walking from one zone to the next the light
// changes over the last stretch of the zone, never in a jump, and colours stay what they are.
import * as THREE from 'three';
import { LIGHT } from './world.js';
import { wrap, zoneAt } from './layout.js';
import { setTint } from './sprites.js';

const AZIMUTH = Math.atan2(LIGHT.sunDirection[2], LIGHT.sunDirection[0]);
const BLEND = 0.45;

export function createLight({ plan, sky, sun, park }) {
  const mix = (a, b, t) => a + (b - a) * t;
  const now = { ...plan.zones[0].mood };
  return {
    update(dt, time, state) {
      const zone = zoneAt(plan, state.s);
      const next = plan.zones[(zone.index + 1) % plan.zones.length];
      const into = (wrap(state.s, plan.length) - zone.start) / zone.length;
      const t = THREE.MathUtils.smoothstep(into, 1 - BLEND, 1);
      const k = Math.min(1, dt * 2);
      for (const key of Object.keys(now)) now[key] += (mix(zone.mood[key], next.mood[key], t) - now[key]) * k;
      sky.intensity = LIGHT.skyIntensity * now.sky;
      sun.intensity = LIGHT.sunIntensity * now.sunLight;
      setTint(0.9 + 0.1 * now.sky);
      const height = THREE.MathUtils.degToRad(now.sun);
      sun.position.set(Math.cos(AZIMUTH) * Math.cos(height), Math.sin(height), Math.sin(AZIMUTH) * Math.cos(height)).multiplyScalar(100);
      park.lamps = now.lamps;
    },
  };
}
