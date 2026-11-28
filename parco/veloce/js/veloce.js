import { catalogue } from '../../js/works.js';
import { element, logo, reducedMotion } from '../../js/media.js';
import { createForma, fromScreen, mix, place, shapes, smooth as settle } from '../../js/forma.js';

// The park seen flat: the same islands one under the other, each with its sky, its sculpture and its
// works standing on the cloud like the pictures of the park. A work opens in the same close view.

const $ = (selector) => document.querySelector(selector);
const page = location.href.split('#')[0];
const silent = { play() {} };

// The accent of each island and the hour of its light, as in js/world/layout.js (MOODS).
const MOODS = {
  ingresso: { hour: 0, accent: '#ffa86a' },
  siti: { hour: 0.3, accent: '#f5a98a' },
  negozi: { hour: 1, accent: '#f2836b' },
  programmi: { hour: 1, accent: '#3298fa' },
  app: { hour: 1, accent: '#5a8fe0' },
  videogioco: { hour: 1.3, accent: '#2a4fd6' },
  marchi: { hour: 1.7, accent: '#f7c35f' },
  manifesti: { hour: 2, accent: '#e98fb5' },
  google: { hour: 2, accent: '#8d7bd9' },
  contatti: { hour: 2, accent: '#ffc27a' },
  // «Che cosa faccio» stands on the island of the arrival in the park; here it comes after the works,
  // so it keeps the accent of the arrival and the hour of the islands round it.
  servizi: { hour: 2, accent: '#ffa86a' },
};

// The colours of the hours, as in js/world/hours.js: sky from the top down, and the floor of the islands.
const HOURS = [
  { at: 0, top: '#6c9ff6', quarter: '#b7b7ee', half: '#ddb8cf', horizon: '#dcb6cd', shade: '#7c82c6', mid: '#b3aad3', lit: '#fff0e4' },
  { at: 1, top: '#0d63e0', quarter: '#3298fa', half: '#4eb5fd', horizon: '#67d2fd', shade: '#7598dd', mid: '#b4c6e9', lit: '#fdfbf9' },
  { at: 2, top: '#20358c', quarter: '#636bce', half: '#8d7bd9', horizon: '#cf8cce', shade: '#5d64c2', mid: '#9891dc', lit: '#f9e2e0' },
];

const hex = (value) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));
const smooth = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function hourColours(hour) {
  const next = Math.max(1, HOURS.findIndex((key) => key.at >= hour));
  const a = HOURS[next - 1];
  const b = HOURS[next];
  const t = smooth(hour, a.at, b.at);
  return Object.fromEntries(Object.keys(a).filter((name) => name !== 'at').map((name) => {
    const [x, y] = [hex(a[name]), hex(b[name])];
    return [name, `rgb(${x.map((value, i) => Math.round(value + (y[i] - value) * t)).join(' ')})`];
  }));
}

// What stands on each island: its sculpture and a few things of its corner of the park, each at a
// share of the width of the island and on its own side. Heights come from the sprites' manifest.
const SCENES = {
  siti: { statue: 'siti', things: [['albero-medio', 0.12], ['cespuglio-1', 0.24], ['lampione', 0.88]] },
  negozi: { statue: 'negozi', things: [['albero-frutti', 0.86], ['cassette', 0.7], ['ciuffo-2', 0.2]] },
  programmi: { statue: 'programmi', things: [['siepe-squadrata', 0.16], ['sasso', 0.32], ['albero-piccolo', 0.9]] },
  app: { statue: 'app', things: [['canne', 0.84], ['tifa', 0.92], ['ninfea', 0.66]] },
  videogioco: { statue: 'videogioco', things: [['scivolo', 0.16], ['aquilone', 0.86], ['ciuffo-1', 0.34]] },
  marchi: { statue: 'marchi', things: [['aiuola', 0.82], ['fiore-1', 0.68], ['fiore-2', 0.94]] },
  manifesti: { statue: 'manifesti', things: [['bandiera', 0.1], ['albero-medio', 0.9], ['erba-alta', 0.26]] },
  google: { statue: 'google', things: [['albero-piccolo', 0.14], ['cespuglio-1', 0.28], ['panchina', 0.84]] },
  servizi: { statue: 'servizi', things: [['albero-grande', 0.9], ['cespugli-gruppo', 0.74], ['lampione', 0.06]] },
  contatti: { statue: 'contatti', things: [['cassetta-posta', 0.86], ['lampione', 0.1], ['ciuffo-2', 0.24]] },
};
const CLOUDS = ['nuvola-1', 'nuvola-2', 'nuvola-3'];

