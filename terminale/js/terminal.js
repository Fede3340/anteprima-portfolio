import { banner, bannerMetrics, bannerWidth } from './banner.js';
import { playBoot } from './boot.js';
import { createCalendar } from './calendar.js';
import { portfolio } from './data.js';
import { el, reducedMotion } from './dom.js';
import { createGlyphViewer } from './glyph-viewer.js';
import { details } from './works.js';

const { works, featured, history, snapshots } = portfolio;

const GITHUB = 'https://github.com/Valee8';
const DEMO = 'js-campominato-dom';
// On a phone the demo keeps the screen width: the field shrinks to fit instead of being cut.
const NARROW_DEMO = `@media (max-width: 700px) {
  header { flex-wrap: wrap; gap: 8px; height: auto; padding: 10px 12px; }
  .logo .title { font-size: 1.4rem; }
  main { min-height: 0; padding: 16px 8px; }
  .box { height: auto; aspect-ratio: 1; }
}`;
const NAME = ['VALERIO', 'LOCCI'];
const PAGE_SIZE = 40;
const CARD_HEIGHT = 392;
const COMMANDS = ['aiuto', 'chi', 'lavori', 'apri', 'storia', 'giorno', 'gioca', 'contatti', 'pulisci'];

const byName = new Map(works.map((work) => [work.name, work]));
const commits = Object.entries(history)
  .flatMap(([repo, list]) => list.map(([day, time, sha, message]) => ({ repo, day, time, sha, message })))
  .sort((a, b) => `${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`));
const byDay = Map.groupBy(commits, (commit) => commit.day);
const firstDay = commits[0].day;
const lastDay = commits.at(-1).day;
const days = [];
for (let time = Date.parse(firstDay); time <= Date.parse(lastDay); time += 864e5) {
  const date = new Date(time).toISOString().slice(0, 10);
  days.push({ date, count: byDay.get(date)?.length ?? 0 });
}
const dayIndex = new Map(days.map((day, index) => [day.date, index]));
const mostCommits = Math.max(...works.map((work) => work.commits));

const terminal = document.getElementById('terminal');
const bannerNode = document.getElementById('banner');
const readout = document.getElementById('readout');
const stream = document.getElementById('stream');
const dock = document.getElementById('dock');
const form = document.getElementById('prompt-form');
const input = document.getElementById('command');
const cursor = document.getElementById('cursor');
const pane = document.getElementById('pane');
const paneTitle = document.getElementById('pane-title');
const paneBody = document.getElementById('pane-body');
const paneNote = document.getElementById('pane-note');
const panePrev = document.getElementById('pane-prev');
const paneNext = document.getElementById('pane-next');
const paneReplay = document.getElementById('pane-replay');

const sidePane = matchMedia('(min-width: 1000px)');
const finePointer = matchMedia('(pointer: fine)');

