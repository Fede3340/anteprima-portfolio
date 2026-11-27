const SLOP = 8;

// Sideways dragging with the finger or the mouse. A press that travels less than a few pixels stays
// a click; one that travels further is a drag, and the click that would follow it is swallowed.
export function createDrag(surface, { move, end }) {
  let start;
  let last;
  let dragging = false;

  surface.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    last = { x: event.clientX, t: event.timeStamp, v: 0 };
    dragging = false;
  });

  surface.addEventListener('pointermove', (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    if (!dragging) {
      if (Math.abs(dx) < SLOP || Math.abs(dx) < Math.abs(event.clientY - start.y)) return;
      dragging = true;
      surface.setPointerCapture(event.pointerId);
    }
    const dt = Math.max(1, event.timeStamp - last.t);
    last = { x: event.clientX, t: event.timeStamp, v: 0.8 * ((event.clientX - last.x) / dt) + 0.2 * last.v };
    move(dx);
  });

  const finish = (event) => {
    if (!start || event.pointerId !== start.id) return;
    if (dragging) end(event.clientX - start.x, event.timeStamp - last.t > 80 ? 0 : last.v);
    start = undefined;
  };
  surface.addEventListener('pointerup', finish);
  surface.addEventListener('pointercancel', finish);

  surface.addEventListener('click', (event) => {
    if (!dragging) return;
    dragging = false;
    event.stopPropagation();
    event.preventDefault();
  }, true);
}

// A drag far enough, or quick enough, turns the page: -1 back, 1 forward, 0 stays.
export const turn = (dx, velocity, width) => {
  if (dx < -width * 0.18 || velocity < -0.45) return 1;
  if (dx > width * 0.18 || velocity > 0.45) return -1;
  return 0;
};
