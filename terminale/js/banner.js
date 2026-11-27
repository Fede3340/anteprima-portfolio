const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
};

const GLYPH_ROWS = 7;
const WORD_GAP = 2;

export const pixelRows = (word) =>
  Array.from({ length: GLYPH_ROWS }, (_, row) => [...word].map((char) => GLYPHS[char][row]).join('.'));

// Each character cell holds two stacked pixels, drawn with half blocks.
export function banner(words) {
  const rows = words.flatMap((word, index) => [...(index ? Array(WORD_GAP).fill('') : []), ...pixelRows(word)]);
  const width = Math.max(...rows.map((row) => row.length));
  const lines = [];
  for (let row = 0; row < rows.length; row += 2) {
    let line = '';
    for (let column = 0; column < width; column++) {
      const top = rows[row][column] === '#';
      const bottom = rows[row + 1]?.[column] === '#';
      line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export const bannerWidth = (words) => Math.max(...words.map((word) => pixelRows(word)[0].length));

// The font size that makes one character cell `cell` px wide. Glyphs overlap by half a pixel
// sideways and by the rounding of the line height, so no hairline shows between blocks.
export function bannerMetrics(cell) {
  const fontSize = (cell + 0.5) / 0.6;
  return { cell, fontSize, lineHeight: 2 * Math.floor((1.1 * fontSize - 0.25) / 2) };
}
