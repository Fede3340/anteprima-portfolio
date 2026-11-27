import { asset, element, logo, reducedMotion, srcset } from './media.js';
import { TALL } from './works.js';

// A work seen closely stays in the park: the picture that was touched grows into a large plaster frame
// standing on two legs, and the project is told inside it in boards, phase after phase, the way a
// project is actually made. Around the frame the park is still there.

const PHASES = { copertina: 'Copertina', studio: 'Studio', ideazione: 'Ideazione', progettazione: 'Progettazione', risultato: 'Risultato' };
const ORDER = Object.keys(PHASES);
const TEXTS = new Set(['text', 'sources']);
const FOCUS = [[0.5, 0.3], [0.3, 0.45], [0.7, 0.35], [0.5, 0.5], [0.3, 0.2]];
const WHEEL_STEP = 60;
const BASE = [248, 250, 252];
const INK = [0, 23, 80];

// The phases of a work, from `process` when the data has it, otherwise read from the fields of today:
// the studies go to Studio, or to Progettazione when they hold colours or typefaces; the first part
// of the story to Ideazione; the second and the pictures to Progettazione; the third and the facts
// to Risultato. A phase with nothing in it is left out.
export function phases(work) {
  if (work.process?.length) return work.process;
  const [idea, choice, where] = work.story ?? [];
  const studies = work.study ?? [];
  const system = (page) => Boolean(page.palette?.length || page.type?.length);
  const blocks = (page) => [
    page.p && { kind: 'text', title: page.title, p: page.p },
    page.palette?.length && { kind: 'palette', items: page.palette },
    page.type?.length && { kind: 'type', items: page.type },
    page.list?.length && { kind: 'list', items: page.list },
    page.sources?.length && { kind: 'sources', items: page.sources },
  ].filter(Boolean);
  const pictures = (work.gallery ?? []).map((_, index) => index);
  return [
    ...studies.filter((page) => !system(page)).map((page) => ({ phase: 'studio', title: page.title, blocks: blocks(page) })),
    idea && { phase: 'ideazione', title: idea.h, blocks: [{ kind: 'text', p: idea.p }] },
    ...studies.filter(system).map((page) => ({ phase: 'progettazione', title: page.title, blocks: blocks(page) })),
    (choice || pictures.length) && {
      phase: 'progettazione',
      title: choice?.h,
      blocks: [choice && { kind: 'text', p: choice.p }, pictures.length && { kind: 'images', items: pictures }].filter(Boolean),
    },
    (where || work.facts?.length) && {
      phase: 'risultato',
      title: where?.h,
      blocks: [where && { kind: 'text', p: where.p }, work.facts?.length && { kind: 'facts', items: work.facts }].filter(Boolean),
    },
  ].filter((section) => section && section.blocks.length);
}

const portrait = (image) => image.h > image.w;
const coverOf = (work) => ({ ...work.cover, srcset: `${work.cover.srcMobile} 960w, ${work.cover.src} 1920w` });
// The pictures of a work other than its cover, which for a mark is often the same picture again.
const others = (work) => {
  const gallery = work.gallery ?? [];
  const different = gallery.filter((image) => image.alt !== work.cover.alt);
  return different.length ? different : gallery;
};
// A second picture for a narrow screen, where one landscape picture alone is too low for its board.
const partner = (work, main) => others(work).find((image) => image.src !== main.src && !portrait(image));

// The boards, in order. Words go with the visual thing that follows them in their phase; words left
// at the end of a phase join the board before when there is room, or get a close-up of the work, so
// that no board is words alone.
const ROOM = 650;
const SHORT = 380;
const length = (texts) => texts.reduce((total, block) => total + (block.p?.length ?? 0) + (block.items?.length ?? 0) * 60, 0);

