const portrait = window.matchMedia('(max-aspect-ratio: 17/20)');

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export const format = () => (portrait.matches ? 'portrait' : 'landscape');

export const onFormatChange = (listener) => portrait.addEventListener('change', listener);

// A scene gets its poster and its file only when it is first asked for, in the cut that fits the screen.
export function prepare(video) {
  const name = `${video.dataset.scene}-${format()}`;
  if (video.dataset.cut === name) return;
  video.dataset.cut = name;
  video.poster = `img/${name}.webp`;
  video.src = `media/${name}.mp4`;
}

export function recut() {
  for (const video of document.querySelectorAll('video[data-cut]')) prepare(video);
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
  };
}
