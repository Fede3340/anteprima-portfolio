import { createDrag, turn } from './drag.js';
import { element } from './media.js';

// Title, place and year, and the line of the work in front.
export function caption(work) {
  const meta = [work.place, work.year].filter(Boolean).join(', ');
  return element('div', { className: 'caption' }, [
    element('h2', { className: 'caption__title' }, [
      element('button', { type: 'button', textContent: work.title, value: work.id }),
      ...(meta ? [element('span', { className: 'caption__meta', textContent: meta })] : []),
    ]),
    element('p', { className: 'caption__line', textContent: work.line }),
  ]);
}

// Moving between the works of a place: drag sideways, the side buttons or the arrow keys. `show`
// gets the new position, the direction and the point the move came from.
export function createBrowse(root, count, show) {
  let index = 0;
  const previous = element('button', { className: 'step step--prev', type: 'button' }, [element('span', { className: 'step__mark', textContent: '‹' })]);
  const next = element('button', { className: 'step step--next', type: 'button' }, [element('span', { className: 'step__mark', textContent: '›' })]);
  previous.setAttribute('aria-label', 'Lavoro precedente');
  next.setAttribute('aria-label', 'Lavoro successivo');
  root.append(previous, next);

  const sync = () => {
    previous.hidden = index === 0;
    next.hidden = index >= count - 1;
  };
  const go = (direction, point) => {
    const target = index + direction;
    if (!direction || target < 0 || target >= count) return;
    index = target;
    sync();
    show(index, direction, point ?? { x: direction > 0 ? innerWidth * 0.85 : innerWidth * 0.15, y: innerHeight * 0.5 });
  };
  previous.addEventListener('click', (event) => go(-1, { x: event.clientX, y: event.clientY }));
  next.addEventListener('click', (event) => go(1, { x: event.clientX, y: event.clientY }));
  createDrag(root, { move() {}, end: (dx, velocity) => go(turn(dx, velocity, innerWidth)) });
  sync();
  return {
    go,
    get index() {
      return index;
    },
    key(event) {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else return false;
      return true;
    },
  };
}
