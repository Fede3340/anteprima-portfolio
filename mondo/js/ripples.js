import { reducedMotion } from './media.js';

const RINGS = 3;
const layer = document.querySelector('.ripples');

// Three flattened rings spreading on the ground from a point, the mark that something was touched.
export function rings(x, y, { size = Math.min(innerWidth * 0.9, 460), tone = 'light' } = {}) {
  if (reducedMotion.matches) return;
  for (let ring = 0; ring < RINGS; ring++) {
    const element = document.createElement('i');
    element.className = 'ripple';
    element.dataset.tone = tone;
    element.style.cssText = `left:${x}px;top:${y}px;--size:${Math.round(size)}px;animation-delay:${ring * 0.17}s`;
    element.addEventListener('animationend', () => element.remove());
    layer.append(element);
  }
}
