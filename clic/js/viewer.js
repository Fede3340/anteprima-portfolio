import { reducedMotion } from './media.js';

const ADDRESS = /^#lavoro\/([\w-]+)$/;

// A work on the whole screen, with an address of its own: Back, Esc and "Chiudi" all close it.
// `find(id)` returns { id, title, link, images, opener } or nothing.
export function createViewer(root, find) {
  const main = document.querySelector('main');
  const title = root.querySelector('.viewer__title');
  const link = root.querySelector('.viewer__link');
  const scroller = root.querySelector('.viewer__scroll');
  const close = root.querySelector('.viewer__close');
  let current;
  let pushed = false;

  function show(work) {
    current = work;
    title.textContent = work.title;
    link.hidden = !work.link;
    if (work.link) {
      link.href = work.link.href;
      link.querySelector('span').textContent = work.link.label;
    }
    scroller.replaceChildren(...work.images.map((src) => Object.assign(new Image(), { src, alt: '', decoding: 'async' })));
    scroller.scrollTop = 0;
    root.hidden = false;
    main.inert = true;
    gsap.killTweensOf(root);
    gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: reducedMotion.matches ? 0.01 : 0.35, ease: 'power1.out' });
    if (!reducedMotion.matches) gsap.fromTo(scroller.children, { y: 40 }, { y: 0, duration: 0.7, ease: 'power3.out' });
    close.focus();
  }

  function hide() {
    if (!current) return;
    const { opener } = current;
    current = undefined;
    main.inert = false;
    gsap.killTweensOf(root);
    gsap.to(root, {
      opacity: 0,
      duration: reducedMotion.matches ? 0.01 : 0.25,
      onComplete: () => {
        root.hidden = true;
        scroller.replaceChildren();
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
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && current) dismiss();
  });
  window.addEventListener('popstate', () => {
    const work = find(ADDRESS.exec(location.hash)?.[1]);
    pushed = Boolean(work);
    if (work) show(work);
    else hide();
  });

  return {
    open(id) {
      const work = find(id);
      if (!work) return;
      history.pushState({ work: id }, '', `#lavoro/${id}`);
      pushed = true;
      show(work);
    },
    // A visitor who arrives on the address of a work sees that work first.
    openFromAddress() {
      const work = find(ADDRESS.exec(location.hash)?.[1]);
      if (work) show(work);
    },
  };
}
