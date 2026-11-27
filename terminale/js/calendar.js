import { ADVANCE, MONO, baseline, fitCanvas, themeColors } from './dom.js';

const GLYPHS = ['·', '+', '#', '█'];
const REST = [0.32, 0.38, 0.54, 0.66];
const DAYS_IN_ROW = 31;
const LABEL_CHARS = 7;
const GLOW_STEPS = 8;
const FADE_MS = 560;
const WAVE_MS = 760;
const WAVE_SLANT = 1.7;
const PLAYHEAD_MS = 130;
const QUIET_DAYS = 3;

const density = (count) => (count === 0 ? 0 : count < 10 ? 1 : count < 30 ? 2 : 3);

// One character per day, one row per month. Cells light up and fade back; only cells whose
// brightness changed are drawn again.
export function createCalendar({ canvas, days, onHover, onLayout, onPick }) {
  const colors = themeColors();
  const [firstYear, firstMonth] = days[0].date.split('-').map(Number);
  const cells = days.map(({ date, count }) => {
    const [year, month, day] = date.split('-').map(Number);
    return { row: (year - firstYear) * 12 + month - firstMonth, column: day - 1, level: density(count) };
  });
  const rows = cells.at(-1).row + 1;
  const labels = Array.from({ length: rows }, (_, row) => {
    const month = new Date(firstYear, firstMonth - 1 + row, 1);
    const name = month.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
    return `${name} ${String(month.getFullYear()).slice(2)}`;
  });
  const rowStarts = labels.map((_, row) => cells.findIndex((cell) => cell.row === row));
  const waveOrder = cells.map((_, index) => index)
    .sort((a, b) => cells[a].column + cells[a].row * WAVE_SLANT - (cells[b].column + cells[b].row * WAVE_SLANT));
  const waveSpan = DAYS_IN_ROW + rows * WAVE_SLANT;

  // The longest run of months with almost no commits: the room where a work's image opens.
  let quiet = { first: 0, count: 0 };
  for (let row = 0, start = 0; row <= rows; row++) {
    const busy = row === rows
      || cells.filter((cell) => cell.row === row && cell.level).length > QUIET_DAYS;
    if (!busy) continue;
    if (row - start > quiet.count) quiet = { first: start, count: row - start };
    start = row + 1;
  }

  const glow = new Float32Array(cells.length);
  const held = new Uint8Array(cells.length);
  const drawn = new Uint8Array(cells.length);
  let context;
  let grid = { left: 0, cell: 0, rowHeight: 0, fontSize: 0 };
  let shown = cells.length;
  let cursor = -1;
  let waveStart = null;
  let waveIndex = 0;
  let frame = 0;
  let lastTime = 0;
  let playhead = 0;
  let playTimer = 0;
  let onScreen = true;
  let idle = false;

  function layout() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    context = fitCanvas(canvas, width, height);
    const labelSize = width < 480 ? 12 : 14;
    const left = Math.ceil(LABEL_CHARS * ADVANCE * labelSize);
    const cell = Math.min(18, Math.floor((width - left) / DAYS_IN_ROW));
    const rowHeight = Math.floor(height / rows);
    grid = { left, cell, rowHeight, labelSize, fontSize: Math.min(16, Math.floor(cell * 1.5), Math.floor(rowHeight * 0.7)) };
    context.clearRect(0, 0, width, height);
    labels.forEach((_, row) => drawLabel(row));
    cells.forEach((_, index) => drawCell(index));
    onLayout({ rowHeight, quiet });
  }

  // A month is named once its first day is on screen.
  function drawLabel(row) {
    const { left, rowHeight, labelSize } = grid;
    context.clearRect(0, row * rowHeight, left, rowHeight);
    if (rowStarts[row] >= shown) return;
    context.textAlign = 'left';
    context.font = `400 ${labelSize}px ${MONO}`;
    context.fillStyle = colors.dim;
    context.globalAlpha = 0.72;
    context.fillText(labels[row], 0, baseline(row * rowHeight, rowHeight, labelSize));
  }

  function drawCell(index) {
    const { row, column, level } = cells[index];
    const { left, cell, rowHeight, fontSize } = grid;
    const x = left + column * cell;
    const y = row * rowHeight;
    const step = Math.round(glow[index] * GLOW_STEPS);
    drawn[index] = step;
    context.clearRect(x, y, cell, rowHeight);
    if (index >= shown) return;
    context.textAlign = 'center';
    context.font = `400 ${fontSize}px ${MONO}`;
    const lit = held[index] ? 1 : step / GLOW_STEPS;
    if (index === cursor) {
      context.globalAlpha = 1;
      context.fillStyle = colors.added;
      context.fillRect(x, y + 3, cell, rowHeight - 6);
      context.fillStyle = colors.bg;
    } else {
      context.globalAlpha = REST[level] + (1 - REST[level]) * lit;
      context.fillStyle = level ? colors.added : lit > 0.5 ? colors.fg : colors.dim;
    }
    context.fillText(GLYPHS[level], x + cell / 2, baseline(y, rowHeight, fontSize));
  }

  function tick(time) {
    const elapsed = Math.min(64, time - lastTime);
    lastTime = time;
    if (waveStart !== null) {
      const front = ((time - waveStart) / WAVE_MS) * waveSpan;
      while (waveIndex < waveOrder.length) {
        const { column, row } = cells[waveOrder[waveIndex]];
        if (column + row * WAVE_SLANT > front) break;
        glow[waveOrder[waveIndex++]] = 1;
      }
      if (waveIndex === waveOrder.length) waveStart = null;
    }
    let active = waveStart !== null;
    for (let index = 0; index < glow.length; index++) {
      if (glow[index] > 0) {
        glow[index] = Math.max(0, glow[index] - elapsed / FADE_MS);
        active = true;
      }
      if (Math.round(glow[index] * GLOW_STEPS) !== drawn[index]) drawCell(index);
    }
    frame = active && !document.hidden ? requestAnimationFrame(tick) : 0;
  }

  function wake() {
    if (frame || document.hidden || !context) return;
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function cellAt(event) {
    const bounds = canvas.getBoundingClientRect();
    const row = Math.floor((event.clientY - bounds.top) / grid.rowHeight);
    const column = Math.floor((event.clientX - bounds.left - grid.left) / grid.cell);
    const index = cells.findIndex((cell) => cell.row === row && cell.column === column);
    return index < shown ? index : -1;
  }

  function point(index) {
    if (index === cursor) return;
    const previous = cursor;
    cursor = index;
    if (previous >= 0) drawCell(previous);
    if (index >= 0) drawCell(index);
    canvas.style.cursor = index >= 0 ? 'pointer' : '';
    onHover(index >= 0 ? days[index] : null);
  }

  function schedulePlayhead() {
    clearInterval(playTimer);
    playTimer = idle && onScreen && !document.hidden && cursor < 0
      ? setInterval(() => {
        glow[playhead] = 1;
        playhead = (playhead + 1) % cells.length;
        wake();
      }, PLAYHEAD_MS)
      : 0;
  }

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    point(cellAt(event));
    schedulePlayhead();
  });
  canvas.addEventListener('pointerleave', () => {
    point(-1);
    schedulePlayhead();
  });
  canvas.addEventListener('click', (event) => {
    const index = cellAt(event);
    if (index >= 0) onPick(days[index]);
  });
  document.addEventListener('visibilitychange', () => {
    schedulePlayhead();
    wake();
  });
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    schedulePlayhead();
  }).observe(canvas);
  new ResizeObserver(layout).observe(canvas);

  return {
    wave() {
      waveStart = performance.now();
      waveIndex = 0;
      wake();
    },
    // Shows the days up to `count`; the ones that just appeared light up.
    reveal(count) {
      const from = Math.min(shown, count);
      const to = Math.max(shown, count);
      glow.fill(count > shown ? 1 : 0, from, to);
      shown = count;
      if (!context || from === to) return;
      for (let index = from; index < to; index++) drawCell(index);
      for (let row = cells[from].row; row <= cells[to - 1].row; row++) drawLabel(row);
      wake();
    },
    // Keeps the given days lit for as long as their work is open.
    mark(indices = []) {
      const changed = new Set(indices);
      held.forEach((value, index) => value && changed.add(index));
      held.fill(0);
      for (const index of indices) held[index] = 1;
      if (context) changed.forEach(drawCell);
    },
    setIdle(value) {
      idle = value;
      schedulePlayhead();
    },
  };
}
