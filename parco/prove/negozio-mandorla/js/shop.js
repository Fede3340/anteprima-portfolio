"use strict";

const SWEETS = [
  {
    id: "amaretti", name: "Amaretti", price: 90,
    text: "Mandorle dolci con qualche mandorla amara, albume e zucchero.",
    allergens: "mandorle, uova",
  },
  {
    id: "gueffus", name: "Gueffus", price: 100,
    text: "Palline di pasta di mandorle passate nello zucchero, incartate come caramelle nella carta velina tagliata a denti.",
    allergens: "mandorle",
  },
  {
    id: "pabassinas", name: "Pabassinas", price: 80,
    text: "Biscotti a rombo con uvetta, mandorle e noci, coperti di glassa e confettini argentati.",
    allergens: "glutine, uova, mandorle, noci",
  },
  {
    id: "pistoccheddus", name: "Pistoccheddus de cappa", price: 130,
    text: "Biscotti di Pasqua sotto la «cappa», la glassa bianca, che qui ricamiamo a pizzo.",
    allergens: "glutine, uova",
  },
  {
    id: "pardulas", name: "Pardulas", price: 160,
    text: "Cestini di pasta sottile con ricotta e zafferano, spolverati di zucchero a velo.",
    allergens: "glutine, latte, uova",
  },
  {
    id: "candelaus", name: "Candelaus", price: 150,
    text: "Pasta di mandorle modellata a scarpetta, ripiena di mandorle, glassata con lo zucchero cotto e decorata con la ghiaccia reale.",
    allergens: "mandorle, uova",
  },
  {
    id: "bianchini", name: "Bianchini", price: 70,
    text: "Piccole piramidi bianche come meringhe, montate con zucchero, limone e mandorle, e confettini sopra.",
    allergens: "uova, mandorle",
  },
  {
    id: "tiliccas", name: "Tiliccas", price: 120,
    text: "Sfoglia sottile chiusa a ferro di cavallo su un ripieno di mandorle e miele.",
    allergens: "glutine, mandorle",
  },
];

const LAYOUTS = { 6: [3, 2], 12: [4, 3], 24: [6, 4] };
const SHIPPING = 790;
const FREE_FROM = 4900;
const byId = Object.fromEntries(SWEETS.map((s) => [s.id, s]));
const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const euro = (cents) => money.format(cents / 100);
const calm = matchMedia("(prefers-reduced-motion: reduce)");

