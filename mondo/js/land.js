import { createDrag, turn } from './drag.js';
import { element, format, playback, reducedMotion, sceneStill, sceneVideo } from './media.js';
import { rings } from './ripples.js';

// Neighbouring places overlap by this share of the screen, where the dunes of one fade into the next.
const SPACING = 0.86;
const LABEL_LEAD = 0.22;
const WHEEL_STEP = 40;

// The land: the opening and the places of the chapters along the dunes, one screen each. The
// visitor travels between them by dragging, with the side buttons, the arrow keys or the wheel.
export function createLand(root, { spots, sound, onEnter, onArrive }) {
  const view = root.querySelector('.land__view');
  const statement = root.querySelector('.statement');
  const hint = root.querySelector('.land__hint');
  const steps = [...root.querySelectorAll('.step')];
  const state = { pos: 0 };
  let index = 0;
  let travel;
  let dragging = false;
  let wheel = 0;
  let width = innerWidth;
  let overhang = 0;

  const nodes = spots.map((spot, position) => {
    const cover = element('div', { className: 'cover' }, [sceneStill(spot.scene)]);
    if (spot.still !== 'always') cover.append(spot.video = sceneVideo(spot.scene));
    const object = element('button', { className: 'spot__object', type: 'button' });
    object.setAttribute('aria-label', spot.title ? `Entra: ${spot.title}` : 'Vai al primo capitolo');
    cover.append(object);
    const scene = element('div', { className: 'spot__scene' }, [cover]);
    const label = spot.title
      ? element('p', { className: 'spot__label' }, [
        element('strong', { textContent: spot.title }),
        element('span', { textContent: spot.note }),
      ])
      : undefined;
    const node = element('div', { className: 'spot' }, label ? [scene, label] : [scene]);
    node.style.zIndex = String(position + 1);
    node.dataset.spot = spot.id;
    view.append(node);
    Object.assign(spot, { node, scene, cover, hit: object, label });

    object.addEventListener('click', (event) => {
      if (position !== index || travel || dragging) return;
      if (!spot.title) return go(1);
      ring(spot);
      sound.play('drop');
      onEnter(spot, { x: event.clientX || innerWidth / 2, y: event.clientY || innerHeight / 2 });
    });
    object.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse' && position === index && !travel && !dragging && spot.title) {
        ring(spot);
        sound.play('drop');
      }
    });
    return node;
  });

  function foot(spot) {
    const [x0, , x1, y1] = spot.object[format()];
    const box = spot.cover.getBoundingClientRect();
    return { x: box.left + ((x0 + x1) / 2) * box.width, y: box.top + y1 * box.height, width: (x1 - x0) * box.width };
  }

  function ring(spot) {
    const { x, y, width: size } = foot(spot);
    rings(x, y, { size: Math.min(innerWidth * 0.95, size * 2.2) });
  }

  // Object boxes and labels follow the cut of the scene; measured again when the screen changes.
  function layout() {
    width = innerWidth;
    for (const spot of spots) {
      const [x0, y0, x1, y1] = spot.object[format()];
      Object.assign(spot.hit.style, { left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` });
      spot.node.style.transform = 'none';
      spot.scene.style.transform = 'none';
    }
    const box = spots[0].cover.getBoundingClientRect();
    overhang = Math.max(0, (box.width - width) / 2) * 0.9;
    for (const spot of spots) {
      if (!spot.label) continue;
      const [x0, y0, x1] = spot.object[format()];
      const cover = spot.cover.getBoundingClientRect();
      const centre = cover.left + ((x0 + x1) / 2) * cover.width;
      const half = spot.label.offsetWidth / 2;
      const gutter = Math.max(20, width * 0.044);
      spot.label.style.left = `${Math.min(width - gutter - half, Math.max(gutter + half, centre))}px`;
      spot.label.style.top = `${Math.max(76, cover.top + y0 * cover.height - spot.label.offsetHeight - 18)}px`;
    }
    render();
  }

  function render() {
    const { pos } = state;
    spots.forEach((spot, position) => {
      const offset = position - pos;
      const near = Math.abs(offset) < 1.5;
      spot.node.style.visibility = near ? '' : 'hidden';
      if (!near) return;
      spot.node.style.transform = `translate3d(${offset * SPACING * width}px, 0, 0)`;
      const shift = -Math.max(-1, Math.min(1, offset)) * overhang;
      spot.scene.style.transform = `translate3d(${shift}px, 0, 0)`;
      if (spot.label) {
        spot.label.style.transform = `translate3d(calc(-50% + ${offset * LABEL_LEAD * width}px), 0, 0)`;
        spot.label.style.opacity = String(Math.max(0, 1 - Math.abs(offset) * 1.6));
      }
    });
    const home = Math.max(0, 1 - Math.abs(pos) * 1.8);
    statement.style.opacity = String(home);
    statement.style.transform = `translate3d(${-pos * 0.3 * width}px, 0, 0)`;
    hint.style.opacity = String(home);
  }

  function settle(quiet = false) {
    travel = undefined;
    spots.forEach((spot, position) => {
      if (spot.video) playback.want(spot.video, position === index && spot.still !== format());
      spot.hit.tabIndex = position === index ? 0 : -1;
      spot.node.toggleAttribute('inert', position !== index);
    });
    for (const step of steps) {
      const target = spots[index + Number(step.dataset.step)];
      step.hidden = !target;
      step.querySelector('.step__name').textContent = target?.title ?? (target ? 'Inizio' : '');
    }
    if (quiet) return;
    if (spots[index].title) {
      ring(spots[index]);
      sound.play('drop');
    }
    onArrive?.(spots[index]);
  }

  function go(direction, { duration } = {}) {
    to(index + direction, { duration });
  }

  function to(target, { duration, instant = false, quiet = false } = {}) {
    const next = Math.max(0, Math.min(spots.length - 1, target));
    const distance = Math.abs(next - state.pos);
    index = next;
    travel?.kill();
    if (instant || reducedMotion.matches || distance < 0.001) {
      state.pos = next;
      render();
      return settle(quiet);
    }
    spots.forEach((spot) => spot.video && playback.want(spot.video, false));
    travel = gsap.to(state, {
      pos: next,
      duration: duration ?? 0.8,
      ease: 'power2.inOut',
      onUpdate: render,
      onComplete: settle,
    });
  }

  createDrag(root, {
    move(dx) {
      travel?.kill();
      travel = undefined;
      dragging = true;
      state.pos = Math.max(-0.25, Math.min(spots.length - 0.75, index - dx / (width * SPACING)));
      render();
    },
    end(dx, velocity) {
      dragging = false;
      to(index + turn(dx, velocity, width), { duration: 0.6 });
    },
  });

  root.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (travel) return;
    wheel += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(wheel) < WHEEL_STEP) return;
    go(Math.sign(wheel));
    wheel = 0;
  }, { passive: false });

  for (const step of steps) {
    step.addEventListener('click', () => {
      sound.play('tap');
      go(Number(step.dataset.step));
    });
  }

  addEventListener('resize', layout);

  return {
    layout,
    go,
    to(id, options) {
      to(spots.findIndex((spot) => spot.id === id), options);
    },
    key(event) {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'Enter' && event.target === document.body && spots[index].title) {
        const { x, y } = foot(spots[index]);
        onEnter(spots[index], { x, y: y - 40 });
      } else return false;
      return true;
    },
    point() {
      const box = spots[index].hit.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    },
    pause() {
      spots.forEach((spot) => spot.video && playback.want(spot.video, false));
    },
    resume: () => settle(),
  };
}
