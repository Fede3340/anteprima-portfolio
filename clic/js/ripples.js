const RINGS = 3;
const TAP_TIME = 450;
const TAP_TRAVEL = 12;

// A tap on the ground of a scene leaves three flattened rings. `ground` returns the horizon of
// the scene on screen and the tone that reads on its ground, or nothing where no scene is shown.
export function createRipples(layer, ground) {
  let down;

  window.addEventListener('pointerdown', (event) => {
    down = event.isPrimary ? event : undefined;
  }, { passive: true });

  window.addEventListener('pointerup', (event) => {
    if (!down || event.timeStamp - down.timeStamp > TAP_TIME) return;
    if (Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > TAP_TRAVEL) return;
    if (event.target.closest('a, button')) return;
    const surface = ground();
    if (!surface || event.clientY < surface.horizon) return;
    const depth = (event.clientY - surface.horizon) / Math.max(1, window.innerHeight - surface.horizon);
    const size = Math.round(Math.min(window.innerWidth * 0.9, 460) * (0.45 + 0.55 * depth));
    for (let ring = 0; ring < RINGS; ring++) {
      const element = document.createElement('i');
      element.className = 'ripple';
      element.dataset.tone = surface.tone;
      element.style.cssText = `left:${event.clientX}px;top:${event.clientY}px;--size:${size}px;animation-delay:${ring * 0.17}s`;
      element.addEventListener('animationend', () => element.remove());
      layer.append(element);
    }
  }, { passive: true });
}