const number = new Intl.NumberFormat('it-IT', { useGrouping: 'always' });
const shortDate = (day) => day.split('-').reverse().join('/');
const longDate = (day, options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('it-IT', options);
const briefDate = (day) => longDate(day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const runButton = (command, label = command, className = 'run') => {
  const button = el('button', className, label);
  button.type = 'button';
  button.dataset.run = command;
  return button;
};

const link = (href, label) => {
  const anchor = el('a', 'link', label);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  return anchor;
};

const text = (content, className = '') => el('p', className, content);
const added = (...content) => el('p', 'row added', el('span', '', '+'), el('span', '', ...content));
const removed = (content) => el('p', 'row removed', el('span', '', '-'), el('span', '', content));
const fact = (label, ...content) => el('p', 'fact', el('span', '', label), el('span', '', ...content));
const hunk = (content) => text(`@@ ${content} @@`, 'hunk');

const bars = (count, most) => {
  const plus = (width) => '+'.repeat(Math.max(1, Math.round((count / most) * width)));
  const bar = el('span', 'bar', el('span', 'bar-long', plus(14)), el('span', 'bar-short', plus(6)));
  bar.setAttribute('aria-hidden', 'true');
  return bar;
};

const commitRow = ({ time, sha, message }, shaNode = el('span', 'sha', sha)) =>
  el('p', 'commit', el('span', '', '+'), el('span', 'date', time), shaNode, el('span', 'message', message));

function pageOf(list, pageArgument) {
  const page = Math.max(1, Number.parseInt(pageArgument, 10) || 1);
  const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { page, slice, shown: (page - 1) * PAGE_SIZE + slice.length };
}

const moreButton = (command, page, shown, total) =>
  runButton(`${command} ${page + 1}`, `altri ${Math.min(PAGE_SIZE, total - shown)}`);

// Commands. Each returns the lines to print.

function chi() {
  const [{ day, time, message }] = commits;
  return [
    added('Valerio Locci, Jr. Full Stack Web Developer, Cagliari'),
    added('primo commit ', el('span', 'date', `${longDate(day)} alle ${time}`), `: «${message}»`),
  ];
}

function workRow(work, withBar) {
  return el('p', 'work',
    runButton(`apri ${work.name}`, `${work.name}/`),
    el('span', 'date', shortDate(work.from)),
    el('span', 'date', shortDate(work.to)),
    el('span', 'count', String(work.commits), el('span', 'unit', ' commit')),
    ...(withBar ? [bars(work.commits, mostCommits)] : []));
}

function lavori(option) {
  const everything = option === '--tutti';
  if (option && !everything) return [removed(`opzione non riconosciuta: ${option}`), text('prova: lavori --tutti', 'dim')];

  const list = everything
    ? [...works].sort((a, b) => a.from.localeCompare(b.from))
    : featured.map((name) => byName.get(name)).sort((a, b) => b.commits - a.commits);
  const head = el('p', 'work head dim',
    el('span', '', 'lavoro'), el('span', '', 'dal'), el('span', '', 'al'), el('span', 'count', 'commit'));
  const foot = everything
    ? text(`${works.length} repository pubblici, ${number.format(commits.length)} commit a nome suo, in ordine di data.`, 'foot dim')
    : el('p', 'foot dim', `${list.length} di ${works.length} repository: `, runButton('lavori --tutti'));

  return [head, ...list.map((work) => workRow(work, !everything)), foot];
}

function unknownWork(name) {
  const close = works.filter((work) => work.name.includes(name)).slice(0, 5);
  const lines = [removed(`nessun repository «${name}»`)];
  if (close.length) {
    lines.push(el('p', 'foot dim', 'forse: ', ...close.flatMap((work, index) =>
      [index ? '  ' : '', runButton(`apri ${work.name}`, work.name)])));
  }
  return lines;
}

function apri(name) {
  if (!name) return [removed('manca il nome'), el('p', 'foot dim', 'per esempio: ', runButton(`apri ${DEMO}`))];
  const work = byName.get(name.replace(/\/$/, ''));
  if (!work) return unknownWork(name);

  const about = details[work.name];
  const lines = [
    el('p', 'name', `${work.name}/`),
    fact('commit', `${work.commits} a nome suo, in ${plural(new Set(history[work.name].map(([day]) => day)).size, 'giorno', 'giorni')}`),
    fact('periodo', el('span', 'date', `${shortDate(work.from)}  ${shortDate(work.to)}`)),
    about
      ? fact('fatto con', about.stack)
      : fact('linguaggi', `${work.languages.join(', ')} (conto di GitHub)`),
    ...(about?.notes ?? []).map((note) => fact('nota', note)),
    fact('codice', link(`${GITHUB}/${work.name}`, `github.com/Valee8/${work.name}`)),
    fact('storia', runButton(`storia ${work.name}`)),
  ];
  if (work.name === DEMO) lines.push(fact('demo', runButton('gioca')));

  if (!work.image) return lines;
  if (sidePane.matches) {
    preview(work, true);
  } else {
    const inline = createGlyphViewer();
    inline.show(work.image, `Schermata di ${work.name}`);
    lines.splice(1, 0, inline.element);
  }
  return lines;
}

function overview() {
  const months = new Map();
  for (const { day } of commits) months.set(day.slice(0, 7), (months.get(day.slice(0, 7)) ?? 0) + 1);
  const busiest = Math.max(...months.values());
  const label = (month) => longDate(`${month}-01`, { month: 'short', year: 'numeric' });
  const plain = { day: 'numeric', month: 'long', year: 'numeric' };

  return [
    hunk(`dal ${longDate(firstDay, plain)} al ${longDate(lastDay, plain)}`),
    ...[...months].map(([month, count]) => el('p', 'month',
      el('span', 'date', label(month)), el('span', 'count', String(count)), bars(count, busiest))),
    text(''),
    added('corso intensivo di 700 ore, da settembre 2022 a marzo 2023'),
    added('progetto di gruppo in cinque, dal 28 febbraio al 24 marzo 2023: 413 commit a nome suo, il numero più alto del gruppo'),
    added('[che cosa fa oggi: lo scrive Valerio]'),
    text(''),
    el('p', 'foot dim', `${number.format(commits.length)} commit a nome suo in ${works.length} repository. Un lavoro alla volta: `, runButton(`storia ${DEMO}`)),
  ];
}

function storia(name, pageArgument) {
  if (!name) return overview();
  const work = byName.get(name.replace(/\/$/, ''));
  if (!work) return unknownWork(name);

  const list = commits.filter((commit) => commit.repo === work.name);
  const { page, slice, shown } = pageOf(list, pageArgument);
  if (!slice.length) return [removed(`${work.name} ha ${list.length} commit: la pagina ${page} non esiste`)];

  const shots = snapshots[work.name];
  const perDay = Map.groupBy(list, (commit) => commit.day);
  const lines = [];
  let current;
  for (const commit of slice) {
    if (commit.day !== current) {
      current = commit.day;
      lines.push(hunk(`${briefDate(current)}, ${perDay.get(current).length} commit`));
    }
    lines.push(commitRow(commit, shots?.[commit.sha] && shotButton(work.name, list.indexOf(commit), commit.sha)));
  }

  if (sidePane.matches && shots) showSnapshot(work.name, list.length - 1);
  else if (sidePane.matches && work.image) preview(work, true);

  lines.push(text(''));
  if (shown < list.length) {
    lines.push(el('p', 'foot dim', `${shown} di ${list.length} commit a nome suo. `, moreButton(`storia ${work.name}`, page, shown, list.length)));
  } else {
    lines.push(el('p', 'foot dim',
      `${list.length} commit in ${plural(perDay.size, 'giorno', 'giorni')}. `,
      shots ? 'Ogni sigla apre il sito a quel commit. ' : '',
      link(`${GITHUB}/${work.name}/commits`, 'su GitHub')));
  }
  return lines;
}

function parseDay(value) {
  const italian = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const day = italian ? `${italian[3]}-${italian[2].padStart(2, '0')}-${italian[1].padStart(2, '0')}` : value;
  return dayIndex.has(day) ? day : null;
}

function giorno(value, pageArgument) {
  if (!value) return [removed('manca la data'), el('p', 'foot dim', 'per esempio: ', runButton(`giorno ${shortDate(firstDay)}`))];
  const day = parseDay(value);
  if (!day) return [removed(`nessun giorno «${value}» tra il ${shortDate(firstDay)} e il ${shortDate(lastDay)}`)];

  const list = byDay.get(day) ?? [];
  if (!list.length) return [hunk(`${longDate(day)}, nessun commit`)];
  const { page, slice, shown } = pageOf(list, pageArgument);
  if (!slice.length) return [removed(`il ${shortDate(day)} ha ${list.length} commit: la pagina ${page} non esiste`)];

  const lines = [hunk(`${longDate(day)}, ${list.length} commit`)];
  let current;
  for (const commit of slice) {
    if (commit.repo !== current) {
      current = commit.repo;
      lines.push(el('p', 'repo', runButton(`apri ${current}`, `${current}/`)));
    }
    lines.push(commitRow(commit));
  }
  if (shown < list.length) {
    lines.push(text(''), el('p', 'foot dim', `${shown} di ${list.length} commit. `, moreButton(`giorno ${shortDate(day)}`, page, shown, list.length)));
  }
  return lines;
}

function shotButton(name, index, sha) {
  const button = el('button', 'run sha', sha);
  button.type = 'button';
  button.dataset.shot = `${name} ${index}`;
  button.setAttribute('aria-label', `${sha}: apri la schermata del sito a questo commit`);
  return button;
}

function gioca() {
  const work = byName.get(DEMO);
  const frame = el('iframe', '');
  frame.src = `demo/${DEMO}/index.html`;
  frame.title = 'Campo minato di Valerio Locci, giocabile';
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    frame.contentWindow.addEventListener('keydown', (event) => event.key === 'Escape' && closePane());
    doc.head.append(Object.assign(doc.createElement('style'), { textContent: NARROW_DEMO }));
    doc.getElementById('play').click();
    fitFrame();
  });
  viewer.hide();
  calendar.mark();
  openPane({ title: [`demo/${DEMO}/`], body: el('div', 'frame', frame), note: 'Sedici bombe.' });
  paneReplay.hidden = false;
  paneReplay.onclick = () => frame.contentWindow.location.reload();
  fitFrame();
  return [
    added(`${DEMO}/ aperto: il suo codice, ${work.commits} commit dal ${shortDate(work.from)} al ${shortDate(work.to)}`),
    el('p', 'foot dim', 'Come ci è arrivato: ', runButton(`storia ${DEMO}`)),
  ];
}

