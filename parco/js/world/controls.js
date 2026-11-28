// How the visitor moves, with nothing to learn and nothing to get out of. Mouse: the look turns while
// the pointer rests in a band at the left or right edge of the park (faster towards the edge, still
// in the middle), dragging looks around, a click does the obvious thing where it points (main.js).
// Finger: dragging looks, a tap goes, holding the lower part of the screen walks ahead. Keys: W and S
// or the up and down arrows walk, A and D or the side arrows turn. The wheel walks a notch.
const LOOK = { mouse: 0.0035, touch: 0.00225 };
const TURN_SPEED = 1.7;
// The bands at the sides: their share of the width, and the turn at the very edge (50 degrees a second).
const BAND = 0.14;
const BAND_SPEED = (50 * Math.PI) / 180;
const SLOP = 9;
const TAP_TIME = 350;
const HOLD_TIME = 260;
const DOUBLE_TAP = 320;
const LOWER = 0.55;
// Pixels of scroll that make a notch, after the first event of a stroke, which is one at once.
const NOTCH = 40;
const FORWARD = new Set(['ArrowUp', 'w', 'W']);
const BACK = new Set(['ArrowDown', 's', 'S']);
const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);

export function createControls(surface, { onWalk, onLook, onTap, onJump, onHold }) {
  const keys = { walk: 0, turn: 0 };
  // Where the mouse rests over the park itself (not over a button, the bar or a panel), if it does.
  let mouse;
  let press;
  let holdTimer;
  let lastTap = 0;
  let scrolled = 0;
  let way = 0;
  let scrollTime = -Infinity;

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') mouse = event.target === surface ? { x: event.clientX, y: event.clientY } : undefined;
  });
  document.documentElement.addEventListener('pointerleave', () => { mouse = undefined; });
  addEventListener('blur', () => { mouse = undefined; });

  surface.addEventListener('wheel', (event) => {
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * scale;
    if (!delta) return;
    if (event.timeStamp - scrollTime > 200 || Math.sign(delta) !== way) {
      way = Math.sign(delta);
      scrolled = NOTCH;
    } else scrolled += Math.abs(delta);
    scrollTime = event.timeStamp;
    if (scrolled < NOTCH) return;
    scrolled = 0;
    onWalk(way);
  }, { passive: false });

  surface.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button) return;
    press = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, t: event.timeStamp, moved: false, holding: false, look: LOOK[event.pointerType] ?? LOOK.mouse };
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
    onLook(-(event.clientX - press.lastX) * press.look, (event.clientY - press.lastY) * press.look);
    press.lastX = event.clientX;
    press.lastY = event.clientY;
  });

  const release = (event) => {
    if (!press || !event.isPrimary) return;
    clearTimeout(holdTimer);
    if (press.holding) onHold(false);
    else if (!press.moved && event.timeStamp - press.t < TAP_TIME && event.type === 'pointerup') {
      if (event.pointerType !== 'mouse' && event.timeStamp - lastTap < DOUBLE_TAP) {
        lastTap = 0;
        onJump();
      } else {
        lastTap = event.timeStamp;
        onTap(event.clientX, event.clientY, event.pointerType);
      }
    }
    press = undefined;
  };
  surface.addEventListener('pointerup', release);
  surface.addEventListener('pointercancel', release);

  // The turn of the bands at the sides, in radians a second: none while a button is pressed.
  function band() {
    if (mouse === undefined || press) return 0;
    const edge = innerWidth * BAND;
    if (mouse.x < edge) return -(1 - mouse.x / edge) * BAND_SPEED;
    if (mouse.x > innerWidth - edge) return (1 - (innerWidth - mouse.x) / edge) * BAND_SPEED;
    return 0;
  }

  return {
    // The mouse is never captured; the travel bar still calls these.
    lock() {},
    unlock() {},
    key(event, down) {
      const set = (name, value) => {
        keys[name] = down ? value : keys[name] === value ? 0 : keys[name];
        return true;
      };
      if (FORWARD.has(event.key)) return set('walk', 1);
      if (BACK.has(event.key)) return set('walk', -1);
      if (LEFT.has(event.key)) return set('turn', -1);
      if (RIGHT.has(event.key)) return set('turn', 1);
      return false;
    },
    // Held keys and the bands: the walk wanted (-1, 0, 1) and the turn to make this frame, in radians.
    held: (dt) => ({ walk: keys.walk, turn: (keys.turn * TURN_SPEED + band()) * dt }),
    // Where the mouse rests over the park, for the label that says what a click does there.
    pointer: () => mouse,
    stop() {
      keys.walk = 0;
      keys.turn = 0;
      if (press?.holding) onHold(false);
      press = undefined;
    },
  };
}