function plan(work, next, stacked, row, wordsRow) {
  const gallery = work.gallery ?? [];
  const close = others(work);
  let borrowed = 0;
  // A close look is cut from a picture of a mark, a poster or the game. A screen is shown whole: cut,
  // its words would look cut by mistake.
  const screens = !['marchi', 'manifesti', 'videogioco'].includes(work.chapter);
  const detail = () => {
    const image = close[borrowed % close.length] ?? coverOf(work);
    const second = close.find((each) => each.src !== image.src);
    const focus = FOCUS[borrowed % FOCUS.length];
    borrowed += 1;
    if (screens) return { kind: 'pics', items: [image] };
    return { kind: 'detail', image, focus, ...(second ? { extra: second } : {}) };
  };
  const cover = coverOf(work);
  const boards = [{ phase: 'copertina', cover: true, texts: [], visual: { kind: 'pics', items: [cover], extra: partner(work, cover) } }];
  // The page scrolling on the phone stands with the phone screens of the same work.
  const sections = phases(work);
  const shown = sections.flatMap((section) => section.blocks).filter((block) => block.kind === 'images');
  const scrolling = shown.find((block) => block.items.some((index) => gallery[index] && portrait(gallery[index]))) ?? shown[0];
  for (const section of sections) {
    const own = [];
    let pending = [];
    // A landscape picture leaves room for a short text only: the rest goes on to the next board.
    const add = (visual) => {
      let rest = [];
      if (visual.kind === 'pics' && !portrait(visual.items[0]) && length(pending) > SHORT) {
        let cut = 1;
        while (cut < pending.length && length(pending.slice(0, cut + 1)) <= SHORT) cut += 1;
        rest = pending.slice(cut);
        pending = pending.slice(0, cut);
      }
      own.push({ phase: section.phase, texts: pending, visual });
      pending = rest;
    };
    // Words that would make a board too long are split, each part with its own close-up.
    const flush = () => {
      while (length(pending) > ROOM) {
        let cut = 1;
        while (cut < pending.length && length(pending.slice(0, cut + 1)) <= ROOM) cut += 1;
        const rest = pending.slice(cut);
        pending = pending.slice(0, cut);
        add(detail());
        pending = rest;
      }
    };
    for (const block of section.blocks) {
      if (TEXTS.has(block.kind)) {
        pending.push(block);
        continue;
      }
      flush();
      if (block.kind === 'images') {
        const items = block.items.map((index) => gallery[index]).filter(Boolean);
        if (TALL[work.id] && block === scrolling) {
          const at = items.findIndex(portrait);
          items.splice(at < 0 ? items.length : at, 0, { tall: true, src: `img/work/${work.id}-tall.webp`, w: TALL[work.id], h: Math.round(TALL[work.id] * 2.1667), alt: '' });
        }
        groups(items, stacked, row, pending.length > 0 && wordsRow).forEach(add);
      } else if (block.kind === 'values' || block.kind === 'list' || block.kind === 'facts') {
        add({ kind: 'tiles', title: block.title ?? (block.kind === 'values' ? 'I valori' : undefined), items: block.items });
      } else if (block.kind === 'type' && !pending.length && own.at(-1)?.visual.kind === 'palette' && !own.at(-1).visual.type) {
        own.at(-1).visual.type = block.items;
      } else {
        add({ kind: block.kind, items: block.items });
      }
    }
    const last = own.at(-1);
    const landscape = last?.visual.kind === 'pics' && !portrait(last.visual.items[0]);
    if (pending.length && last && length(last.texts) + length(pending) <= (landscape ? SHORT : ROOM) && !(last.visual.kind === 'pics' && last.visual.items.length > 1)) {
      last.texts = last.texts.concat(pending);
      pending = [];
    }
    if (pending.length && section.phase === 'risultato' && !stacked && length(pending) <= SHORT) add({ kind: 'next', work: next });
    flush();
    if (pending.length) add(detail());
    for (const { visual: first } of own) {
      if (first.kind === 'pics' && first.items.length === 1 && !portrait(first.items[0])) first.extra = partner(work, first.items[0]);
    }
    // An upright picture alone after a sample with words, as a poster after its colours: the words
    // go with the picture, and the sample stands large on its own.
    own.forEach((board, order) => {
      const before = own[order - 1];
      const single = board.visual.kind === 'pics' && board.visual.items.length === 1 && portrait(board.visual.items[0]) && !board.visual.items[0].tall;
      if (single && !board.texts.length && before?.texts.length && ['palette', 'tiles', 'directions'].includes(before.visual.kind)) {
        board.texts = before.texts;
        before.texts = [];
      }
    });
    if (section.phase === 'risultato' && own.length) own[0].link = true;
    boards.push(...own);
  }
  if (boards.at(-1).visual.kind !== 'next') {
    boards.push({ phase: boards.at(-1).phase === 'risultato' ? 'risultato' : undefined, texts: [], visual: { kind: 'next', work: next, extra: partner(next, coverOf(next)) } });
  }
  return boards;
}

// Pictures go together as they fit the frame: upright ones side by side, as many as `row`; landscapes
// alone on a wide frame and up to three one under the other on a narrow one. When the first group
// shares its board with words it holds `words` upright pictures at most, and a landscape alone.
function groups(items, stacked, row, words) {
  const out = [];
  for (const item of items) {
    const last = out.at(-1);
    const first = words && out.length === 1;
    const most = portrait(item) ? (first ? words : row) : (stacked && !first ? 3 : 1);
    const joins = last && last.items.length < most && last.items.every((each) => portrait(each) === portrait(item));
    if (joins) last.items.push(item);
    else out.push({ kind: 'pics', items: [item] });
  }
  return out;
}

const mix = (colour, share, base = BASE) => base.map((channel, index) => Math.round(channel + (colour[index] - channel) * share));
const rgb = (colour) => `rgb(${colour.join(' ')})`;
const hexRgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
const luminance = (colour) => {
  const [r, g, b] = colour.map((value) => {
    const share = value / 255;
    return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
const saturation = (colour) => {
  const max = Math.max(...colour) / 255;
  const min = Math.min(...colour) / 255;
  return max === min ? 0 : (max - min) / (1 - Math.abs(max + min - 1));
};

// The words on a colour sample: ink, white or black, whichever reads best on it.
const label = (colour) => [INK, [255, 255, 255], [0, 0, 0]].sort((a, b) => contrast(b, colour) - contrast(a, colour))[0];

// The light tint of a work: its liveliest colour where it has a palette, the average of its cover
// otherwise.
async function tintOf(work) {
  const colours = phases(work).flatMap((section) => section.blocks).filter((block) => block.kind === 'palette')
    .flatMap((block) => block.items.map((item) => hexRgb(item.hex)))
    .filter((colour) => { const l = luminance(colour); return l > 0.02 && l < 0.85; });
  if (colours.length) return colours.sort((a, b) => saturation(b) - saturation(a))[0];
  return new Promise((done) => {
    const image = new Image();
    image.onload = () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 8, height: 8 });
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, 8, 8);
      const data = context.getImageData(0, 0, 8, 8).data;
      const sum = [0, 0, 0];
      for (let at = 0; at < data.length; at += 4) for (let c = 0; c < 3; c++) sum[c] += data[at + c];
      done(sum.map((value) => Math.round(value / 64)));
    };
    image.onerror = () => done(INK);
    image.src = asset(work.cover.srcMobile);
  });
}