function contatti() {
  return [
    fact('github', link(GITHUB, 'github.com/Valee8')),
    fact('email', '[indirizzo email: lo indica Valerio]'),
    fact('dove', 'Cagliari'),
  ];
}

function aiuto() {
  const rows = [
    ['lavori', `i ${featured.length} lavori con la schermata; con --tutti i ${works.length} repository`],
    ['apri <nome>', 'la schermata vera e il link al codice'],
    ['storia', 'i commit mese per mese'],
    ['storia <nome>', 'i commit di un lavoro, con ora e frase'],
    ['giorno <data>', 'i commit di un giorno, per esempio 21/12/2022'],
    ['gioca', 'il suo campo minato, giocabile'],
    ['chi', 'chi è, in due righe'],
    ['contatti', 'dove trovarlo'],
    ['pulisci', 'svuota lo schermo'],
  ];
  return [
    ...rows.map(([command, meaning]) => el('p', 'help', el('span', 'name', command), el('span', '', meaning))),
    text(''),
    text('Tab completa, le frecce su e giù richiamano i comandi scritti, Esc chiude il riquadro.', 'dim'),
  ];
}

const handlers = { aiuto, chi, lavori, apri, storia, giorno, gioca, contatti };

// Printing

function promptLabel() {
  return el('span', 'prompt',
    el('span', 'user', 'valerio@cagliari'), ' ', el('span', 'path', '~'), ' ', el('span', 'mark', '%'));
}

