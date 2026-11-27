// The written things of the park: the name of each zone over the path where it begins, and the cards of Chi sono,
// Che cosa faccio, Google and Contatti held beside the path. From above, the names become the way down.
import * as THREE from 'three';
import { element } from '../media.js';
import { along, ringPoint } from './layout.js';

const NAME_NEAR = 24;
const CARD_NEAR = 8;
const CARD_AHEAD = 5;

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

export function createSigns({ plan, texts, works, anchors, rig, state, onZone, onWork }) {
  const name = (zone, position, visible, className = 'zone-name') => {
    const node = element('button', { className, type: 'button', textContent: zone.title, tabIndex: -1 });
    node.addEventListener('click', () => onZone(zone.id));
    anchors.add(node, position, { visible, rank: 1 });
  };
  plan.zones.forEach((zone, index) => {
    const at = zone.start + 3;
    const p = ringPoint(plan, at, 0);
    name(zone, new THREE.Vector3(p.x, 3.4, p.z), () => {
      const gap = along(state.s, at, plan.length);
      return rig.mode === 'walk' && gap < NAME_NEAR && gap > 1;
    });
    // From above, by the middle of each zone, one name inside the ring and the next outside, so
    // that short zones side by side do not cover each other.
    const middle = ringPoint(plan, zone.start + zone.length / 2, index % 2 ? 9 : -11);
    name(zone, new THREE.Vector3(middle.x, 0, middle.z), () => rig.mode === 'above', 'zone-name zone-name--above');
  });
  for (const zone of plan.zones.filter((each) => each.card)) {
    // Held over the path a few steps ahead of the middle of the zone, so that it is in sight while
    // one comes to it and goes away once one is under it.
    const s = zone.start + zone.length / 2;
    const p = ringPoint(plan, s + CARD_AHEAD, 0);
    anchors.add(element('div', { className: 'card' }, card(zone, texts, works, { onZone, onWork })), new THREE.Vector3(p.x, 2.4, p.z), {
      visible: () => {
        const gap = along(state.s, s, plan.length);
        return rig.mode === 'walk' && gap < CARD_NEAR && gap > -3;
      },
    });
  }
}
