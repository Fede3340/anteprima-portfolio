(() => {
  const SHOP = {
    name: 'Tre Fili',
    title: document.title,
    ship: 490,
    freeFrom: 4000,
    payNote: 'Pagamento finto: niente viene addebitato.',
    products: [
      { id: 'vasetto-piccolo', name: 'Vasetto piccolo', sub: '0,25 g di fili interi', price: 700, img: 'p1.webp', grams: '0,25 g',
        alt: 'Un vasetto di vetro piccolo col tappo di sughero, pieno di fili rossi di zafferano',
        text: ['Il vasetto per provarlo. Vetro trasparente e tappo di sughero: i fili si vedono interi, dal primo all’ultimo.'],
        specs: [['Peso dei fili', '0,25 g'], ['Contenitore', 'vetro, tappo di sughero'], ['Sull’etichetta', 'posto e anno di raccolta']] },
      { id: 'vasetto', name: 'Vasetto', sub: '0,5 g di fili interi', price: 1300, img: 'p2.webp', grams: '0,5 g',
        alt: 'Un vasetto di vetro col coperchio viola, pieno di fili rossi di zafferano',
        text: ['Il vasetto di casa, col coperchio viola che si richiude bene. Tienilo al buio e all’asciutto.'],
        specs: [['Peso dei fili', '0,5 g'], ['Contenitore', 'vetro, coperchio a vite'], ['Sull’etichetta', 'posto e anno di raccolta']] },
      { id: 'vasetto-grande', name: 'Vasetto grande', sub: '1 g di fili interi', price: 2400, img: 'p3.webp', grams: '1 g',
        alt: 'Un vasetto di vetro largo col coperchio viola, pieno di fili di zafferano, con qualche filo sparso davanti',
        text: ['Per chi lo usa spesso, o per dividerlo con qualcuno. È il prezzo al grammo più basso del negozio.'],
        specs: [['Peso dei fili', '1 g'], ['Contenitore', 'vetro, coperchio a vite'], ['Sull’etichetta', 'posto e anno di raccolta']] },
      { id: 'tre-vasetti', name: 'Tre vasetti piccoli', sub: '3 × 0,25 g, in scatola', price: 1990, img: 'p4.webp', grams: '0,75 g',
        alt: 'Una scatola di cartone aperta con tre vasetti piccoli di zafferano su carta velina viola',
        text: ['Tre vasetti piccoli in una scatola di cartone, sulla carta velina viola. Si regalano interi o uno per volta.'],
        specs: [['Peso dei fili', '3 × 0,25 g'], ['Contenitore', 'scatola di cartone'], ['Sull’etichetta', 'posto e anno di raccolta']] },
      { id: 'bulbi', name: 'Bulbi di croco', sub: '10 bulbi da piantare', price: 900, img: 'p5.webp', grams: '10 bulbi',
        alt: 'Un sacchetto di carta aperto pieno di bulbi di croco, con tre bulbi sul piano accanto',
        text: ['I bulbi del nostro campo, per avere i fiori in vaso o in giardino e separare i fili da te.'],
        specs: [['Quantità', '10 bulbi'], ['Confezione', 'sacchetto di carta'], ['Pianta', 'Crocus sativus']] },
    ],
    cardExtra: (p) => `<p class="card-grams">${p.grams}</p>`,
    init() {
      const btn = document.querySelector('[data-pick]');
      const threads = document.querySelector('[data-threads]');
      const jar = document.querySelector('[data-jar-threads]');
      const flowers = document.querySelector('[data-pick-flowers]');
      const count = document.querySelector('[data-pick-threads]');
      const ns = 'http://www.w3.org/2000/svg';
      let n = 0;
      let busy = false;
      btn.addEventListener('click', () => {
        if (busy) return;
        busy = true;
        threads.classList.add('is-picked');
        setTimeout(() => {
          n += 1;
          flowers.textContent = n;
          count.textContent = n * 3;
          // Three loose threads settle at the bottom of the jar, the pile grows with each flower.
          for (let i = 0; i < 3; i++) {
            const y = 132 - Math.min(n, 30) * 2.6 + Math.random() * 10;
            const x = -34 + Math.random() * 62;
            const a = (Math.random() - 0.5) * 1.6;
            const line = document.createElementNS(ns, 'path');
            line.setAttribute('d', `M${x} ${y}q${8 * Math.cos(a)} ${-4} ${16 * Math.cos(a)} ${16 * Math.sin(a)}`);
            line.setAttribute('stroke', '#c23a17');
            line.setAttribute('stroke-width', '2.4');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('fill', 'none');
            jar.appendChild(line);
          }
          threads.classList.add('is-gone');
          threads.classList.remove('is-picked');
          requestAnimationFrame(() => requestAnimationFrame(() => { threads.classList.remove('is-gone'); busy = false; }));
        }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700);
      });
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