const rise = (node, order) => {
  node.classList.add('case-rise');
  node.style.setProperty('--i', order);
  return node;
};

function words(board, work) {
  const nodes = [];
  if (board.cover) {
    const where = [work.place, work.year].filter(Boolean).join(', ');
    nodes.push(element('div', { className: 'case-heading' }, [
      ...(work.logo ? [logo(work.logo, { className: 'case-logo' })] : []),
      element('h2', { className: 'case-name', textContent: work.title }),
    ]));
    nodes.push(element('div', { className: 'case-about' }, [
      ...(work.line ? [element('p', { className: 'case-line', textContent: work.line })] : []),
      ...(where || work.tag ? [element('p', { className: 'case-meta' }, [
        ...(where ? [element('span', { textContent: where })] : []),
        ...(work.tag ? [element('span', { className: 'case-tag', textContent: work.tag })] : []),
      ])] : []),
      ...(work.link ? [element('a', { className: 'case-link', href: work.link.href, target: '_blank', rel: 'noopener', textContent: work.link.label })] : []),
    ]));
  }
  for (const block of board.texts) {
    if (block.kind === 'text') {
      if (block.title) nodes.push(element('h3', { className: 'case-subtitle', textContent: block.title }));
      nodes.push(element('p', { className: 'case-p', textContent: block.p }));
    } else if (block.kind === 'sources') {
      nodes.push(element('p', { className: 'case-sources' }, [
        element('span', { textContent: block.items.length > 1 ? 'Fonti' : 'Fonte' }),
        ...block.items.map(({ label: text, href }) => element('a', { href, target: '_blank', rel: 'noopener', textContent: text })),
      ]));
    }
  }
  if (work.link && board.link) {
    nodes.push(element('a', { className: 'case-link', href: work.link.href, target: '_blank', rel: 'noopener', textContent: work.link.label }));
  }
  return nodes.map((node, index) => rise(node, index + 1));
}

// A picture in its box; a touch shows it whole, unless it is part of a link or a moving page.
function pic(image, zoom, className = '') {
  const still = !zoom || image.tall;
  const box = element(still ? 'span' : 'button', { className: `case-pic${image.tall ? ' case-pic--tall' : ''} ${className}`.trim() });
  const img = element('img', { src: asset(image.src), alt: image.alt ?? '', decoding: 'async', draggable: false });
  if (image.srcset) img.srcset = srcset(image.srcset);
  box.append(img);
  box.image = image;
  if (!still) {
    box.type = 'button';
    box.setAttribute('aria-label', image.alt ? `Ingrandisci: ${image.alt}` : 'Ingrandisci');
    box.addEventListener('click', () => zoom(image));
  }
  return box;
}

function visual(board, work, zoom) {
  const { kind } = board.visual;
  if (kind === 'pics') {
    const holder = element('div', { className: 'case-pics' }, board.visual.items.map((image) => pic(image, zoom)));
    if (board.visual.extra) holder.append(pic(board.visual.extra, zoom, 'case-extra'));
    const captions = [...new Set(board.visual.items.map((image) => image.caption).filter(Boolean))];
    if (captions.length === 1 && !board.cover) holder.append(element('p', { className: 'case-caption', textContent: captions[0] }));
    return holder;
  }
  if (kind === 'detail') {
    return element('div', { className: 'case-detail' }, [
      pic(board.visual.image, zoom),
      ...(board.visual.extra ? [pic(board.visual.extra, zoom, 'case-extra')] : []),
    ]);
  }
  if (kind === 'palette') {
    const { length } = board.visual.items;
    const swatches = element('ul', { className: 'case-swatches' }, board.visual.items.map((item) => {
      const colour = hexRgb(item.hex);
      const chip = element('li', { className: 'case-swatch' }, [
        element('span', { className: 'case-swatch__name', textContent: item.name }),
        element('span', { className: 'case-swatch__hex', textContent: item.hex.toLowerCase() }),
        ...(item.role ? [element('span', { className: 'case-swatch__role', textContent: item.role })] : []),
      ]);
      chip.style.background = item.hex;
      chip.style.color = rgb(label(colour));
      return chip;
    }));
    swatches.style.setProperty('--cols', length <= 4 ? length : Math.ceil(length / 2));
    swatches.style.setProperty('--cols-narrow', length <= 2 ? length : 2);
    return board.visual.type ? element('div', { className: 'case-system' }, [swatches, types(board.visual.type)]) : swatches;
  }
  if (kind === 'type') return types(board.visual.items);
  if (kind === 'tiles') {
    const { title, items } = board.visual;
    const words = items.every((item) => item.length < 24);
    return element('ul', { className: `case-tiles${words ? ' case-tiles--words' : ''}` }, [
      ...(title ? [element('li', { className: 'case-tiles__title', textContent: title })] : []),
      ...items.map((item, index) => {
        const split = /^([^:]{2,28}):\s+(.+)$/.exec(item);
        return rise(element('li', { className: 'case-tile' }, split
          ? [element('span', { className: 'case-tile__label', textContent: split[1] }), element('span', { className: 'case-tile__value', textContent: split[2] })]
          : [element('span', { className: `case-tile__value${words ? '' : ' case-tile__value--plain'}`, textContent: item })]), index + 1);
      }),
    ]);
  }
  if (kind === 'directions') {
    return element('ul', { className: 'case-directions' }, board.visual.items.map((item, index) => rise(element('li', { className: `case-direction${item.chosen ? ' is-chosen' : ''}` }, [
      ...(item.chosen ? [element('span', { className: 'case-direction__mark', textContent: 'La scelta' })] : []),
      element('span', { className: 'case-direction__name', textContent: item.name }),
      ...(item.p ? [element('span', { className: 'case-direction__p', textContent: item.p })] : []),
    ]), index + 1)));
  }
  // The next work, at the end of every story.
  const other = board.visual.work;
  const card = element('a', { className: 'case-next', href: `#lavoro/${other.id}` }, [
    pic(coverOf(other)),
    ...(board.visual.extra ? [pic(board.visual.extra, null, 'case-extra')] : []),
    element('span', { className: 'case-next__label' }, [
      element('span', { className: 'case-next__kicker', textContent: 'Il lavoro dopo' }),
      element('span', { className: 'case-next__title', textContent: other.title }),
    ]),
  ]);
  return card;
}

