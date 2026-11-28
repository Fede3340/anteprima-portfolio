const CREAM = "#faeed7";
const COPPER = "#cd7235";

const LEVELS = {
  55: { bg: "#4a2213", bar: "#5a2a16", square: "#6e3a24", wrap: "#34140a", note: "Il più dolce della bottega: su cento grammi, quarantacinque sono zucchero." },
  64: { bg: "#3a170c", bar: "#4a2213", square: "#5a2a16", wrap: "#2a0f07", note: "Rotondo: su cento grammi, trentasei sono zucchero." },
  72: { bg: "#260a06", bar: "#34140a", square: "#462010", wrap: "#1c0704", note: "Il numero del nome: su cento grammi, ventotto sono zucchero." },
  85: { bg: "#1a0604", bar: "#2a0f08", square: "#3a170c", wrap: "#140403", note: "Amaro deciso: su cento grammi, quindici sono zucchero." },
  100: { bg: "#0f0302", bar: "#1f0905", square: "#2e1209", wrap: "#0a0201", note: "Niente zucchero: solo massa di cacao, che a rigore non si chiama più cioccolato." },
};

const FORMATS = [
  { id: "tavoletta", name: "Tavoletta", weight: "80 g", price: 600, extra: "", desc: "La tavoletta da spezzare, quindici quadrati nella carta scura con l’interno color rame." },
  { id: "quadratini", name: "Quadratini", weight: "12 pezzi, 96 g", price: 800, extra: "", desc: "Dodici quadrati incartati uno per uno, da tenere nel cassetto o da regalare." },
  { id: "bottoni", name: "Bottoni da fondere", weight: "250 g", price: 750, extra: "", desc: "Dischi per la cioccolata calda e per la cucina, nel sacchetto che si richiude." },
  { id: "scorze", name: "Scorze d’arancia", weight: "120 g", price: 900, extra: "scorze d’arancia candite", desc: "Scorze d’arancia candite e ricoperte, nella scatola lunga." },
  { id: "fave", name: "Fave ricoperte", weight: "100 g", price: 850, extra: "fave di cacao tostate", desc: "Fave di cacao tostate e ricoperte, nella scatola tonda." },
];

const SHIPPING = 590;
const FREE_FROM = 4000;
const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const $ = (selector, root = document) => root.querySelector(selector);
const cart = new Map();
let level = 72;
let current = null;

const productName = (format, pct) => `${format.name} ${pct}%`;
const findFormat = (id) => FORMATS.find((format) => format.id === id);

const crimp = (x, dir) => {
  let points = `${x + 12 * dir},34 `;
  for (let y = 34, step = 0; y <= 86; y += 4, step++) points += `${x + (step % 2 ? 3 : 0) * dir},${y} `;
  return `<polygon points="${points}${x + 12 * dir},86"/>`;
};

