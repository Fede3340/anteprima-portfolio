// The door: the park at dawn as a picture, the name and the two ways in. A tap dissolves the picture
// into the park, already seen from where one walks.
const FADE = 1100; // the opacity transition of .threshold in css/door.css

export function createThreshold(root, { onEnter, onLeave }) {
  const enter = root.querySelector('.threshold__enter');
  const quiet = root.querySelector('.threshold__quiet');

  const go = async (withSound) => {
    if (root.classList.contains('is-entered')) return;
    root.classList.add('is-entered');
    await Promise.all([onEnter(withSound), new Promise((done) => setTimeout(done, FADE))]);
    root.hidden = true;
    onLeave();
  };

  root.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
  enter.addEventListener('click', () => go(true));
  quiet.addEventListener('click', () => go(false));

  return {
    ready() {
      root.classList.add('is-ready');
      enter.disabled = false;
      quiet.disabled = false;
      enter.focus({ preventScroll: true });
    },
  };
}
