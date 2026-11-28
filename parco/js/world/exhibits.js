// The works standing on the islands: the cover of the work in a thin white frame on two slim legs, its
// middle at eye height, in an arc facing the middle of the island, standing there from the start.
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

// A frame round a picture of the given size with its middle at MIDDLE, on two legs; and the picture.
function createFrame(width, height) {
  const box = (w, h, x, y, d = DEPTH) => new THREE.BoxGeometry(w, h, d).translate(x, y, -d / 2 + 0.01);
  const outer = width + BORDER * 2;
  const bottom = MIDDLE - height / 2;
  const leg = (x) => new THREE.CylinderGeometry(0.025, 0.03, bottom + 0.2, 12).translate(x, (bottom - 0.2) / 2, -0.04);
  const frame = mergeGeometries([
    box(outer, BORDER, 0, MIDDLE + height / 2 + BORDER / 2),
    box(outer, BORDER, 0, bottom - BORDER / 2),
    box(BORDER, height, -width / 2 - BORDER / 2, MIDDLE),
    box(BORDER, height, width / 2 + BORDER / 2, MIDDLE),
    box(width, height, 0, MIDDLE, 0.02).translate(0, 0, -0.03),
    leg(-width * 0.32),
    leg(width * 0.32),
  ].map((geometry) => geometry.toNonIndexed()));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(frame, new THREE.MeshBasicMaterial({ color: '#f2f6fb' })));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: '#dce8f5' }));
  screen.position.set(0, MIDDLE, 0.012);
  group.add(screen);
  return { group, screen };
}

export function createExhibits({ plan, works, renderer, anchors, rig, camera }) {
  const template = createFrame(FRAME.width, FRAME.height);
  template.group.updateMatrixWorld(true);
  const screenMatrix = template.screen.matrixWorld.clone();
  template.group.remove(template.screen);
  const blank = template.screen.material;
  const object = new THREE.Group();
  let here;
  let light = false;
  const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  const items = plan.works.map((spot, index) => {
    const p = spot.place;
    const y = heightAt(plan, p.x, p.z);
    Object.assign(p, { y, cy: y + MIDDLE });
    const yaw = Math.atan2(p.fx, p.fz);
    spot.matrix = new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x, y, p.z);
    const screen = new THREE.Mesh(template.screen.geometry, blank);
    screen.matrixAutoUpdate = false;
    screen.userData.index = index;
    object.add(screen);
    const work = works[spot.id];
    // A plate, as under a picture in a museum: the title, and the logo once the island is near.
    const plate = element('div', { className: 'work-label' }, [element('strong', { textContent: work.title })]);
    const item = { spot, work, screen, label: plate, base: yaw, yaw, height: 0, texture: undefined, close: false, plate: false, distance: Infinity };
    const under = new THREE.Vector3(p.x, y + MIDDLE - FRAME.height / 2 - BORDER - 0.05, p.z);
    anchors.add(plate, under, {
      place: 'below',
      visible: () => item.plate && rig.mode === 'walk',
      // Never wider than the frame as it is seen.
      width: () => (FRAME.width / (2 * item.distance * tanHalf() * camera.aspect)) * innerWidth,
    });
    item.under = under;
    return item;
  });

  const frames = instances(template.group, plan.works);
  object.add(...frames.drawn);

  const corner = new THREE.Vector3();
  function rectOf(item) {
    const xs = [];
    const ys = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      corner.set((sx * FRAME.width) / 2, (sy * FRAME.height) / 2, 0).applyMatrix4(item.screen.matrix).project(camera);
      xs.push((corner.x * 0.5 + 0.5) * innerWidth);
      ys.push((-corner.y * 0.5 + 0.5) * innerHeight);
    }
    return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
  const ahead = new THREE.Vector3();
  const inFront = (item) => {
    camera.getWorldDirection(ahead);
    return (item.spot.place.x - camera.position.x) * ahead.x + (item.spot.place.z - camera.position.z) * ahead.z > 0;
  };

  function place(item, index) {
    const { x, y, z } = item.spot.place;
    item.spot.matrix.makeRotationY(item.yaw).setPosition(x, y + item.height, z);
    frames.set(index, item.spot.matrix);
    item.screen.matrix.multiplyMatrices(item.spot.matrix, screenMatrix);
    item.screen.matrixWorldNeedsUpdate = true;
    item.under.y = y + item.height + MIDDLE - FRAME.height / 2 - BORDER - 0.05;
  }
  items.forEach(place);

  // The cover file with enough pixels for the size the work takes in front of the eyes.
  const wide = () => innerWidth * 0.8 * Math.min(devicePixelRatio, 2) > 960 * 1.1;

  // The small cover, built from the 960 one by tools/build-covers.py, and the logo of the plate;
  // asked for once, let go when the island is far.
  function far(item) {
    item.near = true;
    dress(item);
    if (item.far) return Promise.resolve();
    item.farLoading ??= loadTexture(item.work.cover.srcMobile.replace(/^media\/works\/([^/]+)\/.*$/, 'img/covers/$1.webp'), renderer).then((texture) => {
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

  function load(item) {
    item.wanted = true;
    if (item.texture) return Promise.resolve();
    if (item.loading) return item.loading;
    item.loading = loadTexture(wide() ? item.work.cover.src : item.work.cover.srcMobile, renderer).then((texture) => {
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
    // One stops about a metre before a work, its frame in sight.
    solid: plan.works.map((work) => ({ x: work.x, z: work.z, r: 1.6 })),
    // Small covers up to two islands away, large ones (not on the light way) on the island one is on
    // and those beside it; further, everything is let go.
    island(island) {
      here = island;
      const count = plan.islands.length;
      const apart = (index) => Math.min(Math.abs(index - island.index), count - Math.abs(index - island.index));
      for (const item of items) {
        const away = apart(item.spot.island);
        if (away > 2) forget(item);
        else {
          far(item);
          if (away <= 1 && !light) load(item);
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
      items.forEach((item, index) => {
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
        place(item, index);
      });
      // Only the work one stands before shows its plate, only standing or slow, and only with its whole
      // frame on the screen.
      if (nearest && nearest.distance < PLATE && slow) {
        const r = rectOf(nearest);
        nearest.plate = r.left >= 0 && r.top >= 0 && r.left + r.width <= innerWidth && r.top + r.height <= innerHeight;
      }
      state.nearest = nearest?.spot;
    },
    targets: [...frames.drawn, ...items.map((item) => item.screen)],
    // The work in front showing its plate, if any.
    plated: () => items.find((item) => item.plate)?.spot,
    // The work a hit on one of the targets belongs to.
    spotOf: (hit) => items[hit.object.isInstancedMesh ? frames.spotOf(hit) : hit.object.userData.index].spot,
    // The rectangle of a work's picture on the screen, in CSS pixels.
    rect: (id) => rectOf(items.find((each) => each.spot.id === id)),
    // The rectangles of the works in sight, their frames and plates included.
    inSight: () => items.filter((item) => item.distance < SIGHT && inFront(item)).map((item) => {
      const r = rectOf(item);
      return { left: r.left - 12, top: r.top - 12, width: r.width + 24, height: r.height + 90 };
    }),
    // Where the eyes stand to look at a work: in front of it, as it faces now.
    standing(spot) {
      const item = items.find((each) => each.spot === spot);
      return { ...spot.place, fx: Math.sin(item.yaw), fz: Math.cos(item.yaw) };
    },
  };
}
