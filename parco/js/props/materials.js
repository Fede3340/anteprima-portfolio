import * as THREE from 'three';

export const palette = {
  sky: '#95c8ee',
  horizon: '#e6f1fa',
  deep: '#2a5082',
  night: '#00184d',
  plaster: '#f6f8fb',
  ink: '#001750',
};

// The light the props are made for: a strong sky light with a pale blue bounce from below,
// a gentle sun, and a hint of blue glow in the plaster, so its shaded side stays a light blue
// (around #c5d4ea) instead of going grey. Use the same values in the world.
export const light = {
  sky: '#ffffff',
  ground: '#b9cde6',
  skyIntensity: 2.6,
  sun: '#ffffff',
  sunIntensity: 1.2,
  sunDirection: [-0.45, 0.75, 0.5],
  plasterGlow: '#00406a',
};

export const plaster = new THREE.MeshLambertMaterial({ color: palette.plaster, emissive: light.plasterGlow });
export const deep = new THREE.MeshLambertMaterial({ color: palette.deep });
export const night = new THREE.MeshLambertMaterial({ color: palette.night });
export const glow = new THREE.MeshBasicMaterial({ color: palette.plaster });
