// How the visitor moves, as in a walking game. With a mouse the pointer is captured (Pointer Lock):
// moving it turns the look, a click opens the work in front (main.js decides); Esc
// lets it go and the next click takes it back. Without capture, and on a phone: dragging looks
// around, a tap on a place goes there, holding the lower part of the screen walks ahead. Keys: W and S
// or the up and down arrows walk, A and D step aside, the side arrows turn. The wheel walks a notch.
const MOUSE = 0.0009;
const LOOK = 0.00225;
const TURN_SPEED = 1.7;
const SLOP = 9;
const TAP_TIME = 350;
const HOLD_TIME = 260;
const DOUBLE_TAP = 320;
const LOWER = 0.55;
// Pixels of scroll that make a notch, after the first event of a stroke, which is one at once.
const NOTCH = 40;
const FORWARD = new Set(['ArrowUp', 'w', 'W']);
const BACK = new Set(['ArrowDown', 's', 'S']);
const LEFT = new Set(['a', 'A']);
const RIGHT = new Set(['d', 'D']);
const TURN_LEFT = new Set(['ArrowLeft']);
const TURN_RIGHT = new Set(['ArrowRight']);

export function createControls(surface, { onWalk, onLook, onTap, onJump, onHold, onLock }) {
  const keys = { walk: 0, side: 0, turn: 0 };
  const fine = matchMedia('(pointer: fine)').matches;
  let press;
  let holdTimer;
  let lastTap = 0;
  let scrolled = 0;
  let way = 0;
  let scrollTime = -Infinity;
  // The capture is wanted from the door on, and not while a work is open.
  let wanted = false;
  const locked = () => document.pointerLockElement === surface;

  function lock() {
    if (!fine) return;
    wanted = true;
    if (locked()) return;
    // Raw movement where the browser has it; where it does not, the plain capture. Any other refusal
    // (no click to answer, Esc just pressed) arrives as pointerlockerror, handled below.
    const asked = surface.requestPointerLock({ unadjustedMovement: true });
    asked?.catch((error) => (error.name === 'NotSupportedError' ? surface.requestPointerLock()?.catch(() => {}) : undefined));
  }
  document.addEventListener('pointerlockchange', () => onLock(locked(), wanted));
  document.addEventListener('pointerlockerror', () => onLock(false, wanted));

  document.addEventListener('mousemove', (event) => {
    if (locked()) onLook(event.movementX * MOUSE, -event.movementY * MOUSE);
  });

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
    // Captured, the click is the middle of the screen's; let go after Esc, a click takes the mouse back.
    if (locked()) {
      onTap(innerWidth / 2, innerHeight / 2);
      return;
    }
    if (wanted) {
      lock();
      return;
    }
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
    lock,
    locked,
    // The mouse let go on purpose (a work opens): no invitation to click back.
    unlock() {
      wanted = false;
      if (locked()) document.exitPointerLock();
    },
    key(event, down) {
      const set = (name, way) => {
        keys[name] = down ? way : keys[name] === way ? 0 : keys[name];
        return true;
      };
      if (FORWARD.has(event.key)) return set('walk', 1);
      if (BACK.has(event.key)) return set('walk', -1);
      if (LEFT.has(event.key)) return set('side', -1);
      if (RIGHT.has(event.key)) return set('side', 1);
      if (TURN_LEFT.has(event.key)) return set('turn', -1);
      if (TURN_RIGHT.has(event.key)) return set('turn', 1);
      return false;
    },
    // Held keys: the walk and the step aside wanted (-1, 0, 1), and the turn to make this frame.
    held: (dt) => ({ walk: keys.walk, side: keys.side, turn: keys.turn * TURN_SPEED * dt }),
    stop() {
      keys.walk = 0;
      keys.side = 0;
      keys.turn = 0;
      if (press?.holding) onHold(false);
      press = undefined;
    },
  };
}