function print(command, lines, { animate = !reducedMotion.matches } = {}) {
  const entry = el('section', 'entry', el('p', 'echo', promptLabel(), ' ', el('span', 'typed', command)), ...lines);
  stream.append(entry);
  if (animate) reveal(lines);
  return entry;
}

// Lines come out one after the other; long answers in blocks, so the whole answer takes under 300 ms.
function reveal(lines) {
  const block = Math.ceil(lines.length / 10);
  lines.forEach((line, index) => {
    if (line.matches('.viewer')) return;
    line.classList.add('pending');
    setTimeout(() => line.classList.remove('pending'), Math.floor(index / block + 1) * 28);
  });
}

function run(raw) {
  const command = raw.trim().replace(/\s+/g, ' ');
  if (!command) return;
  const [name, ...args] = command.split(' ');
  const key = name.toLowerCase();
  calendar.wave();

  if (key === 'pulisci') {
    stream.replaceChildren();
    return;
  }
  const lines = handlers[key]
    ? handlers[key](...args)
    : [removed(`comando non trovato: ${name}`), el('p', 'foot dim', 'i comandi: ', runButton('aiuto'))];
  const entry = print(command, lines);

  const room = innerHeight - dock.offsetHeight;
  if (entry.offsetHeight > room) entry.scrollIntoView({ block: 'start' });
  else scrollTo(0, document.documentElement.scrollHeight);
}

