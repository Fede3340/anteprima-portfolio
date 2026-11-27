import { card, exhibit } from './exhibits.js';
import { element, format, playback, reducedMotion, sceneStill, sceneVideo } from './media.js';
import { rings } from './ripples.js';
import { HOME, PLACES } from './works.js';

// Lengths along the path, in screen widths.
const LANDMARK = 1;
const GAP = 0.45;
const NEAR = 2.6;
const FAR = 3.6;
const WHEEL = 0.0016;
const EASE = 0.16;
const INTRO = 0.32;
const TAP_TRAVEL = 10;

const phone = () => innerWidth < 768;
const spacing = () => (phone() ? 0.84 : 0.36);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const centreOf = (node) => {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

const FACTS = [
  'Il 16 ottobre pippi.store è passato al sito nuovo, e i 750 indirizzi del negozio di prima portano alle pagine nuove.',
  'Cassa in due passi senza registrazione, carta, PayPal e contrassegno.',
  'Lo studio della conversione prende nove elementi della pagina, ognuno con la sua fonte, e mette in fila 14 ipotesi da provare, ordinate con un punteggio.',
];
const LINKS = [
  ['LinkedIn', 'https://www.linkedin.com/in/federicomascia'],
  ['Instagram', 'https://www.instagram.com/federico__mascia'],
];

// The walk: one path through the park, from the opening to the paper plane. Each chapter starts at
// its sculpture, seen in the scene behind, and its works stand along the path after it. Any gesture
// walks: dragging, the wheel or the trackpad in either direction, the arrow keys.
export function createWalk(root, { data, works, sound, onOpen, onStage }) {
  const backdrops = element('div', { className: 'walk__backdrops' });
  const track = element('div', { className: 'walk__track' });
  const hint = element('p', { className: 'walk__hint', textContent: 'Trascina per camminare' });
  const path = element('nav', { className: 'path', ariaLabel: 'Il sentiero' });
  const dot = element('span', { className: 'path__dot' });
  const statement = root.querySelector('.statement');
  root.append(backdrops, track, hint);
  root.after(path);

  // Where everything stands along the path.
  const stages = [];
  const items = [];
  const views = [];
  let length = 0;

  function plan() {
    stages.length = 0;
    items.length = 0;
    views.length = 0;
    const step = spacing();
    let x = 0;
    for (const place of [HOME, ...PLACES]) {
      const chapter = data.chapters.find((item) => item.id === place.id);
      const start = x;
      const stage = { ...place, start, title: place.title ?? chapter?.title };
      x += LANDMARK;
      const entries = chapter ? chapter.works.map((id) => ({ work: id }))
        : place.id === 'google' ? FACTS.map((fact, index) => ({ fact, index }))
          : place.id === 'contatti' ? [{ links: true }] : [];
      for (const entry of entries) {
        items.push({ ...entry, stage: place.id, x: x + step / 2 });
        x += step;
      }
      x += place.id === 'home' ? 0 : GAP;
      stage.end = x;
      stage.landmark = start + LANDMARK / 2;
      stage.note = chapter ? `${chapter.works.length} ${chapter.works.length === 1 ? 'lavoro' : 'lavori'}` : place.note;
      stages.push(stage);
      views.push({ scene: place.scene, still: place.still, stage, from: start, to: x });
    }
    length = x;
  }

  function buildViews() {
    backdrops.replaceChildren(...views.map((view) => {
      const cover = element('div', { className: 'cover' }, [sceneStill(view.scene)]);
      if (view.still !== 'always') cover.append(view.video = sceneVideo(view.scene));
      const children = [cover];
      if (view.from === view.stage.start && view.stage.title) {
        view.label = element('p', { className: 'landmark' }, [
          element('strong', { textContent: view.stage.title }),
          element('span', { textContent: view.stage.note }),
        ]);
        children.push(view.label);
      }
      view.node = element('div', { className: 'walk__view' }, children);
      return view.node;
    }));
  }

  function buildPath() {
    const named = stages.filter((stage) => stage.title);
    path.replaceChildren(element('span', { className: 'path__line' }, [dot]), ...named.map((stage, index) => {
      const button = element('button', { className: 'path__stop', type: 'button', textContent: stage.title });
      button.dataset.stage = stage.id;
      button.style.left = `${(100 * (index + 0.5)) / named.length}%`;
      return button;
    }));
  }

  // The stops sit evenly on the line of the path, however long each stretch is; the dot moves
  // between two stops in proportion to the stretch between them.
  function along(centre) {
    const marks = stages.filter((item) => item.title).map((item) => item.landmark);
    const next = marks.findIndex((mark) => mark > centre);
    if (next === 0) return (0.5 * clamp((centre - 0.5) / (marks[0] - 0.5), 0, 1)) / marks.length;
    if (next < 0) return (marks.length - 0.5) / marks.length;
    return (next - 0.5 + (centre - marks[next - 1]) / (marks[next] - marks[next - 1])) / marks.length;
  }

  // Camera: the point of the path at the middle of the screen.
  const camera = { at: 0.5, to: 0.5 };
  let width = innerWidth;
  let overhang = 0;
  let frame = 0;
  let glide;
  let stage;
  const built = new Map();

  const build = (item) => {
    if (item.work) return exhibit(works[item.work]);
    if (item.fact) {
      return card([
        element('span', { className: 'exhibit__count', textContent: `${item.index + 1} di ${FACTS.length}` }),
        element('p', { textContent: item.fact }),
        element('button', { className: 'exhibit__more', type: 'button', textContent: 'pippi.store', value: 'pippi-store' }),
      ], 'pippi-store');
    }
    return card([
      element('h2', { className: 'exhibit__title', textContent: 'Scrivimi' }),
      ...LINKS.map(([name, href]) => element('a', { href, target: '_blank', rel: 'noopener', textContent: name })),
    ]);
  };

  function render() {
    const centre = camera.at;
    track.style.transform = `translate3d(${(0.5 - centre) * width}px, 0, 0)`;
    for (const item of items) {
      const near = Math.abs(item.x - centre) < NEAR;
      let node = built.get(item);
      if (near && !node) {
        node = build(item);
        node.style.left = `${item.x * width}px`;
        built.set(item, node);
        track.append(node);
      } else if (node && Math.abs(item.x - centre) > FAR) {
        node.remove();
        built.delete(item);
      }
    }
    let strongest;
    for (const view of views) {
      const fade = clamp((centre - view.from + 0.3) / 0.6, 0, 1) * clamp((view.to - centre + 0.3) / 0.6, 0, 1);
      view.node.style.opacity = String(fade);
      view.node.style.visibility = fade > 0 ? '' : 'hidden';
      if (fade > 0) {
        const progress = clamp((centre - view.from) / Math.max(0.01, view.to - view.from), 0, 1);
        const drift = `${(0.5 - progress) * 2 * overhang}px 0`;
        view.node.firstChild.style.translate = drift;
        if (view.label) view.label.style.translate = drift;
      }
      if (!strongest || fade > strongest.fade) strongest = { view, fade };
    }
    for (const view of views) if (view.video) playback.want(view.video, view === strongest.view && view.still !== format());
    hint.style.opacity = String(clamp(1 - (centre - 0.5 - INTRO) * 3, 0, 1));
    statement.style.translate = `${(0.5 - centre) * width}px 0`;
    statement.style.opacity = String(clamp(1 - (centre - 0.5) * 1.4, 0, 1));
    dot.style.left = `${100 * along(centre)}%`;
    const current = stages.findLast((item) => centre >= item.start - 0.3) ?? stages[0];
    if (current !== stage) {
      stage = current;
      for (const stop of path.querySelectorAll('.path__stop')) stop.toggleAttribute('aria-current', stop.dataset.stage === stage.id);
      onStage?.(stage.id);
    }
  }

  function loop() {
    frame = 0;
    if (glide) return;
    const distance = camera.to - camera.at;
    camera.at = Math.abs(distance) < 0.0005 ? camera.to : camera.at + distance * EASE;
    render();
    if (camera.at !== camera.to) frame = requestAnimationFrame(loop);
  }
  const wake = () => {
    if (!frame) frame = requestAnimationFrame(loop);
  };
  const aim = (value) => {
    glide?.kill();
    glide = undefined;
    camera.to = clamp(value, 0.5, length - 0.5);
    wake();
  };

  // A longer move, to a stop or a work, is one continuous walk.
  function walkTo(value, { instant = false } = {}) {
    glide?.kill();
    const target = clamp(value, 0.5, length - 0.5);
    if (instant || reducedMotion.matches) {
      glide = undefined;
      camera.at = camera.to = target;
      return render();
    }
    const distance = Math.abs(target - camera.at);
    glide = gsap.to(camera, {
      at: target, duration: Math.min(1.6, 0.5 + 0.12 * distance), ease: 'power2.inOut', onUpdate: render,
      onComplete: () => {
        glide = undefined;
        camera.to = camera.at;
      },
    });
  }

  function layout() {
    width = innerWidth;
    const centre = camera.at / (length || 1);
    plan();
    camera.at = camera.to = clamp(centre * length, 0.5, length - 0.5);
    for (const node of built.values()) node.remove();
    built.clear();
    buildViews();
    buildPath();
    overhang = Math.max(0, (backdrops.querySelector('.cover').getBoundingClientRect().width - width) / 2) * 0.9;
    for (const view of views.filter((item) => item.label)) {
      const [x0, y0, x1] = view.stage.object[format()];
      const box = view.node.querySelector('.cover').getBoundingClientRect();
      view.label.style.left = `${box.left + ((x0 + x1) / 2) * box.width}px`;
      view.label.style.top = `${Math.max(84, box.top + y0 * box.height - 96)}px`;
    }
    stage = undefined;
    render();
  }

  // Dragging walks with the finger; letting go keeps a little of its speed.
  let press;
  root.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button) return;
    press = { x: event.clientX, y: event.clientY, at: camera.at, last: event.clientX, time: event.timeStamp, speed: 0, moved: false };
  });
  root.addEventListener('pointermove', (event) => {
    if (!press) return;
    const dx = event.clientX - press.x;
    if (!press.moved && Math.hypot(dx, event.clientY - press.y) < TAP_TRAVEL) return;
    if (!press.moved) root.setPointerCapture(event.pointerId);
    press.moved = true;
    const dt = Math.max(1, event.timeStamp - press.time);
    press.speed = 0.7 * ((event.clientX - press.last) / dt) + 0.3 * press.speed;
    press.last = event.clientX;
    press.time = event.timeStamp;
    glide?.kill();
    glide = undefined;
    camera.at = camera.to = clamp(press.at - dx / width, 0.5, length - 0.5);
    render();
  });
  const release = (event) => {
    if (!press) return;
    const { moved, speed } = press;
    press = undefined;
    if (moved) {
      aim(camera.at - (speed * 260) / width);
      return;
    }
    if (event.type !== 'pointerup') return;
    const target = event.target.closest('[data-work], a');
    if (target?.tagName === 'A') return;
    if (target) {
      sound.play('tap');
      onOpen(target.querySelector('[value]')?.value ?? target.dataset.work, { x: event.clientX, y: event.clientY });
      return;
    }
    rings(event.clientX, event.clientY, { size: Math.min(width * 0.8, 420) });
    sound.play('drop');
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-work]');
    // A click without a pointer before it comes from the keyboard.
    if (target && event.detail === 0) onOpen(target.querySelector('[value]')?.value ?? target.dataset.work, centreOf(target));
  });

  root.addEventListener('wheel', (event) => {
    event.preventDefault();
    aim(camera.to + (event.deltaX + event.deltaY) * WHEEL * (event.deltaMode ? 30 : 1));
  }, { passive: false });

  root.addEventListener('pointerover', (event) => {
    const object = event.target.closest('.exhibit__object');
    if (event.pointerType !== 'mouse' || !object || object.contains(event.relatedTarget)) return;
    const box = object.getBoundingClientRect();
    rings(box.left + box.width / 2, box.bottom, { size: Math.min(box.width * 2.2, 460) });
    sound.play('drop');
  });

  path.addEventListener('click', (event) => {
    const stop = event.target.closest('.path__stop');
    if (!stop) return;
    sound.play('tap');
    walkTo(stages.find((item) => item.id === stop.dataset.stage).landmark);
  });

  // Keys walk from one thing to the next: a sculpture or a work.
  const marks = () => [...stages.map((item) => item.landmark), ...items.map((item) => item.x)].sort((a, b) => a - b);

  addEventListener('resize', () => {
    if (innerWidth !== width) layout();
  });

  plan();
  return {
    layout,
    walkTo,
    start(stageId) {
      if (stageId) return walkTo(stages.find((item) => item.id === stageId)?.landmark ?? 0.5, { instant: true });
      walkTo(0.5, { instant: true });
      setTimeout(() => walkTo(0.5 + INTRO), 500);
    },
    home: () => walkTo(0.5),
    show(id, options) {
      const item = items.find((entry) => entry.work === id);
      if (item) walkTo(item.x, options);
    },
    // After a work has been looked at closely, the walk goes on to the next thing along the path.
    after(id) {
      const index = items.findIndex((entry) => entry.work === id);
      if (index >= 0) walkTo(items[index + 1]?.x ?? items[index].x);
    },
    key(event) {
      const all = marks();
      if (event.key === 'ArrowRight') walkTo(all.find((x) => x > camera.at + 0.05) ?? length);
      else if (event.key === 'ArrowLeft') walkTo(all.findLast((x) => x < camera.at - 0.05) ?? 0.5);
      else return false;
      return true;
    },
  };
}
