import { pixelRows } from './banner.js';
import { ADVANCE, MONO, baseline, fitCanvas, themeColors } from './dom.js';

const SIZE = 16;
const LEADING = 26;
const CHAR = SIZE * ADVANCE;
const WIDE = 64;
const STAMP_END = 29;
const COUNTER_CELLS = 23;

const CURSOR_MS = 300;
const KEY_MS = 11;
const PAUSE_MS = 180;
const FILM_MS = 2600;
const FRAME_MS = 45;
const HOLD_MS = 480;
const ACCELERATION = 2;

const shortDay = (day) => day.split('-').reverse().join('/');
const longDay = (day) => new Date(`${day}T12:00:00`)
  .toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function wrap(text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
    for (; line.length > width; line = line.slice(width)) lines.push(line.slice(0, width));
  }
  return [...lines, line];
}

// A line is a list of [column, colour, text].
function entryLines({ day, time, sha, message }, columns) {
  const stamp = [[0, 'added', '+'], [2, 'date', `${shortDay(day)} ${time}`], [20, 'dim', sha]];
  if (columns < WIDE) return [stamp, ...wrap(message, columns - 2).map((text) => [[2, 'fg', text]])];
  const [first, ...rest] = wrap(message, columns - STAMP_END);
  return [[...stamp, [STAMP_END, 'fg', first]], ...rest.map((text) => [[STAMP_END, 'fg', text]])];
}

function openingLines({ day, time, sha, message }, columns) {
  const [first, ...rest] = wrap(`${longDay(day)}, ${time}`, columns - 2);
  const [head, ...tail] = wrap(message, columns - 11);
  return [
    [[0, 'added', '+'], [2, 'date', first]],
    ...rest.map((text) => [[2, 'date', text]]),
    [[2, 'dim', sha], [11, 'fg', head]],
    ...tail.map((text) => [[11, 'fg', text]]),
  ];
}

// 1 while the cursor rests, dipping once per 1.2 s like the prompt cursor.
function beat(time) {
  const phase = (time % 1200) / 1200;
  if (phase < 0.45) return 1;
  if (phase < 0.7) return 1 - 3 * (phase - 0.45);
  if (phase < 0.85) return 0.25;
  return 0.25 + 5 * (phase - 0.85);
}

// The opening film: the first commit is typed, then the whole log runs to the last one.
// `place` is where the name will stand: the counter is set in the same cells.
export function playBoot({ canvas, commits, place, onCount }) {
  const colors = themeColors();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const context = fitCanvas(canvas, width, height);
  const { left, top, cell, lineHeight } = place;
  const columns = Math.floor((width - 2 * left) / CHAR);
  const wide = columns >= WIDE;
  const rowsTop = top + 4 * lineHeight + LEADING;
  const rowCount = Math.floor((height - rowsTop - 20) / LEADING);
  const labelLeft = left + COUNTER_CELLS * cell + 2 * CHAR;
  const labelTop = top + 3.5 * lineHeight - 1.5 * LEADING - 0.35 * SIZE;
  const opening = openingLines(commits[0], columns);
  const openingChars = opening.flat().reduce((sum, [, , text]) => sum + text.length, 0);

  const typeEnd = CURSOR_MS + openingChars * KEY_MS;
  const filmStart = typeEnd + PAUSE_MS;
  const filmEnd = filmStart + FILM_MS;
  const start = performance.now();
  let frame = 0;
  let drawnState = '';
  let finished = false;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });

  // The newest commits that fit, whole: an entry is never cut at the top.
  function windowLines(count) {
    const lines = [];
    for (let index = count - 1; index >= 0; index--) {
      const entry = index ? entryLines(commits[index], columns) : opening;
      if (lines.length + entry.length > rowCount) break;
      lines.unshift(...entry);
    }
    return lines;
  }

  // While the film runs the newest lines are the brightest.
  function drawText(lines, typed, running) {
    context.font = `400 ${SIZE}px ${MONO}`;
    let budget = typed;
    let caret = [0, 0];
    lines.forEach((line, row) => {
      context.globalAlpha = running ? 0.3 + 0.7 * ((row + 1) / lines.length) ** 1.5 : 1;
      for (const [column, colour, text] of line) {
        if (budget <= 0) return;
        const shown = text.slice(0, budget);
        budget -= text.length;
        caret = [row, column + shown.length];
        context.fillStyle = colors[colour];
        context.fillText(shown, left + column * CHAR, baseline(rowsTop + row * LEADING, LEADING, SIZE));
      }
    });
    context.globalAlpha = 1;
    return caret;
  }

  function drawCounter(count) {
    context.fillStyle = colors.added;
    pixelRows(String(count).padStart(4, '0')).forEach((pixels, row) => {
      for (let column = 0; column < pixels.length; column++) {
        if (pixels[column] === '#') context.fillRect(left + column * cell, top + (row * lineHeight) / 2, cell, lineHeight / 2);
      }
    });
    const { day } = commits[count - 1];
    context.font = `400 ${SIZE}px ${MONO}`;
    context.fillStyle = colors.date;
    context.fillText(wide ? longDay(day) : shortDay(day), labelLeft, baseline(labelTop, LEADING, SIZE));
    context.fillStyle = colors.dim;
    context.fillText('commit', labelLeft, baseline(labelTop + LEADING, LEADING, SIZE));
  }

  function draw({ typed, count, glow }) {
    context.clearRect(0, 0, width, height);
    const [row, column] = drawText(count ? windowLines(count) : opening, typed, count > 1);
    if (count) drawCounter(count);
    if (glow) {
      context.globalAlpha = glow;
      context.fillStyle = colors.added;
      context.fillRect(left + column * CHAR, rowsTop + row * LEADING + 3, CHAR, LEADING - 6);
      context.globalAlpha = 1;
    }
  }

  function scene(elapsed) {
    if (elapsed < CURSOR_MS) return { typed: 0, count: 0, glow: Math.round(beat(elapsed) * 8) / 8 };
    if (elapsed < typeEnd) return { typed: Math.ceil((elapsed - CURSOR_MS) / KEY_MS), count: 0, glow: 1 };
    if (elapsed < filmStart) return { typed: Infinity, count: 1, glow: 1 };
    const step = Math.floor((elapsed - filmStart) / FRAME_MS) + 1;
    const progress = Math.min(1, (step * FRAME_MS) / FILM_MS);
    return { typed: Infinity, count: Math.round(1 + (commits.length - 1) * progress ** ACCELERATION), glow: 0 };
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    resolveDone();
  }

  function tick(time) {
    const elapsed = time - start;
    if (elapsed >= filmEnd + HOLD_MS) {
      finish();
      return;
    }
    const next = scene(elapsed);
    const state = `${next.typed} ${next.count} ${next.glow}`;
    if (state !== drawnState) {
      drawnState = state;
      draw(next);
      if (next.count) onCount(next.count);
    }
    frame = requestAnimationFrame(tick);
  }

  frame = requestAnimationFrame(tick);
  return { done, finish };
}
