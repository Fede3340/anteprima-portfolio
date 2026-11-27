import { reducedMotion } from './media.js';

const shown = new WeakSet();

const parts = (element) => (element.hasAttribute('data-lines') ? [...element.children] : [element]);
const rise = (index, target) => 0.7 * parseFloat(getComputedStyle(target).fontSize);

// Breaks each [data-lines] text into the lines it wraps to, so that they can enter one by one.
export function splitLines() {
  for (const element of document.querySelectorAll('[data-lines]')) {
    const text = (element.dataset.text ??= element.textContent.trim());
    const words = text.split(' ').map((word) => {
      const span = document.createElement('span');
      span.style.display = 'inline-block';
      span.textContent = word;
      return span;
    });
    element.replaceChildren(...words.flatMap((word, index) => (index ? [' ', word] : [word])));
    const rows = [];
    let top;
    for (const word of words) {
      if (word.offsetTop !== top) rows.push([]);
      top = word.offsetTop;
      rows.at(-1).push(word.textContent);
    }
    element.replaceChildren(...rows.map((row) => {
      const line = document.createElement('span');
      line.className = 'line';
      line.textContent = row.join(' ');
      return line;
    }));
    gsap.set(element.children, { autoAlpha: shown.has(element) ? 1 : 0 });
    element.style.visibility = 'visible';
  }
}

export function show(elements, delay = 0) {
  const fresh = elements.filter((element) => !shown.has(element));
  if (!fresh.length) return;
  fresh.forEach((element) => shown.add(element));
  const still = reducedMotion.matches;
  gsap.fromTo(fresh.flatMap(parts), { autoAlpha: 0, y: still ? 0 : rise }, {
    autoAlpha: 1, y: 0, duration: still ? 0.3 : 1.15, ease: 'power3.out', stagger: still ? 0 : 0.085, delay, overwrite: true,
  });
}

export function hide(elements) {
  const gone = elements.filter((element) => shown.has(element));
  if (!gone.length) return;
  gone.forEach((element) => shown.delete(element));
  gsap.to(gone.flatMap(parts), { autoAlpha: 0, duration: 0.35, ease: 'power1.in', overwrite: true });
}
