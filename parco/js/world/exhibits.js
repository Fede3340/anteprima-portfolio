// The works standing in the park: the cover of the work in a thin white frame on two slim legs, its
// middle at eye height, turned to whoever arrives. Frames are drawn as instances; each cover is a texture only while its zone or a
// zone next to it is the one being walked, and is let go after.
import * as THREE from 'three';
import { element, logo } from '../media.js';
import { loadTexture } from './textures.js';
import { instances } from './instances.js';
import { FRAME, WORK_SIDE, along, ringPoint } from './layout.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

const TURN = THREE.MathUtils.degToRad(55);
const LIFT = 0.08;
const LABEL_NEAR = 2.6;
const NEAR = 8;
const MIDDLE = 1.5;
const BORDER = 0.06;
const DEPTH = 0.05;

// A frame round a picture of the given size with its middle at MIDDLE, on two legs; and the picture.
function createFrame(width, height) {
  const box = (w, h, x, y, d = DEPTH) => new THREE.BoxGeometry(w, h, d).translate(x, y, -d / 2 + 0.01);
  const outer = width + BORDER * 2;
  const bottom = MIDDLE - height / 2;
  const leg = (x) => new THREE.CylinderGeometry(0.025, 0.03, bottom, 12).translate(x, bottom / 2, -0.04);
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

export function createExhibits({ plan, works, renderer, anchors, rig }) {
  const template = createFrame(FRAME.width, FRAME.height);
  template.group.updateMatrixWorld(true);
  const screenMatrix = template.screen.matrixWorld.clone();
  template.group.remove(template.screen);
  const blank = template.screen.material;
  const screenHeight = template.screen.position.y;
  const object = new THREE.Group();

  const items = plan.works.map((spot, index) => {
    const p = ringPoint(plan, spot.s, WORK_SIDE);
    const fx = -p.tx * Math.cos(TURN) - p.nx * Math.sin(TURN);
    const fz = -p.tz * Math.cos(TURN) - p.nz * Math.sin(TURN);
    const yaw = Math.atan2(fx, fz);
    spot.place = { x: p.x, z: p.z, fx, fz, cy: screenHeight };
    Object.assign(spot, { x: p.x, z: p.z });
    spot.matrix = new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x, 0, p.z);
    const screen = new THREE.Mesh(template.screen.geometry, blank);
    screen.matrixAutoUpdate = false;
    screen.userData.index = index;
    object.add(screen);
    const work = works[spot.id];
    const label = element('div', { className: 'work-label' }, [
      element('strong', { textContent: work.title }),
      element('span', { textContent: work.line }),
      ...(work.logo ? [logo(work.logo, { className: 'work-label__logo' })] : []),
    ]);
    const item = { spot, work, screen, yaw, height: 0, texture: undefined, near: false };
    anchors.add(label, new THREE.Vector3(p.x, screenHeight + FRAME.height / 2 + 0.3, p.z), { visible: () => item.near && rig.mode === 'walk' });
    return item;
  });

  const frames = instances(template.group, plan.works);
  object.add(...frames.drawn);

  function place(item, index) {
    const { x, z } = item.spot.place;
    item.spot.matrix.makeRotationY(item.yaw).setPosition(x, item.height, z);
    frames.set(index, item.spot.matrix);
    item.screen.matrix.multiplyMatrices(item.spot.matrix, screenMatrix);
    item.screen.matrixWorldNeedsUpdate = true;
  }
  items.forEach(place);

  // The cover file with enough pixels for the width the work takes on this screen in front of it.
  const wide = () => innerWidth * (innerWidth < innerHeight ? 0.7 : 0.46) * Math.min(devicePixelRatio, 2) > 960 * 1.1;

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
    // Covers for the zone being walked and the two beside it; the others are let go.
    zone(zone) {
      const total = plan.zones.length;
      const wanted = new Set([-1, 0, 1].map((step) => plan.zones[(zone.index + step + total) % total].id));
      items.forEach((item) => (wanted.has(item.spot.zone) ? load(item) : release(item)));
    },
    update(dt, time, state) {
      state.near = [];
      let nearest;
      items.forEach((item, index) => {
        const gap = Math.abs(along(state.s, item.spot.s, plan.length));
        if (gap < NEAR) state.near.push(item.spot);
        item.near = gap < LABEL_NEAR;
        if (item.near && (!nearest || gap < nearest.gap)) nearest = { item, gap };
        const target = item.near ? LIFT : 0;
        if (Math.abs(target - item.height) < 0.001) return;
        item.height += (target - item.height) * Math.min(1, dt * 6);
        place(item, index);
      });
      state.nearest = nearest?.item.spot;
    },
    targets: [...frames.drawn, ...items.map((item) => item.screen)],
    // The work a hit on one of the targets belongs to.
    spotOf: (hit) => items[hit.object.isInstancedMesh ? frames.spotOf(hit) : hit.object.userData.index].spot,
  };
}
