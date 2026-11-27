import { element } from './media.js';

// Every work as a link, zone by zone: the way through the park for keys and screen readers, and the
// whole page where the park cannot be drawn.
export function fillList(root, { plan, works, onOpen }) {
  root.append(element('h2', { textContent: 'Tutti i lavori' }));
  for (const zone of plan.zones.filter((each) => each.works.length)) {
    root.append(
      element('h2', { textContent: zone.title }),
      element('ul', {}, zone.works.map(({ id }) => {
        const link = element('a', { href: `#lavoro/${id}`, textContent: works[id].title });
        link.addEventListener('click', (event) => {
          event.preventDefault();
          onOpen(id);
        });
        return element('li', {}, [link]);
      })),
    );
  }
}
