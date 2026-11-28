const WINES = [
  { id: "gatto-2023", group: "Bottiglie", name: "Il Gatto", vintage: "2023", grape: "carignano", abv: "14%", size: "75 cl", price: 1900, kind: "bottle", scale: 1,
    note: "Il rosso di ogni sera: frutto scuro, morbido, tannino leggero." },
  { id: "gatto-2021", group: "Bottiglie", name: "Il Gatto", vintage: "2021", grape: "carignano", abv: "14,5%", size: "75 cl", price: 2700, kind: "bottle", scale: 1,
    note: "Due anni in più in bottiglia prima di uscire: più profondo, più lento." },
  { id: "mezza", group: "Formati", name: "Mezza bottiglia", vintage: "2023", grape: "carignano", abv: "14%", size: "37,5 cl", price: 1100, kind: "bottle", scale: 0.74,
    note: "Lo stesso vino del 2023, per una cena in due." },
  { id: "magnum", group: "Formati", name: "Magnum", vintage: "2022", grape: "carignano", abv: "14%", size: "150 cl", price: 4600, kind: "bottle", scale: 1.22,
    note: "Due bottiglie in una, per una tavola lunga." },
  { id: "scatola", group: "Casse e regali", name: "Scatola nera", vintage: "2023", grape: "carignano", abv: "14%", size: "75 cl", price: 2500, kind: "box", scale: 0.86,
    note: "Una bottiglia 2023 nella sua scatola nera, con gli occhi d’oro sul coperchio." },
  { id: "cassa-sei", group: "Casse e regali", name: "Cassa da sei", vintage: "2023", grape: "carignano", abv: "14%", size: "6 × 75 cl", price: 10200, kind: "crate", scale: 0.6, crate: "sei bottiglie · 2023",
    note: "Sei bottiglie 2023: 12 € in meno che prese una a una." },
  { id: "cassa-mista", group: "Casse e regali", name: "Cassa mista", vintage: "2023/21", grape: "carignano", abv: "14/14,5%", size: "6 × 75 cl", price: 12500, kind: "crate", scale: 0.6, crate: "tre 2023 · tre 2021",
    note: "Tre 2023 e tre 2021, per sentire che cosa fanno due anni. 13 € in meno." },
];

const SERVE = "16–18 °C, aperto mezz’ora prima";
const PAIRING = "carne alla brace, formaggi stagionati, pasta al sugo di carne";
const FREE_FROM = 6000;
const SHIPPING = 990;

const byId = new Map(WINES.map((wine) => [wine.id, wine]));
const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const price = (cents) => money.format(cents / 100);
const fullName = (wine) => `${wine.name} ${wine.vintage}`;
const wide = matchMedia("(min-width: 1024px)");
const still = matchMedia("(prefers-reduced-motion: reduce)");

/* Drawings */

const label = (x, y, w, vintage) => {
  const h = w * 2.05;
  const at = (dx, dy) => `${+(x + w * dx).toFixed(2)} ${+(y + w * dy).toFixed(2)}`;
  return `
    <path class="d-paper" d="M${at(0, 2.05)}V${y + w * 0.3}C${at(0, 0.14)} ${at(0.05, 0.05)} ${at(0.1, 0)}C${at(0.16, 0.1)} ${at(0.26, 0.24)} ${at(0.36, 0.24)}H${x + w * 0.64}C${at(0.74, 0.24)} ${at(0.84, 0.1)} ${at(0.9, 0)}C${at(0.95, 0.05)} ${at(1, 0.14)} ${at(1, 0.3)}V${y + h}Z"/>
    <circle class="d-eye" cx="${x + w * 0.35}" cy="${y + w * 0.62}" r="${w * 0.032}"/>
    <circle class="d-eye" cx="${x + w * 0.65}" cy="${y + w * 0.62}" r="${w * 0.032}"/>
    <text class="d-name" x="${x + w / 2}" y="${y + h - w * 0.36}" font-size="${w * 0.2}">Il Gatto</text>
    <text class="d-small" x="${x + w / 2}" y="${y + h - w * 0.22}" font-size="${w * 0.058}" letter-spacing="${w * 0.02}">VINO ROSSO</text>
    <text class="d-small" x="${x + w / 2}" y="${y + h - w * 0.1}" font-size="${w * 0.07}">${vintage}</text>`;
};

