// The door: the name and the two ways in, over the park seen from far among the clouds. A tap
// brings the camera down to the walker; the door fades while it comes.
export function createThreshold(root, { onEnter, onLeave }) {
  const enter = root.querySelector('.threshold__enter');
  const quiet = root.querySelector('.threshold__quiet');

  const go = async (withSound) => {
    if (root.classList.contains('is-entered')) return;
    root.classList.add('is-entered');
    await onEnter(withSound);
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
