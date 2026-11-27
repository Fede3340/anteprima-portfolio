import { circle } from './circle.js';
import { createDrag, turn } from './drag.js';
import { asset, element, limit, picture, sharp } from './media.js';
import { brandColour } from './places/field.js';
import { TALL } from './works.js';

const TIMES = ['L’idea', 'Le scelte', 'Dove si vede'];
const FIELDS = { negozi: 'sky', videogioco: 'ember', manifesti: 'sky', app: 'sky' };


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

function screens(work, next) {
  const [idea, choice, where] = work.story ?? [];
  const hero = work.chapter === 'marchi' ? work.gallery[0] : work.cover;
  const list = [{
    time: 0,
    className: 'screen--idea',
    children: [
      element('div', { className: 'screen__text' }, [
        element('p', { className: `screen__lead${(idea?.p ?? work.line).length > 140 ? ' screen__lead--long' : ''}`, textContent: idea?.p ?? work.line }),
      ]),
      element('div', { className: 'screen__stage' }, [sharp(hero, picture(hero, { className: 'screen__picture', eager: true }))]),
    ],
  }];
  choices(work).forEach(({ node, caption }, index) => {
    const text = index === 0 && choice ? [element('p', { className: 'screen__note', textContent: choice.p })]
      : caption ? [element('p', { className: 'screen__note', textContent: caption })] : [];
    list.push({
      time: 1,
      className: `screen--choice${index === 0 && work.chapter === 'marchi' ? ' screen--mark' : ''}`,
      children: [element('div', { className: 'screen__stage' }, [node]), ...(text.length ? [element('div', { className: 'screen__caption' }, text)] : [])],
    });
  });
  const facts = where ? [element('p', { className: 'screen__note', textContent: where.p })]
    : (work.facts ?? []).length ? [element('ul', { className: 'screen__facts' }, work.facts.map((fact) => element('li', { textContent: fact })))] : [];
  list.push({
    time: 2,
    className: 'screen--where',
    children: [element('div', { className: 'screen__text' }, [
      element('h2', { className: 'screen__title', textContent: work.title }),
      element('p', { className: 'screen__meta', textContent: [work.place, work.year, work.count].filter(Boolean).join(', ') }),
      ...facts,
      ...(work.link ? [element('a', { className: 'screen__link', href: work.link.href, target: '_blank', rel: 'noopener', textContent: work.link.label })] : []),
      ...(next ? [element('button', { className: 'screen__next', type: 'button', textContent: `Successivo: ${next.title}` })] : []),
    ])],
  });
  return list;
}

// A work told in full screens: the idea, the choices one picture at a time, and where it can be
// seen. The visitor goes through them by touching, dragging sideways or with the arrows.
export function createStory(root, { works, sound, onClose, onWork }) {
  const head = element('div', { className: 'story__head' }, [
    element('h2', { className: 'story__title' }),
    element('p', { className: 'story__where' }),
  ]);
  const progress = element('p', { className: 'story__progress' });
  const previous = element('button', { className: 'step step--prev story__step', type: 'button' }, [element('span', { className: 'step__mark', textContent: '‹' })]);
  const next = element('button', { className: 'step step--next story__step', type: 'button' }, [element('span', { className: 'step__mark', textContent: '›' })]);
  previous.setAttribute('aria-label', 'Indietro');
  next.setAttribute('aria-label', 'Avanti');
  const stack = element('div', { className: 'story__stack' });
  root.append(stack, head, progress, previous, next);

  let work;
  let list = [];
  let index = 0;
  let busy = false;

  const label = () => {
    const { time } = list[index];
    progress.textContent = `${TIMES[time]}, ${time + 1} di 3`;
    previous.hidden = index === 0;
    next.hidden = index === list.length - 1 && !work.next;
    next.setAttribute('aria-label', index === list.length - 1 ? `Lavoro successivo: ${works[work.next]?.title}` : 'Avanti');
  };

  const build = (screen) => element('section', { className: `screen ${screen.className}` }, screen.children);

  async function show(target, point) {
    if (busy || target === index || target < 0) return;
    if (target >= list.length) {
      if (work.next) onWork(work.next, point);
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
    root.dataset.field = FIELDS[work.chapter] ?? 'night';
    root.style.removeProperty('--field');
    root.style.removeProperty('--text');
    if (work.chapter === 'marchi') {
      const { colour, text } = await brandColour(work);
      root.style.setProperty('--field', colour);
      root.style.setProperty('--text', text);
      root.dataset.field = 'brand';
    }
    head.querySelector('.story__title').textContent = work.title;
    head.querySelector('.story__where').textContent = [work.place, work.year].filter(Boolean).join(', ');
    list = screens(work, works[work.next]);
    index = 0;
    stack.replaceChildren(build(list[0]));
    label();
  }

  createDrag(root, {
    move() {},
    end(dx, velocity) {
      const direction = turn(dx, velocity, innerWidth);
      if (direction) show(index + direction, { x: direction > 0 ? innerWidth * 0.85 : innerWidth * 0.15, y: innerHeight / 2 });
    },
  });

  stack.addEventListener('click', (event) => {
    if (event.target.closest('.screen__next')) return onWork(work.next, { x: event.clientX, y: event.clientY });
    if (event.target.closest('a, button')) return;
    show(index + 1, { x: event.clientX, y: event.clientY });
  });
  previous.addEventListener('click', (event) => show(index - 1, { x: event.clientX, y: event.clientY }));
  next.addEventListener('click', (event) => show(index + 1, { x: event.clientX, y: event.clientY }));

  return {
    get work() {
      return work?.id;
    },
    async open(id, point) {
      await paint(id);
      root.hidden = false;
      sound.play('whoosh');
      await circle(root, point);
    },
    async replace(id, point) {
      await paint(id);
      sound.play('whoosh');
      await circle(root, point);
    },
    async close(point) {
      if (root.hidden) return;
      await circle(root, { ...point, open: false });
      root.hidden = true;
      stack.replaceChildren();
      work = undefined;
    },
    key(event) {
      if (event.key === 'ArrowRight') show(index + 1, { x: innerWidth * 0.85, y: innerHeight / 2 });
      else if (event.key === 'ArrowLeft') show(index - 1, { x: innerWidth * 0.15, y: innerHeight / 2 });
      else return false;
      return true;
    },
  };
}
