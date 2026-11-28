import { asset, element, logo, reducedMotion, srcset } from './media.js';
import { TALL } from './works.js';

// A work seen closely stays in the park: the picture that was touched grows into a large plaster frame
// standing on two legs, and the project is told inside it in boards, phase after phase, the way a
// project is actually made. Around the frame the park is still there.

const KINDS = { siti: 'Sito', negozi: 'Negozio online', programmi: 'Programma', app: 'App', videogioco: 'Videogioco', marchi: 'Marchio', manifesti: 'Manifesto' };
const PHASES = { copertina: 'Copertina', studio: 'Studio', ideazione: 'Ideazione', progettazione: 'Progettazione', risultato: 'Risultato' };
const ORDER = Object.keys(PHASES);
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

// Works made of screens: cutting their pictures cuts words.
const screens = (work) => !['marchi', 'manifesti', 'videogioco'].includes(work.chapter);

// The boards, in order. Each is built round something to look at, a picture of the work, its colours
// or its letters, with the words of its phase beside it. A phase with nothing to look at borrows a
// picture of the work not shown anywhere else, then an enlarged part of one.
const LIMIT = 700;
const LIMIT_WIDE = 420;
const PARTS = [[0, 0, 1, 0.55], [0, 0.45, 1, 0.55], [0.2, 0.2, 0.6, 0.6]];
// The room words take, in characters: a row, a label or a direction costs its words and a little more.
const length = (blocks) => blocks.reduce((total, block) => total + (block.p?.length ?? 0) + (block.items ?? [])
  .reduce((sum, item) => sum + (typeof item === 'string' ? 30 : 80) + (typeof item === 'string' ? item.length : (item.name?.length ?? 0) + (item.p?.length ?? 0)), 0), 0);
// The whole page of the work, to scroll in a window on the board of the result: a capture of the page
// on the computer or on the phone, or the page on the phone that the work already has.
const shot = (value) => (typeof value === 'string' ? { src: value } : value);
// Where the work has a version that can be used, `live`, its address (relative to the site or not).
function pageOf(work, stacked) {
  const live = work.live ? new URL(work.live, document.baseURI).href : undefined;
  const phone = Boolean(work.full?.phone && (stacked || !work.full.desktop));
  if (work.full) return { ...shot(phone ? work.full.phone : work.full.desktop), frame: phone ? 'phone' : 'browser', live };
  if (TALL[work.id]) return { src: `img/work/${work.id}-tall.webp`, w: TALL[work.id], frame: 'phone', live };
  if (live) return { ...coverOf(work), frame: 'browser', live };
  return null;
}
const position = (item) => (typeof item === 'number' ? item : item.i);

