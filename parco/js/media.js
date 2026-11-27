const version = document.documentElement.dataset.version;

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Every file the code asks for carries the version of the release, so that a new release is never
// mixed with files kept by the browser from an earlier one.
export const asset = (path) => (path && version ? `${path}?v=${version}` : path);

export const srcset = (value) => value?.split(',').map((entry) => {
  const [path, width] = entry.trim().split(/\s+/);
  return `${asset(path)} ${width}`;
}).join(', ');

// A picture is never drawn more than 10% larger than its own pixels on the screen at hand.
export const limit = (pixels) => `${Math.round((pixels * 1.1) / devicePixelRatio)}px`;

export function sharp(image, node) {
  node.style.setProperty('--max-w', limit(image.w));
  node.style.setProperty('--max-h', limit(image.h));
  return node;
}

export function element(tag, properties = {}, children = []) {
  const node = Object.assign(document.createElement(tag), properties);
  node.append(...children);
  return node;
}

// A client's logo, 40 px high: the light version on dark grounds where there is one. A file with
// pixels is never drawn larger than they are, however its size is known.
export function logo(image, { className, dark = false }) {
  const node = element('img', { className, src: asset(dark && image.srcLight ? image.srcLight : image.src), alt: image.alt ?? '', decoding: 'async' });
  if (/\.svg$/i.test(image.src)) return node;
  if (image.w) return sharp(image, node);
  node.addEventListener('load', () => sharp({ w: node.naturalWidth, h: node.naturalHeight }, node), { once: true });
  return node;
}

export function picture(image, { className = '', sizes, eager = false } = {}) {
  return element('img', {
    className,
    src: asset(image.src),
    alt: image.alt ?? '',
    width: image.w,
    height: image.h,
    decoding: 'async',
    loading: eager ? 'eager' : 'lazy',
    ...(image.srcset ? { srcset: srcset(image.srcset), sizes: sizes ?? '100vw' } : {}),
  });
}

const colours = new Map();
const INK = '#001750';
const LIGHT = '#f6f8fb';

const luminance = (r, g, b) => {
  const channel = (value) => {
    const share = value / 255;
    return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

// The colour of the corner of a picture, and the text that reads better on it, ink or light.
export function groundColour(src) {
  if (!colours.has(src)) {
    colours.set(src, new Promise((done) => {
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
      image.src = asset(src);
    }));
  }
  return colours.get(src);
}