// Widths of the works on a phone (share of the island) and on a wide screen (share of a row), and how
// far each stands back: the rhythm of a clearing, not of a table. The three runs have different
// lengths, so that no row repeats the one before.
const PHONE = [0.94, 0.7, 0.82, 0.64, 0.88, 0.74];
const WIDE = [0.42, 0.25, 0.31, 0.22, 0.36, 0.27, 0.2];
const BACK = [0, 64, 18, 92, 40];

const metre = () => (innerWidth < 768 ? 40 : 54);

let sprites = {};
// A sprite in its two sizes, the light one (a third of the width) where it is enough for the screen.
function setSprite(img, name) {
  const width = sprites[name].larghezza_1024;
  img.dataset.src = `img/sprites/${sprites[name].file_1024}`;
  img.dataset.srcset = `img/sprites-light/${name}.webp ${Math.round(width / 3)}w, img/sprites/${sprites[name].file_1024} ${width}w`;
}
function sprite(name, x, className) {
  const info = sprites[name];
  const tall = Math.round((Math.min(info.altezza_m ?? 1, 5.5)) * metre());
  const wide = Math.round(tall * (info.larghezza_1024 / info.altezza_1024));
  const img = element('img', { className, alt: '', decoding: 'async', width: wide, height: tall, sizes: `${wide}px` });
  setSprite(img, name);
  img.style.setProperty('--w', `${wide}px`);
  img.style.setProperty('--h', `${tall}px`);
  img.style.setProperty('--foot', `${(1 - (info.appoggio?.y ?? 1)) * 100}%`);
  img.style.setProperty('--anchor', `${(info.appoggio?.x ?? 0.5) * -100}%`);
  img.style.setProperty('--x', `${x * 100}%`);
  img.style.setProperty('--u', x);
  return img;
}

function cloud(index) {
  const img = element('img', { className: 'nuvola', alt: '', decoding: 'async' });
  img.dataset.src = `img/park/${CLOUDS[index % CLOUDS.length]}-small.webp`;
  return img;
}

// The underside of an island: puffs of cloud, as the body of the islands in the park.
function belly() {
  return element('div', { className: 'isola__pancia', ariaHidden: 'true' }, [1, 2, 3, 2, 1, 3].map((n, i) => {
    const img = element('img', { alt: '', decoding: 'async', sizes: '26vw' });
    setSprite(img, `sbuffo-${n}`);
    img.style.setProperty('--i', i);
    return img;
  }));
}

// The stones of the path from one island to the next, in the colour of the path of the park.
const stones = () => element('div', { className: 'sentiero', ariaHidden: 'true' }, [0, 1, 2, 3, 4].map(() => element('span')));

