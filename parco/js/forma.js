// The opening of the site, shared by the park and by the page of the works: a few pure shapes in a calm
// field, which the flow turns into things. Each shape is drawn at home, where the first view of the
// park has its thing (the circle is the sun, the arc the rim of the island, the line the horizon, the
// crescent the moon, the dots the far islands); a box (centre, width, height, turn, in the units of the
// drawing) says where it stands at any moment, and place() puts it there.

// The drawing for a wide and for a tall screen: home of each shape, and its box at the start.
const LAYOUTS = {
  largo: {
    size: [1440, 900],
    sun: [487, 474, 27], moon: [684, 217, 60], rim: [556, 600], horizon: 600,
    dots: [[562, 345, 7], [835, 252, 5], [1150, 455, 9]],
    start: {
      sole: [1180, 232, 208, 208, 0], luna: [232, 214, 0.5, 0.5, -24], arco: [250, 770, 560, 170, -16], linea: [1236, 700, 210, 0, -10],
      dots: [[300, 318, 8], [338, 292, 5], [366, 330, 7]],
    },
  },
  alto: {
    size: [390, 844],
    sun: [39, 439, 18], moon: [253, 253, 25], rim: [476, 492], horizon: 490,
    dots: [[101, 350, 6], [273, 285, 4], [305, 440, 7]],
    start: {
      sole: [332, 98, 120, 120, 0], luna: [52, 118, 0.64, 0.64, -24], arco: [120, 792, 300, 96, -14], linea: [300, 748, 130, 0, -10],
      dots: [[84, 172, 6], [104, 156, 4], [118, 184, 5.6]],
    },
  },
};

const NS = 'http://www.w3.org/2000/svg';

function arc(width, top, edge) {
  const s = edge - top;
  const r = ((width / 2) ** 2 + s * s) / (2 * s);
  return `M0 ${edge}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${width} ${edge}`;
}

// The two drawings, in a box; field: the calm colour behind (the door), or none (over a page).
export function createForma(field = true) {
  const box = document.createElement('div');
  box.className = 'forma-campo';
  box.ariaHidden = 'true';
  box.innerHTML = Object.entries(LAYOUTS).map(([name, l]) => {
    const [w, h] = l.size;
    const [mx, my, mr] = l.moon;
    return `<svg class="forma forma--${name}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
      ${field ? `<defs><linearGradient id="campo-${name}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b7b7ee"/><stop offset="1" stop-color="#ddb8cf"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#campo-${name})"/>` : ''}
      <g data-forma="anello" fill="none" stroke="#fff0e4" stroke-width="1.5"><circle cx="${l.sun[0]}" cy="${l.sun[1]}" r="${l.sun[2]}" vector-effect="non-scaling-stroke"><animate attributeName="r" values="${l.sun[2]};${l.sun[2] * 1.6}" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0" dur="4s" repeatCount="indefinite"/></circle></g>
      <circle data-forma="sole" cx="${l.sun[0]}" cy="${l.sun[1]}" r="${l.sun[2]}" fill="#ffa257"/>
      <path data-forma="luna" d="M${mx} ${my - mr}a${mr} ${mr} 0 1 0 0 ${2 * mr}a${(mr * 0.75).toFixed(1)} ${mr} 0 1 1 0 ${-2 * mr}Z" fill="#fff0e4"/>
      <path data-forma="arco" d="${arc(w, ...l.rim)}" fill="none" stroke="#fff0e4" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <line data-forma="linea" x1="0" y1="${l.horizon}" x2="${w}" y2="${l.horizon}" stroke="#001750" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
      ${l.dots.map(([x, y, r], i) => `<circle data-forma="punto${i}" cx="${x}" cy="${y}" r="${r}" fill="#fff0e4"/>`).join('')}
    </svg>`;
  }).join('');
  return box;
}

// The drawing shown on this screen, its shapes with their home and start boxes, and the way from the
// screen to its units (it covers the screen, centred).
export function shapes(box) {
  const svg = [...box.querySelectorAll('svg.forma')].find((node) => node.getBoundingClientRect().width);
  if (!svg) return undefined;
  const l = LAYOUTS[svg.classList.contains('forma--alto') ? 'alto' : 'largo'];
  const list = [...svg.querySelectorAll('[data-forma]')].map((el) => {
    const name = el.dataset.forma;
    // The ring breathing round the disc goes with the disc: its home is the disc's.
    const b = (name === 'anello' ? svg.querySelector('[data-forma="sole"]') : el).getBBox();
    const home = { cx: b.x + b.width / 2, cy: b.y + b.height / 2, w: b.width || 1, h: b.height || 1, r: 0 };
    let start;
    if (name.startsWith('punto')) {
      const [x, y, d] = l.start.dots[Number(name.slice(5))];
      start = { cx: x, cy: y, w: d, h: d, r: 0 };
    } else {
      const [x, y, w, h, r] = l.start[name === 'anello' ? 'sole' : name];
      // The crescent is given as a share of its own size.
      start = name === 'luna' ? { cx: x, cy: y, w: home.w * w, h: home.h * h, r } : { cx: x, cy: y, w, h: h || home.h, r };
    }
    el.style.transformBox = 'view-box';
    el.style.transformOrigin = '0 0';
    return { el, name, home, start };
  });
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

export function place({ el, home }, box) {
  el.style.transform = `translate(${box.cx}px, ${box.cy}px) rotate(${box.r}deg) scale(${box.w / home.w}, ${box.h / home.h}) translate(${-home.cx}px, ${-home.cy}px)`;
}

export const smooth = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
