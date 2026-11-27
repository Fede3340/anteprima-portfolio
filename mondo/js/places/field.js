import { circle } from '../circle.js';
import { asset, element, picture, sharp } from '../media.js';
import { caption, createBrowse } from '../browse.js';
import { rings } from '../ripples.js';

const colours = new Map();
const INK = '#001750';
const LIGHT = '#f6f8fb';
const FIELDS = { programmi: 'night', app: 'sky', videogioco: 'ember', manifesti: 'sky' };

const luminance = (r, g, b) => {
  const channel = (value) => {
    const share = value / 255;
    return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

// The colour of a brand is the colour of the corner of its first picture, where the mark sits on
// its own ground. The text on it is ink or light, whichever reads better.
export function brandColour(work) {
  if (!colours.has(work.id)) {
    colours.set(work.id, new Promise((done) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        const canvas = Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 4, 4, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        const ground = luminance(r, g, b) + 0.05;
        const onInk = ground / (luminance(0, 23, 80) + 0.05);
        const onLight = (luminance(246, 248, 251) + 0.05) / ground;
        done({ colour: `rgb(${r} ${g} ${b})`, text: onInk >= onLight ? INK : LIGHT });
      };
      image.onerror = () => done({ colour: INK, text: LIGHT });
      image.src = asset(work.gallery[0].src);
    }));
  }
  return colours.get(work.id);
}

// A place where one work at a time fills the screen on a ground of its own. Moving to another work,
// a circle of the new ground opens from where the move came from. For the brands the ground takes
// the colour of the brand.
export function createField({ root, chapter, works, sound }) {
  const brands = chapter.id === 'marchi';
  const stack = element('div', { className: 'field__stack' });
  root.append(stack);

  async function layer(work) {
    const image = work.gallery[0];
    const mark = sharp(image, picture(image, { className: brands ? 'field__mark' : 'field__work', eager: true }));
    const button = element('button', { className: 'field__open', type: 'button', value: work.id }, [mark]);
    button.setAttribute('aria-label', `Apri ${work.title}`);
    button.dataset.open = work.id;
    const node = element('div', { className: 'field' }, [button, caption(work)]);
    if (brands) {
      const { colour, text } = await brandColour(work);
      node.style.setProperty('--field', colour);
      node.style.setProperty('--text', text);
    } else node.dataset.field = FIELDS[chapter.id] ?? 'night';
    await mark.decode().catch(() => {});
    return node;
  }

  let shown = 0;
  async function show(index, direction, point) {
    const ticket = ++shown;
    const node = await layer(works[index]);
    if (ticket !== shown) return;
    const old = [...stack.children];
    stack.append(node);
    sound.play('drop');
    rings(point.x, point.y, { size: Math.min(innerWidth, 420), tone: 'light' });
    await circle(node, point);
    if (ticket === shown) old.forEach((item) => item.remove());
  }

  const browse = createBrowse(root, works.length, show);
  if (brands) works.slice(0, 3).forEach(brandColour);

  return {
    get work() {
      return works[browse.index].id;
    },
    key: (event) => browse.key(event),
    ready: layer(works[0]).then((node) => stack.append(node)),
  };
}