const $ = (selector, root = document) => root.querySelector(selector);
const icon = (id) => `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const tray = {
  size: 12,
  slots: Array(12).fill(null),
  closed: false,
};

const cart = [];

const live = $("[data-live]");
const say = (text) => {
  live.textContent = "";
  requestAnimationFrame(() => { live.textContent = text; });
};

const filled = () => tray.slots.filter(Boolean);
const priceOf = (items) => items.reduce((sum, id) => sum + byId[id].price, 0);

const describe = (items) => {
  const counts = {};
  items.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  return SWEETS.filter((s) => counts[s.id]).map((s) => `${s.name} × ${counts[s.id]}`).join(", ");
};

function buildTray(root, { size, slots, interactive, closed }) {
  const [cols] = LAYOUTS[size];
  root.style.setProperty("--cols", cols);
  root.classList.toggle("is-closed", Boolean(closed));
  const cells = slots.map((id, index) => {
    const piece = id ? `<span class="piece">${icon(`d-${id}`)}</span>` : "";
    const label = id ? `${byId[id].name}, posto ${index + 1}: tocca per toglierlo` : `Posto ${index + 1} vuoto`;
    return interactive
      ? `<button class="cell" type="button" data-slot="${index}" aria-label="${label}" ${id ? "" : "disabled"}>${icon("cup")}${piece}</button>`
      : `<span class="cell">${icon("cup")}${piece}</span>`;
  }).join("");
  root.innerHTML = `
    <div class="tray-paper"><div class="tray-grid">${cells}</div></div>
    <div class="lid"><span class="lid-ribbon"></span><span class="seal"><img src="img/mark.png" alt="" width="668" height="1043"></span></div>`;
}

const trayRoot = $("[data-tray]");
const addButton = $("[data-tray-add]");
const clearButton = $("[data-tray-clear]");
const openButton = $("[data-tray-open]");
const sweetsList = $("[data-sweets]");

function renderTray() {
  buildTray(trayRoot, { size: tray.size, slots: tray.slots, interactive: true, closed: tray.closed });
  trayRoot.setAttribute("aria-label", `Vassoio da ${tray.size}`);
  updateStatus();
}

function updateStatus() {
  const count = filled().length;
  const left = tray.size - count;
  $("[data-tray-count]").textContent = left === 0
    ? `Pieno: ${tray.size} dolci su ${tray.size}`
    : `${count} su ${tray.size} · ${left === 1 ? "resta 1 posto" : `restano ${left} posti`}`;
  $("[data-tray-price]").textContent = euro(priceOf(filled()));
  addButton.disabled = !tray.closed;
  addButton.textContent = tray.closed ? "Metti nel carrello" : (count === 0 ? "Tocca un dolce dal banco" : `Mancano ${plural(left, "dolce", "dolci")}`);
  clearButton.hidden = count === 0 || tray.closed;
  openButton.hidden = !tray.closed;
  sweetsList.querySelectorAll("[data-sweet]").forEach((row) => {
    const n = tray.slots.filter((id) => id === row.dataset.sweet).length;
    const badge = $(".sweet-count", row);
    badge.textContent = n ? `nel vassoio: ${n}` : "";
    row.setAttribute("aria-disabled", String(tray.closed || left === 0));
  });
}

function fly(fromEl, toEl, id) {
  if (calm.matches || !fromEl || !toEl) return Promise.resolve();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const ghost = document.createElement("span");
  ghost.className = "ghost";
  ghost.innerHTML = icon(`d-${id}`);
  Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const scale = (b.width * 0.82) / a.width;
  const lift = Math.min(80, Math.abs(dy) * 0.25 + 30);
  const run = ghost.animate([
    { transform: "translate(0, 0) scale(1)" },
    { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - lift}px) scale(${(1 + scale) / 2})`, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
  ], { duration: 520, easing: "cubic-bezier(.3,.6,.25,1)" });
  return run.finished.then(() => ghost.remove());
}

async function place(id, fromEl) {
  if (tray.closed) return;
  const index = tray.slots.indexOf(null);
  if (index === -1) return;
  tray.slots[index] = id;
  const isFull = !tray.slots.includes(null);
  if (isFull) tray.closed = true;
  const target = trayRoot.querySelector(`[data-slot="${index}"]`);
  const sweetName = byId[id].name;
  const flight = fly(fromEl, target, id);
  buildTray(trayRoot, { size: tray.size, slots: tray.slots, interactive: true, closed: false });
  const piece = $(`[data-slot="${index}"] .piece`, trayRoot);
  if (!calm.matches) piece.style.opacity = "0";
  updateStatus();
  addButton.disabled = true;
  await flight;
  piece.style.opacity = "";
  if (isFull) {
    requestAnimationFrame(() => trayRoot.classList.add("is-closed"));
    addButton.disabled = false;
    say(`${sweetName} nel vassoio. Il vassoio è pieno e si chiude col bollino: ${euro(priceOf(filled()))}.`);
  } else {
    say(`${sweetName} nel vassoio. ${$("[data-tray-count]").textContent}.`);
  }
}

function removeAt(index) {
  if (tray.closed || !tray.slots[index]) return;
  const name = byId[tray.slots[index]].name;
  tray.slots[index] = null;
  renderTray();
  const next = trayRoot.querySelector(".cell:not([disabled])");
  (next || $(".sweet", sweetsList)).focus();
  say(`${name} tolto dal vassoio.`);
}

