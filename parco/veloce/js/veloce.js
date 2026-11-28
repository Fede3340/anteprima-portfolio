import { catalogue } from '../../js/works.js';
import { element, logo, reducedMotion } from '../../js/media.js';

// The park seen flat: the same islands one under the other. Ground, clouds and the plaster of the
// frames are the same everywhere; each island has its own hour and colour in the sky, its own corner
// of garden, and its works set out in the way that suits them: windows for the sites, a shop window
// for the shops, screens, phones, a wall of marks, posters on a line. A work opens in the same close
// view as in the park.

const $ = (selector) => document.querySelector(selector);
const page = location.href.split('#')[0];
const silent = { play() {}, quiet() {} };

// The accent of each island and the hour of its light, as in js/world/layout.js (MOODS). The software
// comes a little before noon and the apps a little after, so that the three islands of full day do not
// share one sky; the game is the one island at night.
const MOODS = {
  ingresso: { hour: 0, accent: '#ffa86a' },
  siti: { hour: 0.3, accent: '#f5a98a' },
  negozi: { hour: 1, accent: '#f5a47a' },
  programmi: { hour: 0.8, accent: '#6fb1ee' },
  app: { hour: 1.15, accent: '#4f72c4' },
  videogioco: { hour: 3, accent: '#a99ade' },
  marchi: { hour: 1.7, accent: '#f0d6a8' },
  manifesti: { hour: 2, accent: '#c7a8e2' },
  google: { hour: 2, accent: '#f39a5a' },
  contatti: { hour: 2.4, accent: '#f5d4a8' },
  // «Che cosa faccio» stands on the island of the arrival in the park; here it comes after the works,
  // so it keeps the accent of the arrival and the hour of the islands round it.
  servizi: { hour: 2, accent: '#ffa86a' },
};

// The colours of the sky by hour, from the top down, as in js/world/hours.js: dawn, day, evening, and
// past it the blue hour and the night of the game.
const HOURS = [
  { at: 0, top: '#6c9ff6', quarter: '#b7b7ee', half: '#ddb8cf', horizon: '#dcb6cd' },
  { at: 1, top: '#0d63e0', quarter: '#3298fa', half: '#4eb5fd', horizon: '#67d2fd' },
  { at: 2, top: '#20358c', quarter: '#636bce', half: '#8d7bd9', horizon: '#cf8cce' },
  { at: 3, top: '#0b1a5c', quarter: '#1d2f86', half: '#34459f', horizon: '#5d57b4' },
];

const hex = (value) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));
const mix = (a, b, t) => a.map((value, i) => Math.round(value + (b[i] - value) * t));
const rgb = (value) => `rgb(${value.join(' ')})`;
const smooth = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The sky of a place: the colours of its hour, its accent let into the lower half of it.
function skyOf(id) {
  const { hour, accent } = MOODS[id];
  const next = Math.max(1, HOURS.findIndex((key) => key.at >= hour));
  const [a, b] = [HOURS[next - 1], HOURS[next]];
  const t = smooth(hour, a.at, b.at);
  const at = (name) => mix(hex(a[name]), hex(b[name]), t);
  const tint = hex(accent);
  return [at('top'), at('quarter'), mix(at('half'), tint, 0.16), mix(at('horizon'), tint, 0.4)].map(rgb);
}