const bottle = (wine) => `
  <svg viewBox="0 0 200 600" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${fullName(wine)}, ${wine.size}">
    <path class="d-glass" d="M86 22h28v140c0 40 36 46 36 92v318c0 6-4 10-10 10H60c-6 0-10-4-10-10V254c0-46 36-52 36-92Z"/>
    <rect class="d-cap" x="83" y="14" width="34" height="112" rx="3"/>
    <path class="d-line" d="M83 108h34"/>
    ${label(56, 286, 88, wine.vintage.slice(0, 4))}
  </svg>`;

const box = (wine) => `
  <svg viewBox="0 0 200 600" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${fullName(wine)} nella scatola">
    <path class="d-side" d="M150 120l18-18v470l-18 18Z"/>
    <path class="d-top" d="M32 120l18-18h118l-18 18Z"/>
    <rect class="d-paper" x="32" y="120" width="118" height="470"/>
    <path class="d-line" d="M32 168h118"/>
    <circle class="d-eye" cx="72" cy="230" r="3.6"/>
    <circle class="d-eye" cx="110" cy="230" r="3.6"/>
    <text class="d-name" x="91" y="520" font-size="21">Il Gatto</text>
    <text class="d-small" x="91" y="540" font-size="6" letter-spacing="2">VINO ROSSO</text>
  </svg>`;

const crate = (wine) => `
  <svg viewBox="0 0 440 300" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${fullName(wine)}, ${wine.crate}">
    <path class="d-top" d="M14 92l50-50h366l-50 50Z"/>
    <path class="d-side" d="M380 92l50-50v200l-50 50Z"/>
    <rect class="d-paper" x="14" y="92" width="366" height="200"/>
    <path class="d-line" d="M14 92h366"/>
    <circle class="d-eye" cx="166" cy="150" r="4.4"/>
    <circle class="d-eye" cx="228" cy="150" r="4.4"/>
    <text class="d-name" x="197" y="236" font-size="34">Il Gatto</text>
    <text class="d-small" x="197" y="262" font-size="9.5" letter-spacing="3">${wine.crate.toUpperCase()}</text>
  </svg>`;

const drawing = (wine) => ({ bottle, box, crate })[wine.kind](wine);

/* Carta */

const list = document.querySelector("[data-list]");
const listEyes = list.querySelector(".list-eyes");

const rowHTML = (wine) => `
  <li class="row" data-id="${wine.id}">
    <button class="row-main" type="button" aria-expanded="false" aria-controls="more-${wine.id}">
      <span class="row-name">${wine.name}</span>
      <span class="row-note">${wine.note}</span>
      <span class="row-meta">
        <span class="row-vintage">${wine.vintage}</span>
        <span class="row-grape">${wine.grape}</span>
        <span class="row-abv">${wine.abv}</span>
        <span class="row-size">${wine.size}</span>
      </span>
      <span class="row-price">${price(wine.price)}</span>
    </button>
    <div class="row-more" id="more-${wine.id}">
      <div class="row-drawing" style="--scale:${wine.scale}">${drawing(wine)}</div>
      <div class="row-actions">
        <button class="btn btn-gold" type="button" data-add="${wine.id}">Aggiungi</button>
        <button class="btn btn-line" type="button" data-sheet-open="${wine.id}">Scheda</button>
      </div>
    </div>
  </li>`;