// Typefaces as a set sample: each name as large as the board allows, its role above it.
function types(items) {
  return element('ul', { className: 'case-types' }, items.map((item, index) => {
    const sample = element('span', { className: 'case-type__name', textContent: item.family });
    sample.style.fontFamily = `"${item.family}", ${/mono/i.test(item.family) ? 'ui-monospace, Consolas, monospace' : 'var(--font-display)'}`;
    return rise(element('li', { className: 'case-type' }, [
      element('span', { className: 'case-type__role', textContent: item.role }),
      sample,
      ...(item.note ? [element('span', { className: 'case-type__note', textContent: item.note })] : []),
    ]), index + 1);
  }));
}

// Draws a picture in a box of the given size, never larger than its own pixels allow (10% at most).
function draw(box, { w, h, fit = 'contain', focus = [0.5, 0] }) {
  const { image } = box;
  const most = 1.1 / devicePixelRatio;
  let scale = fit === 'contain' ? Math.min(w / image.w, h / image.h, most) : Math.min(Math.max(w / image.w, h / image.h), most);
  // A close look is at the picture's own pixels, or up to the 10% more it may take to fill its box.
  if (fit === 'detail') scale = Math.min(Math.max(1 / devicePixelRatio, w / image.w, h / image.h), most);
  const boxW = fit === 'contain' ? image.w * scale : Math.min(w, image.w * scale);
  const boxH = fit === 'contain' ? image.h * scale : Math.min(h, image.h * scale);
  box.style.width = `${Math.floor(boxW)}px`;
  box.style.height = `${Math.floor(boxH)}px`;
  const img = box.querySelector('img');
  const drawnW = image.w * scale;
  if (image.tall) {
    img.style.width = '100%';
    return;
  }
  img.style.width = `${Math.floor(drawnW)}px`;
  img.style.height = `${Math.floor(image.h * scale)}px`;
  img.style.left = `${-Math.round((drawnW - boxW) * focus[0])}px`;
  img.style.top = `${-Math.round((image.h * scale - boxH) * focus[1])}px`;
  if (img.srcset) img.sizes = `${Math.ceil(drawnW)}px`;
}