// The text that reads on a colour, ink or light (WCAG relative luminance).
const luminance = (colour) => {
  const [r, g, b] = hex(colour).map((value) => {
    const share = value / 255;
    return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const textOn = (colour) => ((luminance(colour) + 0.05) / (luminance('#001750') + 0.05) >= 4.5 ? '#001750' : '#f6f8fb');

// What stands on each island: its sculpture and its corner of the park as in js/world/park.js
// (GARDENS), two or three things at most, each at a share of the width of the island: [pictures, the
// first that exists is used; place; size where smaller than its own]. The name of the island stands on
// the other side, so that nothing tall comes near it. idle: the one thing that lives when nobody
// scrolls (a crown that breathes, a flower that sways); none where the works move already.
const WORLDS = {
  siti: { layout: 'finestre', head: 'end', statue: 0.26, things: [[['ulivo', 'albero-piccolo'], 0.07], [['siepe-squadrata'], 0.44]], idle: 0 },
  negozi: { layout: 'vetrina', head: 'start', statue: 0.72, things: [[['bancarella', 'cassette'], 0.54], [['albero-frutti'], 0.94]], idle: 1 },
  programmi: { layout: 'schermi', head: 'end', statue: 0.12, things: [[['siepe-squadrata'], 0.34], [['aiuola'], 0.5]] },
  app: { layout: 'telefoni', head: 'start', statue: 0.86, things: [[['fiore-2'], 0.56, 0.55], [['fiore-1'], 0.63, 0.45], [['albero-piccolo'], 0.72]], idle: 0 },
  videogioco: { layout: 'quadro', head: 'end', statue: 0.36, things: [[['albero-doppio'], 0.06], [['albero-grande'], 0.17], [['fungo', 'cespuglio-2'], 0.56]], idle: 1 },
  marchi: { layout: 'muro', head: 'start', statue: 0.9, things: [[['aiuola'], 0.62], [['rose', 'fiore-1'], 0.74, 0.6]], idle: 1 },
  manifesti: { layout: 'fune', head: 'end', statue: 0.36, things: [[['bandiera'], 0.08], [['cipresso', 'albero-piccolo'], 0.54]] },
  servizi: { layout: 'parole', head: 'start', statue: 0.94, things: [[['albero-grande'], 0.78], [['cespuglio-1'], 0.62]], idle: 0 },
  google: { layout: 'corto', head: 'end', statue: 0.14, things: [[['tifa'], 0.3], [['erba-alta'], 0.36], [['megafono', 'bandiera'], 0.52]] },
  contatti: { layout: 'scrivimi', head: 'start', statue: 0.6, things: [[['cassetta-posta'], 0.46], [['panchina'], 0.76], [['albero-medio'], 0.95]], idle: 2 },
};

// The colours of the living things, the same as in the park (TINTS in js/world/layout.js), and how
// each kind wears them (ROLES in js/world/light.js): [names, colour, how much, colour of its lower part
// (trunk, stem, pot), where in the picture's height that part ends, from the foot]. Flowers, beds and
// flags wear the colour of their island; furniture a neutral tone a little darker than the ground.
// The newer pictures of the park (cipresso, ulivo, rose, fungo, bancarella, megafono) are drawn in
// their own colours and keep them. sways: what moves at rest by swaying, not by breathing.
const TINTS = {
  crown: '#8aa781', forest: '#7a9a76', hedge: '#7f9c77', bush: '#93ad88', grass: '#a0b88c',
  stem: '#8ea47c', reedHead: '#b1916f', trunk: '#a98a74', stone: '#b8b2ac', furniture: '#9ba0c8',
};
const ISLAND = 'accent';
const ROLES = [
  [/^albero-grande/, TINTS.crown, 0.8, TINTS.trunk, 0.38],
  [/^albero-medio/, TINTS.crown, 0.8, TINTS.trunk, 0.42],
  [/^albero-piccolo/, TINTS.crown, 0.8, TINTS.trunk, 0.5],
  [/^albero-frutti/, TINTS.crown, 0.8, TINTS.trunk, 0.47],
  [/^(albero-doppio|boschetto)/, TINTS.forest, 0.82, TINTS.trunk, 0.5],
  [/^siepe/, TINTS.hedge, 0.82],
  [/^cespugli/, TINTS.bush, 0.78],
  [/^(ciuffo|erba|ninfea)/, TINTS.grass, 0.8],
  [/^(canne|tifa)/, TINTS.reedHead, 0.78, TINTS.stem, 0.62],
  [/^fiore/, ISLAND, 0.8, TINTS.stem, 0.52],
  [/^aiuola/, ISLAND, 0.7, TINTS.stone, 0.45],
  [/^bandiera/, ISLAND, 0.75],
  [/^(panchina|gradini|scivolo|cassette|cassetta-posta)/, TINTS.furniture, 0.3],
];
const SWAYS = /^(fiore|rose|bandiera)/;
const CLOUDS = ['nuvola-1', 'nuvola-2', 'nuvola-3'];

const metre = () => (innerWidth < 768 ? 36 : 54);

let sprites = {};
const soft = (colour, amount) => rgb(mix([255, 255, 255], hex(colour), amount));
// A cut-out of the park, its foot on the floor where the top edge of the island is: a plaster picture
// coloured by multiplying it with its colours, and its soft shadow on the ground. role: its colouring
// where it is not that of its kind (the sculpture, in the colour of its island).
function sprite(name, x, island, { size = 1, role } = {}) {
  const info = sprites[name];
  const tall = Math.round(Math.min(info.altezza_m ?? 1, 5.5) * size * metre());
  const wide = Math.round(tall * (info.larghezza_1024 / info.altezza_1024));
  const [, colour, amount = 0, lower, split = 0] = role ?? ROLES.find(([pattern]) => pattern.test(name)) ?? [];
  const on = colour ? soft(colour === ISLAND ? MOODS[island].accent : colour, amount) : '#fff';
  const under = lower ? soft(lower, amount) : on;
  const at = (1 - split) * 100;
  const node = element('span', { className: 'cosa' }, [element('span', { className: 'cosa__sagoma' })]);
  node.style.cssText = `--w:${wide}px;--h:${tall}px;--x:${x * 100}%;--u:${x};`
    + `--ax:${(info.appoggio?.x ?? 0.5) * 100}%;--ay:${(1 - (info.appoggio?.y ?? 1)) * 100}%;`
    + `--tint:linear-gradient(${on} ${at - 3}%, ${under} ${at + 3}%)`;
  // The light picture (a third of the width) where it is enough for the screen.
  const light = Math.round(info.larghezza_1024 / 3);
  node.dataset.sprite = wide * devicePixelRatio <= light ? `img/sprites-light/${name}.webp` : `img/sprites/${info.file_1024}`;
  node.dataset.tall = tall;
  if (SWAYS.test(name)) node.dataset.sways = '';
  return node;
}

function cloud(index) {
  const img = element('img', { className: `nuvola nuvola--${index % 4}`, alt: '', decoding: 'async' });
  img.dataset.src = `img/park/${CLOUDS[index % CLOUDS.length]}-small.webp`;
  return img;
}

// The underside of an island: puffs of cloud, as the body of the islands in the park.
function belly() {
  return element('div', { className: 'isola__pancia', ariaHidden: 'true' }, [1, 2, 3, 2, 1, 3].map((n, i) => {
    const img = element('img', { alt: '', decoding: 'async', sizes: '26vw' });
    const info = sprites[`sbuffo-${n}`];
    img.dataset.src = `img/sprites/${info.file_1024}`;
    img.dataset.srcset = `img/sprites-light/sbuffo-${n}.webp ${Math.round(info.larghezza_1024 / 3)}w, img/sprites/${info.file_1024} ${info.larghezza_1024}w`;
    img.style.setProperty('--i', i);
    return img;
  }));
}

// The stones of the path from one island to the next, in the colour of the path of the park.
const stones = () => element('div', { className: 'sentiero', ariaHidden: 'true' }, [0, 1, 2, 3, 4].map(() => element('span')));

// The colours of a place, and its name for the bar and «I mondi».
function paint(section, id, title) {
  const { accent } = MOODS[id];
  section.style.setProperty('--accent', accent);
  section.style.setProperty('--on-accent', textOn(accent));
  section.dataset.title = title;
  section.dataset.mood = id;
  return section;
}

// The arrival: who, in one sentence, in the sky of the dawn; the first island follows at once.
function arrival(who) {
  const section = element('section', { className: 'arrivo', id: 'chi' }, [
    element('div', { className: 'isola__cielo', ariaHidden: 'true' }, [cloud(0)]),
    element('div', { className: 'arrivo__dentro' }, [
      element('p', { className: 'zone-name', textContent: who.title }),
      element('h1', { className: 'arrivo__testo', id: 'chi-testo', textContent: who.text }),
    ]),
  ]);
  section.setAttribute('aria-labelledby', 'chi-testo');
  return paint(section, 'ingresso', who.title);
}

function island(id, title, body, { note, count } = {}, index = 0) {
  const world = WORLDS[id];
  const heading = element('div', { className: `isola__nome isola__nome--${world.head}` }, [
    element('h2', { className: 'zone-name', id: `${id}-nome`, textContent: title }),
    count ? element('p', { className: 'isola__conta', textContent: count }) : '',
  ]);
  const things = world.things.map(([names, x, size]) => sprite(names.find((name) => sprites[name]), x, id, { size }));
  things[world.idle]?.classList.add(things[world.idle].dataset.sways ? 'cosa--ondeggia' : 'cosa--respira');
  const ground = element('div', { className: 'isola__suolo', ariaHidden: 'true' }, [
    sprite(id, world.statue, id, { role: [null, MOODS[id].accent, 0.5] }),
    ...things,
  ]);
  const room = Math.max(...[...ground.children].map((thing) => Number(thing.dataset.tall)));
  const land = element('div', { className: `isola__terra isola__terra--${world.layout}` }, [ground, note ?? '', ...body, belly()]);
  const section = element('section', { className: `isola isola--${id}`, id }, [
    element('div', { className: 'isola__cielo', ariaHidden: 'true' }, [cloud(index), cloud(index + 2)]),
    heading,
    land,
    stones(),
  ]);
  section.setAttribute('aria-labelledby', `${id}-nome`);
  section.style.setProperty('--room', `${room}px`);
  return paint(section, id, title);
}

const counted = (n) => (n === 1 ? '1 lavoro' : `${n} lavori`);

// A picture fetched only when it comes near the screen.
function picture({ src, srcset, w, h, alt }, className = 'opera__immagine') {
  const img = element('img', { className, alt: alt ?? '', decoding: 'async', width: w, height: h });
  img.dataset.src = src;
  if (srcset) img.dataset.srcset = srcset;
  return img;
}

const cover = (item) => picture({
  src: item.cover.srcMobile,
  srcset: `${item.cover.srcThumb} 240w, ${item.cover.srcMobile} 960w, ${item.cover.src} 1920w`,
  w: item.cover.w, h: item.cover.h, alt: item.cover.alt,
});

// The first upright picture of a work (the screen of an app, the poster), in its sizes.
const upright = (item) => {
  const shot = item.gallery[0];
  return picture({ src: shot.src, srcset: shot.srcset, w: shot.w, h: shot.h, alt: shot.alt });
};

// The plate under a work, as in the park: logo and title.
function plate(item) {
  const mark = item.logo ? logo(item.logo, { className: 'work-label__logo' }) : '';
  if (mark) {
    mark.dataset.src = mark.getAttribute('src');
    mark.removeAttribute('src');
  }
  return element('span', { className: 'work-label opera__targa' }, [mark, element('strong', { textContent: item.title })]);
}

// A work: a link to its close view holding its frame, what it stands or hangs on, and its plate.
function piece(item, kind, inside, { foot, label = true } = {}) {
  const link = element('a', { className: 'opera__quadro', href: `${page}#lavoro/${item.id}` }, [
    element('span', { className: 'opera__cornice' }, inside),
    foot ? element('span', { className: `opera__${foot}`, ariaHidden: 'true' }) : '',
  ]);
  link.setAttribute('aria-label', `${item.title}: apri il lavoro`);
  link.dataset.work = item.id;
  return element('li', { className: `opera opera--${kind}` }, [link, label ? plate(item) : '']);
}

const list = (layout, items, make) => element('ol', { className: `isola__opere opere--${layout}` }, items.map(make));

// Each island sets out its works in its own way.
const LAYOUTS = {
  // Sites: wide windows, one to a row, the page scrolling inside as one goes past.
  finestre: (items) => list('finestre', items, (item, i) => {
    const capture = item.full?.desktop;
    const view = capture
      ? picture({ src: `veloce/img/finestre/${item.id}.webp`, w: 960, h: Math.min(Math.round((capture.h * 960) / capture.w), 2400), alt: item.cover.alt }, 'opera__immagine finestra__pagina')
      : cover(item);
    const node = piece(item, 'finestra', [
      element('span', { className: 'finestra__barra', ariaHidden: 'true' }, [element('i'), element('i'), element('i')]),
      element('span', { className: 'finestra__vista' }, [view]),
    ], { foot: 'gambe' });
    node.dataset.side = i % 2 ? 'end' : 'start';
    return node;
  }),
  // Shops: a shop window of small shelves, rows of two and three set off from each other.
  vetrina: (items) => list('vetrina', items, (item) => piece(item, 'scaffale', [cover(item)], { foot: 'mensola' })),
  // Software: two large screens on their stands.
  schermi: (items) => list('schermi', items, (item) => piece(item, 'schermo', [cover(item)], { foot: 'piede' })),
  // Apps: phones standing in a row.
  telefoni: (items) => list('telefoni', items, (item) => piece(item, 'telefono', [upright(item)], { foot: 'base' })),
  // The game: one large picture.
  quadro: (items) => list('quadro', items, (item) => piece(item, 'grande', [cover(item)], { foot: 'gambe' })),
  // Marks: a plaster wall of small tiles, the mark is its own name.
  muro: (items) => list('muro', items, (item) => piece(item, 'marchio', [cover(item)], { label: false })),
  // Posters: hung on lines with two pegs, of different sizes.
  fune: (items) => list('fune', items, (item, i) => {
    const node = piece(item, 'manifesto', [upright(item)], { label: false, foot: 'mollette' });
    node.style.setProperty('--size', [1, 0.84, 0.92, 0.78, 0.96, 0.88][i % 6]);
    return node;
  }),
};

function card(children, className = '') {
  return element('div', { className: `card isola__carta ${className}` }, children);
}

const link = (id, text) => element('a', { className: 'card__go', href: `${page}#${id}`, textContent: text });

function build(data, texts) {
  const works = catalogue(data);
  const sections = [arrival(texts.who)];

  // The chapter of the campaigns is the island built by hand below, with its card.
  const campaigns = data.chapters.find((chapter) => chapter.id === 'google');
  for (const chapter of data.chapters.filter((each) => each !== campaigns)) {
    const items = chapter.works.map((id) => works[id]);
    const lines = new Set(items.map((item) => item.line));
    const shared = items.length > 1 && lines.size === 1;
    sections.push(island(chapter.id, chapter.title, [LAYOUTS[WORLDS[chapter.id].layout](items)], {
      count: counted(items.length),
      note: shared ? element('p', { className: 'isola__nota', textContent: items[0].line }) : undefined,
    }, sections.length));
  }

  // What I do: the places of the work in large letters, each a way to its island.
  sections.push(island('servizi', texts.services.title, [element('ul', { className: 'parole' }, texts.services.items.map((item) => {
    const way = element('a', { className: 'parola', href: `${page}#${item.stage}` }, [
      element('span', { className: 'parola__punto', ariaHidden: 'true' }),
      element('span', { textContent: item.title }),
    ]);
    way.style.setProperty('--dot', MOODS[item.stage]?.accent ?? MOODS.servizi.accent);
    return element('li', {}, [way]);
  }))], {}, sections.length));

  // The campaigns: the short film large in the middle, the card of the campaign beside it.
  const google = texts.google;
  const shop = works[google.work];
  const line = texts.services.items.find((item) => item.stage === 'google')?.line;
  const film = campaigns ? campaigns.works.map((id) => works[id]) : [];
  sections.push(island('google', 'Campagne', [element('div', { className: 'campagna' }, [
    film.length ? list('corto', film, (item) => {
      const video = element('video', { className: 'opera__immagine corto__video', muted: true, loop: true, playsInline: true, preload: 'none', width: 720, height: 1280 });
      video.setAttribute('aria-label', item.gallery[0].alt);
      video.dataset.poster = 'prove/pippi-corto/poster.webp';
      video.dataset.video = 'prove/pippi-corto/pippi-corto.mp4';
      return piece(item, 'corto', [video], { foot: 'gambe' });
    }) : '',
    card([
      line ? element('h3', { textContent: line }) : '',
      element('ul', { className: 'card__facts' }, google.facts.map((fact) => element('li', { textContent: fact }))),
      element('a', { className: 'card__go', href: `${page}#lavoro/${shop.id}`, textContent: `Apri ${shop.title}` }),
    ], 'isola__carta--google'),
  ])], {}, sections.length));

  // Contacts: one word, large, and the ways to write.
  sections.push(island('contatti', 'Contatti', [element('div', { className: 'scrivimi' }, [
    element('h3', { className: 'scrivimi__titolo', textContent: texts.contact.title }),
    element('ul', { className: 'scrivimi__vie' }, texts.contact.links.map((item) => element('li', {}, [element('a', {
      className: 'scrivimi__via', href: item.href, textContent: item.label, target: '_blank', rel: 'noopener',
    })]))),
  ])], {}, sections.length));

  $('.pianta').append(...sections);
  return { works, sections };
}

// The sky behind the page: one layer for each place, held still; scrolling fades one into the next.
function heavens(sections) {
  const layers = sections.map((section) => {
    const [top, quarter, half, horizon] = skyOf(section.dataset.mood);
    const layer = element('div', { className: 'cielo__strato' });
    layer.style.background = `linear-gradient(${top}, ${quarter} 30%, ${half} 64%, ${horizon})`;
    return layer;
  });
  document.body.prepend(element('div', { className: 'cielo', ariaHidden: 'true' }, layers));
  return layers;
}

// Pictures, cut-outs and the film are fetched when they come near the screen; things rise onto the
// island as they arrive.
function wake(sections) {
  const show = (node) => {
    if (node.dataset.sprite) {
      // Whole, because a url() in a custom property is read against the stylesheet, not the page.
      const url = new URL(node.dataset.sprite, document.baseURI).href;
      delete node.dataset.sprite;
      const img = new Image();
      img.onload = () => {
        node.style.setProperty('--src', `url("${url}")`);
        node.classList.add('is-ready');
      };
      img.src = url;
      return;
    }
    if (node.dataset.video) {
      node.poster = node.dataset.poster;
      node.append(element('source', { src: node.dataset.video, type: 'video/mp4' }));
      delete node.dataset.video;
      return;
    }
    if (!node.dataset.src) return;
    if (node.dataset.srcset) {
      if (!node.sizes) node.sizes = `${Math.ceil(node.parentElement.getBoundingClientRect().width)}px`;
      node.srcset = node.dataset.srcset;
    }
    node.src = node.dataset.src;
    delete node.dataset.src;
  };
  const near = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      show(entry.target);
      near.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px 35% 0px' });
  // What comes into sight together arrives one after the other, in the order of the page.
  const arrive = new IntersectionObserver((entries) => {
    let order = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.style.setProperty('--k', order++);
      entry.target.classList.add('is-in');
      arrive.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const section of sections) {
    section.querySelectorAll('img[data-src], .cosa, video').forEach((node) => near.observe(node));
    section.querySelectorAll('.isola__suolo, .opera, .parole li, .scrivimi > *').forEach((node) => arrive.observe(node));
  }

  // The film plays, without sound, while it is in sight, unless motion is to be kept down.
  const films = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting && !reducedMotion.matches && !navigator.connection?.saveData) target.play().catch(() => {});
      else target.pause();
    }
  }, { threshold: 0.4 });
  document.querySelectorAll('.corto__video').forEach((video) => films.observe(video));
}

