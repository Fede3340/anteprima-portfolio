// Every way of walking turns into metres along the ring. A wheel notch or a short swipe is about
// five metres; the step is taken in the same frame and settles with very little drift. Dragging
// sideways turns the look instead, which goes back to the path once let go.
const WHEEL = 0.05;
const SWIPE = 0.045;
const TURN = 0.0032;
const KEY_SPEED = 5;
const SLOP = 8;
const TAP_TIME = 450;
const DOUBLE_TAP = 320;
const FORWARD = new Set(['ArrowUp', 'ArrowRight', 'w', 'W']);
const BACK = new Set(['ArrowDown', 'ArrowLeft', 's', 'S']);

export function createControls(surface, { onWalk, onTurn, onTap, onJump, onLook }) {
  let held = 0;
  let press;
  let lastTap = 0;
  let fling = 0;

  surface.addEventListener('wheel', (event) => {
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * scale;
    onWalk(Math.max(-8, Math.min(8, delta * WHEEL)));
  }, { passive: false });

  surface.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button) return;
    press = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, t: event.timeStamp, moved: false, v: 0, last: event.timeStamp };
    fling = 0;
  });

  surface.addEventListener('pointermove', (event) => {
    onLook?.(event.clientX / innerWidth - 0.5, event.clientY / innerHeight - 0.5);
    if (!press || !event.isPrimary) return;
    if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) < SLOP) return;
    if (!press.moved) {
      press.moved = true;
      surface.setPointerCapture(event.pointerId);
    }
    const dx = event.clientX - press.lastX;
    const dy = event.clientY - press.lastY;
    // Up goes forward, as a page scrolls; sideways the look turns, as if the park were held.
    const metres = -dy * SWIPE;
    onTurn(dx * TURN, true);
    const dt = Math.max(1, event.timeStamp - press.last);
    press.v = 0.7 * (metres / dt) * 1000 + 0.3 * press.v;
    press.last = event.timeStamp;
    press.lastX = event.clientX;
    press.lastY = event.clientY;
    onWalk(metres);
  });

  const release = (event) => {
    if (!press || !event.isPrimary) return;
    if (press.moved) {
      onTurn(0, false);
      if (event.timeStamp - press.last < 80) fling = Math.max(-14, Math.min(14, press.v * 0.6));
    } else if (event.timeStamp - press.t < TAP_TIME && event.type === 'pointerup') {
      if (event.timeStamp - lastTap < DOUBLE_TAP) {
        lastTap = 0;
        onJump();
      } else {
        lastTap = event.timeStamp;
        onTap(event.clientX, event.clientY);
      }
    }
    press = undefined;
  };
  surface.addEventListener('pointerup', release);
  surface.addEventListener('pointercancel', release);

  return {
    key(event, down) {
      const way = FORWARD.has(event.key) ? 1 : BACK.has(event.key) ? -1 : 0;
      if (!way) return false;
      held = down ? way : held === way ? 0 : held;
      return true;
    },
    // Metres to add this frame from held keys and the glide after a quick swipe.
    step(dt) {
      fling *= Math.exp(-dt / 0.22);
      if (Math.abs(fling) < 0.05) fling = 0;
      return (held * KEY_SPEED + fling) * dt;
    },
    stop() {
      held = 0;
      fling = 0;
    },
  };
}
