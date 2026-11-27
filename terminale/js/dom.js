export const MONO = '"Commit Mono", ui-monospace, monospace';

// Commit Mono: 0.6 em advance, 0.9 em ascent, 0.2 em descent.
export const ADVANCE = 0.6;
export const baseline = (lineTop, lineHeight, fontSize) => lineTop + lineHeight / 2 + 0.35 * fontSize;

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export const el = (tag, className, ...children) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
};

export function themeColors() {
  const style = getComputedStyle(document.documentElement);
  const read = (name) => style.getPropertyValue(`--${name}`).trim();
  return {
    bg: read('bg'), fg: read('fg'), dim: read('dim'),
    added: read('added'), removed: read('removed'), name: read('name'), date: read('date'),
  };
}

export function fitCanvas(canvas, width, height) {
  const ratio = Math.min(devicePixelRatio || 1, 3);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

export const nextFrame = () => new Promise(requestAnimationFrame);