const word = (x, y, size, fill) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="middle" class="art__mark">NERO 72</text>`;

const ART = {
  tavoletta: (pct, c) => `
    <g fill="${c.wrap}">${crimp(14, 1)}${crimp(186, -1)}<rect x="25" y="34" width="150" height="52"/></g>
    <path d="M150 34h25v52h-12z" fill="${COPPER}" opacity=".9"/>
    ${word(92, 64, 21, CREAM)}
    <line x1="99" y1="61" x2="124" y2="51" stroke="${COPPER}" stroke-width="1.3"/>
    <text x="92" y="78" font-size="8" fill="${CREAM}" text-anchor="middle" class="art__small">${pct}% CACAO</text>`,
  quadratini: (pct, c) => {
    let pieces = "";
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 4; col++) {
        const x = 34 + col * 34;
        const y = 21 + row * 27;
        pieces += `<rect x="${x}" y="${y}" width="30" height="23" rx="1.5" fill="${(row + col) % 2 ? CREAM : "#eddcbd"}"/>
          <text x="${x + 15}" y="${y + 16}" font-size="11" fill="${c.wrap}" text-anchor="middle" class="art__mark">${pct}</text>`;
      }
    return `<rect x="28" y="15" width="144" height="93" rx="3" fill="${c.wrap}"/>${pieces}`;
  },
  bottoni: (pct, c) => `
    <circle cx="34" cy="98" r="11" fill="${c.wrap}"/><circle cx="34" cy="98" r="7" fill="none" stroke="${CREAM}" stroke-opacity=".25"/>
    <circle cx="168" cy="96" r="13" fill="${c.wrap}"/><circle cx="168" cy="96" r="8.5" fill="none" stroke="${CREAM}" stroke-opacity=".25"/>
    <path d="M62 10h76l9 102H53z" fill="${c.wrap}"/>
    <line x1="62" y1="21" x2="138" y2="21" stroke="${COPPER}" stroke-width="2"/>
    <rect x="72" y="36" width="56" height="50" fill="${CREAM}"/>
    ${word(100, 56, 13, c.wrap)}
    <text x="100" y="76" font-size="15" fill="${c.wrap}" text-anchor="middle" class="art__mark">${pct}%</text>`,
  scorze: (pct, c) => `
    <rect x="22" y="30" width="156" height="58" fill="${c.wrap}"/>
    <rect x="22" y="48" width="156" height="22" fill="${CREAM}"/>
    <text x="100" y="64" font-size="12" fill="${c.wrap}" text-anchor="middle" class="art__small">SCORZE  ${pct}%</text>
    ${word(56, 42, 11, CREAM)}
    <g transform="rotate(-14 150 104)"><rect x="124" y="98" width="52" height="9" rx="4.5" fill="${c.wrap}"/><rect x="168" y="98" width="8" height="9" rx="4" fill="${COPPER}"/></g>
    <g transform="rotate(8 40 104)"><rect x="18" y="100" width="44" height="8" rx="4" fill="${c.wrap}"/></g>`,
  fave: (pct, c) => `
    <circle cx="96" cy="60" r="50" fill="${c.wrap}"/>
    <circle cx="96" cy="60" r="43" fill="none" stroke="${COPPER}" stroke-width="1.3"/>
    ${word(96, 60, 17, CREAM)}
    <text x="96" y="78" font-size="9" fill="${CREAM}" text-anchor="middle" class="art__small">FAVE  ${pct}%</text>
    <ellipse cx="166" cy="98" rx="11" ry="7" transform="rotate(-25 166 98)" fill="${c.wrap}"/>
    <ellipse cx="180" cy="80" rx="9" ry="6" transform="rotate(30 180 80)" fill="${c.wrap}"/>`,
};

const art = (format, pct) =>
  `<svg viewBox="0 0 200 120" aria-hidden="true" focusable="false">${ART[format.id](pct, LEVELS[pct])}</svg>`;

const ingredients = (format, pct) => {
  const base = pct === 100 ? "massa di cacao" : "massa di cacao, zucchero, burro di cacao";
  return format.extra ? `Ingredienti: ${format.extra}; copertura: ${base}.` : `Ingredienti: ${base}.`;
};

function renderScale() {
  $("[data-scale]").innerHTML = Object.keys(LEVELS)
    .map(
      (pct) => `<label class="scale__item" style="--swatch:${LEVELS[pct].square}">
        <input type="radio" name="pct" value="${pct}" ${+pct === level ? "checked" : ""}>
        <span>${pct}</span></label>`,
    )
    .join("");
}

function renderSlab() {
  const seal = `<div class="sq sq--seal"><p><span class="sq__pct">${level}%</span><span class="sq__of">di cacao</span></p></div>`;
  const squares = FORMATS.map(
    (format) => `<article class="sq" data-format="${format.id}">
      <button class="sq__open" type="button" aria-label="Scheda di ${productName(format, level)}, ${money.format(format.price / 100)}">
        <span class="sq__art">${art(format, level)}</span>
        <span class="sq__name">${format.name}</span>
        <span class="sq__info">${format.weight}</span>
        <span class="sq__price">${money.format(format.price / 100)}</span>
      </button>
      <button class="sq__add" type="button" aria-label="Aggiungi ${productName(format, level)} al carrello">+</button>
    </article>`,
  ).join("");
  $("[data-slab]").innerHTML = seal + squares;
}

function setLevel(pct) {
  level = pct;
  const colors = LEVELS[pct];
  const root = document.documentElement.style;
  root.setProperty("--bg", colors.bg);
  root.setProperty("--slab", colors.bar);
  root.setProperty("--square", colors.square);
  root.setProperty("--wrap", colors.wrap);
  $('meta[name="theme-color"]').content = colors.bg;
  $("[data-note]").textContent = colors.note;
  renderSlab();
}

function crack(square) {
  if (reduceMotion.matches) return;
  const box = square.getBoundingClientRect();
  const place = (node) => {
    Object.assign(node.style, { position: "fixed", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, minHeight: 0, margin: 0, zIndex: 40, pointerEvents: "none" });
    node.setAttribute("aria-hidden", "true");
    document.body.append(node);
    return node;
  };
  const half = (clip, x, y, turn) => {
    const piece = place(square.cloneNode(true));
    piece.inert = true;
    piece.style.visibility = "visible";
    piece.style.clipPath = clip;
    return piece
      .animate(
        [
          { transform: "none", opacity: 1 },
          { transform: "none", opacity: 1, offset: 0.25 },
          { transform: `translate(${x}px, ${y}px) rotate(${turn}deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${x * 1.5}px, ${y * 3}px) rotate(${turn * 1.5}deg)`, opacity: 0 },
        ],
        { duration: 1000, easing: "cubic-bezier(.3,.7,.2,1)" },
      )
      .finished.then(() => piece.remove());
  };
  const line = place(document.createElement("div"));
  line.className = "crackline";
  line.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="68" x2="100" y2="32" pathLength="1"/></svg>';
  line.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: 700 }).finished.then(() => line.remove());

  square.style.visibility = "hidden";
  Promise.all([
    half("polygon(0 0, 100% 0, 100% 32%, 0 68%)", -9, -12, -2.5),
    half("polygon(0 68%, 100% 32%, 100% 100%, 0 100%)", 9, 12, 2.5),
  ]).then(() => {
    square.style.visibility = "";
    square.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: "ease-out" });
  });
}

function add(formatId, qty = 1) {
  const key = `${formatId}-${level}`;
  cart.set(key, (cart.get(key) ?? 0) + qty);
  renderCart();
  const square = $(`.slab [data-format="${formatId}"]`);
  if (square) crack(square);
  const count = $("[data-count]");
  if (!reduceMotion.matches) count.animate([{ transform: "scale(1.5)" }, { transform: "none" }], { duration: 400, delay: 450, easing: "ease-out" });
}

function renderCart() {
  let items = 0;
  let subtotal = 0;
  const lines = [...cart].map(([key, qty]) => {
    const [id, pct] = key.split("-");
    const format = findFormat(id);
    items += qty;
    subtotal += format.price * qty;
    return `<li class="line">
      <span class="line__art">${art(format, +pct)}</span>
      <span class="line__name">${productName(format, pct)}<small>${format.weight}, ${money.format(format.price / 100)} l’uno</small></span>
      <span class="stepper" role="group" aria-label="Quantità di ${productName(format, pct)}">
        <button type="button" data-line="${key}" data-delta="-1" aria-label="Uno in meno">−</button>
        <output>${qty}</output>
        <button type="button" data-line="${key}" data-delta="1" aria-label="Uno in più">+</button>
      </span>
      <span class="line__total">${money.format((format.price * qty) / 100)}</span>
    </li>`;
  });
  const shipping = subtotal === 0 || subtotal >= FREE_FROM ? 0 : SHIPPING;

  $("[data-count]").textContent = items;
  $("[data-lines]").innerHTML = lines.join("");
  $("[data-empty]").hidden = items > 0;
  $("[data-sum]").hidden = items === 0;
  $("[data-pay]").hidden = items === 0;
  $("[data-subtotal]").textContent = money.format(subtotal / 100);
  $("[data-shipping]").textContent = shipping ? money.format(shipping / 100) : "Gratuita";
  $("[data-total]").textContent = money.format((subtotal + shipping) / 100);
  $("[data-free]").textContent =
    items === 0 ? "" : shipping ? `Mancano ${money.format((FREE_FROM - subtotal) / 100)} alla spedizione gratuita.` : "Spedizione gratuita da 40 €: ci sei.";
  $("[data-fake]").textContent = "";
}

function openSheet(dialog) {
  dialog.showModal();
  document.documentElement.classList.add("is-locked");
}

function closeSheet(dialog) {
  if (!dialog.open) return Promise.resolve();
  const done = () => {
    dialog.classList.remove("is-closing");
    dialog.close();
    document.documentElement.classList.remove("is-locked");
  };
  if (reduceMotion.matches) return Promise.resolve(done());
  dialog.classList.add("is-closing");
  return new Promise((resolve) => dialog.addEventListener("animationend", () => resolve(done()), { once: true }));
}

function showProduct(formatId) {
  const format = findFormat(formatId);
  const sheet = $("#scheda");
  current = { format, qty: 1 };
  $("[data-art]", sheet).innerHTML = art(format, level);
  $("[data-title]", sheet).textContent = productName(format, level);
  $("[data-meta]", sheet).textContent = `${level}% di cacao, ${format.weight}`;
  $("[data-desc]", sheet).textContent = format.desc;
  $("[data-ingredients]", sheet).textContent = ingredients(format, level);
  $("[data-price]", sheet).textContent = money.format(format.price / 100);
  $("[data-qty]", sheet).textContent = 1;
  openSheet(sheet);
}

$("[data-scale]").addEventListener("change", (event) => setLevel(+event.target.value));

$("[data-slab]").addEventListener("click", (event) => {
  const square = event.target.closest(".sq[data-format]");
  if (!square) return;
  if (event.target.closest(".sq__add")) add(square.dataset.format);
  else if (event.target.closest(".sq__open")) showProduct(square.dataset.format);
});

$("#scheda").addEventListener("click", (event) => {
  const step = event.target.closest("[data-step]");
  if (step) {
    current.qty = Math.max(1, current.qty + +step.dataset.step);
    $("[data-qty]").textContent = current.qty;
  }
  if (event.target.closest("[data-add-sheet]")) {
    const { format, qty } = current;
    closeSheet($("#scheda")).then(() => add(format.id, qty));
  }
});

$("#carrello").addEventListener("click", (event) => {
  const button = event.target.closest("[data-line]");
  if (button) {
    const key = button.dataset.line;
    const qty = cart.get(key) + +button.dataset.delta;
    if (qty > 0) cart.set(key, qty);
    else cart.delete(key);
    renderCart();
  }
  if (event.target.closest("[data-pay]")) {
    $("[data-fake]").textContent = "Ordine ricevuto, grazie.";
  }
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-close]")) closeSheet(dialog);
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSheet(dialog);
  });
});

$("[data-open-cart]").addEventListener("click", () => openSheet($("#carrello")));

renderScale();
setLevel(level);
renderCart();
