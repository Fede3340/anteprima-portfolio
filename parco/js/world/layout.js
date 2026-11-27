// The plan of the park: the zones in the order they are met along the ring, how long each one is,
// and where every work, sculpture and card stands. Lengths are metres along the middle of the path.
const LEAD = 8;
const TAIL = 3;
const CARD_ZONE = 16;
const SPACING = { siti: 6, negozi: 6, programmi: 6, app: 6, videogioco: 6, marchi: 4.6, manifesti: 4.6 };

export const PATH_HALF = 1.5;
// A work stands this far from the middle of the path, on the outer side: the inner side, towards the
// pond, stays free for the sculptures and for the camera when it turns to a work.
export const WORK_SIDE = 3.4;
// 16:10 like the covers; on its easel the middle of the picture is at about eye height.
export const SCULPTURE_SIDE = -3.9;
export const FRAME = { width: 2.6, height: 1.625 };

// Light of each zone: height of the sun in degrees, strength of sun and sky as shares of the usual
// light, lamps lit. Colours never change.
const MOODS = {
  morning: { sun: 40, sunLight: 1, sky: 1, lamps: 0 },
  bright: { sun: 60, sunLight: 1.25, sky: 1.06, lamps: 0 },
  soft: { sun: 24, sunLight: 0.75, sky: 0.92, lamps: 0.4 },
  evening: { sun: 12, sunLight: 0.45, sky: 0.78, lamps: 1 },
};

const ZONES = [
  { id: 'apertura', mood: 'morning' },
  { id: 'chi', card: 'who', mood: 'morning' },
  { id: 'servizi', card: 'services', mood: 'bright' },
  { id: 'siti', mood: 'bright' },
  { id: 'negozi', mood: 'bright' },
  { id: 'programmi', mood: 'soft' },
  { id: 'app', mood: 'bright' },
  { id: 'videogioco', mood: 'evening' },
  { id: 'marchi', mood: 'soft' },
  { id: 'manifesti', mood: 'bright' },
  { id: 'google', card: 'google', mood: 'morning' },
  { id: 'contatti', card: 'contact', mood: 'evening' },
];

const NAMES = { apertura: 'Apertura', google: 'Google', contatti: 'Contatti' };

export function planPark(data, texts) {
  const chapters = Object.fromEntries(data.chapters.map((chapter) => [chapter.id, chapter]));
  let s = 0;
  const zones = [];
  const works = [];
  for (const zone of ZONES) {
    const chapter = chapters[zone.id];
    const title = NAMES[zone.id] ?? chapter?.title ?? texts[zone.card]?.title;
    const start = s;
    const placed = (chapter?.works ?? []).map((id, index) => {
      const work = { id, zone: zone.id, s: start + LEAD + SPACING[zone.id] * index, reach: SPACING[zone.id] / 2 };
      works.push(work);
      return work;
    });
    const length = chapter ? LEAD + SPACING[zone.id] * Math.max(0, placed.length - 1) + TAIL + 4
      : zone.id === 'apertura' ? 12 : CARD_ZONE;
    zones.push({ ...zone, title, start, length, mood: MOODS[zone.mood], works: placed, index: zones.length });
    s += length;
  }
  const length = s;
  const radius = length / (2 * Math.PI);
  // Each zone's sculpture stands just inside the path where the zone begins; the opening has the
  // great cursor in the middle of the pond instead.
  for (const zone of zones) {
    if (zone.id !== 'apertura') zone.mark = ringPoint({ radius }, zone.start + 3, SCULPTURE_SIDE);
  }
  return {
    zones,
    works,
    length,
    radius,
    pond: radius - 13,
    island: radius + 24,
    // Where the walk begins, and where the first walk on arrival ends.
    landing: 3,
    firstStop: zones[1].start + 6,
  };
}

// Distance from a to b going forward or back along the ring, whichever is shorter (signed).
export const along = (a, b, length) => {
  let d = (b - a) % length;
  if (d > length / 2) d -= length;
  if (d < -length / 2) d += length;
  return d;
};

export const wrap = (s, length) => ((s % length) + length) % length;

export function zoneAt(plan, s) {
  const point = wrap(s, plan.length);
  return plan.zones.findLast((zone) => zone.start <= point) ?? plan.zones[0];
}

// A point on the ring: position, forward direction and the outward side, on the ground.
export function ringPoint(plan, s, offset = 0) {
  const angle = s / plan.radius;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const r = plan.radius + offset;
  return { x: cos * r, z: sin * r, tx: -sin, tz: cos, nx: cos, nz: sin, angle };
}