const groups = [...new Set(WINES.map((wine) => wine.group))];
list.insertAdjacentHTML("beforeend", groups.map((group) => `
  <section class="group" aria-label="${group}">
    <h3 class="group-title">${group}</h3>
    <div class="group-head" aria-hidden="true">
      <span></span><span>annata</span><span>uva</span><span>gradi</span><span>formato</span><span>prezzo</span>
    </div>
    <ul class="rows">${WINES.filter((wine) => wine.group === group).map(rowHTML).join("")}</ul>
  </section>`).join(""));

/* Eyes that follow */

const look = (eyes, x, y, reach) => {
  const rect = eyes.getBoundingClientRect();
  const dx = x - (rect.left + rect.width / 2);
  const dy = y - (rect.top + rect.height / 2);
  const length = Math.hypot(dx, dy) || 1;
  const pull = Math.min(1, length / 300) * reach;
  eyes.style.setProperty("--look-x", `${(dx / length) * pull}px`);
  eyes.style.setProperty("--look-y", `${(dy / length) * pull}px`);
};

const blink = (eyes) => {
  if (still.matches) return;
  eyes.classList.remove("is-blinking");
  void eyes.offsetWidth;
  eyes.classList.add("is-blinking");
};

const heroEyes = document.querySelector(".hero-eyes");
const footEyes = document.querySelector(".foot-eyes");
addEventListener("pointermove", ({ pointerType, clientX, clientY }) => {
  if (pointerType !== "mouse") return;
  look(heroEyes, clientX, clientY, 7);
  look(listEyes, clientX, clientY, 2.5);
  look(footEyes, clientX, clientY, 4);
}, { passive: true });

const blinkLater = () => setTimeout(() => {
  blink(heroEyes);
  blink(footEyes);
  blinkLater();
}, 4200 + Math.random() * 4200);
blinkLater();

/* Active row and the bottle beside it */

const stage = document.querySelector("[data-stage]");
let active = null;

const stageHTML = (wine) => `
  <div class="stage-drawing" style="--scale:${wine.scale}">${drawing(wine)}</div>
  <p class="stage-name">${wine.name}</p>
  <p class="stage-line">${wine.vintage} · ${wine.size}</p>
  <div class="stage-buy">
    <button class="btn btn-gold" type="button" data-add="${wine.id}">Aggiungi · ${price(wine.price)}</button>
    <button class="btn btn-line" type="button" data-sheet-open="${wine.id}">Scheda</button>
  </div>`;

const placeStage = () => {
  if (!wide.matches) return;
  const bar = document.querySelector(".bar").offsetHeight;
  const height = stage.offsetHeight;
  const row = active && list.querySelector(`[data-id="${active}"] .row-main`);
  const rect = row?.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  stage.classList.toggle("is-away", listRect.top > innerHeight * 0.7);
  const center = rect && listRect.top < innerHeight * 0.6 ? rect.top + rect.height / 2 : (innerHeight + bar) / 2;
  const top = Math.max(bar + 16, Math.min(innerHeight - height - 24, center - height * 0.62));
  stage.style.transform = `translateY(${Math.round(top)}px)`;
};

const showOnStage = (wine) => {
  if (stage.dataset.id === wine.id) return;
  stage.dataset.id = wine.id;
  stage.classList.add("is-changing");
  setTimeout(() => {
    stage.innerHTML = stageHTML(wine);
    stage.classList.remove("is-changing");
    placeStage();
  }, still.matches ? 0 : 180);
};

const moveEyes = (row) => {
  const name = row.querySelector(".row-name");
  const top = name.offsetTop + name.offsetHeight / 2;
  listEyes.style.setProperty("--row-y", `${top}px`);
  listEyes.classList.add("is-open");
  blink(listEyes);
};

const activate = (id) => {
  if (active === id) return;
  list.querySelector(".row.is-active")?.classList.remove("is-active");
  const row = list.querySelector(`[data-id="${id}"]`);
  row.classList.add("is-active");
  active = id;
  moveEyes(row);
  showOnStage(byId.get(id));
  placeStage();
};