// What moves with the scroll, and only with it, in planes at their own pace: the sky still behind,
// fading from one place to the next; the clouds of the sky a little slower than the page; the garden
// sliding a few pixels sideways over its floor, as things at another distance do; the cloud under the
// island a little slower; the works with the page; the pages running inside the windows of the sites.
function drift(sections, layers) {
  const planes = sections.map((section) => ({
    section,
    clouds: [...section.querySelectorAll('.nuvola')],
    garden: section.querySelector('.isola__suolo'),
    belly: section.querySelector('.isola__pancia'),
    pages: [...section.querySelectorAll('.finestra__pagina')],
  }));
  let queued = false;
  const frame = () => {
    queued = false;
    const high = innerHeight;
    const side = innerWidth < 768 ? 7 : 14;
    const boxes = sections.map((section) => section.getBoundingClientRect());
    let at = 0;
    boxes.forEach((box, i) => {
      if (box.top < high * 0.9) at = i;
    });
    const fade = at ? smooth(high * 0.9 - boxes[at].top, 0, high * 0.6) : 1;
    // Read everything first, then write.
    const moves = reducedMotion.matches ? [] : planes.flatMap((plane, i) => {
      const box = boxes[i];
      if (box.bottom < 0 || box.top > high) return [];
      const off = (box.top + box.height / 2 - high / 2) / high;
      return [
        ...plane.clouds.map((cloud) => [cloud, 'translate', `0 ${(-off * high * 0.16).toFixed(1)}px`]),
        plane.garden && [plane.garden, 'transform', `translate3d(${(off * side).toFixed(1)}px, 0, 0)`],
        plane.belly && [plane.belly, 'transform', `translate3d(0, ${(-off * 18).toFixed(1)}px, 0)`],
        ...plane.pages.map((img) => {
          const view = img.parentElement.getBoundingClientRect();
          const reach = Math.max(0, img.offsetHeight - view.height);
          const through = Math.min(1, Math.max(0, (high - view.bottom) / Math.max(1, high - view.height)));
          return [img, 'transform', `translate3d(0, ${(-reach * smooth(through, 0.1, 0.9)).toFixed(1)}px, 0)`];
        }),
      ].filter(Boolean);
    });
    layers.forEach((layer, i) => {
      layer.style.opacity = i === at ? fade : i === at - 1 ? 1 : 0;
    });
    for (const [node, property, value] of moves) node.style[property] = value;
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  for (const img of document.querySelectorAll('.finestra__pagina')) img.addEventListener('load', queue);
  frame();
}

// The bar at the foot, the same as in the park: the island before, where one is with «I mondi», and
// «Avanti» to the next.
function bar(sections) {
  const nav = $('.travel__bar');
  const dialog = $('.mondi');
  const arrow = (text) => element('span', { className: 'travel__arrow', textContent: text, ariaHidden: 'true' });
  const prevTo = element('span', { className: 'travel__to' });
  const prev = element('button', { type: 'button', className: 'travel__step travel__step--prev' }, [arrow('‹'), prevTo]);
  const name = element('span', { className: 'travel__name' });
  const here = element('button', { type: 'button', className: 'travel__here' }, [
    element('span', { className: 'travel__dot', ariaHidden: 'true' }), name,
    element('span', { className: 'travel__worlds-label', textContent: 'I mondi' }),
  ]);
  here.setAttribute('aria-haspopup', 'dialog');
  const goTo = element('span', { className: 'travel__go-to' });
  const forward = element('button', { type: 'button', className: 'travel__go' }, [element('strong', { textContent: 'Avanti' }), goTo]);
  nav.append(prev, here, forward);
  nav.hidden = false;

  const items = element('ol', { className: 'mondi__lista' }, sections.map((section) => {
    const count = section.querySelectorAll('.opera').length;
    const item = element('a', { className: 'mondi__voce', href: `${page}#${section.id}` }, [
      element('span', { className: 'mondi__punto', ariaHidden: 'true' }),
      element('span', { className: 'mondi__nome', textContent: section.dataset.title }),
      count ? element('span', { className: 'mondi__conta', textContent: counted(count) }) : '',
    ]);
    item.style.setProperty('--accent', section.style.getPropertyValue('--accent'));
    return element('li', {}, [item]);
  }));
  const shut = element('button', { type: 'button', className: 'pill mondi__chiudi', textContent: 'Chiudi' });
  dialog.append(element('div', { className: 'mondi__testa' }, [element('h2', { className: 'mondi__titolo', textContent: 'I mondi' }), shut]), items);
  shut.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  here.addEventListener('click', () => {
    dialog.showModal();
    dialog.querySelector('.is-here')?.focus();
  });

  let at = 0;
  const set = (index) => {
    at = index;
    const section = sections[at];
    const before = sections[at - 1];
    const after = sections[at + 1];
    name.textContent = section.dataset.title;
    // Only the island one is on lives at rest: its clouds and its one moving thing.
    sections.forEach((each) => each.classList.toggle('is-here', each === section));
    nav.style.setProperty('--mid', section.style.getPropertyValue('--accent'));
    prev.hidden = !before;
    prevTo.textContent = before?.dataset.title ?? '';
    prev.setAttribute('aria-label', before ? `Torna a ${before.dataset.title}` : '');
    goTo.textContent = after ? `verso ${after.dataset.title}` : 'torna all’inizio';
    items.querySelectorAll('a').forEach((item, i) => {
      item.classList.toggle('is-here', i === at);
      if (i === at) item.setAttribute('aria-current', 'location');
      else item.removeAttribute('aria-current');
    });
  };
  prev.addEventListener('click', () => travel(sections[at - 1]?.id));
  forward.addEventListener('click', () => travel(sections[at + 1]?.id ?? sections[0].id));

  // The island in the middle of the screen is where one is; the address follows it, quietly.
  const watch = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const index = sections.indexOf(entry.target);
      set(index);
      if (!/^#lavoro\//.test(location.hash)) history.replaceState(history.state, '', index ? `#${entry.target.id}` : page);
    }
  }, { rootMargin: '-45% 0px -54% 0px' });
  sections.forEach((section) => watch.observe(section));
  set(0);
  return dialog;
}

