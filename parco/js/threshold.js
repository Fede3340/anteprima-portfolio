// The start of the flow, before the first stop of the park. One number, the way gone (0 to 1), follows
// the wheel, a swipe, the keys and «Avanti», forwards and back: the shapes of the opening go home and
// become the things of the park, the name goes to its corner, the way forks (on into the park, or
// aside to all the works on one page), and the park takes shape behind as the door fades. At 1 the
// visit begins; «Indietro» from its first stop comes back here.
import { createForma, mix, place, shapes, smooth } from './forma.js';
import { forming } from './world/sprites.js';

const FORK = 0.45;
const STOPS = [0, FORK, 1];
// How much wheel and how many screens of swipe make the whole way.
const WHEEL = 1600;
const SWIPE = 1.4;
// Past the fork the way does not rest half done: after a pause it goes on or back.
const REST = 450;

export function createThreshold(root, { onBegin, onSound, onArrive }) {
  const field = createForma(true);
  root.querySelector('.threshold__forma').append(field);
  const name = root.querySelector('.threshold__name');
  const fork = root.querySelector('.threshold__bivio');
  const avanti = root.querySelector('.threshold__avanti');
  const verso = root.querySelector('.threshold__verso');
  const sound = root.querySelector('.threshold__sound');
  const foot = root.querySelector('.threshold__piede');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const heard = () => sound.getAttribute('aria-checked') === 'true';

  let drawn;
  let corner;
  let gone = 0;
  // How quickly the way follows what is wanted: at once for a gesture, slowly when the disc is pressed.
  let pace = 9;
  let want = 0;
  let ready = false;
  let begun = false;
  let park = true;
  let looping = false;
  let last = 0;
  let restTimer;
  let soundOn = false;

  // Where the name goes: onto the name in the corner.
  function measure() {
    drawn = shapes(field);
    const brand = document.querySelector('.brand__mark')?.getBoundingClientRect();
    name.style.transform = 'none';
    const mark = name.querySelector('.threshold__mark').getBoundingClientRect();
    corner = brand && brand.height
      ? { x: brand.left + brand.width / 2 - (mark.left + mark.width / 2), y: brand.top + brand.height / 2 - (mark.top + mark.height / 2), s: brand.height / mark.height }
      : { x: -innerWidth / 2, y: -innerHeight / 2, s: 0.2 };
  }

  // The way, in shares of it: the name rises to its corner and is gone by NAMED; the sun moves aside
  // by the fork, where the two choices stand alone in their place, clear and whole; past the fork the
  // choices go, the things go home (HOME), the door fades on the park (FADE) and the park takes shape.
  const NAMED = 0.2;
  const HOME = [0.6, 0.74];
  const FADE = [0.68, 0.88];
  function draw() {
    const g = gone;
    if (drawn) {
      const view = drawn.view();
      const aside = still.matches ? 0 : smooth(g / FORK);
      const home = still.matches ? 0 : smooth((g - HOME[0]) / (HOME[1] - HOME[0]));
      for (const shape of drawn.list) place(shape, mix(mix(shape.start, shape.fork, aside), shape.home, home), view);
    }
    const lift = smooth(g / NAMED);
    name.style.transform = still.matches ? 'none' : `translate(${corner.x * lift}px, ${corner.y * lift}px) scale(${1 + (corner.s - 1) * lift})`;
    name.style.opacity = String(1 - lift);
    name.style.visibility = lift >= 1 ? 'hidden' : '';
    document.documentElement.classList.toggle('flusso-angolo', g >= NAMED);
    // The choices are there whole, or not at all: a short fade in and out.
    const open = smooth((g - 0.3) / 0.05) * (1 - smooth((g - 0.56) / 0.04));
    fork.style.opacity = String(open);
    fork.style.visibility = open > 0 ? '' : 'hidden';
    fork.inert = open < 0.9;
    root.style.opacity = String(1 - smooth((g - FADE[0]) / (FADE[1] - FADE[0])));
    if (begun) forming.value = smooth((g - 0.7) / 0.3);
    // While the things go home the foot steps aside too: nothing passes over a word.
    foot.style.opacity = String(1 - smooth((g - 0.56) / 0.04));
    verso.textContent = g < 0.2 ? 'scorri' : g < 0.7 ? 'entra nel parco' : '';
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    gone = still.matches ? want : gone + (want - gone) * (1 - Math.exp(-dt * pace));
    if (Math.abs(want - gone) < 0.0005) gone = want;
    if (gone > 0.3 && !begun && park) {
      begun = true;
      forming.value = 0;
      onBegin();
    }
    if (gone > FORK + 0.1 && !park) location.href = 'veloce/';
    draw();
    if (gone >= 1) {
      looping = false;
      root.hidden = true;
      document.documentElement.classList.remove('flusso-angolo');
      forming.value = 1;
      onArrive();
      return;
    }
    if (gone === want) {
      looping = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  // The way wanted, within what is ready: until the park has arrived the way waits a little past the
  // fork, with a soft sign at the foot.
  function to(value, rate = 9) {
    pace = rate;
    want = Math.min(Math.max(value, 0), ready || !park ? 1 : FORK + 0.08);
    root.classList.toggle('is-waiting', !ready && park && value > FORK + 0.08);
    clearTimeout(restTimer);
    if (want > 0.58 && want < 1) restTimer = setTimeout(() => to(want > 0.75 ? 1 : FORK), REST);
    if (!looping) {
      looping = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }
  const step = (way) => to(way > 0 ? STOPS.find((stop) => stop > want + 0.01) ?? 1 : [...STOPS].reverse().find((stop) => stop < want - 0.01) ?? 0);

  // Sound may start only inside a tap or a key: the first one starts it, if it is wanted.
  const wake = () => {
    if (soundOn || !heard()) return;
    soundOn = true;
    onSound(true);
  };

  root.addEventListener('wheel', (event) => {
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * scale;
    to(want + delta / WHEEL);
  }, { passive: false });

  // The disc is the first gesture: pressed (a click, a tap, a press held), a wave of rings leaves from
  // where it was pressed and the way goes on by itself to the fork.
  function wave(x, y) {
    if (still.matches) return;
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('span');
      ring.className = 'threshold__onda';
      Object.assign(ring.style, { left: `${x}px`, top: `${y}px`, animationDelay: `${i * 0.22}s` });
      ring.addEventListener('animationend', () => ring.remove());
      root.append(ring);
    }
  }

  let press;
  root.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button || event.target.closest('a, button')) return;
    if (event.target.closest('.sole__cuore') && want < FORK) {
      wave(event.clientX, event.clientY);
      wake();
      to(FORK, 2.4);
      return;
    }
    press = { y: event.clientY, from: want };
    root.setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove', (event) => {
    if (press && event.isPrimary) to(press.from + (press.y - event.clientY) / (innerHeight * SWIPE));
  });
  const release = (event) => {
    if (!press || !event.isPrimary) return;
    press = undefined;
    wake();
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  addEventListener('keydown', (event) => {
    // On a button or a link, Space and Enter are its own click.
    // A key the park has taken (the step back from its first stop) is not taken twice.
    if (root.hidden || event.defaultPrevented || ((event.key === ' ' || event.key === 'Enter') && event.target.closest?.('a, button'))) return;
    const way = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ' ': 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 }[event.key];
    if (way) {
      event.preventDefault();
      wake();
      if (!event.repeat) step(way);
    } else if (event.key === 'End') to(1);
    else if (event.key === 'Home') to(0);
  });

  avanti.addEventListener('click', () => {
    wake();
    step(1);
  });
  root.querySelector('.bivio--parco').addEventListener('click', () => {
    wake();
    to(1);
  });
  sound.addEventListener('click', () => {
    sound.setAttribute('aria-checked', String(!heard()));
    if (soundOn !== heard()) {
      soundOn = heard();
      onSound(soundOn);
    }
  });
  // The page of all the works starts from the same shapes and takes them on.
  root.querySelector('.bivio--lavori').addEventListener('click', () => {
    try {
      sessionStorage.setItem('athena-flusso', '1');
    } catch {
      // Without storage that page simply opens at its start.
    }
  });

  addEventListener('resize', () => {
    if (root.hidden) return;
    measure();
    draw();
  });
  requestAnimationFrame(() => {
    measure();
    draw();
  });

  return {
    // The park has arrived: the way may go on past the fork.
    ready() {
      ready = true;
      root.classList.add('is-ready');
      if (root.classList.contains('is-waiting')) to(1);
    },
    // Without a park (no WebGL), going on past the fork leads to the page of all the works.
    noPark() {
      park = false;
    },
    // «Indietro» from the first stop: back to the fork.
    back() {
      root.hidden = false;
      measure();
      gone = 1;
      to(FORK);
    },
  };
}
