// The arrival: the park itself, seen from high in the sky at dawn, under the name. The page is tall
// and scrolls as any page does; where it is scrolled to is the way down of the eyes (descend, in
// js/world/camera.js), followed with a short ease. Almost nothing is on the screen: the sky and the
// sun; two large clouds passing close on the way down; at the fork two things only, the portal of all
// the works on one page and an islet of the park, its tree, path and pond. Until the fork is passed
// the park is not drawn; then it comes out of the haze, little by little, to where the walk begins.
// At the bottom the visit begins; «Indietro» from its first stop climbs back to the fork.
import * as THREE from 'three';
import { descend } from './world/camera.js';
import { SPACE } from './world/sky.js';
import { createSprite } from './world/sprites.js';

// Where the fork is, in shares of the page scrolled; there the eyes slow down.
const FORK = 0.5;
const SLOW = 0.55;
// How quickly the eyes follow the page (per second): within about a tenth of a second.
const EASE = 22;
// The two things of the fork, seen from the eyes there: metres ahead, to the right and down to their
// foot. On a wide screen side by side at the same height; on a tall one the portal above the islet.
const SPOTS = {
  wide: { portal: [16, -4.4, 4.6], islet: [16, 4.4, 4.6] },
  tall: { portal: [21, 0, 1.2], islet: [21, 0, 13] },
};
const PORTAL_HEIGHT = 6;
// The islet: a cloud, on it a round of ground with the peach path and the blue pond of the park, tilted
// towards the eyes at the fork, and one full round tree in the blue lilac of the park's trees (metres,
// radians from level).
const ISLET = { width: 8, tree: 5.2, ground: 2.6, tilt: 0.28 };
const PARK_COLOURS = { ground: '#e9e6f6', path: '#f4a982', pond: '#3f7fd6', tree: '#4c57cc' };
// The far edge of the sea of clouds, as low as it is seen from the eyes (js/world/land.js): its depth and
// reach in metres.
const SEA = { y: -95, reach: 1500 };
// The sky is space at the top, the dawn of the park by the time the park has come out of the haze.
const SPACE_SPAN = [0.25, 0.85];

// The round of ground of the islet, painted once: plaster, the path crossing it, the pond.
function groundOf() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 512, height: 512 });
  const g = canvas.getContext('2d');
  g.fillStyle = PARK_COLOURS.ground;
  g.beginPath();
  g.arc(256, 256, 254, 0, 2 * Math.PI);
  g.fill();
  g.strokeStyle = PARK_COLOURS.path;
  g.lineWidth = 58;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(300, 500);
  g.bezierCurveTo(250, 400, 380, 330, 330, 230);
  g.stroke();
  g.fillStyle = PARK_COLOURS.pond;
  g.beginPath();
  g.ellipse(150, 300, 84, 62, -0.3, 0, 2 * Math.PI);
  g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.CircleGeometry(ISLET.ground, 48), new THREE.MeshBasicMaterial({ map: texture, fog: false, alphaTest: 0.5 }));
}
// The two clouds passing close on the way down: share of the way, metres to the right and ahead of
// the way, height.
const CLOUDS = [[0.24, -13, 4, 13], [0.34, 15, 8, 11]];
// Past the fork the two things fade and the park comes out of the haze.
const FADE = [0.6, 0.7];
const PARK = 0.56;
// The page scrolled for a share of the way down: slower round the fork.
const shareOf = (scrolled) => scrolled + (SLOW * Math.sin(2 * Math.PI * scrolled)) / (2 * Math.PI);
const { smoothstep } = THREE.MathUtils;

// A cut-out faded to a share of itself: drawn see-through while it is not whole.
function fade(material, k) {
  material.opacity = k;
  const through = k < 1;
  if (material.transparent === through) return;
  material.transparent = through;
  material.alphaTest = through ? 0.01 : 0.5;
  material.needsUpdate = true;
}