// Calendar

function showDay(day) {
  readout.replaceChildren(...(day
    ? [el('span', 'date', briefDate(day.date)), `  ${day.count ? plural(day.count, 'commit', 'commit') : 'nessun commit'}`]
    : [`${number.format(commits.length)} commit in ${byDay.size} giorni`]));
}

const calendarCanvas = document.getElementById('calendar');
calendarCanvas.setAttribute('aria-label',
  `Calendario dei commit dal ${longDate(firstDay)} al ${longDate(lastDay)}: ${number.format(commits.length)} commit in ${byDay.size} giorni`);
const calendar = createCalendar({
  canvas: calendarCanvas,
  days,
  onHover: showDay,
  // Beside the terminal an image opens over the quiet months, as many rows as the card needs.
  onLayout({ rowHeight, quiet }) {
    const rows = Math.min(quiet.count, Math.ceil(CARD_HEIGHT / rowHeight));
    pane.style.setProperty('--band-top', `${quiet.first * rowHeight}px`);
    pane.style.setProperty('--band-height', `${rows * rowHeight}px`);
  },
  onPick(day) {
    if ('booting' in terminal.dataset) return;
    showDay(day);
    run(`giorno ${shortDate(day.date)}`);
  },
});

// Side pane: an image opened by a command stays until it is closed, one opened by pointing at a
// work leaves with the pointer.

const viewer = createGlyphViewer();
let pinned = false;
let paneRun = 0;
let leaveTimer = 0;

function openPane({ title, body = viewer.element, note }) {
  paneRun += 1;
  paneTitle.replaceChildren(...title);
  if (paneBody.firstChild !== body) paneBody.replaceChildren(body);
  paneNote.textContent = note;
  pane.classList.toggle('demo', body !== viewer.element);
  if (body !== viewer.element) pane.classList.remove('large');
  panePrev.hidden = true;
  paneNext.hidden = true;
  paneReplay.hidden = true;
  const wasHidden = pane.hidden;
  pane.hidden = false;
  calendar.setIdle(false);
  if (wasHidden && !sidePane.matches) document.getElementById('pane-close').focus();
}

async function closePane() {
  if (pane.hidden) return;
  const token = ++paneRun;
  if (finePointer.matches) input.focus({ preventScroll: true });
  if (paneBody.firstChild === viewer.element) await viewer.hide();
  if (token !== paneRun) return;
  pane.hidden = true;
  pane.classList.remove('large');
  pinned = false;
  paneBody.replaceChildren();
  calendar.mark();
  calendar.setIdle(!reducedMotion.matches);
}

function preview(work, pin) {
  pinned = pin;
  openPane({ title: [`${work.name}/`], note: `stato finale, ${shortDate(work.to)}` });
  calendar.mark(history[work.name].map(([day]) => dayIndex.get(day)));
  viewer.show(work.image, `Schermata di ${work.name}`);
}

