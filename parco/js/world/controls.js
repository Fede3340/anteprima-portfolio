// How the visitor moves, as in a walking game for people who do not play. With one finger or the
// mouse: dragging looks around, a tap (or click) on a place goes there, holding the lower part of the
// screen walks ahead. Keys: W and S or the up and down arrows walk, A and D or the side arrows turn.
// The wheel walks a step or two each notch.
const WHEEL = 0.018;
const LOOK = 0.0045;
const TURN_SPEED = 1.7;
const SLOP = 9;
const TAP_TIME = 350;
const HOLD_TIME = 260;
const DOUBLE_TAP = 320;
const LOWER = 0.55;
const FORWARD = new Set(['ArrowUp', 'w', 'W']);
const BACK = new Set(['ArrowDown', 's', 'S']);
const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);

export function createControls(surface, { onWalk, onLook, onTap, onJump, onHold }) {
  const keys = { walk: 0, turn: 0 };
  let press;
  let holdTimer;
  let lastTap = 0;

  surface.addEventListener('wheel', (event) => {
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * scale;
    onWalk(Math.max(-2.5, Math.min(2.5, delta * WHEEL)));
  }, { passive: false });

  surface.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button) return;
    press = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, t: event.timeStamp, moved: false, holding: false };
    surface.setPointerCapture(event.pointerId);
    // Held still in the lower part of the screen, the press becomes a walk ahead.
    if (event.clientY > innerHeight * LOWER) {
      holdTimer = setTimeout(() => {
        if (!press || press.moved) return;
        press.holding = true;
        onHold(true);
      }, HOLD_TIME);
    }
  });

  surface.addEventListener('pointermove', (event) => {
    if (!press || !event.isPrimary) return;
    if (!press.moved && !press.holding && Math.hypot(event.clientX - press.x, event.clientY - press.y) < SLOP) return;
    if (press.holding) return;
    press.moved = true;
    onLook(-(event.clientX - press.lastX) * LOOK, (event.clientY - press.lastY) * LOOK);
    press.lastX = event.clientX;
    press.lastY = event.clientY;
  });

  const release = (event) => {
    if (!press || !event.isPrimary) return;
    clearTimeout(holdTimer);
    if (press.holding) onHold(false);
    else if (!press.moved && event.timeStamp - press.t < TAP_TIME && event.type === 'pointerup') {
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
      const set = (name, way) => {
        keys[name] = down ? way : keys[name] === way ? 0 : keys[name];
        return true;
      };
      if (FORWARD.has(event.key)) return set('walk', 1);
      if (BACK.has(event.key)) return set('walk', -1);
      if (LEFT.has(event.key)) return set('turn', -1);
      if (RIGHT.has(event.key)) return set('turn', 1);
      return false;
    },
    // Held keys: the walk wanted (-1, 0, 1) and the turn to make this frame, in radians.
    held: (dt) => ({ walk: keys.walk, turn: keys.turn * TURN_SPEED * dt }),
    stop() {
      keys.walk = 0;
      keys.turn = 0;
      if (press?.holding) onHold(false);
      press = undefined;
    },
  };
}
