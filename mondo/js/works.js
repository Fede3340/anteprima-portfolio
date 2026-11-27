import { asset, element } from './media.js';

// The places of the land in the order they are met, after the opening. `object` is the box of the
// sculpted object in each cut of its scene, as shares of the picture; `still` names the cuts with no loop.
export const PLACES = [
  { id: 'siti', scene: 'window', still: 'always', object: { landscape: [0.41, 0.36, 0.59, 0.9], portrait: [0.29, 0.44, 0.7, 0.84] } },
  { id: 'negozi', scene: 'shops', object: { landscape: [0.32, 0.33, 0.62, 0.88], portrait: [0.12, 0.45, 0.8, 0.83] } },
  { id: 'programmi', scene: 'programs', object: { landscape: [0.28, 0.3, 0.7, 0.86], portrait: [0.12, 0.48, 0.86, 0.82] } },
  { id: 'app', scene: 'apps', object: { landscape: [0.4, 0.4, 0.58, 0.86], portrait: [0.26, 0.42, 0.74, 0.86] } },
  { id: 'videogioco', scene: 'game', object: { landscape: [0.32, 0.52, 0.68, 0.93], portrait: [0.12, 0.55, 0.86, 0.83] } },
  { id: 'marchi', scene: 'brands', object: { landscape: [0.38, 0.3, 0.62, 0.8], portrait: [0.22, 0.44, 0.78, 0.86] } },
  { id: 'manifesti', scene: 'posters', still: 'landscape', object: { landscape: [0.18, 0.55, 0.8, 0.92], portrait: [0.06, 0.55, 0.94, 0.84] } },
  { id: 'google', scene: 'google', title: 'Google', note: 'pippi.store', object: { landscape: [0.5, 0.18, 0.62, 0.97], portrait: [0.34, 0.15, 0.66, 0.86] } },
  { id: 'contatti', scene: 'contact', title: 'Contatti', note: 'Scrivimi', object: { landscape: [0.02, 0.26, 0.45, 0.72], portrait: [0.25, 0.6, 0.75, 0.85] } },
];

// Works with a long capture of their page on the phone, by the width of that capture.
export const TALL = { grecale: 780, mirtifolia: 780, 'pippi-store': 780 };

export const HOME = { id: 'home', scene: 'opening', object: { landscape: [0.41, 0.45, 0.6, 0.88], portrait: [0.33, 0.57, 0.62, 0.85] } };

// Every work in the order of the file, with its chapter and its neighbours.
export function catalogue(data) {
  const order = data.chapters.flatMap((chapter) => chapter.works.map((id) => [id, chapter]));
  return Object.fromEntries(order.map(([id, chapter], position) => {
    const work = data.works[id];
    return [id, {
      id,
      ...work,
      chapter: chapter.id,
      link: work.link && !work.link.confirm ? work.link : undefined,
      count: `${position + 1} di ${order.length}`,
      previous: order[position - 1]?.[0],
      next: order[position + 1]?.[0],
    }];
  }));
}

export function renderArchive(data, list) {
  list.replaceChildren(...data.chapters.flatMap((chapter) => chapter.works.map((id) => {
    const work = data.works[id];
    const button = element('button', { className: 'archive__item', type: 'button' }, [
      element('img', { src: asset(work.cover.srcMobile), alt: '', width: 640, height: 400, loading: 'lazy', decoding: 'async' }),
      element('span', { className: 'archive__name', textContent: work.title }),
      element('span', { className: 'archive__chapter', textContent: chapter.title }),
    ]);
    button.dataset.open = id;
    return element('li', {}, [button]);
  })));
}