function plan(work, stacked, row) {
  // A wide frame has a narrow column for the words beside an upright picture.
  const limit = stacked ? LIMIT : LIMIT_WIDE;
  const gallery = work.gallery ?? [];
  const sections = phases(work);
  const images = sections.flatMap((section) => section.blocks).filter((block) => block.kind === 'images');
  const shown = new Set(images.flatMap((block) => block.items.map(position)));
  const spare = gallery.map((_, at) => at).filter((at) => !shown.has(at) && gallery[at].alt !== work.cover.alt);
  const pool = others(work);
  let parts = 0;
  const borrow = () => {
    if (spare.length) return { kind: 'pics', items: [gallery[spare.shift()]] };
    const image = pool[parts % pool.length] ?? coverOf(work);
    const box = PARTS[Math.floor(parts / Math.max(pool.length, 1)) % PARTS.length];
    parts += 1;
    return { kind: 'crop', image, box };
  };
  // The page scrolling on the phone stands with the phone screens of the same work.
  const scrolling = images.find((block) => block.items.some((item) => gallery[position(item)] && portrait(gallery[position(item)]))) ?? images[0];

  const boards = [{ phase: 'copertina', cover: true, words: [], visual: { kind: 'pics', items: [coverOf(work)] } }];
  for (const section of sections) {
    const own = [];
    let words = [];
    const add = (visual) => {
      own.push({ phase: section.phase, words, visual });
      words = [];
    };
    // A list too long for one board is cut into parts that fit, each going on to the next board.
    const blocks = section.blocks.flatMap((block) => {
      if (!['directions', 'list', 'facts'].includes(block.kind) || length([block]) <= limit) return [block];
      const parts = [];
      for (const item of block.items) {
        const last = parts.at(-1);
        if (last && length([{ ...last, items: [...last.items, item] }]) <= limit) last.items.push(item);
        else parts.push({ ...block, items: [item] });
      }
      return parts;
    });
    for (const block of blocks) {
      if (block.kind === 'images') {
        const entries = block.items.filter((item) => gallery[position(item)])
          .map((item) => (typeof item === 'number' ? gallery[item] : { crop: true, image: gallery[item.i], box: item.box, caption: item.caption }));
        if (TALL[work.id] && block === scrolling) {
          const at = entries.findIndex((entry) => !entry.crop && portrait(entry));
          entries.splice(at < 0 ? entries.length : at, 0, { tall: true, src: `img/work/${work.id}-tall.webp`, w: TALL[work.id], h: Math.round(TALL[work.id] * 2.1667), alt: '' });
        }
        let pictures = [];
        const group = () => {
          groups(pictures, stacked, row, words.length > 0).forEach(add);
          pictures = [];
        };
        for (const entry of entries) {
          if (!entry.crop) {
            pictures.push(entry);
            continue;
          }
          group();
          add({ kind: 'crop', image: entry.image, box: entry.box, caption: entry.caption });
        }
        group();
      } else if (block.kind === 'palette') {
        add({ kind: 'palette', items: block.items });
      } else if (block.kind === 'type' && !words.length && own.at(-1)?.visual.kind === 'palette' && !own.at(-1).visual.type) {
        own.at(-1).visual.type = block.items;
      } else if (block.kind === 'type') {
        add({ kind: 'type', items: block.items });
      } else {
        words.push(block);
      }
    }
    const last = own.at(-1);
    if (words.length && last && length(last.words) + length(words) <= limit) last.words.push(...words);
    else if (words.length) add(borrow());
    // Too many words for one board: the rest go on to a board of their own, with something to look at.
    for (let at = 0; at < own.length; at++) {
      const board = own[at];
      if (board.words.length < 2 || length(board.words) <= limit) continue;
      let cut = 1;
      while (cut < board.words.length && length(board.words.slice(0, cut + 1)) <= limit) cut += 1;
      own.splice(at + 1, 0, { phase: section.phase, words: board.words.slice(cut), visual: borrow() });
      board.words = board.words.slice(0, cut);
    }
    // A poster and its colours share one board.
    const poster = work.chapter === 'manifesti' && own.find((board) => board.visual.kind === 'pics' && portrait(board.visual.items[0]));
    const colours = own.find((board) => board.visual.kind === 'palette');
    if (poster && colours) {
      colours.visual.poster = poster.visual.items[0];
      colours.words.push(...poster.words);
      own.splice(own.indexOf(poster), 1);
    }
    if (section.phase === 'risultato' && own.length) {
      own[0].link = true;
      const page = pageOf(work, stacked);
      const { visual: shown } = own[0];
      if (page) {
        own[0].visual = { kind: 'window', page, also: shown.kind === 'pics' ? shown.items.filter((image) => !image.tall) : [] };
        // Beside an empty window, the pictures of the board after it, when they have no words of their own.
        const after = own[1];
        if (!own[0].visual.also.length && after?.visual.kind === 'pics' && !after.words.length) {
          own[0].visual.also = after.visual.items;
          own.splice(1, 1);
        }
      }
    }
    boards.push(...own);
  }
  // On a narrow screen a screenshot of the computer would be cut through its words or drawn small:
  // where the work has its whole page on the phone, each such board shows a part of that page instead,
  // one after the other down the page.
  const page = stacked && work.full?.phone && { ...shot(work.full.phone), alt: `La pagina di ${work.title} sul telefono` };
  const desk = ({ visual }) => (visual.kind === 'pics' ? visual.items.length === 1 && !portrait(visual.items[0]) : visual.kind === 'crop' && !visual.caption && !portrait(visual.image));
  const wide = page ? boards.filter((board) => !board.cover && desk(board)) : [];
  wide.forEach((board, order) => {
    board.visual = { kind: 'crop', image: page, box: [0, order / wide.length, 1, 1 / wide.length], slice: true };
  });
  return boards;
}

