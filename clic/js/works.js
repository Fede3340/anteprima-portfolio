// The works of data/works.json as chapters of windows, and as the plain list of all of them.

// The scene that opens each chapter; the sites chapter is the night of the land and has none.
const SCENES = {
  negozi: 'shops',
  programmi: 'programs',
  app: 'apps',
  videogioco: 'game',
  marchi: 'brands',
  manifesti: 'posters',
};
const PHONE = '(max-width: 767px)';

const element = (tag, properties = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), properties);
  node.append(...children);
  return node;
};

// Files that wait until their place is a screen away: main.js swaps these in.
const later = (node, sources) => {
  Object.assign(node.dataset, sources);
  return node;
};

const decoration = (className) => {
  const node = element('span', { className });
  node.setAttribute('aria-hidden', 'true');
  return node;
};

const upright = (image) => image.h > image.w;

// The picture inside a window: a poster is shown whole; a work with phone screens shows the first
// of them on the phone; everything else shows its cover.
function windowPicture(work) {
  if (work.kind === 'manifesto') {
    const [poster] = work.gallery;
    return later(element('img', {
      className: 'work__page work__page--fit', alt: '', decoding: 'async', sizes: '(max-width: 767px) 88vw, 22vw', width: poster.w, height: poster.h,
    }), poster.srcset ? { src: poster.src, srcset: poster.srcset } : { src: poster.src });
  }
  const phone = work.gallery.find(upright);
  const cover = work.cover;
  const covers = `${cover.srcMobile} 640w, ${cover.src} 1280w`;
  const image = later(element('img', {
    className: 'work__page work__page--fit', alt: '', decoding: 'async', sizes: '45vw', width: cover.w, height: cover.h,
  }), { src: cover.src, srcset: covers });
  const source = phone
    ? later(element('source', { media: PHONE, width: phone.w, height: phone.h }), { srcset: phone.src })
    : later(element('source', { media: PHONE, sizes: '88vw', width: cover.w, height: cover.h }), { srcset: covers });
  const picture = element('picture', {}, [source, image]);
  if (phone) picture.dataset.tall = '';
  return picture;
}

function card(id, work) {
  const name = element('h3', { className: 'work__name', id: `${id}-name`, textContent: work.title });
  const caption = element('div', { className: 'work__caption' }, [name]);
  if (work.tag) caption.append(element('p', { className: 'work__tag', textContent: work.tag }));
  if (work.kind !== 'manifesto') caption.append(element('p', { className: 'work__text', textContent: work.line }));
  const button = element('button', { className: 'work__window', type: 'button' }, [
    windowPicture(work),
    decoration('work__pulse'),
  ]);
  button.setAttribute('aria-labelledby', name.id);
  button.dataset.open = id;
  const article = element('article', { className: 'work' }, [button, caption]);
  article.dataset.work = id;
  article.dataset.kind = work.kind;
  if (button.querySelector('[data-tall]')) article.dataset.tall = '';
  return article;
}

function head(chapter) {
  const label = element('h2', { className: 'chapter__label', id: `${chapter.id}-label`, textContent: chapter.title });
  return element('div', { className: 'chapter__head' }, [label, decoration('chapter__rule')]);
}

function scene(name) {
  const media = name === 'posters'
    ? element('picture', {}, [
      later(element('source', { media: '(max-aspect-ratio: 17/20)' }), { srcset: 'img/posters-portrait.webp' }),
      later(element('img', { className: 'cover__media', alt: '', decoding: 'async' }), { src: 'img/posters-landscape.webp' }),
    ])
    : element('video', { className: 'cover__media', muted: true, playsInline: true, loop: true, preload: 'none' });
  if (media.tagName === 'VIDEO') {
    media.dataset.scene = name;
    media.setAttribute('muted', '');
    media.setAttribute('playsinline', '');
  }
  return element('div', { className: 'chapter__backdrop' }, [
    element('div', { className: 'chapter__scene' }, [element('div', { className: 'cover' }, [media])]),
  ]);
}

function works(chapter, data) {
  const list = element('div', { className: 'works' }, chapter.works.map((id) => card(id, data.works[id])));
  list.dataset.count = chapter.works.length;
  list.dataset.chapter = chapter.id;
  return list;
}

// The dark ground of a scene runs over the top of the next one as a dune.
function skirt() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#dune-edge');
  svg.setAttribute('class', 'skirt skirt--chapter');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.append(use);
  return svg;
}

export function renderChapters(data, { night, after }) {
  const scenic = data.chapters.filter((chapter) => SCENES[chapter.id]);
  for (const chapter of data.chapters) {
    if (!SCENES[chapter.id]) {
      night.append(head(chapter), works(chapter, data));
      night.setAttribute('aria-labelledby', `${chapter.id}-label`);
      continue;
    }
    const section = element('section', { className: 'chapter chapter--scene', id: chapter.id }, [
      scene(SCENES[chapter.id]), head(chapter), works(chapter, data), skirt(),
    ]);
    section.style.zIndex = String(scenic.length - scenic.indexOf(chapter));
    section.setAttribute('aria-labelledby', `${chapter.id}-label`);
    after.append(section);
  }
}

export function renderArchive(data, list) {
  list.replaceChildren(...data.chapters.flatMap((chapter) => chapter.works.map((id) => {
    const work = data.works[id];
    const thumb = element('img', { src: work.cover.srcMobile, alt: '', width: 640, height: 400, loading: 'lazy', decoding: 'async' });
    const button = element('button', { className: 'archive__item', type: 'button' }, [
      thumb,
      element('span', { className: 'archive__title', textContent: work.title }),
      element('span', { className: 'archive__chapter', textContent: chapter.title }),
    ]);
    button.dataset.open = id;
    return element('li', {}, [button]);
  })));
}

// Every work in the order of the file, with what the full-screen sheet needs.
export function catalogue(data) {
  const order = data.chapters.flatMap((chapter) => chapter.works);
  return Object.fromEntries(order.map((id, position) => {
    const work = data.works[id];
    return [id, {
      id,
      ...work,
      link: work.link && !work.link.confirm ? work.link : undefined,
      count: `${work.index} di ${data.count}`,
      previous: order[position - 1],
      next: order[position + 1],
    }];
  }));
}
