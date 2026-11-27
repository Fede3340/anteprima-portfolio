import { reducedMotion } from './media.js';

// Seconds into the press at which the finger meets the disc, and at which the rings have started to
// spread and the door gives way to the opening.
const TOUCH = 0.5;
const GIVE_WAY = 0.85;
// The door opens on time even when the press cannot play: tap to opening stays within about 2 s.
const OPEN_LIMIT = 1200;
const FADE_LIMIT = 1100;

export function createThreshold(root, { onEnter, onTouch, onLeave }) {
  const enter = root.querySelector('.threshold__enter');
  const quiet = root.querySelector('.threshold__quiet');
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

  const onKey = (event) => {
    if (event.key === 'Enter' && !enter.disabled && !event.target.closest?.('.threshold__quiet')) enter.click();
  };

  const go = (withSound) => {
    if (root.classList.contains('is-entered')) return;
    window.removeEventListener('keydown', onKey);
    root.classList.add('is-entered');
    onEnter(withSound);
    if (reducedMotion.matches) {
      onTouch();
      return leave();
    }
    video.addEventListener('playing', () => {
      setTimeout(onTouch, Math.max(0, TOUCH - video.currentTime) * 1000);
      setTimeout(leave, Math.max(0, GIVE_WAY - video.currentTime) * 1000);
    }, { once: true });
    video.addEventListener('error', leave);
    video.play().catch(leave);
    setTimeout(leave, OPEN_LIMIT);
  };

  root.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
  window.addEventListener('keydown', onKey);
  enter.addEventListener('click', () => go(true));
  quiet.addEventListener('click', () => go(false));

  return {
    progress(share) {
      root.style.setProperty('--loaded', share);
    },
    ready() {
      root.classList.add('is-ready');
      enter.disabled = false;
      quiet.disabled = false;
    },
  };
}
