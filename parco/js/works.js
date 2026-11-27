// Works with a long capture of their page on the phone, by the width of that capture.
export const TALL = {
  grecale: 1170, mirtifolia: 780, 'pippi-store': 1170, 'spedizione-facile': 1170,
};

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
