// The works standing on the islands, each on the stand of its kind (a frame, a screen, a phone, a
// roll-up), facing where one arrives, standing there from the start.
// Close to a visitor a work turns to face them and lifts a little, and its plate shows under it.
// Frames are drawn as instances. Every cover is there small from the start, for the works seen from
// far; on the island one is on and those beside it the large one takes its place.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { element, logo } from '../media.js';
import { instances } from './instances.js';
import { heightAt } from './land.js';
import { FRAME } from './layout.js';
import { fadeIn, loadTexture } from './textures.js';

const LIFT = 0.1;
const CLOSE = 9;
const PLATE = 7.5;
// How far a work is still seen well enough for a name to keep off it.
const SIGHT = 45;
const MIDDLE = 1.5;
const BORDER = 0.06;
const DEPTH = 0.05;

// What each kind of work stands on, all in the same plaster: the brands in a frame on two legs, as a
// picture; sites, shops, programs and the game on a screen on one foot; apps on a tall phone on one
// foot; posters on a roll-up, the stand of a fair, in the shape of the poster. width and height: the
// picture; bottom: its lower edge above the ground; image: which picture of the work it shows.
const KINDS = {
  frame: { width: FRAME.width, height: FRAME.height, bottom: MIDDLE - FRAME.height / 2, image: 'cover' },
  screen: { width: FRAME.width, height: FRAME.height, bottom: MIDDLE - FRAME.height / 2, image: 'cover' },
  phone: { width: 0.9, height: 1.6, bottom: 0.55, image: 'page' },
  rollup: { width: 1.4, height: 1.4 / 0.747, bottom: 0.1, image: 'page' },
};
const KIND_OF = { marchi: 'frame', app: 'phone', manifesti: 'rollup' };
for (const kind of Object.values(KINDS)) kind.middle = kind.bottom + kind.height / 2;

// The stand of each kind round a picture of its size, its front towards +z: the stand in the colour of
// the frame, the back of the picture a tone darker, and the picture.
function createSupport(name) {
  const { width, height, bottom, middle } = KINDS[name];
  const top = bottom + height;
  const box = (w, h, x, y, d = DEPTH) => new THREE.BoxGeometry(w, h, d).translate(x, y, -d / 2 + 0.01);
  const post = (r, from, to, z = -0.06) => new THREE.CylinderGeometry(r, r, to - from, 16).translate(0, (from + to) / 2, z);
  const rim = (b, chin = b) => [
    box(width + b * 2, b, 0, top + b / 2),
    box(width + b * 2, chin, 0, bottom - chin / 2),
    box(b, height, -width / 2 - b / 2, middle),
    box(b, height, width / 2 + b / 2, middle),
  ];
  const parts = {
    // Brands: a frame on two legs, with the bars of a stretcher behind.
    frame: () => [
      ...rim(BORDER),
      ...[-1, 1].map((side) => new THREE.CylinderGeometry(0.025, 0.03, bottom + 0.2, 12).translate(side * width * 0.32, (bottom - 0.2) / 2, -0.04)),
      ...[1, -1].map((side) => box(Math.hypot(width, height) - 0.1, 0.06, 0, 0, 0.03).rotateZ(side * Math.atan2(height, width)).translate(0, middle, -0.05)),
      box(width, 0.06, 0, middle, 0.03).translate(0, 0, -0.05),
    ],
    // A screen: a thin rim with a deeper chin, a neck and a flat foot.
    screen: () => [...rim(0.05, 0.09), post(0.045, 0, bottom - 0.09, -0.07), box(0.8, 0.03, 0, 0.015, 0.4).translate(0, 0, -0.08)],
    // A phone: a rim round its screen, a neck and a round foot.
    phone: () => [...rim(0.06), post(0.04, 0, bottom - 0.06), new THREE.CylinderGeometry(0.28, 0.3, 0.03, 32).translate(0, 0.015, -0.06)],
    // A roll-up: the bar along the top, the case it rolls out of at the foot, the pole behind and the
    // little foot that keeps it up.
    rollup: () => [
      new THREE.CylinderGeometry(0.022, 0.022, width + 0.06, 12).rotateZ(Math.PI / 2).translate(0, top + 0.01, 0),
      box(width + 0.1, bottom, 0, bottom / 2, 0.2).translate(0, 0, 0.04),
      post(0.012, bottom, top),
      box(0.05, 0.03, 0, 0.015, 0.35).translate(0, 0, -0.2),
    ],
  };
  // The back of the picture darker than the stand, so that seen from behind it is the back of a
  // finished thing and not a blank one: one mesh, coloured by its points.
  const painted = (geometry, hex) => {
    const colour = new THREE.Color(hex);
    const flat = geometry.toNonIndexed();
    flat.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: flat.attributes.position.count }, () => colour.toArray()).flat(), 3));
    return flat;
  };
  const stand = mergeGeometries([...parts[name]().map((geometry) => painted(geometry, '#f2f6fb')), painted(box(width, height, 0, middle, 0.02).translate(0, 0, -0.03), '#8f93c4')]);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(stand, new THREE.MeshBasicMaterial({ vertexColors: true })));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: '#dce8f5' }));
  screen.position.set(0, middle, 0.012);
  group.add(screen);
  return { group, screen };
}