export function createThreshold(root, { onSound, onArrive }) {
  const name = root.querySelector('.threshold__name');
  const works = root.querySelector('.threshold__lavori');
  const enter = root.querySelector('.threshold__entra');
  const avanti = root.querySelector('.threshold__avanti');
  const sound = root.querySelector('.threshold__sound');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const heard = () => sound.getAttribute('aria-checked') === 'true';

  let world;
  let decor;
  let sun;
  let planets = [];
  // The share of the page scrolled, and of the way down shown; the arrival waits for the eyes to come
  // up a little after «Indietro» before it can happen again.
  let scrolled = 0;
  let shown = 0;
  let armed = true;
  let soundOn = false;
  let warmed = 0;
  let prepared = false;
  let warmedAt = performance.now();
  // In the colours of the screen, so that the programs prepared are those the screen will use.
  const unseen = new THREE.WebGLRenderTarget(1, 1, { colorSpace: THREE.SRGBColorSpace });
  const at = new THREE.Vector3();
  const look = new THREE.Vector3();
  const point = new THREE.Vector3();

  const room = () => root.scrollHeight - root.clientHeight;
  const read = () => {
    scrolled = Math.min(1, Math.max(0, root.scrollTop / (room() || 1)));
  };
  root.addEventListener('scroll', read, { passive: true });
  addEventListener('resize', () => {
    read();
    if (world && !root.hidden) place();
  });

  // «Avanti», the sun and «Entra nel parco» scroll the page softly to a share; a gesture takes it back.
  const scrollTo = (share) => root.scrollTo({ top: share * room(), behavior: still.matches ? 'instant' : 'smooth' });
  const step = () => scrollTo(scrolled < FORK - 0.01 ? FORK : 1);

  // Sound may start only inside a tap or a key: the first one starts it, if it is wanted.
  const wake = () => {
    if (soundOn || !heard()) return;
    soundOn = true;
    onSound(true);
  };

  // A point seen from the eyes at a share of the way down: metres ahead, to the right, and down.
  function from(share, [ahead, right, below], out) {
    const { state } = world;
    descend(state, share, out, look);
    return out.set(out.x + Math.cos(state.heading) * ahead - Math.sin(state.heading) * right, out.y - below, out.z + Math.sin(state.heading) * ahead + Math.cos(state.heading) * right);
  }

  // The two things of the fork and the two clouds, placed along the way down to where the walk begins.
  function place() {
    const spots = SPOTS[innerWidth >= innerHeight ? 'wide' : 'tall'];
    from(FORK, spots.portal, at);
    Object.assign(decor.portal.spots[0], { x: at.x, y: at.y, z: at.z, height: PORTAL_HEIGHT });
    from(FORK, spots.islet, at);
    const base = decor.islet.spots[0];
    Object.assign(base, { x: at.x, y: at.y, z: at.z, height: ISLET.width / decor.islet.aspect });
    // The ground on the cloud, turned up towards where the eyes come from; the tree on its far half.
    const { heading } = world.state;
    const back = { x: Math.cos(heading), z: Math.sin(heading) };
    const ground = decor.ground;
    ground.position.set(at.x, at.y + base.height * 0.5, at.z);
    ground.lookAt(at.x - back.x * Math.sin(ISLET.tilt), ground.position.y + Math.cos(ISLET.tilt), at.z - back.z * Math.sin(ISLET.tilt));
    Object.assign(decor.tree.spots[0], { x: at.x + back.x * 0.7, y: ground.position.y + 0.5, z: at.z + back.z * 0.7, height: ISLET.tree });
    CLOUDS.forEach(([share, right, ahead, height], index) => {
      from(share, [ahead, right, height * 0.45], at);
      Object.assign(decor.clouds.spots[index], { x: at.x, y: at.y, z: at.z, height });
    });
  }

  // A word held under a point of the sky, kept on the screen; seen only within its stretch of the way.
  function hold(node, x, y, z, seen) {
    point.set(x, y, z).project(world.camera);
    const width = node.offsetWidth / 2 + 16;
    const left = Math.min(innerWidth - width, Math.max(width, ((point.x + 1) / 2) * innerWidth));
    const top = Math.min(innerHeight - 120, ((1 - point.y) / 2) * innerHeight);
    node.style.transform = `translate(${left}px, ${top}px) translate(-50%, 0)`;
    const open = point.z < 1 ? seen : 0;
    node.style.opacity = String(open);
    node.style.visibility = open > 0.02 ? 'visible' : '';
    node.inert = open < 0.6;
  }

  // The sun of the sky on the screen, if it is in front.
  const sunOnScreen = () => {
    point.copy(sun.value).multiplyScalar(500).add(world.camera.position).project(world.camera);
    return point.z < 1 ? { x: ((point.x + 1) / 2) * innerWidth, y: ((1 - point.y) / 2) * innerHeight } : undefined;
  };

  // The park drawn once into a target nobody sees, from a little above where the walk begins; the
  // eyes are put back by the rig before the frame is drawn.
  function warm() {
    const { camera, renderer, scene } = world;
    descend(world.state, 0.8, camera.position, look);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    camera.layers.mask = 3;
    renderer.setRenderTarget(unseen);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
  }

  // Each frame of the park while the arrival is on, after the light of the hour is set: the eyes
  // follow the page; before the fork only the sky and the things of the arrival are drawn (layer 1),
  // past it the haze of the hour (light.js) opens from nothing to its own reach, and the planets
  // come in with it. Without motion the way down is three stops, sky, fork, park, the change hidden by
  // a short fade.
  const stopOf = () => (scrolled < 0.3 ? 0 : scrolled < 0.999 ? FORK : 1);
  let fading = false;
  function update(dt) {
    if (still.matches) {
      if (stopOf() !== shown && !fading) {
        fading = true;
        root.classList.add('is-fading');
        setTimeout(() => {
          shown = stopOf();
          root.classList.remove('is-fading');
          fading = false;
        }, 250);
      }
    } else {
      shown += (scrolled - shown) * (1 - Math.exp(-dt * EASE));
      if (Math.abs(scrolled - shown) < 0.0005) shown = scrolled;
    }
    const share = shareOf(shown);
    world.rig.descent = share;
    // While the name is read and nothing moves, the park as it will come out of the haze is drawn
    // unseen a few times, once a second and a half: what it has made since it was ready (the near
    // pictures arrive later) is prepared then, and not in the frame where it first shows.
    if (share < 0.02 && warmed < 4 && performance.now() - warmedAt > 1500) {
      warmed++;
      warmedAt = performance.now();
      warm();
    }
    // Pictures that came later still change programs: on the way to the fork every program the park
    // needs is made in the background.
    if (!prepared && share > 0.3) {
      prepared = true;
      world.renderer.compileAsync(world.scene, world.camera).catch((error) => console.warn(error));
    }
    const park = smoothstep(share, PARK, 1);
    world.camera.layers.mask = park > 0 ? 3 : 2;
    const { fog } = world.scene;
    fog.near *= park;
    fog.far = Math.max(1, fog.far * park * park);
    // The planets are drawn on the arrival's layer too, unseen until the park comes: they arrive late,
    // and so their programs are made up here and not in the frame where they first show.
    for (const planet of planets) {
      planet.layers.enable(1);
      fade(planet.material, park);
    }
    // The two things come out of the haze on the way to the fork, and fade past it.
    const gone = smoothstep(share, 0.28, 0.38) * (1 - smoothstep(share, ...FADE));
    for (const mesh of [decor.portal.mesh, decor.islet.mesh, decor.tree.mesh, decor.ground]) {
      fade(mesh.material, gone);
      mesh.visible = gone > 0;
    }
    // Space up high, the dawn of the park lower down; the horizon (and the glow's soft end under it)
    // only as the park comes out of the haze.
    const sky = world.land.sky.material.uniforms;
    const space = 1 - smoothstep(share, ...SPACE_SPAN);
    sky.uSpace.value = space;
    // The light of the sun is round in space; before the park comes it already fades softly under the
    // far edge of the sea, where the haze's colour (space low down, while space still shows) meets it.
    sky.uCut.value = smoothstep(share, 0.4, PARK);
    sky.uEdge.value = -(world.camera.position.y - SEA.y) / SEA.reach;
    fog.color.lerp(SPACE.low, space);
    if (shown < 0.95) armed = true;
    if (armed && shown >= 0.999) arrive();
  }

  // After the eyes have moved: the name rising away, and the words under the two things of the fork.
  function frame() {
    const share = shareOf(shown);
    const lift = smoothstep(share, 0, 0.1);
    name.style.transform = `translateY(${-lift * 18}vh)`;
    name.style.opacity = String(1 - lift);
    name.style.visibility = lift < 1 ? '' : 'hidden';
    document.documentElement.classList.toggle('is-named', lift >= 1);
    const seen = smoothstep(share, 0.45, 0.49) * (1 - smoothstep(share, 0.56, FADE[0]));
    const { portal, islet } = decor;
    hold(works, portal.spots[0].x, portal.spots[0].y - 1.4, portal.spots[0].z, seen);
    hold(enter, islet.spots[0].x, islet.spots[0].y - 1.4, islet.spots[0].z, seen);
  }

  function arrive() {
    root.hidden = true;
    decor.group.visible = false;
    world.camera.layers.set(0);
    const sky = world.land.sky.material.uniforms;
    sky.uSpace.value = 0;
    sky.uCut.value = 1;
    sky.uEdge.value = -0.07;
    document.documentElement.classList.remove('is-named');
    world.rig.go('walk');
    onArrive();
  }

  // The sun pressed: a wave of light leaves it and the way goes down by itself to the fork. The
  // portal itself opens the page of all the works, as its name under it does.
  function wave(x, y) {
    if (still.matches) return;
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('span');
      ring.className = 'threshold__onda';
      Object.assign(ring.style, { left: `${x}px`, top: `${y}px`, animationDelay: `${i * 0.22}s` });
      ring.addEventListener('animationend', () => ring.remove());
      root.append(ring);
    }
  }
  const nearSun = (x, y) => {
    const spot = sun && scrolled < FORK && sunOnScreen();
    return spot && Math.hypot(spot.x - x, spot.y - y) < 56 ? spot : undefined;
  };
  root.addEventListener('click', (event) => {
    wake();
    if (!world || event.target.closest('a, button')) return;
    const spot = nearSun(event.clientX, event.clientY);
    if (spot) {
      wave(spot.x, spot.y);
      scrollTo(FORK);
    } else if (!works.inert && world.hit(event.clientX, event.clientY, [decor.portal.mesh])) works.click();
    else if (!enter.inert && world.hit(event.clientX, event.clientY, [decor.islet.mesh, decor.tree.mesh, decor.ground])) scrollTo(1);
  });
  root.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') root.classList.toggle('is-over', Boolean(nearSun(event.clientX, event.clientY)));
  }, { passive: true });

  // Space is «Avanti» (with Shift, back up); the arrows and the page keys scroll the page by themselves.
  // On a button or a link Space is its own click; a key the park has taken (the step back from its
  // first stop) is not taken twice.
  addEventListener('keydown', (event) => {
    if (root.hidden || event.defaultPrevented) return;
    wake();
    if (event.key !== ' ' || event.target.closest?.('a, button')) return;
    event.preventDefault();
    if (event.repeat) return;
    if (event.shiftKey) scrollTo(scrolled > FORK + 0.01 ? FORK : 0);
    else step();
  });

  avanti.addEventListener('click', step);
  enter.addEventListener('click', () => scrollTo(1));
  sound.addEventListener('click', () => {
    sound.setAttribute('aria-checked', String(!heard()));
    if (soundOn !== heard()) {
      soundOn = heard();
      onSound(soundOn);
    }
  });

  return {
    // The things of the arrival, made from the pictures of the park, out of the haze and on a layer of
    // their own; resolves when they are drawn.
    prepare(park, pictures) {
      world = park;
      const make = (entry, count = 1) => createSprite(entry, count, { renderer: world.renderer, fog: false });
      decor = { portal: make(pictures.portal), islet: make(pictures.islet), tree: make(pictures.tree), ground: groundOf(), clouds: make(pictures.cloud, CLOUDS.length), group: new THREE.Group() };
      const sprites = [decor.portal, decor.islet, decor.tree, decor.clouds];
      for (const mesh of [...sprites.map((sprite) => sprite.mesh), decor.ground]) {
        mesh.layers.set(1);
        decor.group.add(mesh);
      }
      // The tree in the blue lilac of the park's trees, full.
      decor.tree.tone.uAccent.value.set(...new THREE.Color(PARK_COLOURS.tree).toArray(), 0.95);
      decor.tree.mesh.material.userData.toned = true;
      decor.tree.mesh.material.needsUpdate = true;
      // The sky, and the lights, so that the light of the park is the same before and after the fork
      // (a change of lights would prepare every program of the park again, in one long frame).
      for (const thing of [world.land.sky, world.sky, world.sun]) thing.layers.enable(1);
      sun = world.land.sky.material.uniforms.uSun;
      place();
      world.add({
        object: decor.group,
        update(dt, time, state, camera) {
          if (root.hidden) return;
          planets = world.scene.children.filter((mesh) => mesh.userData.planet);
          update(dt);
          for (const sprite of sprites) sprite.face(camera);
        },
      });
      world.on({
        frame() {
          if (!root.hidden) frame();
        },
      });
      return Promise.all(sprites.map((sprite) => sprite.use('small')));
    },
    // The park is ready: high in the sky, the page may be scrolled.
    ready() {
      world.rig.go('arrive');
      world.start();
      // The light way, if this machine takes it, is in place now: its programs are prepared too, here,
      // and not in the frame where the park first comes out of the haze.
      world.camera.layers.mask = 3;
      world.renderer.compile(world.scene, world.camera);
      read();
      root.classList.add('is-ready');
      root.focus({ preventScroll: true });
    },
    // «Indietro» from the first stop: up from where the walk begins, back to the fork.
    back() {
      root.hidden = false;
      place();
      decor.group.visible = true;
      world.rig.go('arrive');
      root.scrollTop = room();
      read();
      shown = 1;
      armed = false;
      root.focus({ preventScroll: true });
      scrollTo(FORK);
    },
  };
}
