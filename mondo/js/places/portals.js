import { caption, createBrowse } from '../browse.js';
import { asset, element, format, picture, playback, reducedMotion, sceneVideo } from '../media.js';
import { rings } from '../ripples.js';
import { createSequence } from '../sequence.js';
import { TALL } from '../works.js';

const FRAMES = { landscape: [96, 1600, 900], portrait: [72, 810, 1440] };
const CROSSING = 0.72;
const SLOTS = ['before', 'previous', 'current', 'next', 'after'];

const canvas = element('canvas', { className: 'crossing' });
const sequence = createSequence(canvas);
let loaded;

// The frames of the crossing through the window start arriving while the window is in view.
export function prepareCrossing() {
  const cut = format();
  if (loaded?.cut === cut) return;
  const [count, width, height] = FRAMES[cut];
  const current = { cut, ready: false };
  loaded = current;
  sequence.load(`media/crossing/${cut}`, [width, height], count).then(() => {
    current.ready = true;
  });
}

const upright = (image) => image.h > image.w;

function page(work) {
  if (TALL[work.id]) return [element('img', { className: 'portal__image', src: asset(`img/work/${work.id}-tall.webp`), alt: '', decoding: 'async' })];
  const tall = work.gallery.filter(upright);
  return (tall.length ? tall : work.gallery).map((image) => picture(image, { className: 'portal__image' }));
}

// Windows of chalk planted in the dunes, each with the real page of a work scrolling inside. The
// one in front is large; its neighbours stand sunk further along. Moving on, the window in front
// goes down into the dune and the next one comes up.
export function createPortals({ root, spot, works, sound }) {
  const night = spot.id === 'siti';
  const video = sceneVideo(night ? 'night' : 'shops');
  const scene = element('div', { className: 'portals__scene' }, [element('div', { className: 'cover' }, [video])]);
  const portals = works.map((work) => {
    const body = element('button', { className: 'portal__body', type: 'button', value: work.id }, [
      element('span', { className: 'portal__frame' }, [element('span', { className: 'portal__page' }, page(work))]),
    ]);
    body.dataset.open = work.id;
    body.setAttribute('aria-label', `Apri ${work.title}`);
    return element('div', { className: 'portal' }, [element('div', { className: 'portal__clip' }, [body])]);
  });
  const row = element('div', { className: 'portals' }, portals);
  const captions = element('div', { className: 'portals__caption' }, [caption(works[0])]);
  root.append(scene, row, captions);
  root.dataset.light = night ? 'night' : 'day';

  function place(index, rising) {
    portals.forEach((portal, position) => {
      const offset = position - index;
      portal.dataset.slot = rising ? 'under' : SLOTS[Math.max(-2, Math.min(2, offset)) + 2];
      portal.querySelector('button').tabIndex = offset === 0 ? 0 : -1;
    });
    scene.style.transform = `translate3d(${(works.length > 1 ? 0.5 - index / (works.length - 1) : 0) * 6}%, 0, 0)`;
  }

  function foot() {
    const box = portals[browse.index].querySelector('.portal__clip').getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.bottom };
  }

  function show(index) {
    place(index);
    const next = caption(works[index]);
    captions.replaceChildren(next);
    next.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 350, easing: 'ease-out', fill: 'backwards' });
    setTimeout(() => {
      const { x, y } = foot();
      rings(x, y, { size: Math.min(innerWidth * 1.1, 520) });
      sound.play('drop');
    }, 650);
  }

  const browse = createBrowse(root, works.length, show);
  place(0, true);
  playback.want(video, true);

  return {
    ready: Promise.resolve(),
    // Through the window: the frames of the crossing run, and their last one is the night of the place.
    cross: night && loaded?.ready && !reducedMotion.matches ? async (reveal) => {
      root.after(canvas);
      sequence.seek(0);
      await canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 80, fill: 'forwards' }).finished;
      reveal();
      const playhead = { frame: 0 };
      await new Promise((done) => {
        gsap.to(playhead, {
          frame: FRAMES[format()][0] - 1, duration: CROSSING, ease: 'power1.inOut', onUpdate: () => sequence.seek(playhead.frame), onComplete: done,
        });
      });
      canvas.remove();
      canvas.getAnimations().forEach((animation) => animation.cancel());
    } : undefined,
    start() {
      requestAnimationFrame(() => show(0));
    },
    leave() {
      playback.forget(video);
      canvas.remove();
    },
    get work() {
      return works[browse.index].id;
    },
    key: (event) => browse.key(event),
  };
}
