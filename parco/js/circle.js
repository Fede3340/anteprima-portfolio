import { reducedMotion } from './media.js';

const CIRCLE_TIME = 800;
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

const reach = (x, y) => Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))) + 2;

// The signature passage of the site: a circle opens from the point that was touched and uncovers
// the layer, or closes back onto that point. Resolves when the layer is fully shown or hidden.
export function circle(layer, { x = innerWidth / 2, y = innerHeight / 2, open = true, duration = CIRCLE_TIME } = {}) {
  settle(layer);
  if (reducedMotion.matches) {
    const fade = layer.animate([{ opacity: open ? 0 : 1 }, { opacity: open ? 1 : 0 }], { duration: 300, easing: 'ease', fill: 'forwards' });
    return fade.finished.catch(() => {});
  }
  const shut = `circle(0px at ${x}px ${y}px)`;
  const full = `circle(${reach(x, y)}px at ${x}px ${y}px)`;
  const motion = layer.animate([{ clipPath: open ? shut : full }, { clipPath: open ? full : shut }], { duration, easing: EASE, fill: 'forwards' });
  return motion.finished.catch(() => {});
}

const settle = (layer) => layer.getAnimations().forEach((animation) => animation.cancel());