function setSize(size) {
  const kept = filled().slice(0, size);
  const dropped = filled().length - kept.length;
  tray.size = size;
  tray.slots = Array(size).fill(null).map((_, i) => kept[i] || null);
  tray.closed = kept.length === size;
  renderTray();
  say(`Vassoio da ${size}.${dropped ? ` ${plural(dropped, "dolce è tornato", "dolci sono tornati")} sul banco.` : ""}`);
}

function renderSweets() {
  sweetsList.innerHTML = SWEETS.map((s) => `
    <li>
      <button class="sweet" type="button" data-sweet="${s.id}" aria-describedby="sweet-${s.id}">
        <span class="sweet-figure">${icon("doily")}<span class="sweet-piece">${icon(`d-${s.id}`)}</span></span>
        <span class="sweet-body">
          <span class="sweet-name">${s.name}</span>
          <span class="sweet-text" id="sweet-${s.id}">${s.text} <span class="sweet-allergens">Contiene ${s.allergens}.</span></span>
          <span class="sweet-meta"><span class="sweet-price">${euro(s.price)} al pezzo</span><span class="sweet-count"></span></span>
        </span>
      </button>
    </li>`).join("");
}

/* Cart */
const cartEl = $("#cart");
const scrim = $("[data-scrim]");
const toggle = $(".cart-toggle");
let lastFocus = null;

function cartTotals() {
  const items = cart.reduce((sum, line) => sum + priceOf(line.items) * line.qty, 0);
  const ship = items === 0 || items >= FREE_FROM ? 0 : SHIPPING;
  return { items, ship, sum: items + ship };
}

function renderCart() {
  const lines = $("[data-cart-lines]");
  lines.innerHTML = cart.map((line, i) => `
    <li class="line">
      <div class="line-tray tray tray--mini" data-mini="${i}" aria-hidden="true"></div>
      <div class="line-body">
        <h3>Vassoio da ${line.size}</h3>
        <p class="line-desc">${describe(line.items)}</p>
        <div class="line-row">
          <div class="stepper" role="group" aria-label="Quantità del vassoio da ${line.size}">
            <button type="button" data-step="-1" data-line="${i}" aria-label="Uno in meno">−</button>
            <output aria-live="off">${line.qty}</output>
            <button type="button" data-step="1" data-line="${i}" aria-label="Uno in più" ${line.qty >= 9 ? "disabled" : ""}>+</button>
          </div>
          <p class="line-price">${euro(priceOf(line.items) * line.qty)}</p>
        </div>
        <button class="link" type="button" data-remove="${i}">Togli</button>
      </div>
    </li>`).join("");
  cart.forEach((line, i) => buildTray($(`[data-mini="${i}"]`, lines), { size: line.size, slots: line.items, interactive: false }));

  const { items, ship, sum } = cartTotals();
  const count = cart.reduce((n, line) => n + line.qty, 0);
  $("[data-cart-count]").textContent = count;
  toggle.setAttribute("aria-label", `Carrello, ${plural(count, "vassoio", "vassoi")}`);
  $("[data-cart-empty]").hidden = cart.length > 0;
  $("[data-cart-foot]").hidden = cart.length === 0;
  $("[data-total-items]").textContent = euro(items);
  $("[data-total-ship]").textContent = ship === 0 ? "gratis" : euro(ship);
  $("[data-total-sum]").textContent = euro(sum);
  $("[data-cart-free]").textContent = items < FREE_FROM && items > 0
    ? `Mancano ${euro(FREE_FROM - items)} alla spedizione gratis.` : "";
  $("[data-cart-note]").textContent = "Pagamento finto: niente viene addebitato.";
}

function openCart() {
  lastFocus = document.activeElement;
  cartEl.hidden = false;
  scrim.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  document.documentElement.classList.add("has-cart");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    cartEl.classList.add("is-open");
    scrim.classList.add("is-open");
  }));
  $("[data-cart-close]").focus({ preventScroll: true });
}

