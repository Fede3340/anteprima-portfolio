// Pictures for the park, decoded away from the drawing and handed over one at a time, so that a zone
// full of covers arriving at once never stalls a step.
import * as THREE from 'three';
import { asset } from '../media.js';

const loader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
let queue = Promise.resolve();

export function loadTexture(path, renderer) {
  const next = queue.then(() => new Promise((done, fail) => loader.load(asset(path), (bitmap) => {
    const texture = new THREE.Texture(bitmap);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    // The bitmap is let go with the texture.
    texture.addEventListener('dispose', () => bitmap.close());
    // Uploaded now, outside the frame that will first show it.
    renderer.initTexture(texture);
    done(texture);
  }, undefined, fail)));
  queue = next.catch(() => {});
  return next;
}
