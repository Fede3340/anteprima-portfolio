// Getting anywhere at once. The bar at the foot says where one is and steps to the place before and
// after, in the order of the walk; «I mondi» shows the ten places on the orbit of the day and finds
// any work by its words. A jump goes through a ring of light that closes and opens again.
// Keys: Q and E before and after, 1 to 9 and 0 the places, F search, Tab «I mondi», Esc closes.
import { asset, element, reducedMotion } from './media.js';

const version = document.documentElement.dataset.version;
const main = await import(`./main.js?v=${version}`);
const $ = (selector, root = document) => root.querySelector(selector);

// The sky of each hour from the pictures of dawn, full day and blue hour: top, middle, horizon.
const HOURS = {
  dawn: ['#81adf7', '#ddb8cf', '#dcb6cd'],
  day: ['#0d63e0', '#4eb5fd', '#67d2fd'],
  blue: ['#20358c', '#8d7bd9', '#cf8cce'],
};
// The hour of each island along the walk, and how far it has gone towards the next hour.
const DAY = {
  ingresso: ['dawn'], siti: ['dawn', 'day', 0.3], negozi: ['day'], programmi: ['day'], app: ['day'],
  videogioco: ['day', 'blue', 0.3], marchi: ['day', 'blue', 0.7], manifesti: ['blue'], google: ['blue'], contatti: ['blue'],
};
// The sculpture of each island, from img/sprites; the others have one with their own name.
const SCULPTURE = { ingresso: 'apertura' };
const CLOSE_MS = 260;
const OPEN_MS = 320;

const mix = (a, b, k) => `#${[1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')}`;
const fold = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const counted = (n) => (n === 1 ? '1 lavoro' : `${n} lavori`);

