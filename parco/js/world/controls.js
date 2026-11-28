// How the visitor moves, with nothing to learn and nothing to switch on. «Avanti» (main.js) is the
// one action for whoever does not want to think; everything else is there at any moment. The mouse
// resting or moving moves nothing. Dragging (mouse held or finger) turns the look, and it stays where
// it was left. A click or a tap does the obvious thing where it points (main.js). The wheel takes one
// stop for each gesture, a quick swipe up the next stop and down the one before. On a phone holding the
// lower part of the screen walks ahead. Keys, for whoever plays: W and S or the up and down arrows walk,
// A and D or the side arrows turn.
const LOOK = { mouse: 0.0035, touch: 0.00225 };
// Turning with the keys: up to 90 degrees a second within a third of a second, stopped at once.
const TURN = Math.PI / 2;
const TURN_RISE = 0.3;
const SLOP = 9;
const TAP_TIME = 350;
const HOLD_TIME = 260;
const DOUBLE_TAP = 320;
const LOWER = 0.55;
// A swipe that takes a stop: mostly up or down, this long (pixels), this quick (ms).
const SWIPE = 50;
const SWIPE_TIME = 600;
// A new gesture of the wheel: the first event after this pause (ms), or the other way.
const GESTURE = 250;
const FORWARD = new Set(['ArrowUp', 'w', 'W']);
const BACK = new Set(['ArrowDown', 's', 'S']);
const LEFT = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'd', 'D']);

export function createControls(surface, { onLook, onTap, onJump, onHold, onStep }) {
  const keys = { walk: 0, turn: 0 };
  // How long the turn key has been held.
  let turning = 0;
  // Where the mouse rests over the park itself (not over a button, the bar or a panel), if it does.
  let mouse;
  let press;
  let holdTimer;
  let lastTap = 0;
  let way = 0;
  let scrollTime = -Infinity;

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') mouse = event.target === surface ? { x: event.clientX, y: event.clientY } : undefined;
  });
  document.documentElement.addEventListener('pointerleave', () => { mouse = undefined; });
  addEventListener('blur', () => { mouse = undefined; });

  surface.addEventListener('wheel', (event) => {
    event.preventDefault();
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) return;
    const fresh = event.timeStamp - scrollTime > GESTURE || Math.sign(delta) !== way;
    scrollTime = event.timeStamp;
    way = Math.sign(delta);
    if (fresh) onStep(way);
  }, { passive: false });

  surface.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button) return;
    press = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, t: event.timeStamp, moved: false, holding: false, look: LOOK[event.pointerType] ?? LOOK.mouse };
    surface.setPointerCapture(event.pointerId);
    // A finger held still in the lower part of the screen walks ahead.
    if (event.pointerType !== 'mouse' && event.clientY > innerHeight * LOWER) {
      holdTimer = setTimeout(() => {
        if (!press || press.moved) return;
        press.holding = true;
        onHold(true);
      }, HOLD_TIME);
    }
  });

  surface.addEventListener('pointermove', (event) => {
    if (!press || !event.isPrimary || press.holding) return;
    if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) < SLOP) return;
    press.moved = true;
    onLook(-(event.clientX - press.lastX) * press.look, (event.clientY - press.lastY) * press.look);
    press.lastX = event.clientX;
    press.lastY = event.clientY;
  });

  const release = (event) => {
    if (!press || !event.isPrimary) return;
    clearTimeout(holdTimer);
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    const quick = event.timeStamp - press.t;
    if (press.holding) onHold(false);
    else if (press.moved) {
      // A quick swipe up or down takes a stop; any other drag leaves the look where it is.
      if (Math.abs(dy) > SWIPE && Math.abs(dy) > Math.abs(dx) * 1.5 && quick < SWIPE_TIME) onStep(dy < 0 ? 1 : -1);
    } else if (quick < TAP_TIME && event.type === 'pointerup') {
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

  return {
    // The mouse is never captured; the travel bar still calls these.
    lock() {},
    unlock() {},
    // Keys that walk and turn; true when the key was one of them.
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
    // Held keys: the walk wanted (-1, 0, 1) and the turn to make this frame, in radians.
    held(dt) {
      turning = keys.turn ? turning + dt : 0;
      const rise = Math.min(1, turning / TURN_RISE);
      return { walk: keys.walk, turn: keys.turn * TURN * rise * rise * (3 - 2 * rise) * dt };
    },
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
