// Words in HTML held to points of the park. Each frame the point is projected on the screen; the box
// keeps clear of the screen edges so that nothing written is ever cut, and off the boxes already
// placed; cards and labels of works are placed first, names after them.
import * as THREE from 'three';

const MARGIN = 16;
const point = new THREE.Vector3();

export function createAnchors(layer, camera) {
  const items = [];
  let top = 0;
  let bottom = 0;
  let works = () => [];

  const measure = (item) => {
    item.w = item.node.offsetWidth;
    item.h = item.node.offsetHeight;
  };

  return {
    // place: where the box sits from its point, 'above' or 'below'. visible() says when it is wanted.
    // rank: 0 for cards and labels of works, 1 for names, which give way. width(), if given, is the
    // widest the box may be, in pixels.
    add(node, position, { place = 'above', visible, rank = 0, width }) {
      node.classList.add('anchor');
      layer.append(node);
      const item = { node, position, place, visible, rank, width, on: false, w: 0, h: 0, box: undefined };
      items.push(item);
      items.sort((a, b) => a.rank - b.rank);
      return item;
    },
    // The rectangles of the works on the screen: a name never falls on one.
    avoid(fn) {
      works = fn;
    },
    // Room kept free at the top and the bottom of the screen for the buttons.
    keep(free) {
      ({ top, bottom } = free);
    },
    update() {
      const placed = [];
      let pictures;
      for (const item of items) {
        let on = item.visible();
        if (on) {
          point.copy(item.position).project(camera);
          on = point.z < 1 && Math.abs(point.x) < 1.3 && Math.abs(point.y) < 1.3;
        }
        if (on !== item.on) {
          item.on = on;
          item.node.classList.toggle('is-on', on);
          if (on) measure(item);
        }
        if (!on) continue;
        if (item.width) {
          const widest = Math.max(200, Math.round(item.width() / 8) * 8);
          if (widest !== item.widest) {
            item.widest = widest;
            item.node.style.maxWidth = `${widest}px`;
            measure(item);
          }
        } else if (item.rank === 0 && item.room !== innerHeight - top - bottom) {
          // A card never taller than the room between the buttons at the top and the bar: on a small
          // screen what does not fit scrolls inside it.
          item.room = innerHeight - top - bottom;
          item.node.style.maxHeight = `${item.room}px`;
          measure(item);
        }
        const x = (point.x * 0.5 + 0.5) * innerWidth;
        const y = (-point.y * 0.5 + 0.5) * innerHeight;
        const left = Math.min(innerWidth - MARGIN - item.w, Math.max(MARGIN, x - item.w / 2));
        const above = item.place === 'above' ? y - item.h - 10 : y + 10;
        // Where it would fall on a box already placed, it moves just below or above it; a name that
        // finds no room waits.
        const clear = (box) => !placed.some((other) => box.left < other.box.right && box.right > other.box.left && box.top < other.box.bottom && box.bottom > other.box.top);
        const box = [0, item.h + 6, -item.h - 6]
          .map((shift) => Math.min(innerHeight - bottom - item.h, Math.max(top, above + shift)))
          .map((y) => ({ left, top: y, right: left + item.w, bottom: y + item.h }))
          .find(clear);
        // A box set below its point never climbs back over what it stands under: without room it waits.
        const climbed = item.place === 'below' && box && box.top < above - 1;
        pictures ??= item.rank > 0 ? works() : undefined;
        const onWork = item.rank > 0 && box && pictures.some((r) => box.left < r.left + r.width && box.right > r.left && box.top < r.top + r.height && box.bottom > r.top);
        const covered = (item.rank > 0 && !box) || climbed || onWork;
        item.node.classList.toggle('is-covered', covered);
        item.box = box ?? { left, top: above, right: left + item.w, bottom: above + item.h };
        if (!covered) placed.push(item);
        item.node.style.transform = `translate3d(${Math.round(item.box.left)}px, ${Math.round(item.box.top)}px, 0)`;
      }
    },
    remeasure() {
      items.filter((item) => item.on).forEach(measure);
    },
  };
}