async function start(root) {
  const { world, plan } = main;
  const data = await fetch(`data/works.json?v=${version}`).then((response) => response.json());
  const titles = Object.fromEntries(data.chapters.map((chapter) => [chapter.id, chapter.title]));

  const places = plan.islands.map((island, index) => {
    const [from, to, k = 0] = DAY[island.id];
    const sky = HOURS[from].map((colour, i) => (to ? mix(colour, HOURS[to][i], k) : colour));
    const zone = island.zones[0];
    return { island, index, id: zone.id, title: zone.title, works: island.zones.flatMap((each) => each.works.map((work) => work.id)), sky, key: String((index + 1) % 10) };
  });
  const placeOf = (id) => places.find((place) => place.island.id === id || place.island.zones.some((zone) => zone.id === id));
  const works = places.flatMap((place) => place.works.map((id) => {
    const work = data.works[id];
    const kind = titles[place.id] ?? place.title;
    return { id, place, work, kind, title: fold(work.title), words: fold(`${work.title} ${work.line ?? ''} ${kind} ${work.tag ?? ''}`) };
  }));

  // The bar.
  const kbd = (key) => element('kbd', { className: 'travel__key', textContent: key, ariaHidden: 'true' });
  const prev = element('button', { type: 'button', className: 'travel__step travel__step--prev' }, [kbd('Q'), element('span', { className: 'travel__arrow', textContent: '‹', ariaHidden: 'true' }), element('span', { className: 'travel__to' })]);
  const next = element('button', { type: 'button', className: 'travel__step travel__step--next' }, [element('span', { className: 'travel__to' }), element('span', { className: 'travel__arrow', textContent: '›', ariaHidden: 'true' }), kbd('E')]);
  const here = element('button', { type: 'button', className: 'travel__here' }, [
    element('span', { className: 'travel__dot', ariaHidden: 'true' }),
    element('span', { className: 'travel__name' }),
    element('span', { className: 'travel__worlds-label', textContent: 'I mondi' }),
    kbd('Tab'),
  ]);
  prev.setAttribute('aria-keyshortcuts', 'Q');
  next.setAttribute('aria-keyshortcuts', 'E');
  here.setAttribute('aria-keyshortcuts', 'Tab');
  here.setAttribute('aria-haspopup', 'dialog');
  const bar = element('nav', { className: 'travel__bar', ariaLabel: 'Tipi di lavoro', hidden: true }, [prev, here, next]);

  // «I mondi»: the places on the orbit, the search beside them.
  const focusName = element('strong', { className: 'travel__focus-name' });
  const focusMeta = element('span', { className: 'travel__focus-meta' });
  const path = element('div', { className: 'travel__path', ariaHidden: 'true' });
  // The orbit is the day: each place in the colour of its hour, night between the last and the first.
  path.style.background = `conic-gradient(${places.map((place, i) => `${place.sky[1]} ${i * 36}deg`).join(', ')}, ${HOURS.blue[0]} 342deg, ${places[0].sky[1]} 360deg)`;
  const planets = places.map((place) => {
    const button = element('button', { type: 'button', className: 'travel__planet' }, [
      element('span', { className: 'travel__globe', ariaHidden: 'true' }, [
        element('img', { src: asset(`img/sprites-light/${SCULPTURE[place.island.id] ?? place.island.id}.webp`), alt: '', decoding: 'async' }),
        place.works.length ? element('span', { className: 'travel__moon', textContent: place.works.length }) : '',
      ]),
      element('span', { className: 'travel__label', textContent: place.title }),
      place.works.length ? element('span', { className: 'travel__hidden', textContent: `, ${counted(place.works.length)}` }) : '',
    ]);
    button.style.setProperty('--a', `${place.index * 36 - 90}deg`);
    button.style.setProperty('--top', place.sky[0]);
    button.style.setProperty('--mid', place.sky[1]);
    button.style.setProperty('--low', place.sky[2]);
    button.setAttribute('aria-keyshortcuts', place.key);
    button.addEventListener('click', (event) => go(place, event));
    button.addEventListener('pointerenter', () => choose(place));
    button.addEventListener('focus', () => choose(place));
    return element('li', {}, [button]);
  });
  const orbit = element('div', { className: 'travel__orbit' }, [
    path,
    element('p', { className: 'travel__focus' }, [focusName, focusMeta]),
    element('ol', { className: 'travel__planets', ariaLabel: 'I dieci mondi, nell’ordine del cammino' }, planets),
  ]);

  const input = element('input', { type: 'search', id: 'travel-search', className: 'travel__input', placeholder: 'Titolo, cliente o tipo', autocomplete: 'off', spellcheck: false, enterKeyHint: 'go' });
  input.setAttribute('aria-controls', 'travel-results');
  const status = element('p', { className: 'travel__status', role: 'status' });
  const rows = works.map((entry) => {
    const button = element('button', { type: 'button', className: 'travel__work' }, [
      element('img', { src: asset(entry.work.cover.srcThumb ?? entry.work.cover.srcMobile), alt: '', width: 72, height: 45, loading: 'lazy', decoding: 'async' }),
      element('span', { className: 'travel__work-title', textContent: entry.work.title }),
      element('span', { className: 'travel__work-kind', textContent: entry.kind }),
    ]);
    button.addEventListener('click', () => openWork(entry));
    entry.row = element('li', { hidden: true }, [button]);
    return entry.row;
  });
  const list = element('ul', { id: 'travel-results', className: 'travel__results', ariaLabel: 'Lavori' }, rows);
  const search = element('div', { className: 'travel__search', role: 'search' }, [
    element('label', { className: 'travel__title', htmlFor: 'travel-search', textContent: 'Cerca un lavoro' }),
    element('div', { className: 'travel__field' }, [input, kbd('F')]),
    status,
    list,
  ]);

  const shut = element('button', { type: 'button', className: 'travel__close', textContent: 'Chiudi' });
  shut.setAttribute('aria-keyshortcuts', 'Escape');
  const legend = element('p', { className: 'travel__legend', ariaHidden: 'true' }, [
    kbd('Q'), kbd('E'), ' prima e dopo, ', kbd('1'), '…', kbd('0'), ' i mondi, ', kbd('F'), ' cerca',
  ]);
  const sheet = element('div', { className: 'travel__sheet' }, [
    element('div', { className: 'travel__head' }, [element('h2', { className: 'travel__title', id: 'travel-title', textContent: 'I mondi' }), legend, shut]),
    orbit,
    search,
  ]);
  const scrim = element('div', { className: 'travel__scrim' });
  const panel = element('div', { className: 'travel__panel', role: 'dialog', ariaModal: 'true', hidden: true }, [scrim, sheet]);
  panel.setAttribute('aria-labelledby', 'travel-title');

  const ring = element('span', { className: 'travel__ring' });
  const portal = element('div', { className: 'travel__portal', ariaHidden: 'true', hidden: true }, [ring]);
  const said = element('p', { className: 'travel__hidden', role: 'status' });
  root.append(bar, panel, portal, said);

  let current;
  let chosen;
  let opener;
  let jumping = false;

  const story = () => !$('.story').hidden;
  const currentPlace = () => places[world.here().index];
  const step = (way) => places[(currentPlace().index + way + places.length) % places.length];

  function show() {
    const place = currentPlace();
    if (place === current) return;
    current = place;
    const before = step(-1);
    const after = step(1);
    $('.travel__name', here).textContent = place.title;
    here.style.setProperty('--mid', place.sky[1]);
    here.setAttribute('aria-label', `I mondi. Sei a ${place.title}`);
    $('.travel__to', prev).textContent = before.title;
    $('.travel__to', next).textContent = after.title;
    prev.setAttribute('aria-label', `Indietro a ${before.title}`);
    next.setAttribute('aria-label', `Avanti a ${after.title}`);
    for (const [i, item] of planets.entries()) {
      const button = item.firstChild;
      if (places[i] === place) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    }
  }

  // The place shown in the middle of the orbit, and its works in the list while nothing is written.
  function choose(place) {
    chosen = place;
    focusName.textContent = place.title;
    focusMeta.textContent = [place.works.length ? counted(place.works.length) : '', place === current ? 'Sei qui' : ''].filter(Boolean).join(', ');
    if (!input.value.trim()) filter();
  }

  function filter() {
    const words = fold(input.value).split(/\s+/).filter(Boolean);
    // A place without works shows them all.
    const empty = !chosen.works.length;
    let found = works.filter((entry) => (words.length ? words.every((word) => entry.words.includes(word)) : empty || entry.place === chosen));
    // Titles that hold the first word come first.
    if (words.length) found = [...found.filter((entry) => entry.title.includes(words[0])), ...found.filter((entry) => !entry.title.includes(words[0]))];
    for (const entry of works) entry.row.hidden = !found.includes(entry);
    for (const entry of found) list.append(entry.row);
    if (words.length) status.textContent = found.length ? `${counted(found.length)} per «${input.value.trim()}»` : `Nessun lavoro per «${input.value.trim()}»`;
    else status.textContent = empty ? `In ${chosen.title} non ci sono lavori: ecco tutti i ${found.length}.` : `${chosen.title}, ${counted(found.length)}`;
    panel.classList.toggle('is-searching', words.length > 0);
  }
  input.addEventListener('input', filter);

  function openPanel(withSearch) {
    if (jumping || story() || bar.hidden) return;
    if (panel.hidden) {
      opener = document.activeElement;
      world.controls.unlock();
      world.controls.stop();
      world.stop();
      show();
      choose(current);
      panel.hidden = false;
    }
    if (withSearch) input.focus();
    else planets[current.index].firstChild.focus();
  }

  // Closing gives the mouse back to the park; a click or a key allows it, Esc does not, and then the
  // park asks for a click. With no capture to take back (a phone), nothing happens.
  function closePanel(keepFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    input.value = '';
    panel.classList.remove('is-searching');
    if (keepFocus && bar.contains(opener)) opener.focus();
    else document.activeElement?.blur();
    world.controls.lock();
  }

  // The ring of light closes on the place one leaves, the eyes move, it opens on the new one.
  async function jump(place) {
    if (jumping || story()) return;
    jumping = true;
    if (world.rig.mode === 'above') $('.above').click();
    portal.style.setProperty('--top', place.sky[0]);
    portal.style.setProperty('--low', place.sky[2]);
    portal.hidden = false;
    const still = reducedMotion.matches;
    const timing = (duration, easing) => ({ duration: still ? 150 : duration, easing, fill: 'forwards' });
    const play = (frames, duration, easing) => [
      portal.animate({ opacity: frames.veil }, timing(duration, easing)),
      ...(still ? [] : [ring.animate({ transform: frames.ring.map((s) => `scale(${s})`), opacity: frames.glow }, timing(duration, easing))]),
    ];
    await Promise.all(play({ veil: [0, 1], ring: [1, 0.02], glow: [0, 1] }, CLOSE_MS, 'cubic-bezier(0.55, 0, 0.8, 0.4)').map((a) => a.finished));
    world.place(place.island);
    show();
    await new Promise((done) => requestAnimationFrame(done));
    const opening = play({ veil: [1, 0], ring: [0.02, 1], glow: [1, 0] }, OPEN_MS, 'cubic-bezier(0.2, 0.6, 0.35, 1)');
    await Promise.all(opening.map((a) => a.finished));
    for (const animation of opening) animation.cancel();
    portal.hidden = true;
    jumping = false;
    said.textContent = `Sei a ${place.title}`;
    document.dispatchEvent(new CustomEvent('travel:arrived', { detail: { zone: place.id } }));
  }

  // A place chosen by click or key: the panel closes and the mouse is taken back in the same gesture.
  // Without a gesture (a portal of the park) the capture is left as it is.
  function go(place, event) {
    closePanel(false);
    if (event?.type === 'click') event.currentTarget.blur();
    if (event) world.controls.lock();
    if (place !== currentPlace()) jump(place);
  }

  async function openWork(entry) {
    panel.hidden = true;
    input.value = '';
    document.activeElement?.blur();
    if (entry.place !== currentPlace()) await jump(entry.place);
    location.hash = `#lavoro/${entry.id}`;
  }

  prev.addEventListener('click', (event) => go(step(-1), event));
  next.addEventListener('click', (event) => go(step(1), event));
  here.addEventListener('click', () => openPanel(false));
  shut.addEventListener('click', () => closePanel(true));
  scrim.addEventListener('click', () => closePanel(false));
  document.addEventListener('travel:open', () => openPanel(false));
  document.addEventListener('travel:jump', (event) => {
    const place = placeOf(event.detail?.zone);
    if (place) go(place);
  });

  // Moves the focus among the given buttons with the arrows, and keeps Tab inside the panel.
  const among = (buttons, from, way) => buttons[(buttons.indexOf(from) + way + buttons.length) % buttons.length]?.focus();
  const shown = () => rows.filter((row) => !row.hidden).map((row) => row.firstChild);
  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // Listened before the park: while the panel is open no key reaches it.
  addEventListener('keydown', (event) => {
    if (bar.hidden || story() || event.ctrlKey || event.metaKey || event.altKey) return;
    const open = !panel.hidden;
    const { key, target } = event;
    if (open) event.stopPropagation();
    if (key === 'Escape') {
      if (open) closePanel(true);
      return;
    }
    if (key === 'Tab') {
      if (open) {
        const all = [...sheet.querySelectorAll('button, input')].filter((each) => each.offsetParent);
        const at = all.indexOf(target);
        if (at === -1 || (event.shiftKey && at === 0) || (!event.shiftKey && at === all.length - 1)) {
          stop(event);
          all.at(event.shiftKey ? -1 : 0).focus();
        }
      } else if (!target.closest?.('a, button, input, .list')) {
        stop(event);
        openPanel(false);
      }
      return;
    }
    if (target === input) {
      if (key === 'ArrowDown') {
        stop(event);
        shown()[0]?.focus();
      } else if (key === 'Enter' && input.value.trim() && shown()[0]) {
        stop(event);
        shown()[0].click();
      }
      return;
    }
    if (event.repeat) return;
    const lower = key.toLowerCase();
    const planet = target.closest?.('.travel__planet');
    const work = target.closest?.('.travel__work');
    if (lower === 'q' || lower === 'e') {
      stop(event);
      go(step(lower === 'q' ? -1 : 1), event);
    } else if (lower === 'f') {
      stop(event);
      openPanel(true);
    } else if (/^\d$/.test(key)) {
      stop(event);
      go(places[(Number(key) + 9) % 10], event);
    } else if (planet && /^Arrow/.test(key)) {
      stop(event);
      among(planets.map((item) => item.firstChild), planet, key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1);
    } else if (work && (key === 'ArrowDown' || key === 'ArrowUp')) {
      stop(event);
      const all = shown();
      if (key === 'ArrowUp' && all[0] === work) input.focus();
      else among(all, work, key === 'ArrowUp' ? -1 : 1);
    }
  }, true);

  // The bar follows where one is, every frame of the park; it appears once the door is passed.
  world.add({ update: show });
  show();
  const door = $('.threshold');
  const reveal = () => {
    if (!door.hidden) return false;
    bar.hidden = false;
    return true;
  };
  if (!reveal()) {
    const watch = new MutationObserver(() => reveal() && watch.disconnect());
    watch.observe(door, { attributes: true, attributeFilter: ['hidden'] });
  }
}

const root = document.querySelector('.travel');
if (main.world && root) await start(root);