// The colours of a place: its hour, its accent, and its name for the bar and «I mondi».
function paint(section, id, title) {
  const mood = MOODS[id];
  for (const [name, value] of Object.entries(hourColours(mood.hour))) section.style.setProperty(`--h-${name}`, value);
  section.style.setProperty('--accent', mood.accent);
  section.dataset.title = title;
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

function island(id, title, children, { note, count } = {}) {
  const scene = SCENES[id];
  const side = Object.keys(SCENES).indexOf(id) % 2 ? 'right' : 'left';
  const heading = element('div', { className: 'isola__nome' }, [
    element('h2', { className: 'zone-name', textContent: title }),
    count ? element('p', { className: 'isola__conta', textContent: count }) : '',
  ]);
  const statue = sprite(scene.statue, side === 'left' ? 0.2 : 0.8, 'cosa cosa--statua');
  const ground = element('div', { className: 'isola__suolo' }, [statue, ...scene.things.map(([name, x]) => sprite(name, x, 'cosa'))]);
  const land = element('div', { className: 'isola__terra' }, [ground, note ?? '', ...children, belly()]);
  const section = element('section', { className: `isola isola--${side}`, id }, [
    element('div', { className: 'isola__cielo', ariaHidden: 'true' }, [cloud(id.length), cloud(id.length + 1)]),
    heading,
    land,
    stones(),
  ]);
  section.setAttribute('aria-labelledby', `${id}-nome`);
  heading.querySelector('h2').id = `${id}-nome`;
  section.style.setProperty('--room', `${statue.height}px`);
  return paint(section, id, title);
}

const counted = (n) => (n === 1 ? '1 lavoro' : `${n} lavori`);

// A work as it stands in the park: its cover in a plaster frame on two thin legs, turned a little
// towards the middle of the island, and under it the plate with logo and title.
function work(item, index) {
  const cover = item.cover;
  const img = element('img', { className: 'opera__immagine', alt: cover.alt ?? '', decoding: 'async', width: cover.w, height: cover.h });
  img.dataset.srcset = `${cover.srcThumb} 240w, ${cover.srcMobile} 960w, ${cover.src} 1920w`;
  img.dataset.src = cover.srcMobile;
  const mark = item.logo ? logo(item.logo, { className: 'work-label__logo' }) : '';
  if (mark) {
    mark.dataset.src = mark.getAttribute('src');
    mark.removeAttribute('src');
  }
  const plate = element('span', { className: 'work-label opera__targa' }, [
    mark,
    element('strong', { textContent: item.title }),
  ]);
  const button = element('a', { className: 'opera__quadro', href: `${page}#lavoro/${item.id}` }, [
    element('span', { className: 'opera__cornice' }, [img]),
    element('span', { className: 'opera__gambe', ariaHidden: 'true' }),
  ]);
  button.setAttribute('aria-label', `${item.title}: apri il lavoro`);
  button.dataset.work = item.id;
  const node = element('li', { className: 'opera' }, [button, plate]);
  node.style.setProperty('--phone', PHONE[index % PHONE.length]);
  node.style.setProperty('--wide', WIDE[index % WIDE.length]);
  node.style.setProperty('--back', `${BACK[index % BACK.length]}px`);
  node.style.setProperty('--turn', `${index % 2 ? -9 : 9}deg`);
  node.dataset.side = ['start', 'end', 'center'][index % 3];
  return node;
}

function card(children, className = '') {
  return element('div', { className: `card isola__carta ${className}` }, children);
}

const link = (id, text) => element('a', { className: 'card__go', href: `${page}#${id}`, textContent: text });

function build(data, texts) {
  const works = catalogue(data);
  const root = $('.pianta');
  const sections = [arrival(texts.who)];

  for (const chapter of data.chapters) {
    const items = chapter.works.map((id) => works[id]);
    const lines = new Set(items.map((item) => item.line));
    const shared = items.length > 1 && lines.size === 1;
    const list = element('ol', { className: 'isola__opere' }, items.map(work));
    list.style.setProperty('--many', items.length > 8 ? 0.78 : 1);
    sections.push(island(chapter.id, chapter.title, [list], {
      count: counted(items.length),
      note: shared ? element('p', { className: 'isola__nota', textContent: items[0].line }) : undefined,
    }));
  }

  // What I do: the places of the work, each a way to its island.
  sections.push(island('servizi', texts.services.title, [card([
    element('div', { className: 'card__links' }, texts.services.items.map((item) => link(item.stage, item.title))),
  ], 'isola__carta--servizi')]));

  const google = texts.google;
  const shop = works[google.work];
  const line = texts.services.items.find((item) => item.stage === 'google')?.line;
  sections.push(island('google', 'Campagne', [card([
    line ? element('h3', { textContent: line }) : '',
    element('ul', { className: 'card__facts' }, google.facts.map((fact) => element('li', { textContent: fact }))),
    element('a', { className: 'card__go', href: `${page}#lavoro/${shop.id}`, textContent: `Apri ${shop.title}` }),
  ], 'isola__carta--google')]));

  sections.push(island('contatti', 'Contatti', [card([
    element('h3', { textContent: texts.contact.title }),
    element('div', { className: 'card__links' }, texts.contact.links.map((item) => element('a', {
      className: 'card__go', href: item.href, textContent: item.label, target: '_blank', rel: 'noopener',
    }))),
  ], 'isola__carta--contatti')]));

  sections.forEach((section, i) => section.style.setProperty('--next-top', (sections[i + 1] ?? sections[0]).style.getPropertyValue('--h-top')));
  root.append(...sections);
  return { works, sections };
}

// Pictures are fetched when they come near the screen, and things rise onto the island as they arrive.
function wake(sections) {
  const show = (node) => {
    for (const img of [node, ...node.querySelectorAll('img[data-src]')]) {
      if (!img.dataset?.src) continue;
      if (img.dataset.srcset) {
        if (!img.sizes) img.sizes = `${Math.ceil(img.closest('.opera__cornice').getBoundingClientRect().width)}px`;
        img.srcset = img.dataset.srcset;
      }
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
  };
  const near = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      show(entry.target);
      near.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px 60% 0px' });
  const arrive = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      arrive.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const section of sections) {
    section.querySelectorAll('.isola__cielo, .isola__suolo, .isola__pancia, .opera').forEach((node) => near.observe(node));
    section.querySelectorAll('.isola__suolo, .opera').forEach((node) => arrive.observe(node));
  }
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

  const list = element('ol', { className: 'mondi__lista' }, sections.map((section) => {
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
  dialog.append(element('div', { className: 'mondi__testa' }, [element('h2', { className: 'mondi__titolo', textContent: 'I mondi' }), shut]), list);
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
    nav.style.setProperty('--mid', section.style.getPropertyValue('--accent'));
    prev.hidden = !before;
    prevTo.textContent = before?.dataset.title ?? '';
    prev.setAttribute('aria-label', before ? `Torna a ${before.dataset.title}` : '');
    goTo.textContent = after ? `verso ${after.dataset.title}` : 'torna all’inizio';
    list.querySelectorAll('a').forEach((item, i) => {
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

// The opening, as at the start of the park: the shapes over the sky of the arrival. Scrolling down the
// first screen each goes to its thing on the first island (the circle to the globe of the lamp, the
// arc to the rim of the island, the crescent into the portal, the line onto the first work, the dots
// onto the things beside) and melts there; scrolling up they come back. Come from the fork of the
// park, the page takes the way on by itself.
function opening(first) {
  const layer = createForma(false);
  layer.classList.add('apertura');
  document.body.append(layer);
  const span = () => innerHeight * 0.8;
  const find = (part) => [...first.querySelectorAll('img.cosa')].find((img) => (img.getAttribute('src') ?? img.dataset.src ?? '').includes(part));
  const square = (rect, share) => ({ left: rect.left + (rect.width * (1 - share)) / 2, top: rect.top, width: rect.width * share, height: rect.width * share });
  function places(view) {
    const land = first.querySelector('.isola__terra').getBoundingClientRect();
    const lamp = find('lampione')?.getBoundingClientRect();
    const statue = first.querySelector('.cosa--statua')?.getBoundingClientRect();
    const work = first.querySelector('.opera__cornice')?.getBoundingClientRect();
    const things = [...first.querySelectorAll('.cosa:not(.cosa--statua)')].map((img) => img.getBoundingClientRect());
    const box = (rect) => rect && rect.width && fromScreen(rect, view);
    return {
      sole: box(lamp && square(lamp, 0.8)),
      arco: box({ left: land.left, top: land.top, width: land.width, height: innerWidth < 768 ? 64 : 90 }),
      luna: box(statue && square(statue, 0.5)),
      linea: box(work && { left: work.left, top: work.top, width: work.width, height: 1 }),
      ...Object.fromEntries(things.slice(0, 3).map((rect, i) => [`stella${i}`, box(square(rect, 0.3))])),
    };
  }
  let drawn;
  function draw() {
    const gone = scrollY / span();
    layer.hidden = gone >= 1;
    if (layer.hidden) return;
    drawn ??= shapes(layer);
    if (!drawn) return;
    const view = drawn.view();
    const at = places(view);
    const t = reducedMotion.matches ? 0 : settle(gone);
    for (const shape of drawn.list) place(shape, mix(shape.start, at[shape.name] || shape.start, t), view);
    layer.style.opacity = String(1 - settle((gone - 0.7) / 0.3));
  }
  let queued = false;
  const later = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  };
  addEventListener('scroll', later, { passive: true });
  addEventListener('resize', () => {
    drawn = undefined;
    later();
  });
  draw();
  let handed = false;
  try {
    handed = sessionStorage.getItem('athena-flusso') === '1';
    sessionStorage.removeItem('athena-flusso');
  } catch {
    // Without storage the page waits at its start.
  }
  if (handed && !location.hash && !reducedMotion.matches) setTimeout(() => scrollTo({ top: span(), behavior: 'smooth' }), 400);
}

async function start() {
  const json = (path) => fetch(path).then((response) => response.json());
  const [data, texts, manifest] = await Promise.all([json('data/works.json'), json('data/racconto.json'), json('img/sprites/manifest.json')]);
  sprites = manifest;
  const { works, sections } = build(data, texts);
  wake(sections);
  bar(sections);
  opening(sections[1]);

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
