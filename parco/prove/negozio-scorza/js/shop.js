(() => {
  const grams = (g) => (g >= 1000 ? `${(g / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg` : `${g} g`);
  const SCALE_MAX = 2000;

  const SHOP = {
    name: 'Scorza',
    title: document.title,
    ship: 690,
    freeFrom: 6000,
    payNote: 'Pagamento finto: niente viene addebitato.',
    products: [
      { id: 'sottopentola', name: 'Sottopentola tondo', sub: 'Ø 20 cm, bordo di scorza', price: 1400, img: 'p1.webp', g: 160,
        alt: 'Un sottopentola tondo di sughero chiaro col bordo di corteccia scura, su un piano color sabbia',
        text: ['Un disco tagliato di traverso nella lastra: sopra il sughero liscio, sul bordo la scorza com’era sull’albero.'],
        specs: [['Misura', 'Ø 20 cm, alto 1,5 cm'], ['Peso', '160 g'], ['Pulizia', 'panno umido']] },
      { id: 'sottobicchieri', name: 'Sottobicchieri', sub: '4 pezzi, 10 × 10 cm', price: 1200, img: 'p2.webp', g: 80,
        alt: 'Quattro sottobicchieri quadrati di sughero impilati, quello in cima un po’ spostato',
        text: ['Quattro quadrati lisci con gli angoli arrotondati. Non scivolano e non segnano il tavolo.'],
        specs: [['Misura', '10 × 10 cm'], ['Pezzi', '4'], ['Peso', '80 g in tutto']] },
      { id: 'scatola', name: 'Scatola tonda', sub: 'Ø 12 cm, col coperchio', price: 2600, img: 'p3.webp', g: 140,
        alt: 'Una scatola tonda di sughero col coperchio appoggiato di traverso',
        text: ['Tornita da un blocco unico. Il coperchio entra a pressione e tiene chiuso da solo.'],
        specs: [['Misura', 'Ø 12 cm, alta 9 cm'], ['Peso', '140 g'], ['Pulizia', 'panno asciutto']] },
      { id: 'vassoio', name: 'Vassoio di scorza', sub: '40 cm, da una lastra intera', price: 3800, img: 'p4.webp', g: 380,
        alt: 'Un vassoio ovale scavato in una lastra curva di sughero, liscio dentro e con la corteccia grezza fuori',
        text: ['La lastra curva diventa un vassoio: dentro è scavata e liscia, fuori resta la corteccia. Ogni vassoio ha la forma della sua lastra.'],
        specs: [['Misura', 'circa 40 × 18 cm'], ['Peso', '380 g'], ['Nota', 'ogni pezzo è diverso']] },
      { id: 'porta-bottiglia', name: 'Porta bottiglia', sub: 'Alto 22 cm, per una bottiglia da 75 cl', price: 4500, img: 'p5.webp', g: 300,
        alt: 'Un porta bottiglia cilindrico ricavato da un pezzo di corteccia di sughero, grezzo fuori e chiaro sul bordo',
        text: ['Un pezzo di tronco di corteccia, svuotato. Ci va dentro una bottiglia da 75 cl.'],
        specs: [['Misura', 'alto 22 cm, Ø 10 cm'], ['Peso', '300 g'], ['Nota', 'ogni pezzo è diverso']] },
    ],
    cardExtra: (p) => `<p class="card-g"><span class="card-g-bar" style="--w:${(p.g / 400) * 100}%"></span>${grams(p.g)}</p>`,
    onCart(t, cart, byId) {
      let g = 0;
      cart.forEach((q, id) => { g += byId[id].g * q; });
      document.querySelector('[data-pack-weight]').textContent = grams(g);
      const a = Math.min(g, SCALE_MAX) / SCALE_MAX * 180 - 90;
      document.querySelector('[data-needle]').style.transform = `rotate(${a}deg)`;
    },
    init() {
      const ticks = document.querySelector('[data-scale-ticks]');
      ticks.innerHTML = Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI - (i / 8) * Math.PI, r1 = 84, r2 = i % 2 ? 76 : 70;
        const x = (r) => 100 + r * Math.cos(a), y = (r) => 100 - r * Math.sin(a);
        return `<line x1="${x(r1)}" y1="${y(r1)}" x2="${x(r2)}" y2="${y(r2)}"/>${i % 4 === 0 ? `<text x="${x(56)}" y="${y(56) + 4}">${i / 4} kg</text>` : ''}`;
      }).join('');
      document.querySelector('[data-weights]').innerHTML = SHOP.products.slice().sort((a, b) => a.g - b.g)
        .map((p) => `<li><a href="#p-${p.id}"><span class="w-name">${p.name}</span><span class="w-bar" style="--w:${(p.g / 400) * 100}%"></span><span class="w-g">${grams(p.g)}</span></a></li>`).join('');
    },
  };

  // Shop engine: catalogue, product page, cart. SHOP is defined above.
  const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const money = (cents) => euro.format(cents / 100);
  const $ = (sel, root = document) => root.querySelector(sel);
  const byId = Object.fromEntries(SHOP.products.map((p) => [p.id, p]));
  const cart = new Map();
  const live = $('[data-live]');
  const say = (text) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = text; }); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const picture = (p) => `<img src="img/${p.img}" width="800" height="600" alt="${esc(p.alt)}" loading="lazy" decoding="async">`;

  // Catalogue
  const grid = $('[data-grid]');
  grid.innerHTML = SHOP.products.map((p) => `
    <li class="card" id="card-${p.id}">
      <a class="card-link" href="#p-${p.id}">
        <span class="card-pic">${picture(p)}</span>
        <span class="card-name">${esc(p.name)}</span>
        <span class="card-sub">${esc(p.sub)}</span>
      </a>
      ${SHOP.cardExtra ? SHOP.cardExtra(p) : ''}
      <p class="card-foot"><span class="card-price">${money(p.price)}</span>
        <button class="card-add" type="button" data-add="${p.id}" aria-label="Aggiungi al carrello: ${esc(p.name)}">Aggiungi</button></p>
    </li>`).join('');

  // Product page
  const detail = $('[data-detail]');
  const home = $('[data-home]');
  let homeScroll = 0;
  function showDetail(id) {
    const p = byId[id];
    if (!p) return hideDetail();
    if (detail.hidden) homeScroll = window.scrollY;
    detail.innerHTML = `
      <a class="detail-back" href="#catalogo">Torna ai prodotti</a>
      <div class="detail-grid">
        <div class="detail-pic">${picture(p).replace(' loading="lazy"', '')}</div>
        <div class="detail-text">
          <h1 class="detail-name" tabindex="-1">${esc(p.name)}</h1>
          <p class="detail-sub">${esc(p.sub)}</p>
          <p class="detail-price">${money(p.price)}</p>
          ${p.text.map((t) => `<p>${esc(t)}</p>`).join('')}
          ${SHOP.detailExtra ? SHOP.detailExtra(p) : ''}
          <dl class="detail-specs">${p.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          <div class="detail-buy">
            <div class="qty" role="group" aria-label="Quantità">
              <button type="button" data-step="-1" aria-label="Uno in meno">−</button>
              <output data-qty>1</output>
              <button type="button" data-step="1" aria-label="Uno in più">+</button>
            </div>
            <button class="button detail-add" type="button" data-add="${p.id}" data-from-detail>Aggiungi al carrello</button>
          </div>
        </div>
      </div>`;
    home.hidden = true;
    detail.hidden = false;
    window.scrollTo(0, 0);
    document.title = `${p.name} · ${SHOP.name}`;
    $('.detail-name', detail).focus({ preventScroll: true });
  }
  function hideDetail() {
    if (detail.hidden) return;
    detail.hidden = true;
    home.hidden = false;
    document.title = SHOP.title;
    window.scrollTo(0, homeScroll);
  }
  function route() {
    const m = location.hash.match(/^#p-(.+)$/);
    if (m) showDetail(m[1]); else hideDetail();
  }
  window.addEventListener('hashchange', route);

  // Cart
  const drawer = $('#cart');
  const scrim = $('[data-scrim]');
  const toggle = $('.cart-toggle');
  let opener = null;
  function openCart() {
    opener = document.activeElement;
    drawer.hidden = false; scrim.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-locked');
    $('[data-cart-close]').focus();
  }
  function closeCart() {
    drawer.hidden = true; scrim.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
    resetPay();
    if (opener && opener.focus) opener.focus();
  }
  toggle.addEventListener('click', openCart);
  scrim.addEventListener('click', closeCart);
  $('[data-cart-close]').addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeCart(); });

  function add(id, n = 1) {
    cart.set(id, (cart.get(id) || 0) + n);
    renderCart();
    say(`${byId[id].name} nel carrello. Totale ${money(totals().total)}.`);
    toggle.classList.remove('is-bumped'); void toggle.offsetWidth; toggle.classList.add('is-bumped');
  }
  function setQty(id, n) {
    if (n <= 0) cart.delete(id); else cart.set(id, n);
    renderCart();
  }
  function totals() {
    let items = 0, count = 0;
    cart.forEach((q, id) => { items += byId[id].price * q; count += q; });
    const ship = count === 0 || items >= SHOP.freeFrom ? 0 : SHOP.ship;
    return { items, count, ship, total: items + ship };
  }
  function renderCart() {
    const t = totals();
    $('[data-cart-count]').textContent = t.count;
    $('[data-cart-empty]').hidden = t.count > 0;
    $('[data-cart-foot]').hidden = t.count === 0;
    $('[data-cart-lines]').innerHTML = [...cart].map(([id, q]) => {
      const p = byId[id];
      return `<li class="line">
        <img src="img/${p.img}" width="800" height="600" alt="">
        <div class="line-text"><p class="line-name">${esc(p.name)}</p><p class="line-sub">${esc(p.sub)}</p>
          <div class="qty qty--small" role="group" aria-label="Quantità di ${esc(p.name)}">
            <button type="button" data-line="${id}" data-d="-1" aria-label="Uno in meno">−</button><output>${q}</output>
            <button type="button" data-line="${id}" data-d="1" aria-label="Uno in più">+</button></div></div>
        <p class="line-price">${money(p.price * q)}</p></li>`;
    }).join('');
    $('[data-total-items]').textContent = money(t.items);
    $('[data-total-ship]').textContent = t.ship === 0 ? 'Gratis' : money(t.ship);
    $('[data-total-sum]').textContent = money(t.total);
    const free = $('[data-cart-free]');
    free.textContent = t.items >= SHOP.freeFrom ? 'La spedizione è gratis.' : `Mancano ${money(SHOP.freeFrom - t.items)} alla spedizione gratis.`;
    if (SHOP.onCart) SHOP.onCart(t, cart, byId);
  }

  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const n = addBtn.hasAttribute('data-from-detail') ? Number($('[data-qty]').textContent) : 1;
      add(addBtn.dataset.add, n);
      if (addBtn.hasAttribute('data-from-detail')) openCart();
      return;
    }
    const step = e.target.closest('[data-step]');
    if (step) {
      const out = $('[data-qty]');
      out.textContent = Math.max(1, Math.min(20, Number(out.textContent) + Number(step.dataset.step)));
      return;
    }
    const line = e.target.closest('[data-line]');
    if (line) setQty(line.dataset.line, (cart.get(line.dataset.line) || 0) + Number(line.dataset.d));
  });

  // Fake payment
  const payBtn = $('[data-cart-pay]');
  const note = $('[data-cart-note]');
  function resetPay() { note.textContent = SHOP.payNote; note.classList.remove('is-error', 'is-done'); }
  payBtn.addEventListener('click', () => {
    const problem = SHOP.beforePay ? SHOP.beforePay() : null;
    if (problem) { note.textContent = problem; note.classList.add('is-error'); say(problem); return; }
    note.textContent = `Ordine di prova da ${money(totals().total)}: in questo negozio il pagamento è finto, niente viene addebitato e niente parte.`;
    note.classList.add('is-done');
    say(note.textContent);
  });

  resetPay();
  renderCart();
  route();
  if (SHOP.init) SHOP.init();
})();