function showSnapshot(name, index) {
  const list = commits.filter((commit) => commit.repo === name);
  const { day, time, sha, message } = list[index];
  const step = (button, target) => {
    button.hidden = false;
    button.disabled = target < 0 || target >= list.length;
    button.onclick = () => showSnapshot(name, target);
  };
  pinned = true;
  openPane({
    title: [`${name} `, el('span', 'dim', `@ ${sha}`)],
    note: `${index + 1}/${list.length}  ${longDate(day)}, ${time}  «${message}»`,
  });
  calendar.mark([dayIndex.get(day)]);
  viewer.show(snapshots[name][sha], `${name} al commit ${sha}: ${message}`);
  step(panePrev, index - 1);
  step(paneNext, index + 1);
}

// Beside the terminal the demo keeps its desktop width and is scaled to fit; on a phone it takes
// the screen width and the height of its page.
function fitFrame() {
  const frame = paneBody.querySelector('iframe');
  if (!frame) return;
  if (!sidePane.matches) {
    frame.removeAttribute('style');
    frame.parentElement.removeAttribute('style');
    const page = frame.contentDocument?.body;
    if (page?.querySelector('.box')) frame.style.height = `${page.scrollHeight}px`;
    return;
  }
  const style = getComputedStyle(paneBody);
  const width = paneBody.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = paneBody.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const scale = Math.min(1, width / 760, height / 840);
  frame.style.width = '760px';
  frame.style.height = '840px';
  frame.style.transform = `scale(${scale})`;
  frame.parentElement.style.width = `${760 * scale}px`;
  frame.parentElement.style.height = `${840 * scale}px`;
}

const pointedWork = (target) => {
  const row = sidePane.matches && finePointer.matches && target?.closest?.('.work:not(.head)');
  const work = row && byName.get(row.querySelector('.run').dataset.run.split(' ')[1]);
  return work?.image ? work : null;
};

stream.addEventListener('pointerover', (event) => {
  const work = pointedWork(event.target);
  if (!work || pinned) return;
  clearTimeout(leaveTimer);
  preview(work, false);
});

stream.addEventListener('pointerout', (event) => {
  if (pinned || !pointedWork(event.target) || pointedWork(event.relatedTarget)) return;
  leaveTimer = setTimeout(closePane, 160);
});

// Prompt

const typed = [];
let recall = 0;
let idleTimer;

function syncCursor() {
  const column = input.selectionStart ?? input.value.length;
  cursor.textContent = input.value[column] ?? ' ';
  cursor.style.setProperty('--col', column);
  cursor.style.setProperty('--scroll', `${input.scrollLeft}px`);
  cursor.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => cursor.classList.add('idle'), 600);
}

function setInput(value) {
  input.value = value;
  input.setSelectionRange(value.length, value.length);
  syncCursor();
}

function commonPrefix(words) {
  let prefix = words[0];
  for (const word of words) {
    while (!word.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

function complete() {
  const value = input.value.replace(/^\s+/, '');
  const parts = value.split(/\s+/);
  const takesName = ['apri', 'storia'].includes(parts[0]) && parts.length === 2;
  if (parts.length > 1 && !takesName) return;

  const partial = parts.at(-1);
  const pool = takesName ? [...featured, ...works.map((work) => work.name)] : COMMANDS;
  const matches = [...new Set(pool.filter((word) => word.startsWith(partial)))];
  if (!matches.length) return;

  const head = takesName ? `${parts[0]} ` : '';
  if (matches.length === 1) {
    setInput(head + matches[0] + (!takesName && ['apri', 'storia', 'giorno'].includes(matches[0]) ? ' ' : ''));
    return;
  }
  const prefix = commonPrefix(matches);
  if (prefix.length > partial.length) setInput(head + prefix);
  else print(value, [text(matches.join('  '), 'dim')], { animate: false });
}

input.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && input.value.trim() && !event.shiftKey) {
    event.preventDefault();
    complete();
  } else if (event.key === 'ArrowUp' && recall > 0) {
    event.preventDefault();
    recall -= 1;
    setInput(typed[recall]);
  } else if (event.key === 'ArrowDown' && recall < typed.length) {
    event.preventDefault();
    recall += 1;
    setInput(typed[recall] ?? '');
  } else if (event.key.toLowerCase() === 'l' && event.ctrlKey) {
    event.preventDefault();
    run('pulisci');
  }
});

