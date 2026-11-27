import { reducedMotion } from './media.js';

// The list of every work. A tap on one opens its sheet above the list; Esc and "Chiudi" close it.
export function createArchive(root) {
  const main = document.querySelector('main');
  const close = root.querySelector('.viewer__close');
  let opener;

  const hide = () => {
    if (root.hidden) return;
    main.inert = false;
    gsap.to(root, {
      opacity: 0,
      duration: reducedMotion.matches ? 0.01 : 0.25,
      onComplete: () => {
        root.hidden = true;
      },
    });
    opener?.focus({ preventScroll: true });
  };

  close.addEventListener('click', hide);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });

  return {
    hide,
    show(from) {
      opener = from;
      root.hidden = false;
      main.inert = true;
      gsap.killTweensOf(root);
      gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: reducedMotion.matches ? 0.01 : 0.3 });
      close.focus();
    },
  };
}
