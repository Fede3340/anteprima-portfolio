import { asset, element, picture, reducedMotion, sharp } from './media.js';
import { TALL } from './works.js';

const KINDS = {
  siti: 'portal', negozi: 'portal', programmi: 'window', app: 'phone', videogioco: 'room', marchi: 'banner', manifesti: 'billboard',
};
const DESIGN_PACE = 2600;

const upright = (image) => image.h > image.w;

// Works are built only when the walk comes near them, so their pictures load at once.

// The page of a site scrolling inside its window: the long capture where there is one, otherwise
// the pictures of the work one under the other.
function page(work) {
  const shots = TALL[work.id]
    ? [element('img', { className: 'exhibit__page-image', src: asset(`img/work/${work.id}-tall.webp`), alt: '', decoding: 'async' })]
    : (work.gallery.some(upright) ? work.gallery.filter(upright) : work.gallery).map((image) => picture(image, { className: 'exhibit__page-image', eager: true, sizes: '(max-width: 767px) 72vw, 24vw' }));
  return element('span', { className: 'exhibit__page' }, shots);
}

// The designs of an app passing one after the other inside the phone.
function designs(work) {
  const shots = work.gallery.filter(upright);
  const track = element('span', { className: 'exhibit__designs' }, shots.map((image) => picture(image, { className: 'exhibit__design', eager: true, sizes: '(max-width: 767px) 60vw, 18vw' })));
  if (shots.length > 1 && !reducedMotion.matches) {
    const frames = shots.flatMap((_, index) => [{ transform: `translateX(${-100 * index}%)` }, { transform: `translateX(${-100 * index}%)` }]);
    track.animate(frames, { duration: DESIGN_PACE * shots.length, iterations: Infinity, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
  }
  return track;
}

function body(work, kind) {
  const [first] = work.gallery;
  if (kind === 'portal') return element('span', { className: 'exhibit__frame' }, [page(work)]);
  if (kind === 'phone') return element('span', { className: 'exhibit__frame' }, [designs(work)]);
  return element('span', { className: 'exhibit__frame' }, [sharp(first, picture(first, { className: 'exhibit__image', eager: true, sizes: '(max-width: 767px) 80vw, 30vw' }))]);
}

// A work as an object of the park: seen from outside as the walk passes, opened with a touch.
export function exhibit(work) {
  const kind = KINDS[work.chapter];
  const meta = [work.place, work.year].filter(Boolean).join(', ');
  const button = element('button', { className: 'exhibit__object', type: 'button' }, [body(work, kind)]);
  button.dataset.open = work.id;
  button.setAttribute('aria-label', `Guarda da vicino: ${work.title}`);
  const node = element('div', { className: `exhibit exhibit--${kind}` }, [
    button,
    element('p', { className: 'exhibit__label' }, [
      element('strong', { textContent: work.title }),
      ...(meta ? [element('span', { textContent: meta })] : []),
    ]),
  ]);
  node.dataset.work = work.id;
  return node;
}

// A plain card standing in the park: the facts at the tower, the addresses at the end.
export function card(children, open) {
  const node = element('div', { className: 'exhibit exhibit--card' }, [element('div', { className: 'exhibit__card' }, children)]);
  if (open) node.dataset.work = open;
  return node;
}