// Pictures go together as they fit the frame: upright ones side by side, as many as `row`, but one only
// beside words on a wide frame; landscapes alone on a wide frame and up to three one under the other on
// a narrow one.
function groups(items, stacked, row, words) {
  const out = [];
  for (const item of items) {
    const last = out.at(-1);
    const first = words && out.length === 1;
    const most = portrait(item) ? (first && !stacked ? 1 : row) : (stacked && !first ? 3 : 1);
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

// The words beside the picture: paragraphs, and facts, values, lists and the directions tried as short
// rows and labels, each as high as its own words.
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
  if (board.pass) {
    const { work: other, way } = board.pass;
    nodes.push(
      element('p', { className: 'case-kicker', textContent: way === 'next' ? 'Prossimo progetto' : 'Progetto prima' }),
      element('h2', { className: 'case-name', textContent: other.title }),
      element('p', { className: 'case-meta', textContent: [KINDS[other.chapter], other.place].filter(Boolean).join(', ') }),
      element('p', { className: 'case-actions' }, [
        element('a', { className: 'case-link', href: `#lavoro/${other.id}`, textContent: 'Apri il progetto' }),
        element('button', { className: 'case-back', type: 'button', textContent: 'Torna al parco' }),
      ]),
    );
  }
  const heading = (title) => (title ? [element('h3', { className: 'case-subtitle', textContent: title })] : []);
  for (const block of board.words) {
    if (block.kind === 'text') {
      nodes.push(...heading(block.title), element('p', { className: 'case-p', textContent: block.p }));
    } else if (block.kind === 'values') {
      nodes.push(...heading(block.title), element('ul', { className: 'case-values' }, block.items.map((item) => element('li', { textContent: item }))));
    } else if (block.kind === 'list' || block.kind === 'facts') {
      nodes.push(...heading(block.title), element('ul', { className: `case-rows case-rows--${block.kind}` }, block.items.map((item) => {
        const split = /^([^:]{2,28}):\s+(.+)$/.exec(item);
        return element('li', {}, split
          ? [element('span', { className: 'case-rows__label', textContent: split[1] }), element('span', { textContent: split[2] })]
          : [element('span', { textContent: item })]);
      })));
    } else if (block.kind === 'directions') {
      nodes.push(element('ul', { className: 'case-ways' }, block.items.map((item) => element('li', { className: `case-way${item.chosen ? ' is-chosen' : ''}` }, [
        ...(item.chosen ? [element('span', { className: 'case-way__mark', textContent: 'La scelta' })] : []),
        element('span', { className: 'case-way__name', textContent: item.name }),
        ...(item.p ? [element('span', { className: 'case-way__p', textContent: item.p })] : []),
      ]))));
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

const caption = (text) => element('p', { className: 'case-caption', textContent: text });

function swatches(items) {
  const list = element('ul', { className: 'case-swatches' }, items.map((item) => {
    const chip = element('li', { className: 'case-swatch' }, [
      element('span', { className: 'case-swatch__name', textContent: item.name }),
      element('span', { className: 'case-swatch__hex', textContent: item.hex.toLowerCase() }),
      ...(item.role ? [element('span', { className: 'case-swatch__role', textContent: item.role })] : []),
    ]);
    chip.style.background = item.hex;
    chip.style.color = rgb(label(hexRgb(item.hex)));
    return chip;
  }));
  list.style.setProperty('--cols', items.length <= 4 ? items.length : Math.ceil(items.length / 2));
  list.style.setProperty('--cols-narrow', items.length <= 2 ? items.length : 2);
  return list;
}

function visual(board, work, zoom) {
  const { kind } = board.visual;
  if (kind === 'pics') {
    const { items } = board.visual;
    const plain = board.cover || board.pass;
    const holder = element('div', { className: 'case-pics' }, items.map((image) => pic(image, board.pass ? null : zoom)));
    // A close look at a single picture, used where the frame has room for it.
    if (items.length === 1 && !items[0].tall && !plain) holder.append(pic(items[0], zoom, 'case-closer'));
    const captions = [...new Set(items.map((image) => image.caption).filter(Boolean))];
    if (captions.length === 1 && !plain) holder.append(caption(captions[0]));
    return holder;
  }
  if (kind === 'crop') {
    return element('div', { className: 'case-pics' }, [pic(board.visual.image, zoom), ...(board.visual.caption ? [caption(board.visual.caption)] : [])]);
  }
  if (kind === 'window') {
    const { page, also } = board.visual;
    // The whole page is heavy: it is fetched only when its board comes into view. Never wider than its
    // own pixels allow. Where the work can be used, the working version comes over it once loaded.
    const img = element('img', { alt: `La pagina intera di ${work.title}`, decoding: 'async', draggable: false });
    img.dataset.src = asset(page.src);
    img.addEventListener('load', () => { img.style.maxWidth = `${Math.floor((img.naturalWidth * 1.1) / devicePixelRatio)}px`; }, { once: true });
    const view = element('div', { className: 'case-screen__view' }, [element('div', { className: 'case-screen__page' }, [img])]);
    // The address written in the bar is the one people know: the public site, or the working version
    // where it lives elsewhere; a version kept in this site has none.
    const address = work.link?.href ?? (page.live && new URL(page.live).origin !== location.origin ? page.live : undefined);
    const controls = page.live ? [
      element('button', { className: 'case-screen__full', type: 'button', textContent: 'Schermo intero' }),
      element('a', { className: 'case-screen__out', href: page.live, target: '_blank', rel: 'noopener' }, [
        element('span', { className: 'case-screen__long', textContent: 'Apri in una scheda nuova' }),
        element('span', { className: 'case-screen__short', textContent: 'Nuova scheda' }),
      ]),
      element('button', { className: 'case-screen__shut', type: 'button', textContent: '×' }),
    ] : [];
    controls.at(-1)?.setAttribute('aria-label', 'Esci dallo schermo intero');
    const bar = address || controls.length ? [element('div', { className: 'case-screen__bar' }, [
      ...(address ? [element('span', { className: 'case-screen__host', textContent: new URL(address).host })] : []),
      ...controls,
    ])] : [];
    const screen = element('div', { className: `case-screen case-screen--${page.frame}` }, [...bar, view]);
    screen.live = page.live;
    return element('div', { className: 'case-pics case-window-holder' }, [screen, ...also.map((image) => pic(image, zoom))]);
  }
  if (kind === 'palette') {
    const { poster, type, items } = board.visual;
    const colours = type ? element('div', { className: 'case-system' }, [swatches(items), types(type)]) : swatches(items);
    return poster ? element('div', { className: 'case-poster' }, [pic(poster, zoom), colours]) : colours;
  }
  return types(board.visual.items);
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

// Draws a picture in a box of the given size, never larger than its own pixels allow (10% at most):
// whole ('contain'), filling the box ('cover', anchored at `focus`), or a part of it filling the box
// ('part': `part` is [x, y, w, h] in fractions of the picture).
function draw(box, { w, h, fit = 'contain', focus = [0.5, 0], part }) {
  const { image } = box;
  const most = 1.1 / devicePixelRatio;
  const [px, py, pw, ph] = part ?? [0, 0, 1, 1];
  // 'whole part': the part is shown entire, the box shaped on it.
  const entire = fit === 'whole part';
  const scale = fit === 'contain' || entire
    ? Math.min(w / (image.w * pw), h / (image.h * ph), most)
    : Math.min(Math.max(w / (image.w * pw), h / (image.h * ph)), most);
  const drawnW = image.w * scale;
  const drawnH = image.h * scale;
  const boxW = Math.floor(fit === 'contain' ? drawnW : Math.min(w, entire ? drawnW * pw : drawnW));
  const boxH = Math.floor(fit === 'contain' ? drawnH : Math.min(h, entire ? drawnH * ph : drawnH));
  box.style.width = `${boxW}px`;
  box.style.height = `${boxH}px`;
  const img = box.querySelector('img');
  if (image.tall) {
    img.style.width = '100%';
    return;
  }
  // The middle of the part, or the focus, sits in the middle of the box, as far as the picture allows.
  const centre = part ? [(px + pw / 2) * drawnW, (py + ph / 2) * drawnH] : [focus[0] * drawnW, focus[1] * drawnH];
  const left = Math.min(0, Math.max(boxW - drawnW, boxW / 2 - centre[0]));
  const top = part ? Math.min(0, Math.max(boxH - drawnH, boxH / 2 - centre[1])) : -Math.round((drawnH - boxH) * focus[1]);
  img.style.width = `${Math.floor(drawnW)}px`;
  img.style.height = `${Math.floor(drawnH)}px`;
  img.style.left = `${Math.round(left)}px`;
  img.style.top = `${Math.round(top)}px`;
  if (img.srcset) img.sizes = `${Math.ceil(drawnW)}px`;
}

export function createStory(root, { works, sound, onClose }) {
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
  // What happens in the frame stays in the frame: no click, press or wheel in it reaches the park.
  for (const type of ['pointerdown', 'pointerup', 'click', 'wheel']) frame.addEventListener(type, (event) => event.stopPropagation());

  let work;
  let boards = [];
  const go = (board) => {
    location.hash = `#lavoro/${board.pass.work.id}`;
  };
  const passName = (board) => (board.pass.way === 'next' ? 'Prossimo progetto' : 'Progetto prima');
  let at = 0;
  let mode;

  // A working version in its window: scrolled and clicked in place, larger with one click, or in a
  // tab of its own. Until it has loaded, the capture of its page stays under it.
  function wake(screen) {
    if (!screen.live || screen.querySelector('iframe')) return;
    const frame = element('iframe', { src: screen.live, title: `${work.title}, versione da usare` });
    frame.addEventListener('load', () => screen.classList.add('is-live'), { once: true });
    screen.querySelector('.case-screen__view').append(frame);
  }
  const unfull = () => {
    const open = root.querySelector('.case-screen.is-full');
    open?.classList.remove('is-full');
    return Boolean(open);
  };
  frame.addEventListener('click', (event) => {
    const screen = event.target.closest('.case-screen');
    if (event.target.closest('.case-screen__full')) screen.classList.add('is-full');
    else if (event.target.closest('.case-screen__shut')) unfull();
  });

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
    if (event.key !== 'Escape' || (zoomed.hidden && !root.querySelector('.case-screen.is-full'))) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    if (!unfull()) unzoom();
  }, true);

  // Sizes every board for the frame at hand. The picture takes most of the board, the words the rest:
  // under a landscape picture on a wide frame, beside an upright one, under everything on a narrow one.
  function fit(node, board) {
    const W = view.clientWidth;
    const H = view.clientHeight;
    const text = node.querySelector('.case-words');
    const shown = node.querySelector('.case-visual');
    const boxes = [...shown.querySelectorAll('.case-pic:not(.case-closer)')];
    const closer = shown.querySelector('.case-closer');
    const { kind, box: part } = board.visual;
    // An upright picture, or a part of one, stands beside the words rather than above them.
    const upright = (kind === 'pics' || kind === 'crop') && portrait(boxes[0].image);
    const caption = (shown.querySelector(':scope > .case-caption')?.offsetHeight ?? -20) + 20;
    // A page is cut at its foot; a cover or the next work's cover keeps its middle.
    // A part of a screen chosen in the data is shown entire, so that no word of it is cut; any other
    // part fills its room.
    const cut = kind === 'crop' && board.visual.caption && screens(work) ? 'whole part' : 'part';
    const fill = kind === 'crop' ? { fit: cut, part } : { fit: 'cover', focus: board.cover || board.pass ? [0.5, 0.5] : [0.5, 0] };
    // A close look is kept only where it shows the picture clearly larger than the picture itself.
    const larger = (box) => (1.1 / devicePixelRatio) / (box.offsetWidth / box.image.w) >= 1.4;
    const row = (room, high) => {
      const sum = boxes.reduce((total, box) => total + box.image.w / box.image.h, 0);
      const h = Math.min(high, (room - 12 * (boxes.length - 1)) / sum);
      boxes.forEach((box) => draw(box, { w: h * (box.image.w / box.image.h), h }));
      return boxes.reduce((total, box) => total + box.offsetWidth, 12 * (boxes.length - 1));
    };
    let kept = false;

    if (kind === 'window') {
      // The window takes almost all the board; the words of the result stand in a narrow column.
      const screen = shown.querySelector('.case-screen');
      const phone = board.visual.page.frame === 'phone';
      node.dataset.layout = mode === 'side' && text ? 'beside' : text ? 'stack' : 'full';
      const room = mode === 'side' && text ? W - 360 : W - 24;
      if (mode === 'side' && text) {
        text.style.width = '360px';
        shown.style.width = `${room}px`;
        shown.style.minHeight = `${H}px`;
      }
      // On a narrow screen the page of the phone is as wide as the screen itself.
      const high = mode === 'side' ? H : H * 0.86;
      const wide = phone && mode === 'side' ? Math.min(room, high * 0.47) : room;
      screen.style.width = `${Math.floor(wide)}px`;
      screen.style.height = `${Math.floor(high)}px`;
      const rest = room - wide - 12;
      // The pictures of the result stand beside the window on a wide frame, under it on a narrow one.
      for (const box of boxes) {
        if (mode === 'side' && rest > 120) draw(box, { w: rest / boxes.length - 12, h: high });
        else if (mode === 'side') box.remove();
        else draw(box, { w: W - 24, h: H * 0.8 });
      }
    } else if (mode === 'side' && !upright && (kind === 'pics' || kind === 'crop') && (text || boxes.length === 1)) {
      // The picture across the board, the words in two columns under it.
      node.dataset.layout = text ? 'over' : 'full';
      if (text) text.style.width = `${W}px`;
      // Every word stays in sight: the picture takes the height the words leave, half the board at least.
      const least = 0.5;
      const high = Math.max(H * least, H - (text?.offsetHeight ?? 0)) - caption;
      draw(boxes[0], { w: W, h: high, ...fill });
    } else if (mode === 'side' && text) {
      // The picture, the colours or the letters on the left, the words in a column on the right.
      node.dataset.layout = 'beside';
      // A paragraph longer than the column widens it, so that no word runs past the frame.
      for (const column of [400, 520, 640]) {
        const room = W - column;
        text.style.width = `${column}px`;
        shown.style.width = `${room}px`;
        shown.style.minHeight = `${H}px`;
        kept = false;
        if (kind === 'crop') {
          draw(boxes[0], { w: room, h: H - caption, fit: cut, part });
        } else if (kind === 'pics') {
          const used = row(room, H - caption);
          const rest = room - used - 12;
          if (closer && rest > 140 && larger(boxes[0])) {
            draw(closer, { w: rest, h: boxes[0].offsetHeight, fit: 'part', part: [0.1, 0.05, 0.8, 0.45] });
            kept = true;
          }
        } else if (kind === 'palette' && board.visual.poster) {
          draw(shown.querySelector('.case-pic'), { w: room * 0.64, h: H });
        }
        if (text.offsetHeight <= H) break;
      }
    } else if (mode === 'side') {
      node.dataset.layout = 'full';
      if (kind === 'pics') {
        const used = row(W - 48, H - 48 - caption);
        const rest = W - 48 - used - 20;
        if (upright && closer && rest > W * 0.25 && larger(boxes[0])) {
          draw(closer, { w: rest, h: boxes[0].offsetHeight, fit: 'part', part: [0.1, 0.05, 0.8, 0.45] });
          kept = true;
        }
      }
      else if (kind === 'crop') draw(boxes[0], { w: W, h: H - caption, fit: cut, part });
      else if (kind === 'palette' && board.visual.poster) draw(shown.querySelector('.case-pic'), { w: W * 0.5, h: H });
    } else {
      node.dataset.layout = text ? 'stack' : 'full';
      // On the cover and on a board of passage every word stays in sight.
      const top = Math.round(board.cover || board.pass ? Math.max(H * 0.45, H - text.offsetHeight) : H * 0.62);
      // A screen of a site or of a program is never cut on a narrow screen: whole, across the width.
      const whole = screens(work) && !portrait(boxes[0]?.image ?? { w: 1, h: 0 }) && !(kind === 'crop' && board.visual.caption);
      if (whole && (kind === 'pics' || kind === 'crop') && boxes.length === 1) {
        draw(boxes[0], { w: W, h: H * 0.8 });
      } else if (kind === 'crop' && board.visual.slice) {
        // A part of the page on the phone, as wide as the screen allows, from the top of the part.
        draw(boxes[0], { w: W, h: H * 0.8, fit: 'cover', focus: [0.5, part[1] / Math.max(0.0001, 1 - part[3])] });
      } else if (kind === 'crop') {
        draw(boxes[0], { w: W, h: text ? top : H - 24 - caption, fit: cut, part });
      } else if (kind === 'pics' && upright) {
        shown.style.flexDirection = 'row';
        row(W - 24, H * 0.9 - caption);
      } else if (kind === 'pics' && boxes.length > 1) {
        const h = (H - 48 - 12 * (boxes.length - 1)) / boxes.length;
        boxes.forEach((box) => draw(box, { w: W - 24, h }));
      } else if (kind === 'pics' && text) {
        draw(boxes[0], { w: W, h: top, ...fill });
      } else if (kind === 'pics') {
        // A landscape picture alone: whole, and under it an enlarged part of it.
        draw(boxes[0], { w: W - 24, h: top });
        const room = H - 60 - caption - boxes[0].offsetHeight;
        if (closer && room > H * 0.25 && larger(boxes[0])) {
          draw(closer, { w: W - 24, h: room, fit: 'part', part: [0, 0, 0.5, 0.5] });
          kept = true;
        }
      } else if (kind === 'palette' && board.visual.poster) {
        draw(shown.querySelector('.case-pic'), { w: W, h: top });
      } else {
        shown.style.minHeight = `${top}px`;
      }
    }
    if (!kept) closer?.remove();
  }

  function build(board, order) {
    const texts = words(board, work);
    const shown = visual(board, work, zoom);
    shown.classList.add('case-visual');
    const parts = [rise(shown, 0)];
    if (texts.length) parts.push(element('div', { className: 'case-words' }, texts));
    const node = element('section', { className: `case-board case-board--${board.cover ? 'cover' : board.pass ? 'pass' : board.visual.kind}` }, parts);
    node.setAttribute('aria-label', board.pass ? passName(board) : `${PHASES[board.phase]}, tavola ${order} di ${boards.length - 2}`);
    if (board.pass) {
      shown.addEventListener('click', () => go(board));
      node.querySelector('.case-back').addEventListener('click', () => onClose());
    }
    return node;
  }

  function label() {
    const board = boards[at];
    count.textContent = board.pass ? passName(board) : `${at} di ${boards.length - 2}`;
    previous.setAttribute('aria-label', at === 0 ? 'Apri il progetto prima' : 'Tavola prima');
    next.setAttribute('aria-label', at === boards.length - 1 ? 'Apri il prossimo progetto' : 'Tavola dopo');
    for (const button of index.children) {
      const here = button.dataset.phase === board.phase;
      button.classList.toggle('is-here', here);
      // On a phone the row slides: the phase one is in stays in sight.
      if (here) index.scrollTo({ left: button.offsetLeft - (index.clientWidth - button.offsetWidth) / 2 });
      if (here) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    strip.children[at].classList.add('is-seen');
    strip.children[at].querySelectorAll('img[data-src]').forEach((img) => {
      img.src = img.dataset.src;
      delete img.dataset.src;
    });
    // The working version of the work is on when its board arrives: some weigh megabytes, so not before.
    strip.children[at].querySelectorAll('.case-screen').forEach(wake);
  }

  // Before the cover and after the last board, a board says which work comes before and after: the
  // visitor goes there only by asking, never carried on by the wheel.
  const pass = (other, way) => ({ pass: { work: other, way }, words: [], visual: { kind: 'pics', items: [coverOf(other)] } });

  function layout(keep = 1) {
    const W = view.clientWidth;
    const H = view.clientHeight;
    mode = W >= 900 && W / H >= 1.3 ? 'side' : 'stack';
    const list = Object.values(works);
    boards = [
      pass(works[work.previous] ?? list.at(-1), 'previous'),
      ...plan(work, mode === 'stack', mode === 'side' ? 3 : W >= 600 ? 2 : 1),
      pass(works[work.next] ?? list[0], 'next'),
    ];
    root.dataset.mode = mode;
    const present = ORDER.filter((phase) => boards.some((board) => board.phase === phase));
    index.replaceChildren(...present.map((phase) => {
      const button = element('button', { className: 'case-phase', type: 'button', textContent: PHASES[phase] });
      button.dataset.phase = phase;
      button.addEventListener('click', () => show(boards.findIndex((board) => board.phase === phase)));
      return button;
    }));
    strip.replaceChildren(...boards.map((board, order) => build(board, order)));
    [...strip.children].forEach((node, order) => fit(node, boards[order]));
    fitTypes();
    at = Math.min(keep, boards.length - 1);
    strip.scrollLeft = at * strip.clientWidth;
    label();
  }

  // The name of a typeface is set as large as its room allows, never broken.
  const fitWord = (word, room, most, least) => {
    word.style.fontSize = '100px';
    word.style.whiteSpace = 'nowrap';
    const size = Math.min(most, (100 * room) / word.scrollWidth);
    word.style.whiteSpace = '';
    word.style.fontSize = `${Math.max(least, Math.floor(size))}px`;
  };

  function fitTypes() {
    for (const list of strip.querySelectorAll('.case-types')) {
      const names = [...list.querySelectorAll('.case-type__name')];
      const tallest = list.parentElement.classList.contains('case-system') ? 200 / names.length : (list.clientHeight - 48) / names.length;
      names.forEach((name) => fitWord(name, list.clientWidth - 64, Math.min(200, tallest * 0.55), 28));
    }
  }

  // Turning a board: the strip slides, and stops at both ends.
  function show(target) {
    if (target < 0 || target >= boards.length || target === at) return;
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

  // The arrows and the keys, asked on a board of passage, open the work it shows.
  const move = (direction) => {
    const target = at + direction;
    if (target < 0 || target >= boards.length) go(boards[at]);
    else show(target);
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
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
    // The page in the window scrolls first, then the board, then the wheel turns the boards.
    const page = event.target.closest?.('.case-screen__page');
    if (page && (down ? page.scrollHeight - page.clientHeight - page.scrollTop > 1 : page.scrollTop > 0)) return;
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
  // Heard on the way down, before the frame keeps the event to itself.
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
  }, true);

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
      layout();
      sound.play('whoosh');
      close.focus({ preventScroll: true });
      await grow(point, true);
      [root, stand, ...root.querySelectorAll('.case-top, .case-foot')].forEach((part) => part.getAnimations().forEach((animation) => animation.cancel()));
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
      if (event.key === 'ArrowRight') move(1);
      else if (event.key === 'ArrowLeft') move(-1);
      else if (event.key === 'Enter' && boards[at].pass && !event.target.closest?.('a, button')) go(boards[at]);
      else return false;
      return true;
    },
  };
}
