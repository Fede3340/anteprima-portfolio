// While the button is held the page advances at a constant pace across the given scroll range.
export function createHold(button, { range, seconds }) {
  let frame = 0;
  let previous = 0;
  let target = 0;

  const release = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    button.classList.remove('is-held');
  };

  const step = (now) => {
    const [start, end] = range();
    target = Math.min(end, target + ((end - start) / (seconds * 1000)) * (now - previous));
    previous = now;
    window.scrollTo({ top: target, behavior: 'instant' });
    if (target < end) frame = requestAnimationFrame(step);
    else release();
  };

  const press = () => {
    if (frame) return;
    button.classList.add('is-held');
    previous = performance.now();
    target = Math.max(window.scrollY, range()[0]);
    frame = requestAnimationFrame(step);
  };

  button.addEventListener('pointerdown', (event) => {
    if (event.button) return;
    button.setPointerCapture(event.pointerId);
    press();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'keyup', 'blur']) button.addEventListener(type, release);
  button.addEventListener('keydown', (event) => {
    if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
    event.preventDefault();
    press();
  });
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('visibilitychange', release);
}
