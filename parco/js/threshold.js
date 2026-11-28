// The door: the park at dawn as a picture, the name and the two ways: into the park, or straight to
// the works. A tap on the first dissolves the picture into the park, already seen from where one walks.
const FADE = 1100; // the opacity transition of .threshold in css/door.css

export function createThreshold(root, { onEnter, onLeave }) {
  const enter = root.querySelector('.threshold__enter');
  const sound = root.querySelector('.threshold__sound');
  const withSound = () => sound.getAttribute('aria-checked') === 'true';

  const go = async () => {
    if (root.classList.contains('is-entered')) return;
    root.classList.add('is-entered');
    await Promise.all([onEnter(withSound()), new Promise((done) => setTimeout(done, FADE))]);
    root.hidden = true;
    onLeave();
  };

  root.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
  enter.addEventListener('click', go);
  sound.addEventListener('click', () => sound.setAttribute('aria-checked', String(!withSound())));

  return {
    ready() {
      root.classList.add('is-ready');
      enter.disabled = false;
      sound.disabled = false;
    },
  };
}
