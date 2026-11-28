(() => {
  // A ruler in centimetres: the light bar is the closed knife, the horn-coloured bar the blade that comes out.
  function ruler(r, big) {
    const max = 26;
    const W = 520, x0 = 10, cm = (W - 2 * x0) / max;
    const ticks = Array.from({ length: max + 1 }, (_, i) => {
      const x = x0 + i * cm, long = i % 5 === 0;
      return `<line x1="${x}" y1="0" x2="${x}" y2="${long ? 14 : 8}"/>${long ? `<text x="${x}" y="28">${i}</text>` : ''}`;
    }).join('');
    const closed = r.closed * cm, open = r.open * cm;
    const bars = r.blade
      ? `<rect class="r-handle" x="${x0}" y="40" width="${closed}" height="12" rx="6"/><rect class="r-blade" x="${x0 + closed}" y="42" width="${open - closed}" height="8" rx="4"/>`
      : `<rect class="r-handle" x="${x0}" y="40" width="${r.closed * cm}" height="12" rx="6"/>`;
    return `<svg class="ruler${big ? ' ruler--big' : ''}" viewBox="0 0 ${W} 60" aria-hidden="true"><g class="r-ticks">${ticks}</g>${bars}</svg>`;
  }
  const reading = (r) => r.blade ? `Lama ${r.blade} cm · chiuso ${r.closed} cm · aperto ${r.open} cm` : `Lungo ${r.closed} cm`;

  const SHOP = {
    name: 'Serra',
    title: document.title,
    ship: 990,
    freeFrom: 15000,
    payNote: '',
    products: [
      { id: 'corno-8', name: 'Coltello da tasca, corno', sub: 'Lama 8 cm, manico in corno di montone', price: 12000, img: 'p1.webp', r: { blade: 8, closed: 11, open: 19 },
        alt: 'Un coltello a serramanico aperto con la lama a foglia e il manico di corno color miele, su ardesia scura',
        text: ['Il più piccolo, quello da tenere sempre in tasca. Il corno di montone è caldo in mano e ogni manico ha le sue venature.'],
        specs: [['Lama', '8 cm, acciaio'], ['Manico', 'corno di montone, ottone'], ['Chiuso', '11 cm'], ['Aperto', '19 cm']] },
      { id: 'olivastro-10', name: 'Coltello da tasca, olivastro', sub: 'Lama 10 cm, manico in olivastro', price: 13500, img: 'p2.webp', r: { blade: 10, closed: 13, open: 23 },
        alt: 'Un coltello a serramanico aperto col manico in legno di olivastro venato e le ghiere d’ottone, su ardesia scura',
        text: ['Il legno di olivastro ha venature scure che non si ripetono mai. È il coltello da tavola e da campagna.'],
        specs: [['Lama', '10 cm, acciaio'], ['Manico', 'olivastro, ottone'], ['Chiuso', '13 cm'], ['Aperto', '23 cm']] },
      { id: 'corno-11', name: 'Coltello grande, corno', sub: 'Lama 11 cm, manico in corno di montone', price: 16500, img: 'p3.webp', r: { blade: 11, closed: 14, open: 25 },
        alt: 'Un coltello chiuso col manico lungo di corno scuro e i puntali d’ottone, su ardesia scura',
        text: ['Il manico lungo riempie la mano. Da chiuso la lama sparisce del tutto nel corno.'],
        specs: [['Lama', '11 cm, acciaio'], ['Manico', 'corno di montone, ottone'], ['Chiuso', '14 cm'], ['Aperto', '25 cm']] },
      { id: 'fodero', name: 'Fodero in cuoio', sub: 'Per coltelli chiusi fino a 14 cm', price: 3500, img: 'p4.webp', r: { closed: 15 },
        alt: 'Un fodero di cuoio cucito a mano con un coltello col manico di corno infilato a metà',
        text: ['Cuoio conciato al vegetale, cucito a mano. Protegge la tasca e il coltello.'],
        specs: [['Materiale', 'cuoio al vegetale'], ['Cucitura', 'a mano'], ['Lunghezza', '15 cm']] },
      { id: 'pietra', name: 'Pietra per affilare', sub: 'Su base di olivastro', price: 2800, img: 'p5.webp', r: { closed: 15 },
        alt: 'Una pietra per affilare grigio azzurra, bagnata, appoggiata su una base di legno d’olivastro',
        text: ['Per ravvivare il filo a casa tra una riaffilatura e l’altra. Si bagna con acqua prima di usarla.'],
        specs: [['Misura', '15 × 5 cm'], ['Base', 'olivastro'], ['Uso', 'con acqua']] },
    ],
    cardExtra: (p) => `<div class="card-ruler">${ruler(p.r)}<p class="card-read">${reading(p.r)}</p></div>`,
    detailExtra: (p) => `<div class="detail-ruler">${ruler(p.r, true)}<p class="card-read">${reading(p.r)}</p></div>`,
    beforePay() {
      return document.querySelector('[data-age]').checked ? null : 'Per comprare un coltello conferma di avere almeno 18 anni.';
    },
    init() {
      const box = document.querySelector('[data-pick-ruler]');
      const read = document.querySelector('[data-pick-read]');
      const buttons = [...document.querySelectorAll('[data-pick]')];
      const knives = SHOP.products.filter((p) => p.r.blade);
      const show = (blade) => {
        const p = knives.find((k) => k.r.blade === blade);
        box.innerHTML = ruler(p.r, true);
        read.textContent = `${p.name}: ${reading(p.r)}`;
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.pick) === blade)));
        const bar = box.querySelector('.r-blade');
        bar.classList.add('is-opening');
        requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.remove('is-opening')));
      };
      buttons.forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.pick))));
      show(8);
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

  // Payment
  const payBtn = $('[data-cart-pay]');
  const note = $('[data-cart-note]');
  function resetPay() { note.textContent = SHOP.payNote; note.classList.remove('is-error', 'is-done'); }
  payBtn.addEventListener('click', () => {
    const problem = SHOP.beforePay ? SHOP.beforePay() : null;
    if (problem) { note.textContent = problem; note.classList.add('is-error'); say(problem); return; }
    note.textContent = `Ordine ricevuto, grazie: totale ${money(totals().total)}.`;
    note.classList.add('is-done');
    say(note.textContent);
  });

  resetPay();
  renderCart();
  route();
  if (SHOP.init) SHOP.init();
})();
