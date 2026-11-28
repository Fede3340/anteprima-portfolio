(() => {
  const SHOP = {
    name: 'Cotta',
    title: document.title,
    ship: 990,
    freeFrom: 8000,
    payNote: 'Pagamento finto: niente viene addebitato.',
    products: [
      { id: 'tazza', name: 'Tazza', sub: '350 ml, con manico', price: 2400, img: 'p1.webp',
        alt: 'Una tazza al tornio, bianca di smalto sopra e terracotta cruda sotto, con una goccia di smalto colata',
        text: ['La tazza della colazione. Il manico è tirato a mano e attaccato quando la terra è ancora morbida.'],
        specs: [['Capienza', '350 ml'], ['Altezza', '10 cm'], ['Lavaggio', 'a mano']] },
      { id: 'ciotola', name: 'Ciotola', sub: 'Ø 15 cm', price: 2200, img: 'p2.webp',
        alt: 'Una ciotola al tornio smaltata di bianco dentro e sopra, col piede in terracotta e una goccia di smalto',
        text: ['Per il latte, la frutta, la zuppa. Smaltata tutta dentro, fuori solo fin dove l’abbiamo immersa.'],
        specs: [['Diametro', '15 cm'], ['Altezza', '7 cm'], ['Lavaggio', 'a mano']] },
      { id: 'piatto-piano', name: 'Piatto piano', sub: 'Ø 26 cm', price: 2800, img: 'p3.webp',
        alt: 'Un piatto piano smaltato di bianco con un sottile bordo di terracotta cruda',
        text: ['Lo smalto si ferma poco prima del bordo e lascia una riga di terracotta tutto intorno.'],
        specs: [['Diametro', '26 cm'], ['Altezza', '2,5 cm'], ['Lavaggio', 'a mano']] },
      { id: 'piatto-fondo', name: 'Piatto fondo', sub: 'Ø 22 cm', price: 2800, img: 'p4.webp',
        alt: 'Un piatto fondo con le pareti alte, bianco dentro e terracotta sotto la riga dello smalto',
        text: ['Pareti alte per la pasta e le minestre. Il piede crudo non scivola sulla tovaglia.'],
        specs: [['Diametro', '22 cm'], ['Altezza', '6 cm'], ['Lavaggio', 'a mano']] },
      { id: 'brocca', name: 'Brocca', sub: '1 litro, col beccuccio', price: 4800, img: 'p5.webp',
        alt: 'Una brocca al tornio col beccuccio pizzicato, bianca di smalto in alto e terracotta cruda in basso',
        text: ['Il beccuccio è pizzicato con le dita. Per l’acqua in tavola, o per i fiori.'],
        specs: [['Capienza', '1 litro'], ['Altezza', '22 cm'], ['Lavaggio', 'a mano']] },
    ],
    init() {
      const range = document.querySelector('[data-dip]');
      const glaze = document.querySelector('[data-glaze]');
      const above = document.querySelector('[data-above]');
      // The glaze line wobbles a little and one drip hangs from it; its place changes with the depth.
      const draw = () => {
        const depth = Number(range.value) / 100;
        const y = 40 + depth * 190;
        const dx = 80 + (Number(range.value) * 37) % 90;
        glaze.setAttribute('d', `M50 30H230V${y - 3}C200 ${y + 4} 170 ${y - 5} ${dx + 14} ${y}C${dx + 8} ${y + 1} ${dx + 6} ${y + 20} ${dx} ${y + 20}S${dx - 6} ${y + 2} ${dx - 10} ${y}C110 ${y - 4} 80 ${y + 5} 50 ${y}Z`);
        above.setAttribute('height', y);
        range.setAttribute('aria-valuetext', `immersa per il ${range.value} per cento`);
      };
      range.addEventListener('input', draw);
      draw();
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
