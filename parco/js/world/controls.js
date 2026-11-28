// How the visitor moves, with nothing to learn. Mouse: the look follows the pointer without pressing
// anything (straight ahead in the middle, about 25 degrees halfway to an edge, about 65 at the edge,
// up to 15 up and down), and in the last 8% towards a side the way one faces turns slowly too; over a
// work, a name, a portal or a button the look stays still, so that a hand not quite steady can reach
// it. A click does the obvious thing where it points (main.js). Dragging turns the way one faces.
// Finger: dragging looks, a tap goes, holding the lower part of the screen walks ahead. Keys: W and S
// or the up and down arrows walk, A and D or the side arrows turn. The wheel walks a notch.
const LOOK = { mouse: 0.0035, touch: 0.00225 };
const TURN_SPEED = 1.7;
const deg = (value) => (value * Math.PI) / 180;
// The look away from the way one faces, for a pointer at n (-1 to 1) from the middle of the screen:
// 35|n| + 30n² degrees, so 25 at halfway and 65 at the edge; and up and down.
const AWAY = (n) => Math.sign(n) * deg(35 * Math.abs(n) + 30 * n * n);
const UPDOWN = deg(15);
// The last stretch towards a side, and how fast the way one faces turns at the very edge.
const EDGE = 0.92;
const EDGE_TURN = deg(40);
// The look follows in about 150 ms, so that it never trembles.
const FOLLOW = 0.05;
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
  // The look away from the way one faces, as it is and as the pointer asks; still while held.
  const gaze = { yaw: 0, pitch: 0, wantYaw: 0, wantPitch: 0, held: false };
  let press;
  let holdTimer;
  let lastTap = 0;
  let scrolled = 0;
  let way = 0;
  let scrollTime = -Infinity;

  // The look the pointer asks for, where it rests. Over a button, the bar, a panel or a name, or
  // coming near a name (near), the look stops where it is at once, so that what one reaches for does
  // not slide away from under the hand.
  let near = () => false;
  const freeze = () => {
    gaze.wantYaw = gaze.yaw;
    gaze.wantPitch = gaze.pitch;
  };
  const follow = () => {
    if (press) return;
    if (!mouse || gaze.held || near(mouse.x, mouse.y)) return freeze();
    gaze.wantYaw = AWAY((mouse.x / innerWidth) * 2 - 1);
    gaze.wantPitch = -((mouse.y / innerHeight) * 2 - 1) * UPDOWN;
  };
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    mouse = event.target === surface ? { x: event.clientX, y: event.clientY } : undefined;
    follow();
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

  // In the last stretch towards a side, the way one faces turns, slowly at first.
  function edge() {
    if (!mouse || press || gaze.held) return 0;
    const n = (mouse.x / innerWidth) * 2 - 1;
    return Math.abs(n) > EDGE ? Math.sign(n) * ((Math.abs(n) - EDGE) / (1 - EDGE)) * EDGE_TURN : 0;
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
    // Held keys and the edge: the walk wanted (-1, 0, 1) and the turn to make this frame, in radians.
    held: (dt) => ({ walk: keys.walk, turn: (keys.turn * TURN_SPEED + edge()) * dt }),
    // The look away from the way one faces, following the pointer; level: the up and down asked for
    // goes back to the horizon (one is walking).
    gaze(dt, level) {
      const k = 1 - Math.exp(-dt / FOLLOW);
      if (level) gaze.wantPitch = 0;
      gaze.yaw += (gaze.wantYaw - gaze.yaw) * k;
      gaze.pitch += (gaze.wantPitch - gaze.pitch) * k;
      // Settled: exactly where it was asked, so that nothing goes on moving by a hair.
      if (Math.abs(gaze.wantYaw - gaze.yaw) < 1e-5) gaze.yaw = gaze.wantYaw;
      if (Math.abs(gaze.wantPitch - gaze.pitch) < 1e-5) gaze.pitch = gaze.wantPitch;
      return gaze;
    },
    // Over something to click the look holds still, until the pointer leaves it.
    hold(on) {
      if (on === gaze.held) return;
      gaze.held = on;
      follow();
    },
    // What else holds the look still when the pointer comes near it: fn(x, y).
    holdNear(fn) {
      near = fn;
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
