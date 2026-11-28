// The door: the park drawn down to its bones, the name and the two ways: into the park, or straight to
// the works. Going into the park the shapes settle where the first view of the park has them, the door
// fades, and the park takes shape: its things grow from the ground and the haze lifts. Going to the
// works the shapes are handed to that page, which takes them up where they are.
import { forming } from './world/sprites.js';

const SETTLE = 900; // the transform transition of the shapes in css/door.css
const FADE = 600; // the opacity transition of .threshold.is-forming, after SETTLE
const GROW = 1500;
const PLAIN = 1100; // the opacity transition of .threshold, with less motion
const HANDED = 'athena-forma'; // read by veloce/index.html

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const ease = (t) => 1 - (1 - t) ** 3;

export function createThreshold(root, { onEnter, onLeave }) {
  const enter = root.querySelector('.threshold__enter');
  const sound = root.querySelector('.threshold__sound');
  const works = root.querySelector('a.threshold__way');
  const withSound = () => sound.getAttribute('aria-checked') === 'true';
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  // The park grows from nothing to whole over GROW, or at once when skipped.
  let skipped = false;
  const grow = () => new Promise((done) => {
    const start = performance.now();
    const step = (now) => {
      const t = skipped ? 1 : Math.min(1, (now - start) / GROW);
      forming.value = ease(t);
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });

  const go = async () => {
    if (root.classList.contains('is-entered')) return;
    root.classList.add('is-entered');
    if (still.matches) {
      await Promise.all([onEnter(withSound()), wait(PLAIN)]);
      root.hidden = true;
      onLeave();
      return;
    }
    forming.value = 0;
    root.classList.add('is-forming');
    // A tap or a key while it happens: the park is there at once.
    let settled;
    const skip = () => {
      skipped = true;
      root.hidden = true;
      settled?.();
    };
    addEventListener('pointerdown', skip, { once: true });
    addEventListener('keydown', skip, { once: true });
    const entering = onEnter(withSound());
    await new Promise((done) => {
      settled = done;
      setTimeout(done, SETTLE);
    });
    const growing = grow();
    await Promise.all([entering, skipped || wait(FADE)]);
    root.hidden = true;
    onLeave();
    await growing;
    removeEventListener('pointerdown', skip);
    removeEventListener('keydown', skip);
  };

  root.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
  enter.addEventListener('click', go);
  sound.addEventListener('click', () => sound.setAttribute('aria-checked', String(!withSound())));
  // The shapes go with whoever goes to the works, for that page to take them up.
  works.addEventListener('click', (event) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || still.matches) return;
    try {
      sessionStorage.setItem(HANDED, root.querySelector('.threshold__forma').innerHTML);
    } catch {
      // Without storage the page of the works opens plainly.
    }
  });

  return {
    ready() {
      root.classList.add('is-ready');
      enter.disabled = false;
      sound.disabled = false;
    },
  };
}
