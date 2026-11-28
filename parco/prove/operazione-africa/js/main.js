const SVG = "http://www.w3.org/2000/svg";
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const number = (value) => value.toLocaleString("it-IT", { useGrouping: "always" });
const euro = (value) => number(value) + " €";

const dot = (group, cx, cy, r, className) => {
  const circle = document.createElementNS(SVG, "circle");
  circle.setAttribute("cx", cx.toFixed(2));
  circle.setAttribute("cy", cy.toFixed(2));
  circle.setAttribute("r", r);
  circle.setAttribute("class", className);
  return group.appendChild(circle);
};

const dotRing = (group, { count, radius, center, size, filled, next = -1 }) =>
  Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
    const className = i === next ? "dot-next" : i < filled ? "dot-full" : "dot-empty";
    return dot(group, center + radius * Math.cos(angle), center + radius * Math.sin(angle), size, className);
  });

/* Campaign ring: one dot for each percent of the goal */
const ring = document.querySelector(".ring");
if (ring) {
  const raised = Number(ring.dataset.raised);
  const percent = Math.round((raised / Number(ring.dataset.goal)) * 100);
  const dots = dotRing(ring.querySelector(".ring-dots"), { count: 100, radius: 184, center: 200, size: 4.6, filled: 0, next: percent });
  const counter = ring.querySelector("[data-count]");
  const duration = calm ? 0 : 1800;
  const start = performance.now();

  const frame = (now) => {
    const t = duration ? Math.min(1, (now - start) / duration) : 1;
    const eased = 1 - Math.pow(1 - t, 3);
    const lit = Math.round(percent * eased);
    dots.forEach((item, i) => i < lit && item.setAttribute("class", "dot-full"));
    counter.textContent = number(t === 1 ? raised : Math.round((raised * eased) / 100) * 100);
    if (t < 1) requestAnimationFrame(frame);
    else ring.classList.add("is-filled");
  };
  requestAnimationFrame(frame);
}

/* Step drawings: twelve months, then the gift joining the ring */
const months = document.querySelector(".step-months");
const monthDots = months ? Array.from({ length: 12 }, (_, i) => dot(months, 15 + (i % 4) * 30, 30 + Math.floor(i / 4) * 30, 8, "dot-full")) : [];

const join = document.querySelector(".step-ring");
let mover;
if (join) {
  const slot = dotRing(join, { count: 18, radius: 48, center: 60, size: 5.2, filled: 17 }).at(-1);
  const x = Number(slot.getAttribute("cx"));
  const y = Number(slot.getAttribute("cy"));
  mover = dot(join, x, y, 6.5, "dot-moving");
  mover.style.transform = `translate(${60 - x}px, ${60 - y}px)`;
}

const play = () => {
  monthDots.forEach((item, i) => setTimeout(() => (item.style.opacity = "1"), calm ? 0 : 200 + i * 110));
  if (mover) mover.style.transform = "translate(0, 0)";
};

const steps = document.querySelector(".steps-list");
if (steps && "IntersectionObserver" in window && !calm) {
  monthDots.forEach((item) => (item.style.opacity = "0.25"));
  const watch = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    play();
    watch.disconnect();
  }, { threshold: 0.35 });
  watch.observe(steps);
} else {
  play();
}

/* What the gift becomes: example costs, to be replaced with the real ones */
const things = [
  { cost: 100, one: "un filtro per l'acqua per una famiglia", many: (n) => `${n} filtri per l'acqua, uno per famiglia` },
  { cost: 50, one: "un mese di pasti a scuola per un bambino", many: (n) => `${n} mesi di pasti a scuola per un bambino` },
  { cost: 25, one: "sementi e attrezzi per un orto di famiglia", many: (n) => `sementi e attrezzi per ${n} orti di famiglia` },
  { cost: 10, one: "quaderni e penne per un bambino, per un anno di scuola", many: (n) => `quaderni e penne per ${n} bambini, per un anno di scuola` },
  { cost: 5, one: "metà dei quaderni di un bambino per un anno di scuola" },
];

const describe = (amount) => {
  const parts = [];
  let rest = amount;
  for (const thing of things) {
    const n = Math.floor(rest / thing.cost);
    if (!n) continue;
    parts.push(n === 1 ? thing.one : thing.many(n));
    rest -= n * thing.cost;
    if (parts.length === 2) break;
  }
  return parts.join(", più ");
};

const form = document.querySelector(".give-form");
if (form) {
  const amountOut = form.querySelector(".becomes-amount");
  const thingOut = form.querySelector(".becomes-thing");
  const yearOut = form.querySelector(".becomes-year");
  const other = form.elements.other;

  const update = () => {
    const monthly = form.elements.frequency.value === "monthly";
    const amount = other.value ? Math.floor(Number(other.value)) : Number(form.elements.amount.value);
    if (!(amount >= 5)) {
      amountOut.textContent = euro(5);
      thingOut.textContent = "è la cifra minima per donare";
      yearOut.hidden = true;
      return;
    }
    amountOut.textContent = euro(amount) + (monthly ? " al mese" : "");
    thingOut.textContent = describe(amount);
    yearOut.hidden = !monthly;
    yearOut.textContent = `In un anno fanno ${euro(amount * 12)}: ${describe(amount * 12)}.`;
  };

  form.addEventListener("change", (event) => {
    if (event.target.name === "amount") other.value = "";
    update();
  });
  other.addEventListener("input", () => {
    form.querySelectorAll('[name="amount"]').forEach((input) => (input.checked = false));
    update();
  });
  update();
}

document.querySelectorAll("form").forEach((demo) => demo.addEventListener("submit", (event) => {
  event.preventDefault();
  demo.querySelector(".form-status").hidden = false;
}));