function closeCart() {
  cartEl.classList.remove("is-open");
  scrim.classList.remove("is-open");
  toggle.setAttribute("aria-expanded", "false");
  document.documentElement.classList.remove("has-cart");
  const done = () => { cartEl.hidden = true; scrim.hidden = true; };
  if (calm.matches) done(); else setTimeout(done, 320);
  if (lastFocus) lastFocus.focus({ preventScroll: true });
}

function addToCart() {
  if (!tray.closed) return;
  const items = tray.slots.slice();
  const key = `${tray.size}:${items.slice().sort().join(",")}`;
  const same = cart.find((line) => line.key === key);
  if (same) same.qty = Math.min(9, same.qty + 1);
  else cart.push({ key, size: tray.size, items, qty: 1 });
  tray.slots = Array(tray.size).fill(null);
  tray.closed = false;
  renderTray();
  renderCart();
  openCart();
}

/* Events */
sweetsList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-sweet]");
  if (!row) return;
  if (tray.closed) { say("Il vassoio è chiuso. Riaprilo per cambiare i dolci."); return; }
  place(row.dataset.sweet, $(".sweet-piece", row));
});

trayRoot.addEventListener("click", (event) => {
  const cell = event.target.closest("[data-slot]");
  if (cell) removeAt(Number(cell.dataset.slot));
});

document.querySelectorAll("input[name=size]").forEach((input) => {
  input.addEventListener("change", () => setSize(Number(input.value)));
});

addButton.addEventListener("click", addToCart);
clearButton.addEventListener("click", () => {
  tray.slots = Array(tray.size).fill(null);
  renderTray();
  say("Vassoio svuotato.");
});
openButton.addEventListener("click", () => {
  const last = tray.slots.length - 1 - [...tray.slots].reverse().findIndex(Boolean);
  tray.closed = false;
  tray.slots[last] = null;
  renderTray();
  say("Vassoio riaperto: l’ultimo dolce è tornato sul banco.");
});

toggle.addEventListener("click", openCart);
$("[data-cart-close]").addEventListener("click", closeCart);
scrim.addEventListener("click", closeCart);

cartEl.addEventListener("click", (event) => {
  const step = event.target.closest("[data-step]");
  const remove = event.target.closest("[data-remove]");
  if (step) {
    const line = cart[Number(step.dataset.line)];
    line.qty = Math.max(1, Math.min(9, line.qty + Number(step.dataset.step)));
    renderCart();
    $(`[data-line="${step.dataset.line}"][data-step="${step.dataset.step}"]`, cartEl)?.focus();
  }
  if (remove) {
    cart.splice(Number(remove.dataset.remove), 1);
    renderCart();
    $("[data-cart-close]").focus();
    say("Vassoio tolto dal carrello.");
  }
  if (event.target.closest("[data-cart-pay]")) {
    $("[data-cart-note]").textContent = "Questo negozio è un concept: il pagamento è finto e nessun ordine parte.";
  }
});

document.addEventListener("keydown", (event) => {
  if (cartEl.hidden) return;
  if (event.key === "Escape") closeCart();
  if (event.key !== "Tab") return;
  const focusable = [...cartEl.querySelectorAll("button:not([disabled])")].filter((el) => el.offsetParent);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

/* Opening: a tray of twelve with the lid pulled halfway */
const hero = $("[data-hero-tray]");
hero.classList.add("tray", "tray--hero");
buildTray(hero, {
  size: 12,
  slots: ["pistoccheddus", "amaretti", "gueffus", "pardulas", "bianchini", "tiliccas", "pabassinas", "candelaus", "amaretti", "pardulas", "pistoccheddus", "gueffus"],
  interactive: false,
  closed: true,
});

renderSweets();
renderTray();
renderCart();