// The picture of a work for its kind, about the width asked: the cover for frames and screens (the
// small one built by tools/build-covers.py, or the 960 one); for phones and posters the first picture
// of the work, upright and whole, at the size of its srcset nearest above.
function pictureOf(work, kind, width) {
  if (KINDS[kind].image === 'cover') return width < 500 ? work.cover.srcMobile.replace(/^media\/works\/([^/]+)\/.*$/, 'img/covers/$1.webp') : work.cover.srcMobile;
  const sizes = work.gallery[0].srcset.split(',').map((entry) => entry.trim().split(' ')).map(([src, w]) => ({ src, w: parseInt(w, 10) })).sort((a, b) => a.w - b.w);
  return (sizes.find((size) => size.w >= width) ?? sizes.at(-1)).src;
}

export function createExhibits({ plan, works, renderer, anchors, rig, camera }) {
  const kindOf = (spot) => (works[spot.id].gallery?.length ? KIND_OF[spot.zone] : undefined) ?? 'screen';
  // One template for each kind that has works, and once the works are placed one set of instances.
  const supports = {};
  for (const name of new Set(plan.works.map(kindOf))) {
    const template = createSupport(name);
    template.group.updateMatrixWorld(true);
    const screenMatrix = template.screen.matrixWorld.clone();
    template.group.remove(template.screen);
    const spots = plan.works.filter((spot) => kindOf(spot) === name);
    supports[name] = { name, ...KINDS[name], template, screenMatrix, spots };
  }
  const blank = new THREE.MeshBasicMaterial({ color: '#dce8f5' });
  const object = new THREE.Group();
  let here;
  let light = false;
  const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  const items = plan.works.map((spot, index) => {
    const p = spot.place;
    const y = heightAt(plan, p.x, p.z);
    const kind = supports[kindOf(spot)];
    Object.assign(p, { y, cy: y + kind.middle });
    const yaw = Math.atan2(p.fx, p.fz);
    spot.matrix = new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x, y, p.z);
    const screen = new THREE.Mesh(kind.template.screen.geometry, blank);
    screen.matrixAutoUpdate = false;
    screen.userData.index = index;
    object.add(screen);
    const work = works[spot.id];
    // A plate, as under a picture in a museum: the title, and the logo once the island is near.
    const plate = element('div', { className: 'work-label' }, [element('strong', { textContent: work.title })]);
    const item = { spot, work, kind, slot: kind.spots.indexOf(spot), screen, label: plate, base: yaw, yaw, height: 0, texture: undefined, close: false, plate: false, distance: Infinity };
    const under = new THREE.Vector3(p.x, y + kind.bottom - BORDER - 0.05, p.z);
    anchors.add(plate, under, {
      place: 'below',
      visible: () => item.plate && rig.mode === 'walk',
      // Never wider than the frame as it is seen.
      width: () => (Math.max(kind.width, 1.2) / (2 * item.distance * tanHalf() * camera.aspect)) * innerWidth,
    });
    item.under = under;
    return item;
  });

  for (const kind of Object.values(supports)) kind.set = instances(kind.template.group, kind.spots);
  const drawn = Object.values(supports).flatMap((kind) => kind.set.drawn);
  object.add(...drawn);

  const corner = new THREE.Vector3();
  // behind: a corner of the frame is behind the eyes, where its projection on the screen means nothing.
  function rectOf(item) {
    const xs = [];
    const ys = [];
    let behind = false;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      corner.set((sx * item.kind.width) / 2, (sy * item.kind.height) / 2, 0).applyMatrix4(item.screen.matrix).project(camera);
      behind ||= corner.z > 1;
      xs.push((corner.x * 0.5 + 0.5) * innerWidth);
      ys.push((-corner.y * 0.5 + 0.5) * innerHeight);
    }
    return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), behind };
  }

  function place(item) {
    const { x, y, z } = item.spot.place;
    item.spot.matrix.makeRotationY(item.yaw).setPosition(x, y + item.height, z);
    item.kind.set.set(item.slot, item.spot.matrix);
    item.screen.matrix.multiplyMatrices(item.spot.matrix, item.kind.screenMatrix);
    item.screen.matrixWorldNeedsUpdate = true;
    item.under.y = y + item.height + item.kind.bottom - BORDER - 0.05;
  }
  items.forEach(place);

  // The small cover, built from the 960 one by tools/build-covers.py, and the logo of the plate;
  // asked for once, let go when the island is far.
  function far(item) {
    item.near = true;
    dress(item);
    if (item.far) return Promise.resolve();
    item.farLoading ??= loadTexture(pictureOf(item.work, item.kind.name, 320), renderer).then((texture) => {
      item.farLoading = undefined;
      if (!item.near) return texture.dispose();
      item.far = new THREE.MeshBasicMaterial({ map: texture });
      if (item.texture) return;
      item.screen.material = item.far;
      fadeIn(item.far);
    }, (error) => {
      item.farLoading = undefined;
      console.warn(error);
    });
    return item.farLoading;
  }

  function forget(item) {
    item.near = false;
    release(item);
    if (!item.far) return;
    item.far.map.dispose();
    item.far.dispose();
    item.far = undefined;
    item.screen.material = blank;
  }

  // The logo on the plate. A wide logo already writes the name, so the title goes; a square one is a
  // sign, and the title stays beside it.
  function dress(item) {
    if (item.dressed || !item.work.logo) return;
    item.dressed = true;
    const mark = logo(item.work.logo, { className: 'work-label__logo' });
    // Read as laid out, 40 px high: drawings that give only a viewBox have no natural size.
    mark.addEventListener('load', () => requestAnimationFrame(() => item.label.classList.toggle('has-name', mark.offsetWidth / Math.max(1, mark.offsetHeight) > 1.4)), { once: true });
    item.label.prepend(mark);
  }

  // The near picture, the 960 cover or the upright picture at about 800 px: the stand takes at most
  // about half the screen's height in the park; the work opened closely has its own pictures.
  function load(item) {
    item.wanted = true;
    if (item.texture) return Promise.resolve();
    if (item.loading) return item.loading;
    item.loading = loadTexture(pictureOf(item.work, item.kind.name, 800), renderer).then((texture) => {
      item.loading = undefined;
      if (!item.wanted) return texture.dispose();
      item.texture = texture;
      item.screen.material = new THREE.MeshBasicMaterial({ map: texture });
    }, (error) => {
      item.loading = undefined;
      console.warn(error);
    });
  }

  function release(item) {
    item.wanted = false;
    if (!item.texture) return;
    item.texture.dispose();
    if (item.screen.material !== blank) item.screen.material.dispose();
    item.screen.material = item.far ?? blank;
    item.texture = undefined;
  }

  return {
    object,
    items,
    // One stops before a work, its frame in sight; narrower than half the gap between two works
    // (layout.js, 2.7 m) and the room kept round a thing (world.js, 0.3 m), so that one can stand
    // between two works of the first row to see one of the second.
    solid: plan.works.map((work) => ({ x: work.x, z: work.z, r: 0.9 })),
    // Small covers up to two islands away, large ones on the island one is on and those beside it (on
    // the light way only on the island one is on); further, everything is let go.
    island(island) {
      here = island;
      const count = plan.islands.length;
      const apart = (index) => Math.min(Math.abs(index - island.index), count - Math.abs(index - island.index));
      for (const item of items) {
        const away = apart(item.spot.island);
        if (away > 2) forget(item);
        else {
          far(item);
          if (away <= (light ? 0 : 1)) load(item);
          else release(item);
        }
      }
    },
    light(on) {
      light = on;
      if (here) this.island(here);
    },
    // The small covers of the island of the given index; resolves when they are drawn.
    load: (index) => Promise.all(items.filter((item) => item.spot.island === index).map(far)),
    update(dt, time, state) {
      let nearest;
      const slow = Math.abs(state.speed) < 0.5;
      items.forEach((item) => {
        const { x, z } = item.spot.place;
        item.distance = Math.hypot(camera.position.x - x, camera.position.z - z);
        item.close = item.distance < CLOSE;
        // In front of the eyes, within a narrow look.
        const facing = Math.cos(Math.atan2(z - camera.position.z, x - camera.position.x) - state.heading) > 0.8;
        item.plate = false;
        if (item.close && facing && (!nearest || item.distance < nearest.distance)) nearest = item;
        // The work turns to the eyes when they are near, and back to the path when they go.
        const aim = item.close ? Math.atan2(camera.position.x - x, camera.position.z - z) : item.base;
        const turn = Math.atan2(Math.sin(aim - item.yaw), Math.cos(aim - item.yaw));
        const rise = (item.close ? LIFT : 0) - item.height;
        if (Math.abs(turn) < 0.0005 && Math.abs(rise) < 0.0005) return;
        const k = 1 - Math.exp(-dt / 0.35);
        item.yaw += turn * k;
        item.height += rise * k;
        place(item);
      });
      // Only the work one stands before shows its plate, only standing or slow, and only with its whole
      // frame on the screen.
      if (nearest && nearest.distance < PLATE && slow) {
        const r = rectOf(nearest);
        nearest.plate = r.left >= 0 && r.top >= 0 && r.left + r.width <= innerWidth && r.top + r.height <= innerHeight;
      }
      state.nearest = nearest?.spot;
    },
    targets: [...drawn, ...items.map((item) => item.screen)],
    // The work a hit on one of the targets belongs to.
    spotOf: (hit) => {
      if (!hit.object.isInstancedMesh) return items[hit.object.userData.index].spot;
      const kind = Object.values(supports).find((each) => each.set.drawn.includes(hit.object));
      return kind.spots[kind.set.spotOf(hit)];
    },
    // The rectangle of a work's picture on the screen, in CSS pixels.
    rect: (id) => rectOf(items.find((each) => each.spot.id === id)),
    // The rectangles of the works in sight, their frames and plates included.
    inSight: () => items.filter((item) => item.distance < SIGHT).map((item) => ({ item, r: rectOf(item) })).filter(({ r }) => !r.behind).map(({ item, r }) => ({ left: r.left - 12, top: r.top - 12, width: r.width + 24, height: r.height + 90, spot: item.spot, distance: item.distance })),
    // Where the eyes stand to look at a work: in front of it, as it faces now.
    standing(spot) {
      const item = items.find((each) => each.spot === spot);
      return { ...spot.place, fx: Math.sin(item.yaw), fz: Math.cos(item.yaw) };
    },
    // A stop of the guided visit before a work: square in front of it (as it stands, never behind),
    // far enough for a frame or a screen to take at most 45% of the screen's height and 86% of its
    // width; a phone or a roll-up, upright, whole within 62% of the height, stand and foot included, from
    // far enough that it is not seen from above.
    view(spot) {
      const { x, z, fx, fz, cy } = spot.place;
      const { kind } = items.find((each) => each.spot === spot);
      const fit = (size, share, aspect = 1) => (size + BORDER * 2) / (2 * share * tanHalf() * aspect);
      const tall = kind.image === 'page';
      const away = Math.max(2.6, tall ? fit(kind.bottom + kind.height + 0.1, 0.62) : fit(kind.height, 0.45), fit(kind.width, 0.86, camera.aspect));
      return { x: x + fx * away, z: z + fz * away, look: { x, y: cy + LIFT, z } };
    },
  };
}
