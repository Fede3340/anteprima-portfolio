import { ADVANCE, MONO, baseline, el, nextFrame, reducedMotion, themeColors } from './dom.js';

const RAMP = ' .:-=+*#%@';
const SOLID = 0.9;
const CELL_SHAPE = 1.85;
const PRINT_MS = 280;
const HOLD_MS = 140;
const DISSOLVE_MS = 500;
const COVER_MS = 220;
const VANISH_MS = 220;

function tone(red, green, blue, light) {
  const max = Math.max(red, green, blue);
  const spread = max - Math.min(red, green, blue);
  if (max < 48 || spread / max < 0.3) return light > 0.5 ? 'fg' : 'dim';
  const hue = max === red
    ? ((green - blue) / spread + 6) % 6
    : max === green ? (blue - red) / spread + 2 : (red - green) / spread + 4;
  if (hue < 0.6 || hue >= 5.3) return 'removed';
  if (hue < 1.25) return 'name';
  if (hue < 3.2) return 'added';
  return 'date';
}

// The image as rows of text, one string per theme colour: denser glyphs where it is lighter, and
// full blocks where it is lightest. Blocks are kept as runs of cells, to be filled without gaps.
function characters(image, { columns, rows }) {
  const probe = document.createElement('canvas');
  probe.width = columns;
  probe.height = rows;
  const context = probe.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, columns, rows);
  let data;
  try {
    ({ data } = context.getImageData(0, 0, columns, rows));
  } catch {
    // Pixels are unreadable when the page is opened from disk: the image is shown without the effect.
    return null;
  }
  return Array.from({ length: rows }, (_, row) => {
    const strips = {};
    const blocks = [];
    for (let column = 0; column < columns; column++) {
      const index = (row * columns + column) * 4;
      const light = ((0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255) ** 0.8;
      const name = tone(data[index], data[index + 1], data[index + 2], light);
      if (light >= SOLID) {
        const last = blocks.at(-1);
        if (last?.[1] === column && last[2] === name) last[1] = column + 1;
        else blocks.push([column, column + 1, name]);
        continue;
      }
      const glyph = RAMP[Math.floor((light / SOLID) * RAMP.length)];
      if (glyph !== ' ') (strips[name] ??= Array(columns).fill(' '))[column] = glyph;
    }
    return { blocks, text: Object.entries(strips).map(([name, glyphs]) => [name, glyphs.join('')]) };
  });
}

// A frame where an image is born from characters and goes back to them when it leaves.
export function createGlyphViewer() {
  const colors = themeColors();
  const canvas = el('canvas', '');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  const element = el('figure', 'viewer', canvas);
  const context = canvas.getContext('2d');
  let image = null;
  let source = '';
  let run = 0;

  function measure() {
    const ratio = Math.min(devicePixelRatio || 1, 3);
    const width = Math.round(element.clientWidth * ratio);
    const height = Math.round(element.clientHeight * ratio);
    if (!width || !height) return null;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const columns = Math.round(element.clientWidth / (ratio >= 2 ? 5 : 6));
    const rows = Math.round(height / ((width / columns) * CELL_SHAPE));
    return {
      columns,
      rows,
      fontSize: width / columns / ADVANCE,
      xs: Array.from({ length: columns + 1 }, (_, column) => Math.round((column * width) / columns)),
      ys: Array.from({ length: rows + 1 }, (_, row) => Math.round((row * height) / rows)),
    };
  }

  async function printRows(token, grid, text, duration) {
    canvas.hidden = false;
    context.font = `400 ${grid.fontSize}px ${MONO}`;
    const started = performance.now();
    for (let row = 0; row < grid.rows;) {
      const time = await nextFrame();
      if (token !== run) return false;
      const until = Math.min(grid.rows, Math.ceil(((time - started) / duration) * grid.rows));
      for (; row < until; row++) {
        const top = grid.ys[row];
        const height = grid.ys[row + 1] - top;
        context.fillStyle = colors.bg;
        context.fillRect(0, top, canvas.width, height);
        for (const [from, to, name] of text[row].blocks) {
          context.fillStyle = colors[name];
          context.fillRect(grid.xs[from], top, grid.xs[to] - grid.xs[from], height);
        }
        for (const [name, line] of text[row].text) {
          context.fillStyle = colors[name];
          context.fillText(line, 0, baseline(top, height, grid.fontSize));
        }
      }
    }
    return true;
  }

  async function clearCells(token, { columns, rows, xs, ys }, duration) {
    const keys = Float32Array.from({ length: columns * rows }, (_, index) =>
      0.5 * Math.random() + (0.5 * Math.floor(index / columns)) / rows);
    const order = Array.from(keys.keys()).sort((a, b) => keys[a] - keys[b]);
    const started = performance.now();
    for (let done = 0; done < order.length;) {
      const time = await nextFrame();
      if (token !== run) return false;
      const until = Math.min(order.length, Math.ceil(((time - started) / duration) * order.length));
      for (; done < until; done++) {
        const column = order[done] % columns;
        const row = (order[done] - column) / columns;
        context.clearRect(xs[column], ys[row], xs[column + 1] - xs[column], ys[row + 1] - ys[row]);
      }
    }
    return true;
  }

  function place(next) {
    if (image) image.replaceWith(next);
    else element.prepend(next);
    image = next;
  }

  async function show(src, alt) {
    if (src === source) return;
    source = src;
    const token = ++run;
    const next = new Image();
    next.alt = alt;
    next.src = src;
    // A file that cannot be decoded leaves the frame as it is.
    await next.decode().catch(() => {});
    if (token !== run || !next.naturalWidth) return;
    const grid = reducedMotion.matches ? null : measure();
    const text = grid && characters(next, grid);
    if (!text) {
      place(next);
      canvas.hidden = true;
      return;
    }
    if (!(await printRows(token, grid, text, PRINT_MS))) return;
    place(next);
    await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
    if (token === run && (await clearCells(token, grid, DISSOLVE_MS))) canvas.hidden = true;
  }

  async function hide() {
    const token = ++run;
    source = '';
    const grid = reducedMotion.matches ? null : measure();
    const text = grid && image && characters(image, grid);
    if (text && !(await printRows(token, grid, text, COVER_MS))) return;
    image?.remove();
    image = null;
    if (grid && !(await clearCells(token, grid, VANISH_MS))) return;
    canvas.hidden = true;
  }

  return { element, show, hide };
}
