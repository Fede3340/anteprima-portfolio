import { asset } from './media.js';

// Short sounds, decoded ahead so they play at once.
const SHORT = { drop: 'media/sound/drop.mp3', tap: 'media/sound/tap.mp3', whoosh: 'media/sound/whoosh.mp3' };
// The music and the sound of nature, played as they arrive: they start inside the tap that lets
// sound in, with no wait for the whole file.
const BEDS = { music: 'media/sound/musica-3.mp3', nature: 'media/sound/natura-1.mp3' };
const LEVEL = { drop: 0.7, tap: 0.6, whoosh: 0.7, music: 0.3, nature: 0.18 };
const MASTER = 0.35;
const SWITCH_FADE = 0.4;
const BED_RISE = 0.4;
const BED_FADE = 2;
const ATTACK = 0.012;
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

// Quiet sounds that accompany the visit. The page works the same where Web Audio is missing.
export function createSound(button) {
  const Context = window.AudioContext || window.webkitAudioContext;
  const decoded = {};
  const beds = {};
  let context;
  let master;
  let on = false;
  let lastDrop = -Infinity;

  function ramp(param, value, seconds) {
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }

  // Called inside a tap: browsers only let sound start from one.
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
      for (const [name, file] of Object.entries(SHORT)) {
        fetch(asset(file))
          .then((response) => response.arrayBuffer())
          .then((data) => new Promise((done, fail) => context.decodeAudioData(data, done, fail)))
          .then((buffer) => { decoded[name] = buffer; })
          .catch((error) => console.warn(error));
      }
      // The beds are audio elements fed into the same volume as everything else, asked for in this
      // tap and played as they arrive.
      for (const [name, file] of Object.entries(BEDS)) {
        const bed = { audio: new Audio(asset(file)) };
        bed.audio.loop = true;
        beds[name] = bed;
        bed.gain = context.createGain();
        bed.gain.gain.value = 0;
        // However late it arrives, the bed comes in softly.
        bed.audio.addEventListener('playing', () => ramp(bed.gain.gain, LEVEL[name], BED_FADE), { once: true });
        context.createMediaElementSource(bed.audio).connect(bed.gain);
        bed.gain.connect(master);
      }
    }
    context.resume();
    for (const bed of Object.values(beds)) bed.audio.play().catch((error) => console.warn(error));
    ramp(master.gain, MASTER, BED_RISE);
  }

  function set(value) {
    on = Boolean(value && Context);
    button.setAttribute('aria-checked', String(on));
    button.querySelector('.sound__state').textContent = on ? 'acceso' : 'spento';
    remember(on ? 'on' : 'off');
    if (on) wake();
    else if (context) {
      ramp(master.gain, 0, SWITCH_FADE);
      setTimeout(() => { if (!on) Object.values(beds).forEach((bed) => bed.audio.pause()); }, SWITCH_FADE * 1000);
    }
  }

  button.disabled = !Context;
  button.addEventListener('click', () => set(!on));
  document.addEventListener('visibilitychange', () => {
    if (!context || !on) return;
    if (document.hidden) {
      context.suspend();
      Object.values(beds).forEach((bed) => bed.audio.pause());
    } else {
      context.resume();
      Object.values(beds).forEach((bed) => bed.audio.play().catch(() => {}));
    }
  });

  return {
    // The choice made at the door; sound switched off earlier in this visit stays off.
    begin(wanted) {
      set(wanted && remembered() !== 'off');
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
