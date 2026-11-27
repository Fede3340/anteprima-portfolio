// While the button is held the page runs through the given scroll range in `seconds`, starting at
// full pace. Let go past halfway and it finishes on its own; let go earlier and it stops there.
export function createHold(button, { range, seconds }) {
  let tween;

  const share = () => {
    const [start, end] = range();
    return (window.scrollY - start) / (end - start);
  };

  const release = () => {
    button.classList.remove('is-held');
    if (!tween || share() >= 0.5) return;
    tween.kill();
    tween = undefined;
  };

  const press = () => {
    button.classList.add('is-held');
    if (tween) return;
    const [start, end] = range();
    const travel = { y: Math.max(window.scrollY, start) };
    tween = gsap.to(travel, {
      y: end,
      duration: (seconds * (end - travel.y)) / (end - start),
      ease: 'power1.out',
      onUpdate: () => window.scrollTo({ top: travel.y, behavior: 'instant' }),
      onComplete: () => {
        tween = undefined;
        button.classList.remove('is-held');
      },
    });
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
