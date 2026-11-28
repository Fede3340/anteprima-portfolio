// Pictures for the park, decoded away from the drawing, four at a time in the order asked, so that
// what is asked first comes first and a zone full of covers arriving at once never stalls a step.
import * as THREE from 'three';
import { asset } from '../media.js';

const loader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
// Cut-outs come premultiplied and undecoded, so that the hidden colour of their transparent pixels
// never bleeds into their edges; their shader divides by alpha and decodes (grade.js).
const cutLoader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'premultiply' });
const AT_ONCE = 4;
const waiting = [];
let busy = 0;

function next() {
  while (busy < AT_ONCE && waiting.length) {
    busy++;
    waiting.shift()().then(() => {
      busy--;
      next();
    });
  }
}

// A picture that arrives while the park is in sight comes in softly, over about half a second.
// alphaTest: the cut-off of a cut-out picture, eased off while it comes in so the edge stays soft.
// It is blended only while it comes in.
export function fadeIn(material, { alphaTest = 0 } = {}) {
  const start = performance.now();
  material.transparent = true;
  material.needsUpdate = true;
  material.opacity = 0;
  if (alphaTest) material.alphaTest = 0.01;
  const step = (now) => {
    const k = Math.min(1, (now - start) / 600);
    material.opacity = k;
    if (k < 1) return requestAnimationFrame(step);
    // Drawn solid again, with a solid alpha too: a program left from the fade would write the
    // cut-out's soft edge into the canvas's own alpha, and the page would show through it.
    material.transparent = false;
    material.needsUpdate = true;
    if (alphaTest) material.alphaTest = alphaTest;
  };
  requestAnimationFrame(step);
}

export function loadTexture(path, renderer, { cutOut = false } = {}) {
  return new Promise((done, fail) => {
    waiting.push(() => new Promise((finished) => (cutOut ? cutLoader : loader).load(asset(path), (bitmap) => {
      const texture = new THREE.Texture(bitmap);
      texture.flipY = false;
      texture.colorSpace = cutOut ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      // The bitmap is let go with the texture.
      texture.addEventListener('dispose', () => bitmap.close());
      // Uploaded now, outside the frame that will first show it.
      renderer.initTexture(texture);
      done(texture);
      finished();
    }, undefined, (error) => {
      fail(error);
      finished();
    })));
    next();
  });
}
