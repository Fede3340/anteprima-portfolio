// The written things of the park: the name of each island floating over it when seen from elsewhere,
// and the cards of Chi sono, Che cosa faccio, Google and Contatti over their sculptures. From above, the
// names become the way to the islands.
import * as THREE from 'three';
import { element } from '../media.js';

const NAME_NEAR = 120;
const CARD_NEAR = 11;

function card(zone, texts, works, { onZone, onWork }) {
  const title = element('h2', { textContent: texts[zone.card].title ?? zone.title });
  if (zone.card === 'who') return [title, element('p', { textContent: texts.who.text })];
  if (zone.card === 'services') {
    return [title, element('ul', {}, texts.services.items.map((item) => {
      const go = element('button', { className: 'card__go', type: 'button', textContent: item.title });
      go.addEventListener('click', () => onZone(item.stage));
      return element('li', {}, [go, ...(item.line ? [element('p', { textContent: item.line })] : [])]);
    }))];
  }
  if (zone.card === 'google') {
    const go = element('button', { className: 'card__go', type: 'button', textContent: works[texts.google.work].title });
    go.addEventListener('click', () => onWork(texts.google.work));
    return [title, element('ul', { className: 'card__facts' }, texts.google.facts.map((fact) => element('li', { textContent: fact }))), go];
  }
  return [title, element('p', { className: 'card__links' }, texts.contact.links.map(({ label, href }) => element('a', { className: 'card__go', href, target: '_blank', rel: 'noopener', textContent: label })))];
}

export function createSigns({ plan, texts, works, anchors, rig, state, camera, onZone, onWork }) {
  const name = (title, id, position, visible, className = 'zone-name') => {
    // A real button, reached with Tab too while it shows.
    const node = element('button', { className, type: 'button', textContent: title });
    node.dataset.zone = id;
    node.addEventListener('click', () => onZone(id));
    anchors.add(node, position, { visible, rank: 1 });
  };
  const away = (point) => Math.hypot(camera.position.x - point.x, camera.position.z - point.z);
  for (const island of plan.islands) {
    const [first] = island.zones;
    // High in the sky over the island, clear of what stands on it.
    const over = island.centre.clone().setY(island.centre.y + 11);
    // Seen from another island or from the path, the name floats over the island; on it, it goes.
    name(first.title, first.id, over, () => rig.mode === 'walk' && state.island !== island && away(over) < NAME_NEAR);
    name(first.title, first.id, island.centre, () => rig.mode === 'above', 'zone-name zone-name--above');
  }
  for (const zone of plan.zones.filter((each) => each.card)) {
    // Held over the sculpture of the place, in sight while one stands on its island near it.
    const over = new THREE.Vector3(zone.mark.x, zone.mark.y + 3.6, zone.mark.z);
    anchors.add(element('div', { className: 'card' }, card(zone, texts, works, { onZone, onWork })), over, {
      visible: () => rig.mode === 'walk' && state.island === zone.island && away(over) < CARD_NEAR,
    });
  }
}
