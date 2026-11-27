import { createBrowse } from '../browse.js';
import { element, playback, sceneVideo } from '../media.js';
import { rings } from '../ripples.js';

const FACTS = [
  'Il 16 ottobre pippi.store è passato al sito nuovo, e i 750 indirizzi del negozio di prima portano alle pagine nuove.',
  'Cassa in due passi senza registrazione, carta, PayPal e contrassegno.',
  'Lo studio della conversione prende nove elementi della pagina, ognuno con la sua fonte, e mette in fila 14 ipotesi da provare, ordinate con un punteggio.',
];

// The tower: going up it, the facts of pippi.store appear one per floor.
export function createGoogle({ root, sound }) {
  const video = sceneVideo('google');
  const floors = FACTS.map((fact, index) => element('li', { className: 'floor' }, [
    element('span', { className: 'floor__count', textContent: `${index + 1} di ${FACTS.length}` }),
    element('p', { textContent: fact }),
  ]));
  const open = element('button', { className: 'tower__open', type: 'button', textContent: 'pippi.store' });
  open.dataset.open = 'pippi-store';
  root.append(
    element('div', { className: 'tower__scene' }, [element('div', { className: 'cover' }, [video])]),
    element('div', { className: 'tower' }, [element('h2', { className: 'tower__title' }, [open]), element('ol', { className: 'tower__floors' }, floors)]),
  );

  function show(index) {
    floors.forEach((floor, position) => floor.classList.toggle('is-up', position <= index));
    const box = floors[index].getBoundingClientRect();
    rings(box.left + box.width / 2, box.bottom, { size: Math.min(innerWidth, 380) });
    sound.play('drop');
  }

  const browse = createBrowse(root, FACTS.length, show);
  playback.want(video, true);

  return {
    ready: Promise.resolve(),
    start: () => show(0),
    leave: () => playback.forget(video),
    work: 'pippi-store',
    key: (event) => browse.key(event),
  };
}
