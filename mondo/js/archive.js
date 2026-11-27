import { reducedMotion } from './media.js';

// The list of every work, over whatever is on screen. A tap on one opens it; Esc and "Chiudi" close.
export function createArchive(root, { open, fill }) {
  const list = root.querySelector('.archive__list');
  let opener;

  const hide = () => {
    if (root.hidden) return;
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion.matches ? 10 : 250 }).finished.then(() => {
      root.hidden = true;
    });
    opener?.focus({ preventScroll: true });
  };

  root.querySelector('.archive__close').addEventListener('click', hide);
  list.addEventListener('click', (event) => {
    const item = event.target.closest('[data-open]');
    if (item) open(item.dataset.open);
  });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });

  return {
    hide,
    show(from) {
      opener = from;
      if (!list.children.length) fill(list);
      root.hidden = false;
      root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reducedMotion.matches ? 10 : 300 });
      root.querySelector('.archive__close').focus();
    },
  };
}
