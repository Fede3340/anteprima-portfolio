const REACH = 10;
const KEEP = 22;
const PARALLEL = 6;
const REST_DELAY = 140;

const decode = window.createImageBitmap
  ? (blob) => createImageBitmap(blob)
  : (blob) => new Promise((done, fail) => {
    const image = new Image();
    image.onload = () => done(image);
    image.onerror = fail;
    image.src = URL.createObjectURL(blob);
  });

const release = (frame) => {
  if (frame.close) frame.close();
  else URL.revokeObjectURL(frame.src);
};

// Frames are fetched once and kept compressed; only the ones around the playhead stay decoded.
// While the playhead moves, neighbouring frames are cross-faded; at rest a single frame is shown.
export function createSequence(canvas, count) {
  const context = canvas.getContext('2d', { alpha: false });
  let blobs = [];
  let decoded = new Map();
  let pending = new Set();
  let generation = 0;
  let position = 0;
  let painted = '';
  let restTimer = 0;

  function nearest(index) {
    for (let offset = 0; offset < count; offset++) {
      if (decoded.has(index - offset)) return index - offset;
      if (decoded.has(index + offset)) return index + offset;
    }
    return -1;
  }

  function paint(atRest) {
    const base = atRest ? Math.round(position) : Math.floor(position);
    const first = nearest(base);
    if (first < 0) return;
    const blend = first === base && !atRest && decoded.has(base + 1) ? position - base : 0;
    const key = `${first}:${blend.toFixed(2)}`;
    if (key === painted) return;
    painted = key;
    context.globalAlpha = 1;
    context.drawImage(decoded.get(first), 0, 0, canvas.width, canvas.height);
    if (blend < 0.02) return;
    context.globalAlpha = blend;
    context.drawImage(decoded.get(base + 1), 0, 0, canvas.width, canvas.height);
  }

  function request(index) {
    if (!blobs[index] || decoded.has(index) || pending.has(index)) return;
    const run = generation;
    pending.add(index);
    decode(blobs[index]).then((frame) => {
      if (run !== generation) return release(frame);
      pending.delete(index);
      if (Math.abs(index - position) > KEEP) return release(frame);
      decoded.set(index, frame);
      if (Math.abs(index - position) <= 1) paint(false);
    }, () => {
      // A frame that cannot be decoded is left out: the nearest one is painted in its place.
      blobs[index] = undefined;
      pending.delete(index);
    });
  }

  function seek(next) {
    position = Math.min(count - 1, Math.max(0, next));
    const centre = Math.round(position);
    for (let index = Math.max(0, centre - REACH); index <= Math.min(count - 1, centre + REACH); index++) request(index);
    for (const [index, frame] of decoded) {
      if (Math.abs(index - centre) <= KEEP) continue;
      decoded.delete(index);
      release(frame);
    }
    paint(false);
    clearTimeout(restTimer);
    restTimer = setTimeout(() => paint(true), REST_DELAY);
  }

  // Resolves once the first frame has arrived; the others keep loading behind it.
  async function load(folder, [width, height]) {
    const run = ++generation;
    decoded.forEach(release);
    blobs = new Array(count);
    decoded = new Map();
    pending = new Set();
    painted = '';
    canvas.width = width;
    canvas.height = height;
    const fetchFrame = async (index) => {
      const response = await fetch(`${folder}/${String(index).padStart(3, '0')}.webp`);
      if (!response.ok) return;
      const blob = await response.blob();
      if (run !== generation) return;
      blobs[index] = blob;
      if (Math.abs(index - position) <= REACH) request(index);
    };
    await fetchFrame(0);
    let next = 1;
    const worker = async () => {
      while (next < count && run === generation) await fetchFrame(next++);
    };
    for (let slot = 0; slot < PARALLEL; slot++) worker();
  }

  return { load, seek };
}
