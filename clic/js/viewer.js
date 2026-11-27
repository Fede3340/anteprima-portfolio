import { reducedMotion } from './media.js';

const ADDRESS = /^#lavoro\/([\w-]+)$/;
// Phone screens are kept at the size they were taken at; the rest fit the screen up to this width.
const WIDE = 1280;

const figure = (image) => {
  const picture = Object.assign(new Image(), {
    src: image.src, alt: image.alt ?? '', width: image.w, height: image.h, loading: 'lazy', decoding: 'async',
  });
  if (image.srcset) {
    picture.srcset = image.srcset;
    picture.sizes = `min(100vw, ${WIDE}px)`;
  }
  picture.style.maxWidth = `${image.w < 1000 ? image.w / 2 : WIDE}px`;
  const node = document.createElement('figure');
  node.append(picture);
  if (image.caption) node.append(Object.assign(document.createElement('figcaption'), { textContent: image.caption }));
  return node;
};

// A work on the whole screen, with an address of its own: Back, Esc and "Chiudi" all close it, and
// moving to the previous or next work replaces the address so that Back still closes.
export function createViewer(root, works, { onStep } = {}) {
  const main = document.querySelector('main');
  const $ = (selector) => root.querySelector(selector);
  const link = $('.viewer__link');
  const scroller = $('.viewer__scroll');
  const close = $('.viewer__close');
  const steps = [...root.querySelectorAll('.sheet__step')];
  let current;
  let opener;
  let mainWasInert = false;
  let pushed = false;

  function fill(work) {
    current = work;
    $('.viewer__title').textContent = work.title;
    link.hidden = !work.link;
    if (work.link) {
      link.href = work.link.href;
      link.querySelector('span').textContent = work.link.label;
    }
    $('.sheet__count').textContent = work.count;
    $('.sheet__line').textContent = work.line;
    $('.sheet__tag').textContent = work.tag ?? '';
    $('.sheet__tag').hidden = !work.tag;
    $('.sheet__facts').replaceChildren(...(work.facts ?? []).map((fact) => Object.assign(document.createElement('li'), { textContent: fact })));
    $('.sheet__gallery').replaceChildren(...work.gallery.map(figure));
    for (const step of steps) {
      const target = works[step.dataset.step < 0 ? work.previous : work.next];
      step.hidden = !target;
      step.dataset.target = target?.id ?? '';
      step.querySelector('strong').textContent = target?.title ?? '';
    }
    scroller.scrollTop = 0;
  }

  function show(work) {
    const opening = root.hidden;
    fill(work);
    if (!opening) return;
    root.hidden = false;
    mainWasInert = main.inert;
    main.inert = true;
    gsap.killTweensOf(root);
    gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: reducedMotion.matches ? 0.01 : 0.35, ease: 'power1.out' });
    if (!reducedMotion.matches) gsap.fromTo('.sheet', { y: 40 }, { y: 0, duration: 0.7, ease: 'power3.out' });
    close.focus();
  }

  function hide() {
    if (!current) return;
    current = undefined;
    main.inert = mainWasInert;
    gsap.killTweensOf(root);
    gsap.to(root, {
      opacity: 0,
      duration: reducedMotion.matches ? 0.01 : 0.25,
      onComplete: () => {
        root.hidden = true;
        $('.sheet__gallery').replaceChildren();
      },
    });
    opener?.focus({ preventScroll: true });
  }

  function dismiss() {
    if (pushed) return history.back();
    history.replaceState(null, '', location.pathname + location.search);
    hide();
  }

  close.addEventListener('click', dismiss);
  for (const step of steps) {
    step.addEventListener('click', () => {
      const work = works[step.dataset.target];
      if (!work) return;
      history.replaceState({ work: work.id }, '', `#lavoro/${work.id}`);
      fill(work);
      onStep?.();
    });
  }
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && current) {
      event.stopImmediatePropagation();
      dismiss();
    }
  });
  window.addEventListener('popstate', () => {
    const work = works[ADDRESS.exec(location.hash)?.[1]];
    pushed = Boolean(work);
    if (work) show(work);
    else hide();
  });

  return {
    open(id, from) {
      const work = works[id];
      if (!work) return;
      opener = from;
      history.pushState({ work: id }, '', `#lavoro/${id}`);
      pushed = true;
      show(work);
    },
    // A visitor who arrives on the address of a work sees that work first.
    openFromAddress() {
      const work = works[ADDRESS.exec(location.hash)?.[1]];
      if (work) show(work);
    },
  };
}
