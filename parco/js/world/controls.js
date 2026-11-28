// How the visitor moves, with nothing to learn. Mouse: the look follows the pointer without pressing
// anything, calmly: still in the middle of the screen, up to about 40 degrees at the edge and 8 up and
// down; over a work, a name, a portal or a button the look stays still, so that a hand not quite steady
// can reach it. To turn round there are two large arrows at the sides, «Girati a sinistra» and «Girati
// a destra»: resting the mouse on one, or holding a finger on it, turns; so does the last 8% of the
// screen towards a side, and so do the side arrow keys. A click does the obvious thing where it points
// (main.js). Dragging turns the way one faces. Finger: dragging looks, a tap goes, holding the lower
// part of the screen walks ahead. Keys: W and S or the up and down arrows walk, A and D or the side
// arrows turn. The wheel walks a notch.
const LOOK = { mouse: 0.0035, touch: 0.00225 };
const deg = (value) => (value * Math.PI) / 180;
// The middle of the screen where the look stays still: 12% of its width (and of its height).
const STILL = 0.12;
// From the edge of the still middle to the edge of the screen: a soft start over the first 30%, then
// even, so that no stretch of the screen turns the look faster than another.
const SOFT = 0.3;
const curve = (n) => {
  const m = Math.max(0, Math.abs(n) - STILL / 2) / (1 - STILL / 2);
  return (Math.sign(n) * (m < SOFT ? (m * m) / (2 * SOFT) : m - SOFT / 2)) / (1 - SOFT / 2);
};
const AWAY = (n) => curve(n) * deg(40);
const UPDOWN = (n) => curve(n) * deg(8);
// The last stretch towards a side.
const EDGE = 0.92;
// Turning round: slowly at first, up to 45 degrees a second within half a second; stopped at once.
const TURN = deg(45);
const TURN_RISE = 0.5;
// The look follows in about 150 ms and is still within 250: it eases in, and its last stretch is
// covered at no less than 0.6 radians a second, so that it never creeps on.
const FOLLOW = 0.04;
const SETTLE = 0.6;
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

// The two arrows at the sides, written with what they do.
function arrow(side, text) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `turn turn--${side}`;
  node.tabIndex = -1;
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = `<span class="turn__arrow">${side === 'left' ? '‹' : '›'}</span><span class="turn__label">${text}</span>`;
  document.body.append(node);
  return node;
}

export function createControls(surface, { onWalk, onLook, onTap, onJump, onHold }) {
  const keys = { walk: 0, turn: 0 };
  // The way an arrow at the side asks to turn (-1, 0, 1), and for how long one has been turning.
  let arrowTurn = 0;
  let turning = 0;
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
    gaze.wantPitch = -UPDOWN((mouse.y / innerHeight) * 2 - 1);
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

  // The arrows: the mouse resting on one turns, and a finger or the mouse holding it. They show while
  // the mouse moves over the park, and stay on a phone.
  const arrows = [arrow('left', 'Girati a sinistra'), arrow('right', 'Girati a destra')];
  let shownTimer;
  const show = () => {
    for (const node of arrows) node.classList.add('is-shown');
    clearTimeout(shownTimer);
    shownTimer = setTimeout(() => {
      if (!arrowTurn) for (const node of arrows) node.classList.remove('is-shown');
    }, 3000);
  };
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' && (event.movementX || event.movementY)) show();
  });
  arrows.forEach((node, index) => {
    const way = index ? 1 : -1;
    const start = () => {
      arrowTurn = way;
      node.classList.add('is-held');
    };
    const end = () => {
      if (arrowTurn === way) arrowTurn = 0;
      node.classList.remove('is-held');
      show();
    };
    node.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') start(); });
    node.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      start();
    });
    node.addEventListener('pointerleave', end);
    node.addEventListener('pointerup', (event) => { if (event.pointerType !== 'mouse') end(); });
    node.addEventListener('pointercancel', end);
    node.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  // Which way one is asked to turn: an arrow at the side, a side key, or the mouse in the last
  // stretch towards a side.
  function asked() {
    if (arrowTurn) return arrowTurn;
    if (keys.turn) return keys.turn;
    if (!mouse || press || gaze.held) return 0;
    const n = (mouse.x / innerWidth) * 2 - 1;
    return Math.abs(n) > EDGE ? Math.sign(n) : 0;
  }
  function turn(dt) {
    const way = asked();
    turning = way ? turning + dt : 0;
    const rise = Math.min(1, turning / TURN_RISE);
    return way * TURN * rise * rise * (3 - 2 * rise) * dt;
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
    // Held keys, arrows and the edge: the walk wanted (-1, 0, 1) and the turn to make this frame, in radians.
    held: (dt) => ({ walk: keys.walk, turn: turn(dt) }),
    arrows,
    // The look away from the way one faces, following the pointer; level: the up and down asked for
    // goes back to the horizon (one is walking).
    gaze(dt, level) {
      const k = 1 - Math.exp(-dt / FOLLOW);
      if (level) gaze.wantPitch = 0;
      const toward = (value, want) => {
        const left = want - value;
        const step = Math.sign(left) * Math.max(Math.abs(left) * k, SETTLE * dt);
        return Math.abs(step) >= Math.abs(left) ? want : value + step;
      };
      gaze.yaw = toward(gaze.yaw, gaze.wantYaw);
      gaze.pitch = toward(gaze.pitch, gaze.wantPitch);
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