for (const type of ['input', 'keyup', 'click', 'focus', 'select', 'scroll']) {
  input.addEventListener(type, syncCursor);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const command = input.value;
  if (command.trim()) typed.push(command.trim());
  recall = typed.length;
  setInput('');
  run(command);
});

document.addEventListener('pointerdown', (event) => {
  const key = event.target.closest('.keys button, .pane-actions button');
  if (!key) return;
  key.classList.add('pressed');
  setTimeout(() => key.classList.remove('pressed'), 180);
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-run]');
  if (button) {
    run(button.dataset.run);
    if (finePointer.matches) input.focus({ preventScroll: true });
    return;
  }
  const shot = event.target.closest('[data-shot]');
  if (shot) {
    const [name, index] = shot.dataset.shot.split(' ');
    showSnapshot(name, Number(index));
    return;
  }
  const plainArea = !event.target.closest('a, button, input, img, .pane');
  if (plainArea && finePointer.matches && getSelection().isCollapsed) input.focus({ preventScroll: true });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePane();
  const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
  if (printable && event.key !== ' ' && event.target !== input) input.focus({ preventScroll: true });
});

document.getElementById('pane-close').addEventListener('click', closePane);
// Beside the terminal a click on an opened image shows it over the whole screen, a second click puts it back.
paneBody.addEventListener('click', (event) => {
  if (!sidePane.matches || !event.target.closest('.viewer')) return;
  pinned = true;
  pane.classList.toggle('large');
});
new ResizeObserver(fitFrame).observe(paneBody);

// The name, set in half blocks: on one line where it fits, on two where it does not.

let nameLines = [];
let nameMetrics;

function fitName() {
  const width = bannerNode.clientWidth;
  const wide = Math.floor(width / bannerWidth([NAME.join(' ')]));
  const words = wide >= 6 ? [NAME.join(' ')] : NAME;
  nameMetrics = bannerMetrics(wide >= 6 ? Math.min(wide, 12) : Math.min(Math.floor(width / bannerWidth(NAME)), 10));
  nameLines = banner(words);
  bannerNode.style.fontSize = `${nameMetrics.fontSize}px`;
  bannerNode.style.lineHeight = `${nameMetrics.lineHeight}px`;
  bannerNode.textContent = nameLines.join('\n');
}

function printName() {
  nameLines.forEach((_, last) => {
    setTimeout(() => {
      bannerNode.textContent = nameLines.map((line, row) => (row <= last ? line : '')).join('\n');
    }, last * 38);
  });
}

// Arrival

function arrive(filmed) {
  delete terminal.dataset.booting;
  calendar.reveal(days.length);
  showDay(null);
  print('lavori', lavori(), { animate: filmed });
  syncCursor();
  if (finePointer.matches) input.focus({ preventScroll: true });
  if (sidePane.matches && finePointer.matches) {
    for (const name of featured) new Image().src = byName.get(name).image;
  }
  if (!filmed) return;
  printName();
  calendar.wave();
  calendar.setIdle(true);
}

async function boot() {
  fitName();
  addEventListener('resize', fitName);
  if (reducedMotion.matches) {
    arrive(false);
    return;
  }

  const canvas = document.getElementById('boot');
  canvas.hidden = false;
  scrollTo(0, 0);
  calendar.reveal(0);
  const bounds = bannerNode.getBoundingClientRect();
  const film = playBoot({
    canvas,
    commits,
    place: { left: bounds.left, top: bounds.top, ...nameMetrics },
    onCount: (count) => calendar.reveal(dayIndex.get(commits[count - 1].day) + 1),
  });
  addEventListener('click', film.finish);
  addEventListener('keydown', film.finish);
  await film.done;
  removeEventListener('click', film.finish);
  removeEventListener('keydown', film.finish);
  canvas.remove();
  arrive(true);
}

document.fonts.load('16px "Commit Mono"').then(boot);
