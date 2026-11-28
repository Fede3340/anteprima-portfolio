import { element } from './media.js';

// Every work as a link, zone by zone, with its small cover, title and kind: the way through the park
// for keys and screen readers, and the whole page where the park cannot be drawn or is not wanted.
// The covers wait in data-src until the list is shown as a page.
export function fillList(root, { plan, works, onOpen }) {
  root.append(element('h2', { textContent: 'Tutti i lavori' }));
  for (const zone of plan.zones.filter((each) => each.works.length)) {
    root.append(
      element('h2', { textContent: zone.title }),
      element('ul', {}, zone.works.map(({ id }) => {
        const work = works[id];
        const link = element('a', { className: 'list__work', href: `#lavoro/${id}` }, [
          element('img', { alt: '', width: 240, height: 150, decoding: 'async', loading: 'lazy' }),
          element('strong', { textContent: work.title }),
          element('span', { textContent: work.tag ?? '' }),
        ]);
        link.firstChild.dataset.src = work.cover.srcThumb ?? work.cover.srcMobile;
        link.addEventListener('click', (event) => {
          event.preventDefault();
          onOpen(id);
        });
        return element('li', {}, [link]);
      })),
    );
  }
}
