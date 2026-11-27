import { approach, circle, settle } from './circle.js';
import { createContact } from './places/contact.js';
import { createField } from './places/field.js';
import { createGoogle } from './places/google.js';
import { createPortals } from './places/portals.js';

const KINDS = { siti: createPortals, negozi: createPortals, google: createGoogle, contatti: createContact };

// The place layer: it opens with a circle from the touched object and closes back onto it.
export function createPlaces(layer, { scene, data, works, sound, openWork }) {
  let current;

  layer.addEventListener('click', (event) => {
    const title = event.target.closest('.caption__title button, [data-open]');
    if (title) openWork(title.value || title.dataset.open, { x: event.clientX, y: event.clientY });
  });

  return {
    get id() {
      return current?.spot.id;
    },
    get work() {
      return current?.place.work;
    },
    async open(spot, point, { instant = false } = {}) {
      current?.place.leave?.();
      layer.replaceChildren();
      layer.dataset.place = spot.id;
      const chapter = data.chapters.find((item) => item.id === spot.id);
      const place = (KINDS[spot.id] ?? createField)({
        root: layer, spot, chapter, works: chapter ? chapter.works.map((id) => works[id]) : [], sound, openWork,
      });
      current = { spot, place };
      await place.ready;
      const reveal = () => {
        settle(layer);
        layer.hidden = false;
      };
      if (instant) {
        reveal();
        return place.start?.();
      }
      sound.play('whoosh');
      if (place.cross) await place.cross(reveal);
      else {
        reveal();
        approach(scene, point);
        await circle(layer, point);
      }
      place.start?.();
    },
    async close(point) {
      if (!current) return;
      const { place } = current;
      current = undefined;
      sound.play('whoosh');
      approach(scene, { ...point, back: true });
      await circle(layer, { ...point, open: false });
      place.leave?.();
      layer.hidden = true;
      layer.replaceChildren();
    },
    key: (event) => current?.place.key?.(event) ?? false,
  };
}
