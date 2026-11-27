import { format, reducedMotion } from './media.js';

// Seconds into the press at which the rings have spread and the scene gives way to the opening.
const GIVE_WAY = { landscape: 2.4, portrait: 2.8 };
const START_LIMIT = 1200;
const TOTAL_LIMIT = 7000;
const FADE_LIMIT = 2500;

export function createThreshold(root, { onEnter, onLeave }) {
  const button = root.querySelector('.threshold__enter');
  const video = root.querySelector('video');
  let leaving = false;

  const remove = () => {
    root.hidden = true;
    video.pause();
  };

  const leave = () => {
    if (leaving) return;
    leaving = true;
    root.classList.add('is-leaving');
    root.addEventListener('transitionend', (event) => {
      if (event.target === root && event.propertyName === 'opacity') remove();
    });
    setTimeout(remove, FADE_LIMIT);
    onLeave();
  };

  root.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });

  button.addEventListener('click', () => {
    root.classList.add('is-entered');
    onEnter();
    if (reducedMotion.matches) return leave();
    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= GIVE_WAY[format()]) leave();
    });
    video.addEventListener('ended', leave);
    video.addEventListener('error', leave);
    video.play().catch(leave);
    setTimeout(() => {
      if (video.currentTime < 0.05) leave();
    }, START_LIMIT);
    setTimeout(leave, TOTAL_LIMIT);
  }, { once: true });

  return {
    progress(share) {
      root.style.setProperty('--loaded', share);
    },
    ready() {
      root.classList.add('is-ready');
      button.disabled = false;
      button.focus({ preventScroll: true });
    },
  };
}