const expand = (row) => {
  const open = row.classList.contains("is-open");
  list.querySelectorAll(".row.is-open").forEach((other) => {
    other.classList.remove("is-open");
    other.querySelector(".row-main").setAttribute("aria-expanded", "false");
  });
  row.classList.toggle("is-open", !open);
  row.querySelector(".row-main").setAttribute("aria-expanded", String(!open));
  moveEyes(row);
};

list.addEventListener("pointerover", (event) => {
  const row = event.target.closest(".row");
  if (row && event.pointerType === "mouse" && wide.matches) activate(row.dataset.id);
});
list.addEventListener("focusin", (event) => {
  const row = event.target.closest(".row");
  if (row) activate(row.dataset.id);
});
list.addEventListener("click", (event) => {
  const main = event.target.closest(".row-main");
  if (!main) return;
  const row = main.closest(".row");
  activate(row.dataset.id);
  if (!wide.matches) expand(row);
});

let ticking = false;
addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    placeStage();
    document.body.classList.toggle("is-scrolled", scrollY > 24);
    ticking = false;
  });
}, { passive: true });
addEventListener("resize", () => {
  if (active) moveEyes(list.querySelector(`[data-id="${active}"]`));
  placeStage();
});

stage.innerHTML = stageHTML(WINES[0]);
stage.dataset.id = WINES[0].id;

/* Cart */

const cart = new Map();
const cartPanel = document.querySelector("#cart");
const cartButton = document.querySelector(".bar-cart");
const scrim = document.querySelector("[data-scrim]");
const lines = cartPanel.querySelector("[data-lines]");
const sums = cartPanel.querySelector("[data-sums]");
const fake = cartPanel.querySelector("[data-fake]");

const totals = () => {
  const subtotal = [...cart].reduce((sum, [id, qty]) => sum + byId.get(id).price * qty, 0);
  const shipping = subtotal >= FREE_FROM ? 0 : SHIPPING;
  return { subtotal, shipping, total: subtotal + shipping };
};

const renderCart = () => {
  const count = [...cart.values()].reduce((sum, qty) => sum + qty, 0);
  document.querySelector("[data-count]").textContent = count;
  cartPanel.querySelector("[data-empty]").hidden = count > 0;
  sums.hidden = count === 0;
  lines.innerHTML = [...cart].map(([id, qty]) => {
    const wine = byId.get(id);
    return `
      <li class="line">
        <div class="line-drawing" style="--scale:${wine.scale}">${drawing(wine)}</div>
        <div class="line-text">
          <p class="line-name">${fullName(wine)}</p>
          <p class="line-size">${wine.size} · ${price(wine.price)}</p>
          <div class="qty" role="group" aria-label="Quantità di ${fullName(wine)}">
            <button type="button" data-step="-1" data-id="${id}" aria-label="Una in meno">−</button>
            <output aria-live="polite">${qty}</output>
            <button type="button" data-step="1" data-id="${id}" aria-label="Una in più">+</button>
          </div>
        </div>
        <p class="line-total">${price(wine.price * qty)}</p>
      </li>`;
  }).join("");
  const { subtotal, shipping, total } = totals();
  sums.querySelector("[data-subtotal]").textContent = price(subtotal);
  sums.querySelector("[data-shipping]").textContent = shipping ? price(shipping) : "gratuita";
  sums.querySelector("[data-total]").textContent = price(total);
  sums.querySelector("[data-free]").textContent = shipping
    ? `Mancano ${price(FREE_FROM - subtotal)} alla spedizione gratuita.`
    : "La spedizione è gratuita.";
  fake.textContent = "";
};

const setCartOpen = (open) => {
  cartPanel.classList.toggle("is-open", open);
  cartPanel.toggleAttribute("inert", !open);
  cartPanel.setAttribute("aria-hidden", String(!open));
  cartButton.setAttribute("aria-expanded", String(open));
  scrim.hidden = !open;
  if (open) cartPanel.querySelector("[data-close-cart]").focus({ preventScroll: true });
};

const add = (id, qty = 1) => {
  cart.set(id, (cart.get(id) ?? 0) + qty);
  renderCart();
  setCartOpen(true);
};

