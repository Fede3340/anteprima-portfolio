// The works standing on the islands: the cover of the work in a thin white frame on two slim legs, its
// middle at eye height, in an arc facing the middle of the island. They rise from the floor when their
// island wakes; close to a visitor a work turns to face them and lifts a little, and its plate shows
// under it. Frames are drawn as instances; each cover is a texture only
// while its zone or a zone next to it is in sight, and is let go after.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { element, logo } from '../media.js';
import { instances } from './instances.js';
import { heightAt } from './land.js';
import { FRAME } from './layout.js';
import { loadTexture } from './textures.js';

const LIFT = 0.1;
// How deep a work waits under the floor before its island wakes.
const SUNK = -2.4;
const CLOSE = 9;
const PLATE = 7.5;
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
    // A plate, as under a picture in a museum: the logo and the title.
    const plate = element('div', { className: 'work-label' }, [
      ...(work.logo ? [logo(work.logo, { className: 'work-label__logo' })] : []),
      element('strong', { textContent: work.title }),
    ]);
    // Its turn to rise when its island wakes: one after the other along the arc.
    const order = plan.works.filter((other) => other.island === spot.island).indexOf(spot);
    const item = { spot, work, screen, base: yaw, yaw, height: SUNK, risen: 0, delay: order * 0.12, texture: undefined, close: false, plate: false, distance: Infinity };
    const under = new THREE.Vector3(p.x, y + SUNK + MIDDLE - FRAME.height / 2 - BORDER - 0.05, p.z);
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

  function load(item) {
    item.wanted = true;
    if (item.texture || item.loading) return;
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
    item.screen.material = blank;
    item.texture = undefined;
  }

  return {
    object,
    items,
    // Covers for the island one is on and the two beside it; the others are let go.
    island(island) {
      const count = plan.islands.length;
      const near = (index) => Math.min(Math.abs(index - island.index), count - Math.abs(index - island.index)) <= 1;
      items.forEach((item) => (near(item.spot.island) ? load(item) : release(item)));
    },
    update(dt, time, state) {
      let nearest;
      const slow = Math.abs(state.speed) < 0.5;
      const awake = state.island?.index ?? (state.path ? [state.path.from, state.path.to] : []);
      items.forEach((item, index) => {
        // An island wakes when one is on it or on a path to it: its works rise from its floor.
        const up = [awake].flat().includes(item.spot.island);
        item.wait = up ? (item.wait ?? item.delay) - dt : undefined;
        item.risen += ((up && item.wait <= 0 ? 1 : 0) - item.risen) * (1 - Math.exp(-dt / 0.45));
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
        const rise = (item.close ? LIFT : 0) + SUNK * (1 - item.risen) - item.height;
        if (Math.abs(turn) < 0.0005 && Math.abs(rise) < 0.0005) return;
        const k = 1 - Math.exp(-dt / 0.35);
        item.yaw += turn * k;
        item.height += rise * k;
        place(item, index);
      });
      // Only the work one stands before shows its plate, and only standing or slow.
      if (nearest && nearest.distance < PLATE && slow) nearest.plate = true;
      state.nearest = nearest?.spot;
    },
    targets: [...frames.drawn, ...items.map((item) => item.screen)],
    // The work a hit on one of the targets belongs to.
    spotOf: (hit) => items[hit.object.isInstancedMesh ? frames.spotOf(hit) : hit.object.userData.index].spot,
    // The rectangle of a work's picture on the screen, in CSS pixels.
    rect(id) {
      const item = items.find((each) => each.spot.id === id);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => new THREE.Vector3(sx * FRAME.width / 2, sy * FRAME.height / 2, 0)
        .applyMatrix4(item.screen.matrix).project(camera));
      const xs = corners.map((c) => (c.x * 0.5 + 0.5) * innerWidth);
      const ys = corners.map((c) => (-c.y * 0.5 + 0.5) * innerHeight);
      return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    },
    // Where the eyes stand to look at a work: in front of it, as it faces now.
    standing(spot) {
      const item = items.find((each) => each.spot === spot);
      return { ...spot.place, fx: Math.sin(item.yaw), fz: Math.cos(item.yaw) };
    },
  };
}
