const [MUSIC, NATURE] = ['musica-1', 'natura-1'];
const FILES = {
  drop: 'media/sound/drop.mp3',
  tap: 'media/sound/tap.mp3',
  whoosh: 'media/sound/whoosh.mp3',
  music: `media/sound/${MUSIC}.mp3`,
  nature: `media/sound/${NATURE}.mp3`,
};
const LEVEL = { drop: 0.7, tap: 0.6, whoosh: 0.7, music: 0.3, nature: 0.18 };
const BEDS = ['music', 'nature'];
const MASTER = 0.35;
const SWITCH_FADE = 0.5;
const BED_RISE = 2;
const ATTACK = 0.012;
// Each bed has a quarter of a second of margin at each end, left out of the loop.
const BED_EDGE = 0.25;
const DROP_GAP = 0.15;
const KEY = 'sound';

const remembered = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const remember = (value) => {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // Private windows may refuse storage: the choice then lasts as long as the page.
  }
};

// Quiet sounds that accompany the visit. Nothing is downloaded until sound is turned on, and the
// page works the same where Web Audio is missing.
export function createSound(button) {
  const Context = window.AudioContext || window.webkitAudioContext;
  const buffers = {};
  const decoded = {};
  let context;
  let master;
  const beds = new Set();
  let bedsAllowed = false;
  let on = false;
  let lastDrop = -Infinity;

  const load = (name) => (buffers[name] ??= fetch(FILES[name])
    .then((response) => response.arrayBuffer())
    .then((data) => new Promise((done, fail) => context.decodeAudioData(data, done, fail)))
    .then((buffer) => {
      decoded[name] = buffer;
      return buffer;
    }));

  function ramp(param, value, seconds) {
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }

  // The two beds, music and nature, loop under everything and rise in over two seconds.
  async function startBed(name) {
    if (beds.has(name) || !bedsAllowed || !on) return;
    beds.add(name);
    const buffer = await load(name);
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = BED_EDGE;
    source.loopEnd = buffer.duration - BED_EDGE;
    source.connect(gain);
    source.start(0, BED_EDGE);
    ramp(gain.gain, LEVEL[name], BED_RISE);
  }

  // Called inside a tap: browsers only let a sound context start from one.
  function wake() {
    if (!context) {
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
      } catch {
        // Without an audio session the device's own rules apply.
      }
      context = new Context();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      Object.keys(FILES).filter((name) => !BEDS.includes(name)).forEach((name) => load(name).catch((error) => console.warn(error)));
    }
    context.resume();
    BEDS.forEach((name) => startBed(name).catch((error) => console.warn(error)));
    ramp(master.gain, MASTER, SWITCH_FADE);
  }

  function set(value) {
    on = Boolean(value && Context);
    button.setAttribute('aria-checked', String(on));
    button.querySelector('.sound__state').textContent = on ? 'acceso' : 'spento';
    remember(on ? 'on' : 'off');
    if (on) wake();
    else if (context) ramp(master.gain, 0, SWITCH_FADE);
  }

  button.disabled = !Context;
  button.addEventListener('click', () => set(!on));
  document.addEventListener('visibilitychange', () => {
    if (!context || !on) return;
    if (document.hidden) context.suspend();
    else context.resume();
  });

  return {
    // The choice made at the door; sound switched off earlier in this visit stays off.
    begin(wanted) {
      set(wanted && remembered() !== 'off');
    },
    // The beds weigh some megabytes: they are fetched once the path can be used, and only with sound on.
    allowBeds() {
      bedsAllowed = true;
      if (on) BEDS.forEach((name) => startBed(name).catch((error) => console.warn(error)));
    },
    play(name) {
      if (!on || !decoded[name] || context.state !== 'running') return false;
      if (name === 'drop') {
        if (context.currentTime - lastDrop < DROP_GAP) return false;
        lastDrop = context.currentTime;
      }
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(master);
      const source = context.createBufferSource();
      source.buffer = decoded[name];
      source.connect(gain);
      source.start();
      ramp(gain.gain, LEVEL[name], ATTACK);
      return true;
    },
  };
}