lines.addEventListener("click", (event) => {
  const step = event.target.closest("[data-step]");
  if (!step) return;
  const qty = (cart.get(step.dataset.id) ?? 0) + Number(step.dataset.step);
  if (qty > 0) cart.set(step.dataset.id, qty);
  else cart.delete(step.dataset.id);
  renderCart();
});

cartButton.addEventListener("click", () => setCartOpen(!cartPanel.classList.contains("is-open")));
cartPanel.querySelector("[data-close-cart]").addEventListener("click", () => setCartOpen(false));
scrim.addEventListener("click", () => setCartOpen(false));
addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cartPanel.classList.contains("is-open")) setCartOpen(false);
});

cartPanel.querySelector("[data-pay]").addEventListener("submit", (event) => {
  event.preventDefault();
  fake.textContent = `Ordine ricevuto, grazie: totale ${price(totals().total)}.`;
});

/* Scheda */

const sheet = document.querySelector("[data-sheet]");
const sheetBody = sheet.querySelector("[data-sheet-body]");
let sheetQty = 1;

const sheetHTML = (wine) => `
  <div class="scheda-drawing" style="--scale:${wine.scale}">${drawing(wine)}</div>
  <div class="scheda-text">
    <button class="scheda-close" type="button" data-sheet-close>Chiudi</button>
    <h2 class="scheda-title" id="scheda-title">${wine.name}</h2>
    <p class="scheda-line">${wine.vintage} · ${wine.size}</p>
    <p class="scheda-note">${wine.note}</p>
    <dl class="scheda-facts">
      <div><dt>Uva</dt><dd>${wine.grape}</dd></div>
      <div><dt>Gradi</dt><dd>${wine.abv}</dd></div>
      <div><dt>Servire a</dt><dd>${SERVE}</dd></div>
      <div><dt>Con</dt><dd>${PAIRING}</dd></div>
      <div><dt>Spedizione</dt><dd>${price(SHIPPING)}, gratuita da ${price(FREE_FROM)}</dd></div>
    </dl>
    <div class="scheda-buy">
      <div class="qty" role="group" aria-label="Quantità">
        <button type="button" data-sheet-step="-1" aria-label="Una in meno">−</button>
        <output data-sheet-qty aria-live="polite">1</output>
        <button type="button" data-sheet-step="1" aria-label="Una in più">+</button>
      </div>
      <button class="btn btn-gold" type="button" data-sheet-add="${wine.id}"><span>Aggiungi · <span data-sheet-price>${price(wine.price)}</span></span></button>
    </div>
    <p class="scheda-age">Si vende solo a chi ha compiuto 18 anni.</p>
  </div>`;

const openSheet = (id) => {
  sheetQty = 1;
  sheetBody.innerHTML = sheetHTML(byId.get(id));
  sheet.showModal();
  sheet.querySelector("[data-sheet-close]").focus({ preventScroll: true });
};

sheet.addEventListener("click", (event) => {
  if (event.target === sheet || event.target.closest("[data-sheet-close]")) return sheet.close();
  const step = event.target.closest("[data-sheet-step]");
  const addButton = event.target.closest("[data-sheet-add]");
  if (step) {
    sheetQty = Math.max(1, sheetQty + Number(step.dataset.sheetStep));
    const wine = byId.get(sheet.querySelector("[data-sheet-add]").dataset.sheetAdd);
    sheet.querySelector("[data-sheet-qty]").textContent = sheetQty;
    sheet.querySelector("[data-sheet-price]").textContent = price(wine.price * sheetQty);
  }
  if (addButton) {
    sheet.close();
    add(addButton.dataset.sheetAdd, sheetQty);
  }
});

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const sheetButton = event.target.closest("[data-sheet-open]");
  if (addButton) add(addButton.dataset.add);
  if (sheetButton) openSheet(sheetButton.dataset.sheetOpen);
});

renderCart();
document.fonts.ready.then(placeStage);
