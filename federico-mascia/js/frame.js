const COVER_START = 150;
const LABEL_PAUSE = 50;

const root = document.documentElement;
const [navigation] = performance.getEntriesByType('navigation');
const returning = navigation?.type === 'back_forward';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!returning && !reducedMotion && 'animate' in Element.prototype) {
  root.classList.add('is-arriving');
  document.addEventListener('DOMContentLoaded', liftCover, { once: true });
}

async function liftCover() {
  const cover = document.querySelector('.frame__cover');
  const label = document.querySelector('.frame-row__state--first');
  if (cover && label) {
    const tokens = getComputedStyle(root);
    const easing = tokens.getPropertyValue('--ease').trim();
    const duration = (name) => parseFloat(tokens.getPropertyValue(name));
    const elapsed = Number(document.timeline.currentTime) || 0;

    await cover.animate(
      { transform: ['translateY(0)', 'translateY(-100%)'] },
      { delay: Math.max(0, COVER_START - elapsed), duration: duration('--duration-cover'), easing, fill: 'forwards' },
    ).finished;
    await label.animate(
      { opacity: [0, 1] },
      { delay: LABEL_PAUSE, duration: duration('--duration-state'), easing, fill: 'forwards' },
    ).finished;
  }
  root.classList.remove('is-arriving');
}
