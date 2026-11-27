const portrait = window.matchMedia('(max-aspect-ratio: 17/20)');
const version = document.documentElement.dataset.version;

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export const format = () => (portrait.matches ? 'portrait' : 'landscape');

export const onFormatChange = (listener) => portrait.addEventListener('change', listener);

// Every file the code asks for carries the version of the release, so that a new release is never
// mixed with files kept by the browser from an earlier one.
export const asset = (path) => (path && version ? `${path}?v=${version}` : path);

export const srcset = (value) => value?.split(',').map((entry) => {
  const [path, width] = entry.trim().split(/\s+/);
  return `${asset(path)} ${width}`;
}).join(', ');

// A picture is never drawn more than 10% larger than its own pixels on the screen at hand.
export const limit = (pixels) => `${Math.round((pixels * 1.1) / devicePixelRatio)}px`;

export function sharp(image, node) {
  node.style.setProperty('--max-w', limit(image.w));
  node.style.setProperty('--max-h', limit(image.h));
  return node;
}

export function element(tag, properties = {}, children = []) {
  const node = Object.assign(document.createElement(tag), properties);
  node.append(...children);
  return node;
}

export function picture(image, { className = '', sizes, eager = false } = {}) {
  return element('img', {
    className,
    src: asset(image.src),
    alt: image.alt ?? '',
    width: image.w,
    height: image.h,
    decoding: 'async',
    loading: eager ? 'eager' : 'lazy',
    ...(image.srcset ? { srcset: srcset(image.srcset), sizes: sizes ?? '100vw' } : {}),
  });
}

// A scene gets its poster and its file only when it is first asked for, in the cut that fits the screen.
export function prepare(video) {
  const name = `${video.dataset.scene}-${format()}`;
  if (video.dataset.cut === name) return;
  video.dataset.cut = name;
  video.poster = asset(`img/${name}.webp`);
  video.src = asset(`media/${name}.mp4`);
}

export function recut() {
  for (const video of document.querySelectorAll('video[data-cut]')) prepare(video);
}

export function sceneVideo(scene, className = 'cover__media') {
  const video = element('video', { className, muted: true, playsInline: true, loop: true, preload: 'none' });
  video.dataset.scene = scene;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  return video;
}

export function sceneStill(scene, className = 'cover__media') {
  return element('picture', {}, [
    element('source', { media: '(max-aspect-ratio: 17/20)', srcset: asset(`img/${scene}-portrait.webp`) }),
    element('img', { className, src: asset(`img/${scene}-landscape.webp`), alt: '', decoding: 'async' }),
  ]);
}

// One video decodes at a time: the scene asked for last plays, the others rest on their frame.
export function createPlayback() {
  const videos = new Set();
  const wanted = [];
  const sync = () => {
    const active = reducedMotion.matches ? undefined : wanted.at(-1);
    for (const video of videos) {
      if (video !== active) video.pause();
      // A refused or interrupted play() leaves the poster in place, which is the intended fallback.
      else if (video.paused) video.play().catch(() => {});
    }
  };
  return {
    sync,
    want(video, on) {
      const index = wanted.indexOf(video);
      if (index >= 0) wanted.splice(index, 1);
      videos.add(video);
      if (on) {
        prepare(video);
        wanted.push(video);
      }
      sync();
    },
    forget(video) {
      this.want(video, false);
      videos.delete(video);
    },
  };
}

export const playback = createPlayback();