function travel(id, smooth = true) {
  const target = id && document.getElementById(id);
  if (!target) return;
  $('.mondi').close();
  target.scrollIntoView({ behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto', block: 'start' });
}

async function start() {
  const json = (path) => fetch(path).then((response) => response.json());
  const [data, texts, manifest] = await Promise.all([json('data/works.json'), json('data/racconto.json'), json('img/sprites/manifest.json')]);
  sprites = manifest;
  const { works, sections } = build(data, texts);
  const layers = heavens(sections);
  wake(sections);
  drift(sections, layers);
  bar(sections);

  // The close view of the park, fetched when a work is first near the finger or the pointer. Opening a
  // work adds an entry to the history, so that Back closes it, as in the park.
  let story;
  let loading;
  const ready = () => {
    loading ??= import('../../js/story.js').then(({ createStory }) => {
      story = createStory($('.story'), { works, sound: silent, onClose: close });
      return story;
    });
    return loading;
  };
  for (const type of ['pointerover', 'touchstart', 'focusin']) {
    document.addEventListener(type, (event) => {
      if (event.target.closest?.('[href*="#lavoro/"]')) ready();
    }, { passive: true });
  }
  let chain = Promise.resolve();
  let opener;
  const WORK = /^#lavoro\/([\w-]+)$/;
  const centre = () => ({ x: innerWidth / 2, y: innerHeight / 2 });
  const apply = async (id, point) => {
    if (id) await ready();
    if (!story) return;
    if (story.work && story.work !== id) {
      await story.close(point ?? centre());
      opener?.focus({ preventScroll: true });
    }
    if (id && works[id] && story.work !== id) {
      opener = document.querySelector(`[data-work="${id}"]`);
      await story.open(id, point ?? centre());
    }
  };
  const run = (id, point) => {
    chain = chain.then(() => apply(id, point)).catch((error) => console.warn(error));
    return chain;
  };
  function close() {
    if (!story?.work) return chain;
    if (history.state?.work) {
      history.back();
      return chain;
    }
    history.replaceState(null, '', `#${works[story.work].chapter}`);
    return run(undefined);
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const anchor = event.target.closest('a[href^="http"]');
    if (!anchor || !anchor.href.startsWith(`${page}#`)) return;
    event.preventDefault();
    const hash = anchor.hash;
    const id = WORK.exec(hash)?.[1];
    if (id) {
      if (story?.work === id) return;
      history.pushState({ work: id }, '', hash);
      const box = anchor.querySelector('.opera__cornice')?.getBoundingClientRect();
      run(id, box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: event.clientX, y: event.clientY });
      return;
    }
    travel(hash.slice(1));
  });
  addEventListener('popstate', () => run(WORK.exec(location.hash)?.[1]));
  addEventListener('keydown', (event) => {
    if (!story?.work) return;
    if (event.key === 'Escape') close();
    else if (story.key(event)) event.preventDefault();
  });

  // An address from elsewhere: an island goes there, a work opens over its island.
  const id = WORK.exec(location.hash)?.[1];
  if (id && works[id]) {
    travel(works[id].chapter, false);
    run(id);
  } else if (location.hash.length > 1) {
    travel(location.hash.slice(1), false);
  }
}

start();
