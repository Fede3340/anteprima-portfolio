const portrait = window.matchMedia('(max-aspect-ratio: 17/20)');

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export const format = () => (portrait.matches ? 'portrait' : 'landscape');

export const onFormatChange = (listener) => portrait.addEventListener('change', listener);

export function assignScenes() {
  for (const video of document.querySelectorAll('video[data-scene]')) {
    const name = `${video.dataset.scene}-${format()}`;
    video.poster = `img/${name}.webp`;
    video.src = `media/${name}.mp4`;
  }
  document.querySelector('[data-sky]').src = `img/day-sky-${format()}.webp`;
}

// One video decodes at a time: the scene asked for last plays, the others rest on their frame.
export function createPlayback(videos) {
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
      if (on) wanted.push(video);
      sync();
    },
  };
}
