import { circle } from './circle.js';
import { createDrag, turn } from './drag.js';
import { asset, element, groundColour, limit, logo, picture, sharp } from './media.js';
import { TALL } from './works.js';

const TIMES = ['L’idea', 'Studi e ricerche', 'Le scelte', 'Dove si vede'];
const FIELDS = { negozi: 'sky', manifesti: 'sky', app: 'sky' };
const WHEEL_STEP = 60;

const upright = (image) => image.h > image.w;

const frame = (image) => sharp(image, picture(image, { className: `frame frame--${upright(image) ? 'phone' : 'window'}`, eager: true }));

function tall(work) {
  const frameNode = element('div', { className: 'frame frame--window frame--tall' }, [
    element('img', { className: 'frame__scroll', src: asset(`img/work/${work.id}-tall.webp`), alt: '', decoding: 'async' }),
  ]);
  frameNode.style.setProperty('--max-w', limit(TALL[work.id]));
  return frameNode;
}

const framed = new Set(['siti', 'negozi', 'programmi', 'app']);

function choices(work) {
  const screens = work.gallery.map((image) => ({
    node: framed.has(work.chapter) ? frame(image) : sharp(image, picture(image, { className: 'screen__picture' })),
    caption: image.caption,
  }));
  if (TALL[work.id]) screens.unshift({ node: tall(work) });
  return screens;
}

// A page of the studies: what was looked at, with the palette and the typefaces shown as samples.
function study(page) {
  const parts = [element('h2', { className: 'screen__title', textContent: page.title })];
  if (page.p) parts.push(element('p', { className: 'screen__note', textContent: page.p }));
  if (page.palette?.length) {
    parts.push(element('ul', { className: 'swatches' }, page.palette.map(({ name, hex }) => {
      const swatch = element('li', { className: 'swatch' }, [element('span', { className: 'swatch__name', textContent: name }), element('span', { textContent: hex })]);
      swatch.style.setProperty('--swatch', hex);
      return swatch;
    })));
  }
  if (page.type?.length) {
    parts.push(element('ul', { className: 'types' }, page.type.map(({ role, family, note }) => {
      const sample = element('span', { className: 'type__sample', textContent: family });
      sample.style.fontFamily = `"${family}", var(--font-display)`;
      return element('li', { className: 'type' }, [element('span', { className: 'type__role', textContent: role }), sample, ...(note ? [element('span', { textContent: note })] : [])]);
    })));
  }
  if (page.list?.length) parts.push(element('ul', { className: 'screen__facts' }, page.list.map((entry) => element('li', { textContent: entry }))));
  if (page.sources?.length) {
    parts.push(element('p', { className: 'sources' }, page.sources.map(({ label, href }) => element('a', { href, target: '_blank', rel: 'noopener', textContent: label }))));
  }
  return { time: 1, className: 'screen--study', children: [element('div', { className: 'screen__text' }, parts)] };
}

function screens(work) {
  const [idea, choice, where] = work.story ?? [];
  const hero = work.chapter === 'marchi' ? work.gallery[0] : { ...work.cover, srcset: `${work.cover.srcMobile} 960w, ${work.cover.src} 1920w` };
  const list = [{
    time: 0,
    className: 'screen--idea',
    children: [
      element('div', { className: 'screen__text' }, [
        element('p', { className: 'screen__lead', textContent: idea?.p ?? work.line }),
      ]),
      element('div', { className: 'screen__stage' }, [sharp(hero, picture(hero, { className: 'screen__picture', eager: true }))]),
    ],
  }];
  list.push(...(work.study ?? []).slice(0, 2).map(study));
  choices(work).forEach(({ node, caption }, index) => {
    const text = index === 0 && choice ? [element('p', { className: 'screen__note', textContent: choice.p })]
      : caption ? [element('p', { className: 'screen__note', textContent: caption })] : [];
    list.push({
      time: 2,
      className: `screen--choice${index === 0 && work.chapter === 'marchi' ? ' screen--mark' : ''}`,
      children: [element('div', { className: 'screen__stage' }, [node]), ...(text.length ? [element('div', { className: 'screen__caption' }, text)] : [])],
    });
  });
  const facts = where ? [element('p', { className: 'screen__note', textContent: where.p })]
    : (work.facts ?? []).length ? [element('ul', { className: 'screen__facts' }, work.facts.map((fact) => element('li', { textContent: fact })))] : [];
  list.push({
    time: 3,
    className: 'screen--where',
    children: [element('div', { className: 'screen__text' }, [
      element('h2', { className: 'screen__title', textContent: work.title }),
      element('p', { className: 'screen__meta', textContent: [work.place, work.year, work.count].filter(Boolean).join(', ') }),
      ...facts,
      ...(work.link ? [element('a', { className: 'screen__link', href: work.link.href, target: '_blank', rel: 'noopener', textContent: work.link.label })] : []),
    ])],
  });
  return list;
}