export function createStory(root, { works, sound, onClose, onEnd }) {
  const sheet = element('link', { rel: 'stylesheet', href: asset('css/story.css') });
  const styled = new Promise((done) => { sheet.onload = done; sheet.onerror = done; });
  document.head.append(sheet);

  root.classList.add('case');
  const index = element('nav', { className: 'case-phases' });
  index.setAttribute('aria-label', 'Fasi del progetto');
  const close = element('button', { className: 'case-button case-close', type: 'button', textContent: 'Chiudi' });
  const previous = element('button', { className: 'case-button case-step', type: 'button', textContent: '‹' });
  const next = element('button', { className: 'case-button case-step', type: 'button', textContent: '›' });
  const count = element('p', { className: 'case-count' });
  count.setAttribute('aria-live', 'polite');
  previous.setAttribute('aria-label', 'Tavola prima');
  const strip = element('div', { className: 'case-strip' });
  const view = element('div', { className: 'case-window' }, [strip]);
  const frame = element('div', { className: 'case-frame' }, [view]);
  const stand = element('div', { className: 'case-stand' }, [
    element('div', { className: 'case-shadow' }), element('div', { className: 'case-leg case-leg--left' }), element('div', { className: 'case-leg case-leg--right' }), frame,
  ]);
  const zoomed = element('div', { className: 'case-zoom', hidden: true });
  zoomed.setAttribute('role', 'dialog');
  zoomed.setAttribute('aria-label', 'Immagine intera');
  root.replaceChildren(
    element('div', { className: 'case-top' }, [index, close]),
    stand,
    element('div', { className: 'case-foot' }, [previous, count, next]),
    zoomed,
  );
  root.addEventListener('dragstart', (event) => event.preventDefault());

  let work;
  let boards = [];
  let at = 0;
  let mode;

  // The picture at full size, over everything, until touched again.
  function zoom(image) {
    const most = 1.1 / devicePixelRatio;
    const fit = Math.min((innerWidth - 32) / image.w, (innerHeight - 112) / image.h, most);
    const img = element('img', { src: asset(image.src), alt: image.alt ?? '', decoding: 'async' });
    if (image.srcset) {
      img.srcset = srcset(image.srcset);
      img.sizes = `${Math.ceil(image.w * fit)}px`;
    }
    img.style.width = `${Math.floor(image.w * fit)}px`;
    img.style.height = `${Math.floor(image.h * fit)}px`;
    const shut = element('button', { className: 'case-button case-zoom__close', type: 'button', textContent: 'Chiudi' });
    zoomed.replaceChildren(img, shut);
    zoomed.hidden = false;
    shut.focus({ preventScroll: true });
    sound.play('tap');
  }
  const unzoom = () => {
    zoomed.hidden = true;
    zoomed.replaceChildren();
  };
  zoomed.addEventListener('click', (event) => {
    event.stopPropagation();
    unzoom();
  });
  addEventListener('keydown', (event) => {
    if (zoomed.hidden || event.key !== 'Escape') return;
    event.stopImmediatePropagation();
    event.preventDefault();
    unzoom();
  }, true);

  // Sizes every board for the frame at hand: the words take the room they need, the visual thing the
  // rest, and never less than half of the board.
  function fit(node, board) {
    const W = view.clientWidth;
    const H = view.clientHeight;
    const text = node.querySelector('.case-words');
    const shown = node.querySelector('.case-visual');
    const boxes = [...shown.querySelectorAll('.case-pic:not(.case-extra, .case-more)')];
    const extra = shown.querySelector('.case-extra');
    const more = node.querySelector('.case-more');
    const { kind } = board.visual;
    const first = boxes[0]?.image;
    const upright = kind === 'pics' && portrait(first);
    const tall = Math.round(H * 0.56);
    let used = false;
    let kept = false;
    const enough = W * H * 0.53;
    const area = (box) => box.offsetWidth * box.offsetHeight;
    // A close look is worth it only when it shows the picture clearly larger than the picture beside it.
    const closer = (box) => (1.1 / devicePixelRatio) / (box.offsetWidth / box.image.w) >= 1.4;

    if (mode === 'side' && !text && kind !== 'next') {
      node.dataset.layout = 'full';
      if (kind === 'pics') {
        const caption = shown.querySelector('.case-caption') ? 44 : 0;
        const sum = board.visual.items.reduce((total, image) => total + image.w / image.h, 0);
        const h = Math.min(H - 48 - caption, (W - 48 - 20 * (boxes.length - 1)) / sum);
        boxes.forEach((box) => draw(box, { w: h * (box.image.w / box.image.h), h }));
        const rest = W - 48 - boxes.reduce((total, box) => total + box.offsetWidth + 20, 0);
        const below = H - 48 - caption - 20 - boxes[0].offsetHeight;
        if (more && upright && rest > W * 0.3 && closer(boxes[0])) {
          draw(more, { w: rest, h, fit: 'detail', focus: [0.5, 0.3] });
          kept = true;
        } else if (more && below > H * 0.25 && closer(boxes[0])) {
          draw(more, { w: W - 48, h: below, fit: 'detail', focus: [0.5, 0.5] });
          kept = true;
        }
      } else if (kind === 'detail') {
        draw(boxes[0], { w: W, h: H, fit: 'detail', focus: board.visual.focus });
      }
    } else if (mode === 'side' && kind === 'next') {
      // Words above, the next work below them.
      node.dataset.layout = 'under';
      if (text) text.style.width = `${W}px`;
      const room = H - (text?.offsetHeight ?? 0) - shown.querySelector('.case-next__label').offsetHeight;
      draw(boxes[0], { w: W, h: room, fit: 'cover', focus: [0.5, 0.5] });
    } else if (mode === 'side' && kind === 'detail' && extra && (first.w / devicePixelRatio) * Math.min(H, first.h / devicePixelRatio) < enough) {
      // A picture too small for a close look on a wide board: it and a second one, whole, above the words.
      node.dataset.layout = 'over';
      text.style.width = `${W}px`;
      shown.style.flexDirection = 'row';
      const pictures = [boxes[0], extra];
      const sum = pictures.reduce((total, box) => total + box.image.w / box.image.h, 0);
      const h = Math.min(H - text.offsetHeight, (W - 36) / sum);
      pictures.forEach((box) => draw(box, { w: h * (box.image.w / box.image.h), h }));
      used = true;
    } else if (mode === 'side' && kind === 'pics' && !upright) {
      // A landscape picture above, whole when it fills half of the board, cut at its foot otherwise.
      node.dataset.layout = 'over';
      text.style.width = `${W}px`;
      const room = H - text.offsetHeight - (shown.querySelector('.case-caption')?.offsetHeight ?? 0);
      draw(boxes[0], { w: W, h: room });
      const textW = Math.round(Math.min(560, Math.max(480, W * 0.4)));
      if (area(boxes[0]) < enough && extra) {
        // A picture with few pixels: it and a second one, whole, one above the other beside the words.
        node.dataset.layout = 'beside';
        text.style.width = `${textW}px`;
        shown.style.width = `${W - textW}px`;
        shown.style.flexDirection = 'column';
        [boxes[0], extra].forEach((box) => draw(box, { w: W - textW, h: (H - 36) / 2 }));
        used = area(boxes[0]) + area(extra) >= enough;
        if (!used) {
          node.dataset.layout = 'over';
          text.style.width = `${W}px`;
          shown.style.cssText = '';
        }
      }
      if (!used && area(boxes[0]) < enough) draw(boxes[0], { w: W, h: room, fit: 'cover', focus: [0.5, 0] });
    } else if (mode === 'side') {
      node.dataset.layout = 'beside';
      const textW = Math.round(Math.min(560, Math.max(480, W * 0.4)));
      if (upright) {
        // Upright pictures whole, side by side at full height, their caption over the words. A close look
        // at the first fills the room left: beside them when it is wide, under the words when it is high.
        const caption = shown.querySelector('.case-caption');
        if (caption) text.prepend(caption);
        const sum = board.visual.items.reduce((total, image) => total + image.w / image.h, 0);
        const gaps = 12 * (boxes.length - 1);
        const h = Math.min(H, (W - textW - gaps) / sum);
        boxes.forEach((box) => draw(box, { w: h * (box.image.w / box.image.h), h }));
        let wide = boxes.reduce((total, box) => total + box.offsetWidth, gaps);
        const spare = W - textW - wide - 12;
        if (more && spare > 160 && closer(boxes[0])) {
          shown.append(more);
          draw(more, { w: spare, h, fit: 'detail', focus: [0.5, 0.3] });
          wide += 12 + more.offsetWidth;
          kept = true;
        }
        shown.style.width = `${wide}px`;
        text.style.width = `${W - wide}px`;
        const room = H - text.offsetHeight;
        if (more && !kept && room > 160) {
          draw(more, { w: W - wide, h: room, fit: 'detail', focus: [0.5, 0.3] });
          kept = true;
        }
      } else {
        text.style.width = `${textW}px`;
        shown.style.width = `${W - textW}px`;
        shown.style.minHeight = `${H}px`;
        if (kind === 'detail') draw(boxes[0], { w: W - textW, h: H, fit: 'detail', focus: board.visual.focus });
      }
    } else {
      // One above the other: the visual thing first, at least just over half of the board high.
      node.dataset.layout = text ? 'stack' : 'full';
      // A landscape picture whole when it is enough; with a second one under it when they are enough
      // together; cut to the height of the board otherwise ('crop').
      const pair = (box) => {
        draw(box, { w: W, h: H * 0.8 });
        if (area(box) >= enough) return 'whole';
        if (!extra) return 'crop';
        draw(extra, { w: W, h: Math.max(tall - box.offsetHeight, H * 0.3) });
        return area(box) + area(extra) >= enough ? 'pair' : 'crop';
      };
      if (kind === 'pics' && upright) {
        // Upright pictures side by side, whole; where there is room left, a close look at the first.
        const caption = shown.querySelector('.case-caption') ? 44 : 0;
        const sum = board.visual.items.reduce((total, image) => total + image.w / image.h, 0);
        const h = Math.min(H * (text ? 0.82 : 0.92) - caption, (W - 24 - 12 * (boxes.length - 1)) / sum);
        boxes.forEach((box) => draw(box, { w: h * (box.image.w / box.image.h), h }));
        shown.style.flexDirection = 'row';
        const rest = W - 24 - boxes.reduce((total, box) => total + box.offsetWidth + 12, 0);
        if (more && rest > W * 0.3 && closer(boxes[0])) {
          shown.querySelector('.case-caption')?.before(more);
          if (!shown.contains(more)) shown.append(more);
          draw(more, { w: rest, h: boxes[0].offsetHeight, fit: 'detail', focus: [0.5, 0.3] });
          kept = true;
        }
      } else if (kind === 'pics' && text) {
        const how = pair(boxes[0]);
        used = how === 'pair';
        if (how === 'crop') draw(boxes[0], { w: W, h: Math.max(boxes[0].offsetHeight, tall), fit: 'cover', focus: [0.5, 0] });
      } else if (kind === 'pics') {
        used = boxes.length === 1 && pair(boxes[0]) === 'pair';
        const h = (H - 48 - 12 * (boxes.length - 1)) / boxes.length;
        if (!used) boxes.forEach((box) => draw(box, { w: W - 24, h }));
        // A low picture alone: under it, a close look at the same picture.
        const room = H - 60 - boxes[0].offsetHeight;
        if (!used && more && boxes.length === 1 && room > H * 0.3 && closer(boxes[0])) {
          draw(more, { w: W - 24, h: room, fit: 'detail', focus: [0.5, 0.5] });
          kept = true;
        }
      } else if (kind === 'next') {
        const how = pair(boxes[0]);
        used = how === 'pair';
        if (how === 'crop') draw(boxes[0], { w: W, h: H - shown.querySelector('.case-next__label').offsetHeight, fit: 'cover', focus: [0.5, 0.5] });
      } else if (kind === 'detail') {
        // A close look narrower than the board is made taller; a picture too small for that gets a
        // second close look under it.
        draw(boxes[0], { w: W, h: tall, fit: 'detail', focus: board.visual.focus });
        if (area(boxes[0]) < enough) draw(boxes[0], { w: W, h: Math.min(enough / boxes[0].offsetWidth, H * 0.8), fit: 'detail', focus: board.visual.focus });
        if (extra && area(boxes[0]) < enough) {
          draw(extra, { w: W, h: Math.max(tall - boxes[0].offsetHeight, H * 0.25), fit: 'detail', focus: [0.5, 0.4] });
          used = true;
        }
      } else {
        shown.style.minHeight = `${tall}px`;
      }
    }
    if (!used) extra?.remove();
    if (!kept) more?.remove();
  }

  function build(board, order) {
    const texts = words(board, work);
    const shown = visual(board, work, zoom);
    shown.classList.add('case-visual');
    const parts = [rise(shown, 0)];
    if (texts.length) {
      const column = element('div', { className: 'case-words' }, texts);
      if (board.visual.kind === 'pics' && board.visual.items.length === 1 && portrait(board.visual.items[0]) && !board.visual.items[0].tall) {
        column.append(rise(pic(board.visual.items[0], zoom, 'case-more'), texts.length + 1));
      }
      parts.push(column);
    } else if (board.visual.kind === 'pics' && board.visual.items.every((image) => !image.tall) && (board.visual.items.length === 1 || board.visual.items.every(portrait))) {
      shown.querySelector('.case-caption')?.before(pic(board.visual.items[0], zoom, 'case-more'));
      if (!shown.querySelector('.case-more')) shown.append(pic(board.visual.items[0], zoom, 'case-more'));
    }
    const node = element('section', { className: `case-board case-board--${board.cover ? 'cover' : board.visual.kind}` }, parts);
    node.setAttribute('aria-label', `${PHASES[board.phase] ?? 'Il lavoro dopo'}, tavola ${order + 1} di ${boards.length}`);
    return node;
  }

  function label() {
    const board = boards[at];
    count.textContent = `${at + 1} di ${boards.length}`;
    previous.disabled = at === 0;
    next.setAttribute('aria-label', at === boards.length - 1 ? 'Torna al sentiero' : 'Tavola dopo');
    for (const button of index.children) {
      const here = button.dataset.phase === board.phase;
      button.classList.toggle('is-here', here);
      if (here) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    strip.children[at].classList.add('is-seen');
  }

  function layout(keep = 0) {
    const W = view.clientWidth;
    const H = view.clientHeight;
    mode = W >= 900 && W / H >= 1.3 ? 'side' : 'stack';
    const following = works[work.next] ?? Object.values(works)[0];
    const row = mode === 'side' ? 3 : W >= 600 ? 2 : 1;
    boards = plan(work, following, mode === 'stack', row, mode === 'side' ? 1 : row);
    root.dataset.mode = mode;
    const present = ORDER.filter((phase) => boards.some((board) => board.phase === phase));
    index.replaceChildren(...present.map((phase) => {
      const button = element('button', { className: 'case-phase', type: 'button' }, [
        element('span', { className: 'case-phase__long', textContent: PHASES[phase] }),
        element('span', { className: 'case-phase__short', textContent: PHASES[phase][0] }),
      ]);
      button.setAttribute('aria-label', PHASES[phase]);
      button.dataset.phase = phase;
      button.addEventListener('click', () => show(boards.findIndex((board) => board.phase === phase)));
      return button;
    }));
    strip.replaceChildren(...boards.map((board, order) => build(board, order)));
    [...strip.children].forEach((node, order) => fit(node, boards[order]));
    fitWords();
    at = Math.min(keep, boards.length - 1);
    strip.scrollLeft = at * strip.clientWidth;
    label();
  }

  // Large words are set as large as their room allows, never broken: the name of a typeface, a value.
  const fitWord = (word, room, most, least) => {
    word.style.fontSize = '100px';
    word.style.whiteSpace = 'nowrap';
    const size = Math.min(most, (100 * room) / word.scrollWidth);
    word.style.whiteSpace = '';
    word.style.fontSize = `${Math.max(least, Math.floor(size))}px`;
  };

  function fitWords() {
    for (const list of strip.querySelectorAll('.case-types')) {
      const names = [...list.querySelectorAll('.case-type__name')];
      const tallest = list.parentElement.classList.contains('case-system') ? 110 : (list.clientHeight - 48) / names.length;
      names.forEach((name) => fitWord(name, list.clientWidth - 64, Math.min(200, tallest * 0.55), 28));
    }
    for (const value of strip.querySelectorAll('.case-tiles--words .case-tile__value')) {
      fitWord(value, value.parentElement.clientWidth - 40, 48, 16);
    }
  }

  // Turning a board: the strip slides; past the last one the visitor is back on the path.
  function show(target) {
    if (target < 0 || target === at) return;
    if (target >= boards.length) {
      onEnd(work.id);
      return;
    }
    sound.play('tap');
    at = target;
    steering = target;
    label();
    strip.scrollTo({ left: target * strip.clientWidth, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  // A slide started by the arrows, the keys or the wheel is not undone by the boards it passes.
  let steering;
  let settle;
  strip.addEventListener('scroll', () => {
    cancelAnimationFrame(settle);
    settle = requestAnimationFrame(() => {
      const near = Math.round(strip.scrollLeft / strip.clientWidth);
      const still = Math.abs(strip.scrollLeft - near * strip.clientWidth) < 4;
      if (steering !== undefined) {
        if (still && near === steering) steering = undefined;
        return;
      }
      if (near !== at && still) {
        at = near;
        label();
      }
    });
  }, { passive: true });

  previous.addEventListener('click', () => show(at - 1));
  next.addEventListener('click', () => show(at + 1));
  close.addEventListener('click', () => onClose());

  // Touching the park around the frame puts the work back.
  root.addEventListener('click', (event) => {
    if (event.target.closest('.case-frame, .case-top, .case-foot, .case-zoom')) return;
    onClose();
  });

  // Wheel: a board that scrolls scrolls first, then the wheel turns the boards.
  let wheel = 0;
  let quiet = 0;
  strip.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const board = strip.children[at];
    const down = event.deltaY > 0;
    const room = down ? board.scrollHeight - board.clientHeight - board.scrollTop > 1 : board.scrollTop > 0;
    if (room && board.contains(event.target)) return;
    event.preventDefault();
    if (event.timeStamp < quiet) return;
    wheel += event.deltaY;
    if (Math.abs(wheel) < WHEEL_STEP) return;
    show(at + Math.sign(wheel));
    wheel = 0;
    quiet = event.timeStamp + 450;
  }, { passive: false });

  // Dragging with the mouse: sideways turns the boards, downwards puts the work back. The finger
  // has the strip's own sliding, and pulls down from the top of a board to put it back.
  let drag;
  strip.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button) return;
    drag = { x: event.clientX, y: event.clientY, left: strip.scrollLeft, moved: false };
  });
  addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 8) return;
    if (!drag.moved && Math.abs(dx) < Math.abs(event.clientY - drag.y)) return;
    drag.moved = true;
    strip.classList.add('is-dragged');
    strip.scrollLeft = drag.left - dx;
  });
  addEventListener('pointerup', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    strip.classList.remove('is-dragged');
    if (drag.moved) {
      const turn = Math.abs(dx) > strip.clientWidth * 0.15 ? -Math.sign(dx) : 0;
      strip.scrollLeft = drag.left;
      if (turn) show(at + turn);
      else strip.scrollTo({ left: at * strip.clientWidth });
      strip.addEventListener('click', (click) => { click.stopPropagation(); click.preventDefault(); }, { capture: true, once: true });
    } else if (dy > 90 && dy > Math.abs(dx) * 1.5) {
      onClose();
    }
    drag = undefined;
  });

  let pull;
  root.addEventListener('touchstart', (event) => {
    const board = event.target.closest?.('.case-board');
    pull = event.touches.length === 1 && (!board || board.scrollTop <= 0)
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : undefined;
  }, { passive: true });
  root.addEventListener('touchend', (event) => {
    if (!pull) return;
    const touch = event.changedTouches[0];
    const dy = touch.clientY - pull.y;
    if (dy > 90 && dy > Math.abs(touch.clientX - pull.x) * 1.5) onClose();
    pull = undefined;
  }, { passive: true });

  let resized;
  addEventListener('resize', () => {
    if (!work) return;
    clearTimeout(resized);
    resized = setTimeout(() => layout(at), 150);
  });

  // The frame grows from the point that was touched, and goes back into it.
  const grow = (point, open) => {
    if (reducedMotion.matches) {
      return root.animate([{ opacity: open ? 0 : 1 }, { opacity: open ? 1 : 0 }], { duration: 250, fill: 'forwards' }).finished.catch(() => {});
    }
    const box = stand.getBoundingClientRect();
    const dx = (point?.x ?? innerWidth / 2) - (box.left + box.width / 2);
    const dy = (point?.y ?? innerHeight / 2) - (box.top + box.height / 2);
    const small = { transform: `translate(${dx}px, ${dy}px) scale(0.1)`, opacity: 0 };
    const full = { transform: 'none', opacity: 1 };
    const chrome = [...root.querySelectorAll('.case-top, .case-foot')];
    chrome.forEach((part) => part.animate([{ opacity: open ? 0 : 1 }, { opacity: open ? 1 : 0 }], { duration: open ? 300 : 200, delay: open ? 450 : 0, fill: 'both' }));
    return stand.animate(open ? [small, full] : [full, small], { duration: open ? 700 : 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }).finished.catch(() => {});
  };

  return {
    get work() {
      return work?.id;
    },
    async open(id, point) {
      await styled;
      await document.fonts.load('700 100px Grandstander').catch(() => {});
      unzoom();
      work = works[id];
      const tint = await tintOf(work);
      root.style.setProperty('--board', rgb(mix(tint, 0.07)));
      root.style.setProperty('--panel', rgb(mix(tint, 0.16)));
      root.hidden = false;
      root.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
      layout(0);
      sound.play('whoosh');
      close.focus({ preventScroll: true });
      await grow(point, true);
    },
    async close(point) {
      if (root.hidden) return;
      unzoom();
      sound.play('whoosh');
      await grow(point, false);
      root.hidden = true;
      strip.replaceChildren();
      root.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
      work = undefined;
    },
    key(event) {
      if (!zoomed.hidden) return false;
      if (event.key === 'ArrowRight') show(at + 1);
      else if (event.key === 'ArrowLeft') show(at - 1);
      else return false;
      return true;
    },
  };
}
