// The opening of the site, shared by the park and by the page of the works: a sun of light and a few
// drawn signs (an orbit, a thread of horizon, a crescent, three stars) in a deep field, which the flow
// turns into things. Each thing has a home, where the first view of the park has it (the sun is the
// sun, the orbit the rim of the island, the thread the horizon, the crescent the moon, the stars the far
// islands), a place at the start, and a place at the fork, out of the way of the two choices. A box
// (centre, width, height, turn, in the units of the drawing) says where a thing stands at any moment,
// and place() puts it there: the signs are lines of one drawing, the sun a layer of light of its own.

// The drawing for a wide and for a tall screen. sun: [x, y, radius of its core]; start and fork: the
// box of each thing then ([x, y, width, height, turn]; the crescent as a share of its size; the sun and
// the stars as [x, y, radius]).
const LAYOUTS = {
  largo: {
    size: [1440, 900],
    sun: [487, 474, 27], moon: [684, 217, 60], rim: [556, 600], horizon: 600,
    stars: [[562, 345], [835, 252], [1150, 455]],
    start: {
      sole: [1130, 236, 30], luna: [262, 196, 0.42, 0.42, -24], arco: [210, 830, 640, 220, -14], linea: [1300, 548, 240, 0, -6],
      stars: [[120, 640], [160, 612], [188, 654]],
    },
    fork: { sole: [860, 236, 30] },
  },
  alto: {
    size: [390, 844],
    sun: [39, 439, 18], moon: [253, 253, 25], rim: [476, 492], horizon: 490,
    stars: [[101, 350], [273, 285], [305, 440]],
    start: {
      sole: [316, 110, 22], luna: [336, 246, 0.55, 0.55, -24], arco: [0, 170, 260, 100, 22], linea: [96, 104, 150, 0, -6],
      stars: [[40, 470], [62, 452], [84, 486]],
    },
    fork: { sole: [262, 150, 22] },
  },
};
// The layer of the sun is this many times as wide as its core: the rest is its halo.
const HALO = 10;
const STAR = 1.6;

function arc(width, top, edge) {
  const s = edge - top;
  const r = ((width / 2) ** 2 + s * s) / (2 * s);
  return `M0 ${edge}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${width} ${edge}`;
}

// A fine grain over the field, made once: it takes the plastic off the gradient.
let grain;
function grainImage() {
  if (grain) return grain;
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(size, size);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const v = Math.random() * 255;
    pixels.data.set([v, v, v, 14], i);
  }
  ctx.putImageData(pixels, 0, 0);
  grain = canvas.toDataURL();
  return grain;
}

// The two drawings and the sun, in a box; field: the deep sky behind with its grain (the door), or
// none (over a page).
export function createForma(field = true) {
  const box = document.createElement('div');
  box.className = field ? 'forma-campo forma-campo--cielo' : 'forma-campo';
  box.ariaHidden = 'true';
  if (field) box.style.setProperty('--grana', `url(${grainImage()})`);
  box.innerHTML = Object.entries(LAYOUTS).map(([name, l]) => {
    const [w, h] = l.size;
    const [mx, my, mr] = l.moon;
    return `<svg class="forma forma--${name}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#fff0e4" stroke-width="1" stroke-linecap="round">
      <path data-forma="luna" d="M${mx} ${my - mr}a${mr} ${mr} 0 1 0 0 ${2 * mr}a${(mr * 0.72).toFixed(1)} ${mr} 0 1 1 0 ${-2 * mr}" vector-effect="non-scaling-stroke" opacity="0.8"/>
      <path data-forma="arco" d="${arc(w, ...l.rim)}" vector-effect="non-scaling-stroke" opacity="0.7"/>
      <line data-forma="linea" x1="0" y1="${l.horizon}" x2="${w}" y2="${l.horizon}" vector-effect="non-scaling-stroke" opacity="0.85"/>
      ${l.stars.map(([x, y], i) => `<circle data-forma="stella${i}" cx="${x}" cy="${y}" r="${STAR}" fill="#fff0e4" stroke="none"/>`).join('')}
    </svg>`;
  }).join('') + '<div class="sole" data-forma="sole"><div class="sole__respiro"></div><div class="sole__cuore"></div></div>';
  return box;
}

const circle = ([x, y, r]) => ({ cx: x, cy: y, w: 2 * r, h: 2 * r, r: 0 });

// The drawing shown on this screen, its things with their home, start and fork boxes, and the way from
// the screen to its units (it covers the screen, centred).
export function shapes(box) {
  const svg = [...box.querySelectorAll('svg.forma')].find((node) => node.getBoundingClientRect().width);
  if (!svg) return undefined;
  const l = LAYOUTS[svg.classList.contains('forma--alto') ? 'alto' : 'largo'];
  const list = [...svg.querySelectorAll('[data-forma]')].map((el) => {
    const name = el.dataset.forma;
    const b = el.getBBox();
    const home = { cx: b.x + b.width / 2, cy: b.y + b.height / 2, w: b.width || 1, h: b.height || 1, r: 0 };
    let start;
    if (name.startsWith('stella')) {
      const [x, y] = l.start.stars[Number(name.slice(6))];
      start = { cx: x, cy: y, w: home.w, h: home.h, r: 0 };
    } else {
      const [x, y, w, h, r] = l.start[name];
      // The crescent is given as a share of its own size.
      start = name === 'luna' ? { cx: x, cy: y, w: home.w * w, h: home.h * h, r } : { cx: x, cy: y, w, h: h || home.h, r };
    }
    el.style.transformBox = 'view-box';
    el.style.transformOrigin = '0 0';
    return { el, name, home, start, fork: start };
  });
  const sun = box.querySelector('.sole');
  list.push({ el: sun, name: 'sole', home: circle(l.sun), start: circle(l.start.sole), fork: circle(l.fork.sole) });
  const view = () => {
    const rect = svg.getBoundingClientRect();
    const [w, h] = l.size;
    const k = Math.max(rect.width / w, rect.height / h);
    return { k, x: rect.left + (rect.width - w * k) / 2, y: rect.top + (rect.height - h * k) / 2 };
  };
  return { svg, list, view };
}

export const mix = (a, b, t) => ({ cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t, r: a.r + (b.r - a.r) * t });

// A box of the screen (a DOMRect) in the units of the drawing.
export function fromScreen(rect, view, r = 0) {
  return { cx: (rect.left + rect.width / 2 - view.x) / view.k, cy: (rect.top + rect.height / 2 - view.y) / view.k, w: rect.width / view.k, h: rect.height / view.k, r };
}

// A sign of the drawing moves in its units; the sun, a layer of its own, on the screen (view), so that
// only its transform changes.
export function place({ el, home }, box, view) {
  if (el instanceof SVGElement) {
    el.style.transform = `translate(${box.cx}px, ${box.cy}px) rotate(${box.r}deg) scale(${box.w / home.w}, ${box.h / home.h}) translate(${-home.cx}px, ${-home.cy}px)`;
    return;
  }
  const size = el.offsetWidth || 1;
  const x = view.x + box.cx * view.k;
  const y = view.y + box.cy * view.k;
  el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px) scale(${(box.w * view.k * HALO) / size})`;
}

export const smooth = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
