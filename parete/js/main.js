gsap.registerPlugin(ScrollTrigger);

const stage = document.querySelector('.stage');
const scene = document.querySelector('.scene');
const screen = document.querySelector('[data-surface="monitor"]');
const print = document.querySelector('[data-surface="f1"]');
const band = document.querySelector('.note--work');
const notes = [...document.querySelectorAll('.note')];

const compact = window.matchMedia('(max-width: 760px)');
const still = window.matchMedia('(prefers-reduced-motion: reduce)');

const PATH = [
  [0, 'left'],
  [0.14, 'right'],
  [0.28, 'screenWide'],
  [0.42, 'screen'],
  [0.54, 'screen'],
  [0.68, 'printWide'],
  [0.86, 'print'],
  [1, 'print'],
];

// On small screens the text panel never overlaps the wall, so a note stays until the next one.
const NOTES = compact.matches
  ? { intro: [0, 0.34], pippi: [0.34, 0.76], wine: [0.76, 1] }
  : { intro: [0, 0.012], pippi: [0.405, 0.555], wine: [0.845, 1] };

const ease = gsap.parseEase('power2.inOut');
const clamp = gsap.utils.clamp;
const progress = { t: 0 };
let shots;

// A shot pins the scene point (px, py) to the stage point (ax, ay) at scale s.
function measure() {
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const sw = scene.offsetWidth;
  const small = compact.matches;
  const free = small ? H : H - band.offsetHeight;
  const centre = (el) => [el.offsetLeft + el.offsetWidth / 2, el.offsetTop + el.offsetHeight / 2];
  const [sx, sy] = centre(screen);
  const [fx, fy] = centre(print);
  const top = small ? sy : screen.offsetTop;

  shots = {
    left: { px: small ? sw * 0.292 : 0, py: 0, ax: 0, ay: 0, s: 1 },
    right: { px: sw, py: 0, ax: W, ay: 0, s: 1 },
    screenWide: { px: sx, py: top, ax: W / 2, ay: top, s: 1 },
    screen: { px: sx, py: top, ax: W / 2, ay: small ? H / 2 : 0, s: W / screen.offsetWidth },
    printWide: { px: fx, py: fy, ax: W / 2, ay: fy, s: 1 },
    print: {
      px: fx,
      py: fy,
      ax: W / 2,
      ay: free / 2,
      s: Math.min((0.84 * free) / print.offsetHeight, (0.88 * W) / print.offsetWidth),
    },
  };
  render();
}

function render() {
  const t = progress.t;
  const i = Math.min(PATH.findLastIndex(([at]) => at <= t), PATH.length - 2);
  const [from, a] = PATH[i];
  const [to, b] = PATH[i + 1];
  const raw = (t - from) / (to - from);
  const k = still.matches ? Math.round(raw) : ease(raw);
  const A = shots[a];
  const B = shots[b];
  const mix = (key) => A[key] + (B[key] - A[key]) * k;

  const s = A.s * (B.s / A.s) ** k;
  const x = clamp(stage.clientWidth - scene.offsetWidth * s, 0, mix('ax') - mix('px') * s);
  const y = clamp(stage.clientHeight - scene.offsetHeight * s, 0, mix('ay') - mix('py') * s);
  scene.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;

  for (const note of notes) {
    const [start, end] = NOTES[note.dataset.note];
    note.classList.toggle('is-on', t >= start && (t < end || end === 1));
  }
}

gsap.to(progress, {
  t: 1,
  ease: 'none',
  onUpdate: render,
  scrollTrigger: {
    trigger: '.track',
    start: 'top top',
    end: 'bottom bottom',
    scrub: still.matches ? true : 0.5,
  },
});

measure();
window.addEventListener('resize', measure);