// A work seen closely: it comes forward over the park, which stays behind, dimmed. Its story goes
// by in full screens with the same gestures as the walk. Going past the last screen, touching
// outside the work, Esc, Back and "Chiudi" all lead back to the path, where the visitor was.
export function createStory(root, { works, sound, onClose, onEnd }) {
  const head = element('div', { className: 'story__head' }, [
    element('h2', { className: 'story__title' }),
    element('p', { className: 'story__where' }),
  ]);
  const progress = element('p', { className: 'story__progress' });
  const previous = element('button', { className: 'step step--prev story__step', type: 'button' }, [element('span', { className: 'step__mark', textContent: '‹' })]);
  const next = element('button', { className: 'step step--next story__step', type: 'button' }, [element('span', { className: 'step__mark', textContent: '›' })]);
  const close = element('button', { className: 'story__close', type: 'button', textContent: 'Chiudi' });
  previous.setAttribute('aria-label', 'Indietro');
  next.setAttribute('aria-label', 'Avanti');
  const stack = element('div', { className: 'story__stack' });
  const panel = element('div', { className: 'story__panel' }, [stack, head, progress, previous, next]);
  root.append(panel, close);
  root.addEventListener('dragstart', (event) => event.preventDefault());

  let work;
  let list = [];
  let index = 0;
  let busy = false;
  let wheel = 0;

  const label = () => {
    const times = [...new Set(list.map((screen) => screen.time))];
    const { time } = list[index];
    progress.textContent = `${TIMES[time]}, ${times.indexOf(time) + 1} di ${times.length}`;
    previous.hidden = index === 0;
    next.setAttribute('aria-label', index === list.length - 1 ? 'Torna al sentiero' : 'Avanti');
  };

  const build = (screen) => element('section', { className: `screen ${screen.className}` }, screen.children);

  async function show(target, point) {
    if (busy || target === index || target < 0) return;
    if (target >= list.length) {
      onEnd(work.id);
      return;
    }
    busy = true;
    sound.play('tap');
    const old = stack.lastElementChild;
    const node = build(list[target]);
    stack.append(node);
    index = target;
    label();
    await circle(node, point);
    old?.remove();
    busy = false;
  }

  async function paint(id) {
    work = works[id];
    panel.dataset.field = FIELDS[work.chapter] ?? 'night';
    panel.style.removeProperty('--field');
    panel.style.removeProperty('--text');
    if (work.chapter === 'marchi') {
      const { colour, text } = await groundColour(work.gallery[0].src);
      panel.style.setProperty('--field', colour);
      panel.style.setProperty('--text', text);
      panel.dataset.field = 'brand';
    }
    head.querySelector('.story__logo')?.remove();
    if (work.logo) head.prepend(logo(work.logo, { className: 'story__logo', dark: panel.dataset.field === 'night' }));
    head.querySelector('.story__title').textContent = work.title;
    head.querySelector('.story__where').textContent = [work.place, work.year].filter(Boolean).join(', ');
    list = screens(work);
    index = 0;
    stack.replaceChildren(build(list[0]));
    label();
  }

  const side = (direction) => ({ x: direction > 0 ? innerWidth * 0.85 : innerWidth * 0.15, y: innerHeight / 2 });

  createDrag(panel, {
    move() {},
    end(dx, velocity) {
      const direction = turn(dx, velocity, innerWidth);
      if (direction) show(index + direction, side(direction));
    },
  });

  // Pulling the work down puts it back.
  let pull;
  panel.addEventListener('pointerdown', (event) => {
    pull = { x: event.clientX, y: event.clientY };
  });
  panel.addEventListener('pointerup', (event) => {
    if (!pull) return;
    const dy = event.clientY - pull.y;
    if (dy > 90 && dy > Math.abs(event.clientX - pull.x) * 1.5) onClose();
    pull = undefined;
  });

  panel.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (busy) return;
    wheel += event.deltaX + event.deltaY;
    if (Math.abs(wheel) < WHEEL_STEP) return;
    const direction = Math.sign(wheel);
    wheel = 0;
    show(index + direction, side(direction));
  }, { passive: false });

  stack.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) return;
    show(index + 1, { x: event.clientX, y: event.clientY });
  });
  previous.addEventListener('click', (event) => show(index - 1, { x: event.clientX, y: event.clientY }));
  next.addEventListener('click', (event) => show(index + 1, { x: event.clientX, y: event.clientY }));
  close.addEventListener('click', () => onClose());
  root.addEventListener('click', (event) => {
    if (!panel.contains(event.target) && event.target !== close) onClose();
  });

  return {
    get work() {
      return work?.id;
    },
    async open(id, point) {
      await paint(id);
      root.hidden = false;
      // The screens start under the title, however many lines it takes.
      panel.style.setProperty('--head-h', `${head.offsetHeight}px`);
      sound.play('whoosh');
      close.focus({ preventScroll: true });
      await circle(root, point);
    },
    async close(point) {
      if (root.hidden) return;
      sound.play('whoosh');
      await circle(root, { ...point, open: false });
      root.hidden = true;
      stack.replaceChildren();
      work = undefined;
    },
    key(event) {
      if (event.key === 'ArrowRight') show(index + 1, side(1));
      else if (event.key === 'ArrowLeft') show(index - 1, side(-1));
      else return false;
      return true;
    },
  };
}
